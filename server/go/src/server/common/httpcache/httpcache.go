package httpcache

import (
	"net/http"
	"strconv"
)

func CachePublic(w http.ResponseWriter, time int) {
	w.Header().Set("Cache-Control", "public, max-age="+strconv.Itoa(time))

}

func NoCache(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-cache, no-store")
}
