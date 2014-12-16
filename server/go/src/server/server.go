package main

import (
	"github.com/vharitonsky/iniflags"
	"github.com/zenazn/goji"
	"server/sharing"
	"server/sync"
	"server/termdb"
	"server/user"
)

func main() {
	iniflags.Parse()
	err := termdb.LoadDatabase()
	if err != nil {
		panic(err)
	}

	goji.Get("/endpoints/termdb/:term/search", termdb.SearchHandler)
	goji.Get("/endpoints/termdb/:term/basket", termdb.BasketHandler)
	goji.Get("/endpoints/sync", sync.Handler)

	goji.Get("/endpoints/user/signin/:method", user.UserSigninHandler)
	goji.Post("/endpoints/sharing/share", sharing.ShareHandler)
	goji.Serve()
}
