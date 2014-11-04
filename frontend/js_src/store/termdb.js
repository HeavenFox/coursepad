var EventEmitter = require('event-emitter');
var endpoints = require('../consts/endpoints.js');
var indexeddb = require('../persist/indexeddb.js');
var meta = require('./meta.js');

var ajax = require('../utils/ajax.js');

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

/**
 * @return {Promise}
 */
TermDatabase.prototype.applyUpdates = function(updates) {
    var self = this;
    if (updates.term != this.term) {
        return Promise.resolve(false);
    }
    var termId = updates.term;
    this.titleIndex = [];

    var chain = indexeddb.cursorByIndex('title_index', 'term', IDBKeyRange.only(termId), function(cursor) {
        cursor.delete();
    }, 'readwrite');

    for (var i=0; i < updates.diffs.length; i++) {
        var diff = updates.diffs[i];
        if (diff['roster']) {
            chain = chain.then(function() {
                var rosterDiff = diff['roster'];
                return indexeddb.queryObjectStore('roster', function(rosterStore) {
                    var i;
                    if (rosterDiff['added']) {
                        for (i=0; i < rosterDiff['added'].length; i++) {
                            rosterDiff['added'][i].term = termId;

                            rosterStore.add(rosterDiff['added'][i]);
                        }
                    }

                    if (rosterDiff['deleted']) {
                        for (i=0; i < rosterDiff['deleted'].length; i++) {
                            rosterStore.delete(rosterDiff['deleted'][i]);
                        }
                    }

                    if (rosterDiff['modified']) {
                        for (i=0; i < rosterDiff['modified'].length; i++) {
                            rosterDiff['modified'][i].term = termId;

                            rosterStore.put(rosterDiff['modified'][i]);

                        }
                    }
                }, 'readwrite');
            })
        }

        if (diff['subjects']) {
            var subjectsDiff = diff['subjects'];

            chain = chain.then(function() {
                function hashify(diff) {
                    var result = Object.create(null);
                    if (diff) {
                        diff.forEach(function(subject) {
                            result[subject['sub']] = subject;
                        })
                    }
                    return result;
                }

                var modifiedSubDiff = hashify(subjectsDiff['modified']);
                var removedSubDiff = Object.create(null);
                if (subjectsDiff['deleted']) {
                    subjectsDiff['deleted'].forEach(function(s) {
                        removedSubDiff[s] = true;
                    });
                }

                return indexeddb.queryObjectStore('subjects', function(subjectsStore) {
                    var index = subjectsStore.index('term');

                    index.openCursor(IDBKeyRange.only(termId)).onsuccess = function(e) {
                        var cursor = e.target.result;
                        if (cursor) {
                            if (modifiedSubDiff[cursor.value['sub']]) {
                                modifiedSubDiff[cursor.value['sub']]['term'] = termId;
                                cursor.update(modifiedSubDiff[cursor.value['sub']]);
                            } else if (removedSubDiff[cursor.value['sub']]) {
                                cursor.delete();
                            }
                            cursor.continue();
                        }
                    };

                    if (subjectsDiff['added']) {
                        for (var i=0; i < subjectsDiff['added']; i++) {
                            subjectsDiff['added'][i].term = termId;
                            subjectsStore.add(subjectsDiff['added'][i]);
                        }
                    }
                }, 'readwrite');
            });
        }

        chain = chain.then(function() {
            // Set local storage
            meta.addLocalTerm(termId, diff.time);
        });
    }

    chain = chain.then(function() {
        // Rebuild Index
        var indexHash = Object.create(null);
        return indexeddb.queryObjectStore('roster', function(rosterStore) {
            rosterStore.index('term').openCursor().onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var number = cursor.value['sub'] + cursor.value['nbr'];
                    if (!(indexHash[number])) {
                        indexHash[number] = {
                            term: termId,
                            title: cursor.value['sub'] + cursor.value['nbr'] + ': ' + cursor.value['title'],
                            course: [cursor.value['sub'], cursor.value['nbr']]
                        }
                    }
                    cursor.continue();
                }
            }
        }).then(function() {
            // Insert index
            return indexeddb.queryObjectStore('title_index', function(titleIndexStore) {
                for (var i in indexHash) {
                    titleIndexStore.add(indexHash[i]);
                    indexHash[i].titleLower = indexHash[i].title.toLowerCase();
                    self.titleIndex.push(indexHash[i]);
                }
            }, 'readwrite');
        });
    }).then(null, function(e) {
        console.error('apply updates', e);
    });

    return chain;
};

