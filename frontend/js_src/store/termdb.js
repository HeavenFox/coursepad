var EventEmitter = require('event-emitter');
var endpoints = require('../consts/endpoints.js');
var indexeddb = require('../persist/indexeddb.js');
var meta = require('./meta.js');

var currentTermDB = null;

var Course = require('../model/Course.js');

function TermDatabase() {
    
}

/**
 * @return {Promise}
 */
TermDatabase.prototype.getCoursesBySubjectAndNumber = function(subject, number) {
    var resolvedCourses;
    return indexeddb.queryAllByIndex('roster', 'course', IDBKeyRange.only([this.term, subject, number])).then(function(courses) {
        return courses.map(function(c) {
            return new Course(c);
        });
    }).then(function(courses) {
        resolvedCourses = courses;

        return [];
    }).then(function(professors) {

        return resolvedCourses;
    });
}

/**
 * @param {String} keywords 
 * @param {Array?} increment result from previous
 */ 
TermDatabase.prototype.searchByKeyword = function(keywords, increment) {
    var results = [];
    var toSearch = increment ? increment : this.titleIndex;
    var i, j;
    var terms = keywords.toLowerCase().split(/ /).filter(function(term) {
        return term.length > 0;
    });
    for (i=0; i < toSearch.length; i++) {
        var current = toSearch[i].titleLower;
        var segments = [];
        var lastSegment = [0, -1];
        var lastLocation = 0;
        var found = true;
        for (j=0; j < terms.length; j++) {
            var curTerm = terms[j];
            var position = current.indexOf(curTerm, lastLocation);
            if (position < 0) {
                found = false;
                break;
            } else {
                if (lastSegment[1] == position) {
                    lastSegment[1] = position + curTerm.length;
                } else {
                    lastSegment = [position, position + curTerm.length];
                    segments.push(lastSegment);
                }

                lastLocation = position + curTerm.length;

            }
        }
        if (found) {
            var currentResult = increment ? toSearch[i] : $.extend({}, toSearch[i]);
            currentResult.segments = segments;
            results.push(currentResult);
        }
    }
    results.sort(function(a,b) {
        return (a.segments[0][0] - b.segments[0][0]) || a.title.localeCompare(b.title);
    });
    return results;
}

function setCurrentTerm(term) {
    if (currentTermDB !== null && currentTermDB.term === term) {
        return Promise.resolve(false);
    }

    store.ready = false;
    store.emit('readystatechange');

    var dbLoadedPromise;
    if (meta.getLocalTerms().indexOf(term) > -1) {
        dbLoadedPromise = Promise.resolve();
    } else {
        dbLoadedPromise = loadTerm(term);
    }

    return dbLoadedPromise.then(function() {
        currentTermDB = new TermDatabase();
        currentTermDB.term = term;
        currentTermDB.titleIndex = [];

        return indexeddb.queryByIndex('title_index', 'term', IDBKeyRange.only(term), function(item) {
            item.titleLower = item.title.toLowerCase();
            currentTermDB.titleIndex.push(item);
        });
    })
    .then(function() {
        meta.setSelectedTerm(term);
        store.ready = true;
        store.emit('readystatechange');
    });
}

function getCurrentTerm() {
    return currentTermDB;
}

function loadTerm(term, progress) {
    if (!progress) progress = function(){};
    // Download
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: endpoints.db('term_db_' + term + '.json'),
            beforeSend: function(jqXHR) {

            },
            error: function(jqXHR, status, error) {
                reject(status);
            },
            success: function(data) {
                indexeddb.open().then(function(db) {
                    var transaction = db.transaction(['roster', 'subjects', 'title_index'], 'readwrite');
                    var rosterStore = transaction.objectStore('roster');

                    var titleHash = Object.create(null);

                    if (data.roster) {
                        for (var i=0; i < data.roster.length; i++) {
                            var course = data.roster[i];

                            course.term = term;

                            rosterStore.add(course);

                            titleHash[course.sub + course.nbr + ': ' + course.title] = [course.sub, course.nbr]

                        }
                    }


                    var subjectsStore = transaction.objectStore('subjects');
                    if (data.subjects) {
                        for (var i=0; i < data.subjects.length; i++) {
                            var subject = data.subjects[i];

                            subject.term = term;
                            subjectsStore.add(subject);

                        }
                    }

                    var titleIndexCacheStore = transaction.objectStore('title_index');
                    for (var title in titleHash) {
                        titleIndexCacheStore.add({
                            term: term,
                            title: title,
                            course: titleHash[title]
                        });
                    }

                    transaction.oncomplete = function() {
                        meta.addLocalTerm(term);
                        progress(1);
                        resolve(true);
                    }

                    transaction.onerror = function(e) {
                        console.log("error", e);
                        reject(e);
                    }
                });
                
            },
            dataType: 'json'
        });
    });
}


var store = new EventEmitter({
    ready: false,
    setCurrentTerm: setCurrentTerm,
    getCurrentTerm: getCurrentTerm,
    loadTerm: loadTerm
});

module.exports = store;