package sharing

import (
	"bytes"
	"code.google.com/p/draw2d/draw2d"
	"code.google.com/p/freetype-go/freetype/truetype"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/lib/pq"
	"github.com/zenazn/goji/web"
	"html"
	"image"
	"image/color"
	"image/png"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path"
	"server/common"
	"server/common/db"
	"server/common/fb"
	"server/common/httpcache"
	"server/common/httperror"
	"server/termdb"
	"server/user"
	"strings"
	"time"
)

const (
	IMAGE_WIDTH       = 1200
	IMAGE_HEIGHT      = 630
	TOP_MARGIN        = 70
	LEFT_MARGIN       = 30
	STRIPE_HEIGHT     = 60
	STRIPE_TOP_MARGIN = 10
	CLASS_WIDTH       = 130
	CLASS_GUTTER      = 10
)

type ShareResponse struct {
	Url string `json:"url"`
}

type Schedule struct {
	Basket       []string
	Sections     []int
	ColorMapping map[string]string
}

type GetSharedResponse struct {
	Term     string           `json:"term"`
	Schedule *json.RawMessage `json:"schedule"`
}

func premultiply(r, g, b uint8, a float64) color.Color {
	return color.RGBA{uint8(float64(r) * a), uint8(float64(g) * a), uint8(float64(b) * a), uint8(255 * a)}
}

var ColorPalette = map[string]color.Color{
	"pearl":      premultiply(234, 224, 200, 0.75),
	"pink":       premultiply(234, 205, 200, 0.75),
	"purple":     premultiply(234, 200, 223, 0.75),
	"lavender":   premultiply(221, 200, 234, 0.75),
	"blue":       premultiply(200, 201, 234, 0.75),
	"cyan":       premultiply(200, 234, 234, 0.75),
	"applegreen": premultiply(200, 234, 217, 0.75),
	"green":      premultiply(205, 234, 200, 0.75),
	"beryl":      premultiply(221, 234, 200, 0.75),
	"yellow":     premultiply(229, 234, 200, 0.75),
}

func strToTime(str string) float64 {
	t, err := time.Parse("03:04PM", str)
	if err != nil {
		return 0.
	}
	return float64(t.Hour()) + float64(t.Minute())/60
}

type singleMeeting struct {
	name     string
	time     string
	day      uint
	start    float64
	duration float64
	color    color.Color
}

func DrawClass(gc *draw2d.ImageGraphicContext, x, y, w, h float64, c color.Color, title, time string) {
	gc.SetFillColor(c)
	draw2d.Rect(gc, x, y, x+w, y+h)
	gc.Fill()

	gc.SetFillColor(color.Black)

	gc.SetFontSize(12)
	left, top, right, _ := gc.GetStringBounds(title)
	gc.FillStringAt(title, x+w/2-(right-left)/2-left, y-top+10)

	gc.SetFontSize(10)
	left, top, right, _ = gc.GetStringBounds(time)
	gc.FillStringAt(time, x+w/2-(right-left)/2-left, y-top+10+12+5)
}

