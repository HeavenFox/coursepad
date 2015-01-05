package user

import (
	"crypto/md5"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/garyburd/redigo/redis"
	_ "github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"golang.org/x/crypto/bcrypt"
	"io/ioutil"
	"net/http"
	"net/url"
	"server/common/db"
	"server/common/httperror"
	"strconv"
	"strings"
	"time"
)

const SESSION_TIMEOUT_EPHEMERAL = 7200

func mustMarshal(v interface{}) []byte {
	r, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return r
}

func GetUserIdForHeader(r *http.Request) (int, error) {
	sessionIdString := r.Header.Get("Authorization")
	if sessionIdString == "" {
		return 0, errors.New("Not Logged In")
	}

	return GetUserIdForSession(sessionIdString)
}

func GetUserIdForSession(s string) (int, error) {
	redisConn := redisPool.Get()
	defer redisConn.Close()

	v, err := redis.String(redisConn.Do("GET", rediskeyForUserId(SessionId(s))))
	if err != nil {
		return 0, err
	} else {
		return strconv.Atoi(v)
	}
}

var redisPool = redis.Pool{
	MaxIdle:     3,
	IdleTimeout: 240 * time.Second,
	Dial: func() (redis.Conn, error) {
		c, err := redis.Dial("tcp", ":6379")
		if err != nil {
			return nil, err
		}
		return c, err
	},
}

type UserBundle struct {
	Id             int32   `json:"id"`
	Slug           *string `json:"slug"`
	Name           string  `json:"name"`
	ProfilePicture string  `json:"profile_picture"`
}

type fqlError struct {
	Message string
	Type    string
	Code    int
}

type fqlUserResult struct {
	Id    string
	Name  string `json:"name"`
	Error *fqlError
}

type SessionId string

func makeSessionId() SessionId {
	bits := make([]byte, 16)
	_, err := rand.Read(bits)
	if err != nil {
		panic("cannot get random bits")
	}
	return SessionId(hex.EncodeToString(bits))
}

func facebookProfilePicture(fbid string) string {
	return "https://graph.facebook.com/v2.2/" + fbid + "/picture"
}

func rediskeyForUserId(s SessionId) string {
	return "session:" + string(s) + ":uid"
}

type fqlSingleFriend struct {
	Name string
	Id   string
}

type fqlPaging struct {
	next     *string
	previous *string
}

type fqlFriendResponse struct {
	Data   []fqlSingleFriend
	Error  *fqlError
	Paging *fqlPaging
}

func MakeSession(bundle *UserBundle, expire int) SessionId {

	redisConn := redisPool.Get()
	defer redisConn.Close()
	sessionId := makeSessionId()

	redisKey := rediskeyForUserId(sessionId)

	_, err := redisConn.Do("SET", redisKey, strconv.Itoa(int(bundle.Id)), "EX", SESSION_TIMEOUT_EPHEMERAL)
	if err != nil {
		panic(err)
	}

	return sessionId
}

func handleEmailLogin(w http.ResponseWriter, r *http.Request) (SessionId, *UserBundle, error) {
	email := r.PostForm.Get("email")
	password := r.PostForm.Get("password")
	userBundle := &UserBundle{}
	hashedPassword := []byte{}

	noUser := false

	conn := db.GetPostgresConn()
	err := conn.QueryRow("SELECT id, password, slug, name, profile_picture FROM users WHERE email = $1", email).Scan(&userBundle.Id, &hashedPassword, &userBundle.Slug, &userBundle.Name, &userBundle.ProfilePicture)
	switch {
	case err == sql.ErrNoRows:
		noUser = true

	case err != nil:
		panic(err)
	}

	if !noUser && bcrypt.CompareHashAndPassword(hashedPassword, []byte(password)) == nil {
		session := MakeSession(userBundle, SESSION_TIMEOUT_EPHEMERAL)
		return session, userBundle, nil
	}

	return SessionId(""), nil, errors.New("Wrong Email / Password Combination")
}

