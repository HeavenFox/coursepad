package sharing

import (
	"database/sql"
	"encoding/json"
	"github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"math/rand"
	"net/http"
	"server/common/httperror"
	"server/termdb"
	"server/user"
	"time"
)

type ShareResponse struct {
	Url string `json:"url"`
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

	db, err := sql.Open("postgres", "user=zhujingsi dbname=coursepad sslmode=disable")
	if err != nil {
		panic(err)
	}

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	const sluglen = 12
	var slug string
	for {
		result := make([]byte, sluglen)
		for i := range result {
			result[i] = chars[rand.Intn(len(chars))]
		}
		slug = string(result)
		_, err := db.Exec("INSERT INTO shared (slug, author, term, schedule, created) VALUES ($1, $2, $3, $4, $5)",
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
