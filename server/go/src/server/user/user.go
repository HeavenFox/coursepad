package user

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/garyburd/redigo/redis"
	_ "github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"io/ioutil"
	"net/http"
	"net/url"
	"server/common/db"
	"strconv"
	"time"
)

const SESSION_TIMEOUT_EPHEMERAL = 7200

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

func handleFacebookLogin(w http.ResponseWriter, r *http.Request) (SessionId, *UserBundle, error) {
	conn := db.GetPostgresConn()

	r.ParseForm()
	accessToken := r.Form.Get("access_token")
	query := url.Values{}
	query.Set("access_token", accessToken)

	resp, err := http.Get("https://graph.facebook.com/v2.2/me?" + query.Encode())
	if err != nil {
		return SessionId(""), nil, err
	}

	defer resp.Body.Close()
	respData, err := ioutil.ReadAll(resp.Body)
	fqlResult := fqlUserResult{}
	err = json.Unmarshal(respData, &fqlResult)

	if err != nil {
		panic("Error parsing FQL result")
	}

	if fqlResult.Error != nil {
		return SessionId(""), nil, errors.New(fqlResult.Error.Message)
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

	redisConn := redisPool.Get()
	defer redisConn.Close()

	sessionId := makeSessionId()

	redisKey := rediskeyForUserId(sessionId)

	_, err = redisConn.Do("SET", redisKey, strconv.Itoa(int(userBundle.Id)), "EX", SESSION_TIMEOUT_EPHEMERAL)
	if err != nil {
		panic(err)
	}

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

type SigninResult struct {
	SessionId SessionId   `json:"session_id"`
	User      *UserBundle `json:"user"`
}

func UserSigninHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	var err error
	reply := SigninResult{}
	reply.SessionId, reply.User, err = handleFacebookLogin(w, r)
	if err != nil {
		panic(err)
	}
	data, err := json.Marshal(reply)
	if err != nil {
		panic(err)
	}
	w.Write(data)
}
