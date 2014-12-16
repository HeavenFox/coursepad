package db

import (
	"database/sql"
	_ "github.com/lib/pq"
)

var postgres *sql.DB

func init() {
	conn, err := sql.Open("postgres", "user=zhujingsi dbname=coursepad sslmode=disable")
	if err != nil {
		panic(err)
	}

	postgres = conn
}

func GetPostgresConn() *sql.DB {
	return postgres
}
