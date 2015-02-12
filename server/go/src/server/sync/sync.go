package sync

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"github.com/garyburd/redigo/redis"
	"github.com/gorilla/websocket"
	"github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"log"
	"math/rand"
	"net/http"
	"server/common"
	"server/common/db"
	"server/common/httperror"
	"server/user"
	"strconv"
	"strings"
	"time"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == *common.ORIGIN || strings.HasSuffix(origin, "."+*common.ORIGIN)
	},
}

type syncRequestMessage struct {
	Version  int64
	Term     string
	Schedule *json.RawMessage `json:"schedule"`
}

type redisMessage struct {
	SocketId int
	Version  int64
	Term     string
	Schedule *json.RawMessage
	ClientId int
}

type serverMessage struct {
	Action   string           `json:"action"`
	Term     string           `json:"term"`
	Version  int64            `json:"version"`
	Schedule *json.RawMessage `json:"schedule"`
	ClientId int              `json:"client_id"`
}

type getScheduleReply struct {
	Version  int64            `json:"version"`
	Schedule *json.RawMessage `json:"schedule"`
}

func GetScheduleHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	uid, err := user.GetUserIdForHeader(r)
	if err != nil {
		httperror.Unauthenticated(w, "")
		return
	}
	term := c.URLParams["term"]
	dbconn := db.GetPostgresConn()
	var schedule []byte
	var version int64
	err = dbconn.QueryRow("SELECT version, schedule FROM schedules WHERE author = $1 AND term = $2", uid, term).Scan(&version, &schedule)
	switch {
	case err == nil:
	case err == sql.ErrNoRows:
		w.Write([]byte("{}"))
		return
	case err != nil:
		panic(err)
	}

	result := getScheduleReply{
		Version:  version,
		Schedule: (*json.RawMessage)(&schedule),
	}
	resultJson, err := json.Marshal(&result)
	if err != nil {
		panic(err)
	}
	w.Write(resultJson)
}

func SyncSocketHandler(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	sid := r.Form.Get("sid")
	uid, err := user.GetUserIdForSession(sid)

	if err != nil {
		httperror.Unauthenticated(w, "")
		return
	}

	clientId, err := strconv.Atoi(r.Form.Get("clientid"))

	if err != nil {
		clientId = -1
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		panic(err)
	}

	redisSubConn, err1 := redis.Dial("tcp", ":6379")
	redisPubConn, err2 := redis.Dial("tcp", ":6379")

	if err1 != nil || err2 != nil {
		panic(err2)
	}

	defer redisSubConn.Close()
	defer redisPubConn.Close()

	pubsubKey := "pubsub:schedule:" + strconv.Itoa(uid)

	redisSub := redis.PubSubConn{redisSubConn}

	redisSub.Subscribe(pubsubKey)

	socketId := rand.Int()

	socket_chan := make(chan []byte)
	redis_chan := make(chan []byte)

	go func() {
		for {
			messageType, p, err := conn.ReadMessage()
			if err != nil {
				log.Println(err)
				close(socket_chan)
				return
			}

			if messageType == websocket.TextMessage {
				socket_chan <- p
			}
		}
	}()

	go func() {
		for {
			switch v := redisSub.Receive().(type) {
			case redis.Message:
				redis_chan <- v.Data
			case error:
				return
			}
		}
	}()

	for {
		select {
		case socket_val, more := <-socket_chan:
			if !more {
				return
			}

			switch {
			case bytes.Equal([]byte("PING"), socket_val):
				conn.WriteMessage(websocket.TextMessage, []byte("PONG"))
			default:
				request := syncRequestMessage{}
				err := json.Unmarshal(socket_val, &request)
				if err != nil {
					log.Println(err)
				}

				// Update

				dbconn := db.GetPostgresConn()

				var sqlErr error
				conflict := false
				if request.Version == 0 {
					_, err = dbconn.Exec("INSERT INTO schedules (author, term, schedule, version, last_modified) VALUES ($1, $2, $3, $4, $5)", uid, request.Term, []byte(*request.Schedule), 1, time.Now().Unix())

					switch {
					case err == nil:
					case err.(*pq.Error).Code == "23505":
						conflict = true
					case err != nil:
						sqlErr = err
					}
				} else {
					result, err := dbconn.Exec("UPDATE schedules SET version = $3 + 1, schedule = $4, last_modified = $5 WHERE author = $1 AND term = $2 AND version = $3", uid, request.Term, request.Version, []byte(*request.Schedule), time.Now().Unix())
					if err == nil {
						if rows, _ := result.RowsAffected(); rows == 0 {
							// Conflict!
							conflict = true
						}
					} else {
						sqlErr = err
					}

				}

				if sqlErr == nil {
					if conflict {
						var schedule []byte
						var version int64
						if err := dbconn.QueryRow("SELECT version, schedule FROM schedules WHERE author = $1 AND term = $2", uid, request.Term).Scan(&version, &schedule); err != nil {
							log.Println(err)
						}
						message := &serverMessage{
							Action:   "conflict",
							ClientId: clientId,
							Term:     request.Term,
							Version:  version,
							Schedule: (*json.RawMessage)(&schedule),
						}
						conn.WriteJSON(message)

					} else {
						// Send to listening clients
						message := redisMessage{
							SocketId: socketId,
							Term:     request.Term,
							Version:  request.Version + 1,
							Schedule: request.Schedule,
							ClientId: clientId,
						}
						messageJson, _ := json.Marshal(message)
						_, err := redisPubConn.Do("PUBLISH", pubsubKey, messageJson)
						if err != nil {
							log.Println(err)
						}

						ackMsg := &serverMessage{
							Action:  "ack",
							Term:    request.Term,
							Version: message.Version,
						}

						conn.WriteJSON(ackMsg)
					}
				} else {
					log.Println(sqlErr)
				}
			}

		case redis_val := <-redis_chan:
			message := redisMessage{}
			err := json.Unmarshal(redis_val, &message)
			if err == nil {
				if message.SocketId != socketId && (message.ClientId != clientId || clientId == -1) {
					reply := &serverMessage{
						Action:   "update",
						Term:     message.Term,
						Version:  message.Version,
						Schedule: message.Schedule,
						ClientId: clientId,
					}

					conn.WriteJSON(reply)
				}

			}
		}
	}
}
