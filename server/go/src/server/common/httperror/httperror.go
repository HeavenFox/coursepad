package httperror

import (
	"encoding/json"
	"net/http"
)

type ErrorJson struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error ErrorJson `json:"error"`
}

func ErrorMsgToJson(msg string) string {
	result, err := json.Marshal(ErrorResponse{ErrorJson{msg}})
	if err != nil {
		panic(err)
	}
	return string(result)

}

func Unauthenticated(w http.ResponseWriter, response string) {
	http.Error(w, response, 403)
}

func Malformed(w http.ResponseWriter, response string) {
	http.Error(w, response, 400)
}

func NotFound(w http.ResponseWriter, response string) {
	http.Error(w, response, 404)
}
