package common

import (
	"flag"
)

var WEBSITE_ROOT = flag.String("url", "https://coursepad.me/", "Web URL")

var ORIGIN = flag.String("origin", "coursepad.me", "Allow Origin")

var DATA_LOCATION = flag.String("datapath", "", "Server Data Dir Location")
var FRONTEND_LOCATION = flag.String("frontendpath", "", "Server Data Dir Location")
