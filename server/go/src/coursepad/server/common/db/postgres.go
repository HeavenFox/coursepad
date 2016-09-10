package db

import (
	"database/sql"
	"flag"
	_ "github.com/lib/pq"
)

var postgres *sql.DB

var POSTGRES_USER = flag.String("postgres_user", "postgres", "Postgres User")
var POSTGRES_DB = flag.String("postgres_db", "coursepad", "Postgres DB")

func initPostgres() {
	conn, err := sql.Open("postgres", "user="+*POSTGRES_USER+" dbname="+*POSTGRES_DB+" sslmode=disable")
	if err != nil {
		panic(err)
	}

	postgres = conn
}

func GetPostgresConn() *sql.DB {
	if postgres == nil {
		initPostgres()
	}
	return postgres
}
