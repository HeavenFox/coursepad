package termdb

import (
	"encoding/json"
	"github.com/zenazn/goji/web"
	"io/ioutil"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

type ClassMeetingJson struct {
	Building   string   `json:"bldg"`
	StartDate  string   `json:"sd"`
	EndDate    string   `json:"ed"`
	StartTime  string   `json:"st"`
	EndTime    string   `json:"et"`
	Professors []string `json:"profs"`
	Pattern    int      `json:"ptn"`
}

type ClassComponentJson struct {
	Meetings    []ClassMeetingJson `json:"mt"`
	ClassNumber int                `json:"nbr"`
	Section     string             `json:"sec"`
}

type CourseJson struct {
	Id         int                             `json:"id"`
	Number     int                             `json:"nbr"`
	Sections   map[string][]ClassComponentJson `json:"secs"`
	Subject    string                          `json:"sub"`
	Title      string                          `json:"title"`
	Unit       []float32                       `json:"unit"`
	Crosslists [][2]interface{}                `json:"crosslists"`
}

type TermDatabaseJson struct {
	Roster            []CourseJson
	titleIndex        []IndexItem
	courseNumberIndex map[string][]*CourseJson
}

type IndexItem struct {
	Title          string
	TitleLowercase string
	Subject        string
	Number         int
}

type SegmentList [][2]int

type SearchResult struct {
	Title  string         `json:"title"`
	Course [2]interface{} `json:"course"`
}

func (db *TermDatabaseJson) LoadJson(dat []byte) error {
	err := json.Unmarshal(dat, db)
	if err != nil {
		return err
	}
	db.courseNumberIndex = make(map[string][]*CourseJson)
	db.titleIndex = make([]IndexItem, 0)
	cache := make(map[string]bool)
	for i, course := range db.Roster {
		course_key := course.Subject + " " + strconv.Itoa(course.Number)

		db.courseNumberIndex[course_key] = append(db.courseNumberIndex[course_key], &db.Roster[i])

		if _, ok := cache[course_key]; !ok {
			cache[course_key] = true
			item := IndexItem{
				Title:   course_key + ": " + course.Title,
				Subject: course.Subject,
				Number:  course.Number,
			}
			item.TitleLowercase = strings.ToLower(item.Title)
			db.titleIndex = append(db.titleIndex, item)
		}
	}
	return nil
}

func (db TermDatabaseJson) SearchByKeyword(keyword string) []SearchResult {
	pieces := regexp.MustCompile(" +").Split(keyword, -1)
	for i, _ := range pieces {
		pieces[i] = strings.ToLower(pieces[i])
	}
	result := make([]SearchResult, 0)
	for _, course := range db.titleIndex {
		found := true
		for _, term := range pieces {
			if !strings.Contains(course.TitleLowercase, term) {
				found = false
				break
			}
		}
		if found {
			result = append(result, SearchResult{
				Title:  course.Title,
				Course: [2]interface{}{course.Subject, course.Number},
			})
		}

	}

	return result
}

func (db TermDatabaseJson) GetBasket(basket []string) [][]*CourseJson {
	result := make([][]*CourseJson, 0, len(basket))
	for _, course := range basket {
		if c, ok := db.courseNumberIndex[course]; ok {
			result = append(result, c)
		}
	}
	return result
}

var a TermDatabaseJson

func LoadDatabase(url string) {
	js, err := ioutil.ReadFile(url)
	if err != nil {
		panic(err)
	}
	err = a.LoadJson(js)
	if err != nil {
		panic(err)
	}
}

func BasketHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	r.ParseForm()

	var basket string
	if classes := r.Form["classes"]; len(classes) >= 1 {
		basket = strings.Join(classes, "|")
	} else {
		panic("No Query")
	}
	data, err := json.Marshal(a.GetBasket(strings.Split(basket, "|")))
	if err != nil {
		panic("Unknown")
	}
	w.Write(data)
}

func SearchHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	r.ParseForm()

	var query string
	if queries := r.Form["q"]; len(queries) >= 1 {
		query = queries[0]
	} else {
		panic("No Query")
	}
	data, err := json.Marshal(a.SearchByKeyword(query))
	if err != nil {
		panic("Unknown")
	}
	w.Write(data)
}