function setCurrentTerm(term) {
    if (currentTermDB !== null && currentTermDB.term === term) {
        return Promise.resolve(false);
    }

    store.ready = false;
    store.emit('readystatechange');

    var dbLoadedPromise;
    if (meta.getLocalTerms().hasOwnProperty(term)) {
        dbLoadedPromise = Promise.resolve();
    } else {
        console.log("start downloading");
        dbLoadedPromise = loadTerm(term);
    }

    return dbLoadedPromise.then(function() {
        console.log("start loading");
        currentTermDB = new TermDatabase();
        currentTermDB.term = term;
        currentTermDB.titleIndex = [];

        return indexeddb.queryByIndex('title_index', 'term', IDBKeyRange.only(term), function(item) {
            item.titleLower = item.title.toLowerCase();
            currentTermDB.titleIndex.push(item);
        });
    })
    .then(function() {
        console.log("done");
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
                var titleHash = Object.create(null);

                indexeddb.queryObjectStore('roster', function(rosterStore) {
                    if (data.roster) {
                        for (var i=0; i < data.roster.length; i++) {
                            var course = data.roster[i];

                            course.term = term;

                            rosterStore.add(course);

                            titleHash[course.sub + course.nbr + ': ' + course.title] = [course.sub, course.nbr]

                        }
                    }
                }, 'readwrite').then(function() {
                    return indexeddb.queryObjectStore('subjects', function(subjectsStore) {
                        if (data.subjects) {
                            for (var i=0; i < data.subjects.length; i++) {
                                var subject = data.subjects[i];

                                subject.term = term;
                                subjectsStore.add(subject);

                            }
                        }
                    }, 'readwrite');
                }).then(function() {
                    return indexeddb.queryObjectStore('title_index', function(titleIndexCacheStore) {
                        for (var title in titleHash) {
                            titleIndexCacheStore.add({
                                term: term,
                                title: title,
                                course: titleHash[title]
                            });
                        }
                    }, 'readwrite');
                }).then(function() {
                    meta.addLocalTerm(term, data.time);
                    progress(1);
                    resolve(true);
                }).then(null, function(e) {
                    console.warn(e);
                    reject(e);
                });
            },
            dataType: 'json'
        });
    });
}

function checkForUpdates() {
    var current_term = getCurrentTerm();
    if (current_term && current_term.term) {
        var term_id = current_term.term;
        return meta.getRemoteTerms().then(function(remoteTerms) {
            var localTerms = meta.getLocalTerms();
            if (remoteTerms[term_id] > localTerms[term_id]) {
                // Need upgrade
                return ajax.getJson(endpoints.db('version_history.json')).then(function(history) {
                    var timestamps = history['term_db'][term_id];
                    var index = timestamps.indexOf(localTerms[term_id]);
                    if (index < 0) {
                        throw new Error('cannot find history')
                    }

                    var path = timestamps.slice(index);

                    var diffPromises = [];
                    for (var i=0; i < path.length-1; i++) {
                        diffPromises.push(ajax.getJson(endpoints.db('diffs/diff_termdb_' + term_id + '_' + path[i] + '_' + path[i+1] + '.json')));
                    }

                    return Promise.all(diffPromises);
                }).then(function(diffs) {
                    console.log(diffs);
                    return {term: term_id, diffs: diffs};
                }).then(null, function(e) {
                    console.warn('update check error', e);
                });
            } else {
                return false;
            }
        });
    }
    return Promise.resolve(false);
}

var store = new EventEmitter({
    ready: false,
    setCurrentTerm: setCurrentTerm,
    getCurrentTerm: getCurrentTerm,
    loadTerm: loadTerm,
    checkForUpdates: function() {
        var self = this;
        checkForUpdates().then(function(result) {
            if (result !== false) {
                self.emit('updateAvailable', result);
            }
        })
    }
});

module.exports = store;