func generateImage(meetings []singleMeeting) []byte {
	fontBytes, err := ioutil.ReadFile(path.Join(*common.DATA_LOCATION, "sharing", "Roboto-Light.ttf"))
	if err != nil {
		panic(err)
	}
	defaultFont, err := truetype.Parse(fontBytes)
	if err != nil {
		panic(err)
	}

	sharing_logo_file, err := os.Open(path.Join(*common.DATA_LOCATION, "sharing", "sharing_logo.png"))
	if err != nil {
		panic(err)
	}

	sharing_logo, _, err := image.Decode(sharing_logo_file)
	if err != nil {
		panic(err)
	}

	img := image.NewRGBA(image.Rect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT))

	context := draw2d.NewGraphicContext(img)
	draw2d.Rect(context, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
	context.SetFillColor(color.RGBA{43, 43, 43, 255})
	context.Fill()

	context.Save()
	context.Translate(45, 22)
	context.DrawImage(sharing_logo)
	context.Restore()

	draw2d.Rect(context, LEFT_MARGIN, TOP_MARGIN, IMAGE_WIDTH, IMAGE_HEIGHT)
	context.SetFillColor(color.White)
	context.Fill()

	context.SetFillColor(color.RGBA{250, 250, 250, 255})
	for y := float64(TOP_MARGIN + STRIPE_TOP_MARGIN); y < IMAGE_HEIGHT; y += 2 * STRIPE_HEIGHT {
		draw2d.Rect(context, LEFT_MARGIN, y, IMAGE_WIDTH, y+STRIPE_HEIGHT)

		context.Fill()
	}

	context.SetFont(defaultFont)

	daysToShow := 5
	for _, meeting := range meetings {
		if meeting.day >= 5 {
			daysToShow = 7
			break
		}
	}

	contentWidth := daysToShow*CLASS_WIDTH + (daysToShow-1)*CLASS_GUTTER
	calendarX := float64(LEFT_MARGIN + (IMAGE_WIDTH-LEFT_MARGIN-contentWidth)/2)
	calendarY := float64(TOP_MARGIN + STRIPE_TOP_MARGIN)

	const CLASS_START = 8

	for _, meeting := range meetings {
		DrawClass(context, calendarX+float64((CLASS_WIDTH+CLASS_GUTTER)*meeting.day), calendarY+(meeting.start-CLASS_START)*STRIPE_HEIGHT, CLASS_WIDTH, meeting.duration*STRIPE_HEIGHT, meeting.color, meeting.name, meeting.time)
	}

	writer := new(bytes.Buffer)
	png.Encode(writer, img)
	return writer.Bytes()
}

func getSharedTermSchedule(key string) (string, []byte, error) {
	conn := db.GetPostgresConn()
	var term string
	var schedule []byte

	if err := conn.QueryRow("SELECT term, schedule FROM shared WHERE slug = $1", key).Scan(&term, &schedule); err != nil {
		return "", nil, err
	}

	return term, schedule, nil
}

func GetSharedImageHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")

	key := c.URLParams["slug"]

	if term, schedule, err := getSharedTermSchedule(key); err != nil {
		httperror.NotFound(w, "")
	} else {
		var shared Schedule
		if err := json.Unmarshal(schedule, &shared); err != nil {
			httperror.NotFound(w, "")
			return
		}

		curtermdb, ok := termdb.Get(term)

		if !ok {
			httperror.NotFound(w, "")
			return
		}

		splitMeetings := make([]singleMeeting, 0)

		for _, classNo := range shared.Sections {
			course, ok1 := curtermdb.GetCourseByClassNumber(classNo)
			section, ok2 := curtermdb.GetComponentByClassNumber(classNo)
			if ok1 && ok2 {
				courseNumber := course.CourseKey()

				for _, meeting := range section.Meetings {
					for i := uint(0); i < 7; i++ {
						if (meeting.Pattern & (1 << i)) > 0 {
							splitMeetings = append(splitMeetings, singleMeeting{
								name:     courseNumber,
								time:     meeting.StartTime + " - " + meeting.EndTime,
								day:      i,
								start:    strToTime(meeting.StartTime),
								duration: strToTime(meeting.EndTime) - strToTime(meeting.StartTime),
								color:    ColorPalette[shared.ColorMapping[courseNumber]],
							})
						}
					}
				}
			}
		}

		httpcache.CachePublic(w, 5*24*60*60)
		w.Write(generateImage(splitMeetings))
	}
}

func GetSharedHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	key := c.URLParams["slug"]

	if term, schedule, err := getSharedTermSchedule(key); err != nil {
		httperror.NotFound(w, httperror.ErrorMsgToJson("Schedule does not exist"))
	} else {
		raw := json.RawMessage(schedule)
		response, err := json.Marshal(GetSharedResponse{Term: term, Schedule: &raw})
		if err != nil {
			panic(err)
		}
		httpcache.CachePublic(w, 1*24*60*60)
		w.Write(response)
	}

}

