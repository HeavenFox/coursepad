package conduit

import (
	"io/ioutil"
	"net/http"
	"path"
	"coursepad/server/common"
	"strconv"
	"strings"
)

var template = ""

func ConduitHandler(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	data := r.PostForm.Get("data")

	if template == "" {
		tp, err := ioutil.ReadFile(path.Join(*common.DATA_LOCATION, "conduit", "index.html"))
		if err != nil {
			panic(err)
		}
		template = string(tp)
	}

	result := strings.Replace(template, "'<DATA>'", strconv.QuoteToASCII(data), 1)

	w.Write([]byte(result))
}
