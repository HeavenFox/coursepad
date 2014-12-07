package sync

import (
	"github.com/garyburd/redigo/redis"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func Handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	redisSubConn, err1 := redis.Dial("tcp", ":6379")
	redisPubConn, err2 := redis.Dial("tcp", ":6379")

	if err1 != nil || err2 != nil {
		panic(err2)
	}

	defer redisSubConn.Close()
	defer redisPubConn.Close()

	redisSub := redis.PubSubConn{redisSubConn}

	redisSub.Subscribe("content")

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
			_, err := redisPubConn.Do("PUBLISH", "content", socket_val)
			if err != nil {
				log.Println(err)
			}
		case redis_val := <-redis_chan:
			conn.WriteMessage(websocket.TextMessage, redis_val)
		}
	}

}