func termToName(term string) (string, error) {
	var semester string
	switch term[:2] {
	case "fa":
		semester = "Fall"
	case "sp":
		semester = "Spring"
	case "su":
		semester = "Summer"
	case "wi":
		semester = "Winter"
	default:
		return "", errors.New("Invalid Semester")
	}

	return semester + " 20" + term[2:], nil

}

func SharedPageHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	key := c.URLParams["slug"]

	if term, schedule, err := getSharedTermSchedule(key); err != nil {
		httperror.NotFound(w, "")
	} else {
		var shared Schedule
		if err := json.Unmarshal(schedule, &shared); err != nil {
			httperror.NotFound(w, "")
			return
		}

		if !termdb.IsValidTerm(term) {
			httperror.NotFound(w, "")
			return
		}

		name, err := termToName(term)
		if err != nil {
			httperror.NotFound(w, "")
			return
		}

		title := name + " Schedule on CoursePad.me"
		description := "I have these courses on my " + name + " schedule: " + strings.Join(shared.Basket, ", ")
		image := *common.WEBSITE_ROOT + "shared/" + key + "/image.png"

		meta := fmt.Sprintf(`
			<meta property="og:title" content="%s" />
			<meta property="og:description" content="%s" />
			<meta property="og:site_name" content="CoursePad.me" />
			<meta property="og:image" content="%s" />
			<meta property="og:image:width" content="%d" />
			<meta property="og:image:height" content="%d" />
			<meta name="twitter:card" content="summary_large_image">
			<meta name="twitter:site" content="@CoursePadme">`,
			html.EscapeString(title), html.EscapeString(description), html.EscapeString(image), IMAGE_WIDTH, IMAGE_HEIGHT)

		indexHtml, err := ioutil.ReadFile(path.Join(*common.FRONTEND_LOCATION, "index.html"))

		if err != nil {
			panic(err)
		}

		httpcache.CachePublic(w, 5*24*60*60)
		w.Write(bytes.Replace(indexHtml, []byte("</head>"), []byte(meta+"</head>"), 1))
	}
}

func ShareHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	id, err := user.GetUserIdForHeader(r)
	if err != nil {
		panic(err)
	}

	r.ParseForm()
	term := r.PostForm.Get("term")
	if !termdb.IsValidTerm(term) {
		httperror.Malformed(w, "")
		return
	}

	shareJson := r.PostForm.Get("schedule")

	conn := db.GetPostgresConn()

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	const sluglen = 12
	var slug string

	retries := 3
	for {
		result := make([]byte, sluglen)
		for i := range result {
			result[i] = chars[rand.Intn(len(chars))]
		}
		slug = string(result)
		_, err := conn.Exec("INSERT INTO shared (slug, author, term, schedule, created) VALUES ($1, $2, $3, $4, $5)",
			slug,
			id,
			term,
			shareJson,
			time.Now().Unix())

		if err == nil {
			break
		}

		switch err.(*pq.Error).Code[0:2] {
		case "23":
			retries--
			if retries < 0 {
				panic(err)
			}
			continue
		case "22":
			httperror.Malformed(w, "")
			return
		default:
			panic(err)
		}
	}

	sharedUrl := *common.WEBSITE_ROOT + "shared/" + slug

	// Asynchronously try to prefetch shared url for Facebook
	go func() {
		resp, err := http.Get("https://graph.facebook.com/v2.2/?id=" + url.QueryEscape(sharedUrl) + "&access_token=" + url.QueryEscape(fb.AppToken()))
		if err == nil {
			resp.Body.Close()
		} else {
			log.Println(err)
		}
	}()

	resp := ShareResponse{sharedUrl}
	data, err := json.Marshal(resp)
	if err != nil {
		panic(err)
	}

	w.Write(data)
}
