package fb

import (
	"flag"
)

var APP_ID = flag.String("fb_appid", "", "Facebook App ID")
var APP_SECRET = flag.String("fb_appsecret", "", "Facebook App Secret")

func AppToken() string {
	return *APP_ID + "|" + *APP_SECRET
}