func handleFacebookLogin(w http.ResponseWriter, r *http.Request) (SessionId, *UserBundle, error) {
	conn := db.GetPostgresConn()

	r.ParseForm()
	accessToken := r.Form.Get("access_token")
	query := url.Values{}
	query.Set("access_token", accessToken)

	resp, err := http.Get("https://graph.facebook.com/v2.2/me?" + query.Encode())
	if err != nil {
		return SessionId(""), nil, errors.New("Unable to communicate with Facebook")
	}

	defer resp.Body.Close()
	respData, err := ioutil.ReadAll(resp.Body)
	fqlResult := fqlUserResult{}
	err = json.Unmarshal(respData, &fqlResult)

	if err != nil {
		panic("Error parsing FQL result")
	}

	if fqlResult.Error != nil {
		return SessionId(""), nil, errors.New("Unable to authenticate with Facebook")
	}

	userBundle := &UserBundle{}

	err = conn.QueryRow("SELECT id, slug, name, profile_picture FROM users WHERE fb_uid = $1", fqlResult.Id).Scan(&userBundle.Id, &userBundle.Slug, &userBundle.Name, &userBundle.ProfilePicture)
	switch {
	case err == sql.ErrNoRows:
		var id int32
		userBundle.ProfilePicture = facebookProfilePicture(fqlResult.Id)
		userBundle.Name = fqlResult.Name
		err = conn.QueryRow("INSERT INTO users (name, profile_picture, fb_uid) VALUES ($1, $2, $3) RETURNING id",
			userBundle.Name, userBundle.ProfilePicture, fqlResult.Id).Scan(&id)
		if err != nil {
			panic(err)
		}
		userBundle.Id = id

	case err != nil:
		panic(err)
	}

	sessionId := MakeSession(userBundle, SESSION_TIMEOUT_EPHEMERAL)

	// Fetch friend list
	go func() {
		userIds := make([]string, 0)

		url := "https://graph.facebook.com/v2.2/me/friends?access_token=" + accessToken

		for {
			fqlResponse := fqlFriendResponse{}

			resp, err := http.Get(url)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			data, err := ioutil.ReadAll(resp.Body)
			if err != nil {
				return
			}

			err = json.Unmarshal(data, &fqlResponse)

			if err != nil {
				return
			}

			for _, friend := range fqlResponse.Data {
				userIds = append(userIds, friend.Id)
			}

		}

		tx, err := conn.Begin()
		if err != nil {
			return
		}
		tx.Exec("DELETE FROM fb_friends WHERE user = $1", userBundle.Id)
		for _, id := range userIds {
			tx.Exec("INSERT INTO fb_friends (user, friend_fbid) VALUES ($1, $2)", userBundle.Id, id)
		}

		tx.Commit()

	}()

	return sessionId, userBundle, nil
}

func UserRegistrationHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	r.ParseForm()

	name := r.PostForm.Get("name")
	email := r.PostForm.Get("email")
	password := r.PostForm.Get("password")
	hash := md5.Sum([]byte(strings.ToLower(strings.TrimSpace(email))))
	picture := "https://www.gravatar.com/avatar/" + hex.EncodeToString(hash[:])

	passwordHashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	if err != nil {
		panic(err)
	}

	conn := db.GetPostgresConn()

	bundle := UserBundle{
		Id:             0,
		Name:           name,
		ProfilePicture: picture,
	}

	if err := conn.QueryRow(
		"INSERT INTO users (name, email, password, profile_picture) VALUES ($1, $2, $3, $4) RETURNING id",
		name, email, passwordHashed, picture).Scan(&bundle.Id); err != nil {
		// Duplicate email
		httperror.Malformed(w, httperror.ErrorMsgToJson("Email address already registered. You may try to log in first"))
		return
	}

	result := SigninResult{
		SessionId: MakeSession(&bundle, SESSION_TIMEOUT_EPHEMERAL),
		User:      &bundle,
	}

	data, err := json.Marshal(result)
	if err != nil {
		panic(err)
	}

	w.Write(data)
}

type SigninResult struct {
	SessionId SessionId   `json:"session_id"`
	User      *UserBundle `json:"user"`
}

func UserSigninHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	var err error
	reply := SigninResult{}
	r.ParseForm()
	switch c.URLParams["method"] {
	case "fb":
		reply.SessionId, reply.User, err = handleFacebookLogin(w, r)
	case "email":
		reply.SessionId, reply.User, err = handleEmailLogin(w, r)
	}
	if err != nil {
		httperror.Unauthenticated(w, httperror.ErrorMsgToJson(err.Error()))
	}
	data, err := json.Marshal(reply)
	if err != nil {
		panic(err)
	}
	w.Write(data)
}

func BundleFromSessionHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	id, err := GetUserIdForSession(r.Form.Get("sid"))
	if err != nil {
		httperror.Unauthenticated(w, "")
		return
	}
	userBundle := &UserBundle{}

	conn := db.GetPostgresConn()
	err = conn.QueryRow("SELECT id, slug, name, profile_picture FROM users WHERE id = $1", id).Scan(&userBundle.Id, &userBundle.Slug, &userBundle.Name, &userBundle.ProfilePicture)
	switch {
	case err == sql.ErrNoRows:
		httperror.Unauthenticated(w, "")
		return

	case err != nil:
		panic(err)
	}

	w.Write(mustMarshal(userBundle))

}
