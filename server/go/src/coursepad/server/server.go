package main

import (
	"coursepad/server/sharing"
	"coursepad/server/sync"
	"coursepad/server/termdb"
	"coursepad/server/user"
	"time"

	"github.com/vharitonsky/iniflags"
	"github.com/zenazn/goji"
	"github.com/zenazn/goji/graceful"
)

func main() {
	iniflags.Parse()
	err := termdb.InitTermDatabase()
	if err != nil {
		panic(err)
	}

	graceful.Timeout(30 * time.Second)

	goji.Get("/endpoints/termdb/:term/search", termdb.SearchHandler)
	goji.Get("/endpoints/termdb/:term/basket", termdb.BasketHandler)

	goji.Post("/endpoints/user/signin/:method", user.UserSigninHandler)
	// goji.Post("/endpoints/user/register", user.UserRegistrationHandler)
	goji.Get("/endpoints/user/session", user.BundleFromSessionHandler)
	goji.Post("/endpoints/user/refreshsession", user.RefreshSessionHandler)

	goji.Post("/endpoints/sharing/share", sharing.ShareHandler)
	goji.Get("/endpoints/sharing/shared/:slug", sharing.GetSharedHandler)

	goji.Handle("/endpoints/sync/websocket", sync.SyncSocketHandler)
	goji.Get("/endpoints/sync/schedule/:term", sync.GetScheduleHandler)

	goji.Get("/shared/:slug/image.png", sharing.GetSharedImageHandler)
	goji.Get("/shared/:slug", sharing.SharedPageHandler)

	goji.Serve()
}
