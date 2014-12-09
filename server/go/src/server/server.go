package main

import (
	"flag"
	"github.com/vharitonsky/iniflags"
	"github.com/zenazn/goji"
	"server/sync"
	"server/termdb"
	"server/user"
)

func main() {
	fn := flag.String("termdb", "", "Term DB Location")
	iniflags.Parse()

	termdb.LoadDatabase(*fn)

	goji.Get("/endpoints/termdb/:term/search", termdb.SearchHandler)
	goji.Get("/endpoints/termdb/:term/basket", termdb.BasketHandler)
	goji.Get("/endpoints/sync", sync.Handler)

	goji.Get("/endpoints/user/signin/:method", user.UserSigninHandler)
	goji.Serve()
}
