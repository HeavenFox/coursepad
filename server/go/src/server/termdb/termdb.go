package termdb

import (
	"encoding/json"
	"flag"
	"github.com/zenazn/goji/web"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"regexp"
	"server/common/httpcache"
	"strconv"
	"strings"
	"sync"
	"syscall"
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
	Roster              []CourseJson
	titleIndex          []IndexItem
	courseNumberIndex   map[string][]*CourseJson
	classNumberIndex    map[int]*ClassComponentJson
	classNumberToCourse map[int]*CourseJson
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

func (c CourseJson) CourseKey() string {
	return c.Subject + " " + strconv.Itoa(c.Number)
}

func (db TermDatabaseJson) GetCourseByClassNumber(classNo int) (*CourseJson, bool) {
	r, ok := db.classNumberToCourse[classNo]
	return r, ok
}

func (db TermDatabaseJson) GetComponentByClassNumber(classNo int) (*ClassComponentJson, bool) {
	r, ok := db.classNumberIndex[classNo]
	return r, ok
}

func IsValidTerm(term string) bool {
	_, ok := Get(term)
	return ok
}

func (db *TermDatabaseJson) LoadJson(dat []byte) error {
	err := json.Unmarshal(dat, db)
	if err != nil {
		return err
	}
	db.courseNumberIndex = make(map[string][]*CourseJson)
	db.classNumberIndex = make(map[int]*ClassComponentJson)
	db.classNumberToCourse = make(map[int]*CourseJson)
	db.titleIndex = make([]IndexItem, 0)

	cache := make(map[string]bool)
	for i, course := range db.Roster {
		for _, sections := range course.Sections {
			for j, section := range sections {
				db.classNumberIndex[section.ClassNumber] = &sections[j]
				db.classNumberToCourse[section.ClassNumber] = &db.Roster[i]
			}
		}

		// Title Index
		course_key := course.CourseKey()

		db.courseNumberIndex[course_key] = append(db.courseNumberIndex[course_key], &db.Roster[i])

		if _, ok := cache[course_key]; !ok {
			cache[course_key] = true
			item := IndexItem{
				Title:   course.Subject + strconv.Itoa(course.Number) + ": " + course.Title,
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

type TermDBRepository struct {
	DB   map[string]*TermDatabaseJson
	Lock sync.RWMutex
}

var repo = TermDBRepository{DB: make(map[string]*TermDatabaseJson)}

func Get(term string) (*TermDatabaseJson, bool) {
	repo.Lock.RLock()
	defer repo.Lock.RUnlock()
	val, ok := repo.DB[term]
	return val, ok
}

type MetaInfo struct {
	RosterTime map[string]int `json:"roster_time"`
}

var termdbLocation *string

func init() {
	termdbLocation = flag.String("termdbpath", "", "TermDB Data Dir Location")
}

func loadDatabase() error {
	metaJson, err := ioutil.ReadFile(path.Join(*termdbLocation, "data_index", "meta.json"))
	if err != nil {
		return err
	}
	meta := MetaInfo{}
	err = json.Unmarshal(metaJson, &meta)
	if err != nil {
		return err
	}

	repo.Lock.Lock()
	defer repo.Lock.Unlock()
	for term, time := range meta.RosterTime {
		db := new(TermDatabaseJson)
		content, err := ioutil.ReadFile(path.Join(*termdbLocation, "data", "termdb_"+term+"_"+strconv.Itoa(time)+".json"))
		if err != nil {
			return err
		}
		if err := db.LoadJson(content); err != nil {
			return err
		}
		repo.DB[term] = db
	}
	return nil
}

func InitTermDatabase() error {
	err := loadDatabase()
	if err != nil {
		return err
	}

	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, syscall.SIGHUP)
		for {
			<-c
			err := loadDatabase()
			if err != nil {
				log.Println("ERROR: Error reloading termdb. " + err.Error())
			} else {
				log.Println("Term Database Reloaded")
			}
		}
	}()

	return nil
}

func BasketHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	httpcache.CachePublic(w, 5*60)
	r.ParseForm()

	db, ok := Get(c.URLParams["term"])
	if !ok {
		w.WriteHeader(404)
		return
	}

	var basket string
	if classes := r.Form["classes"]; len(classes) >= 1 {
		basket = strings.Join(classes, "|")
	} else {
		panic("No Query")
	}
	data, err := json.Marshal(db.GetBasket(strings.Split(basket, "|")))
	if err != nil {
		panic("Unknown")
	}
	w.Write(data)
}

func SearchHandler(c web.C, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	httpcache.CachePublic(w, 5*60)
	r.ParseForm()

	db, ok := Get(c.URLParams["term"])
	if !ok {
		w.WriteHeader(404)
		return
	}

	var query string
	if queries := r.Form["q"]; len(queries) >= 1 {
		query = queries[0]
	} else {
		panic("No Query")
	}
	data, err := json.Marshal(db.SearchByKeyword(query))
	if err != nil {
		panic("Unknown")
	}
	w.Write(data)
}
