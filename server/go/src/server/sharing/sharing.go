package sharing

import (
	"encoding/json"
	"github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"math/rand"
	"net/http"
	"server/common/db"
	"server/common/httperror"
	"server/termdb"
	"server/user"
	"time"
)

type ShareResponse struct {
	Url string `json:"url"`
}

type GetSharedResponse struct {
	Term     string           `json:"term"`
	Schedule *json.RawMessage `json:"schedule"`
}

func GetSharedHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	key := c.URLParams["slug"]
	conn := db.GetPostgresConn()

	var term string
	var schedule []byte

	if err := conn.QueryRow("SELECT term, schedule FROM shared WHERE slug = $1", key).Scan(&term, &schedule); err != nil {
		httperror.NotFound(w, httperror.ErrorMsgToJson("Schedule does not exist"))
	} else {
		raw := json.RawMessage(schedule)
		response, err := json.Marshal(GetSharedResponse{Term: term, Schedule: &raw})
		if err != nil {
			panic(err)
		}
		w.Write(response)
	}

}

func ShareHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	id, err := user.GetUserIdForHeader(r)
	if err != nil {
		panic(err)
	}

	r.ParseForm()
	term := r.PostForm.Get("term")
	if !termdb.IsValidTerm(term) {
		httperror.Malformed(w, "")
		return
	}

	shareJson := r.PostForm.Get("schedule")

	conn := db.GetPostgresConn()

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	const sluglen = 12
	var slug string

	retries := 3
	for {
		result := make([]byte, sluglen)
		for i := range result {
			result[i] = chars[rand.Intn(len(chars))]
		}
		slug = string(result)
		_, err := conn.Exec("INSERT INTO shared (slug, author, term, schedule, created) VALUES ($1, $2, $3, $4, $5)",
			slug,
			id,
			term,
			shareJson,
			time.Now().Unix())

		if err == nil {
			break
		}

		switch err.(*pq.Error).Code[0:2] {
		case "23":
			retries--
			if retries < 0 {
				panic(err)
			}
			continue
		case "22":
			httperror.Malformed(w, "")
			return
		default:
			panic(err)
		}
	}

	resp := ShareResponse{"http://coursepadtest.me/shared/" + string(slug)}
	data, err := json.Marshal(resp)
	if err != nil {
		panic(err)
	}

	w.Write(data)
}
