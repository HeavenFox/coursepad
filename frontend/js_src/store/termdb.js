var EventEmitter = require('event-emitter');
var endpoints = require('../consts/endpoints.js');
var indexeddb = require('../persist/indexeddb.js');
var meta = require('./meta.js');

var ajax = require('../utils/ajax.js');

var Course = require('../model/Course.js');

const PREFER_REMOTE = 2;
const PREFER_FASTER = 3;


var currentTermDB = null;
var currentPreference = PREFER_FASTER;

function TermDatabase() {
    
}

TermDatabase.prototype.searchIn = function(toSearch, keywords) {
    var results = [];
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
            var currentResult = $.extend({}, toSearch[i]);
            currentResult.segments = segments;
            results.push(currentResult);
        }
    }
    results.sort(function(a,b) {
        return (a.segments[0][0] - b.segments[0][0]) || a.title.localeCompare(b.title);
    });

    return results;
};

function LocalTermDatabase() {

}


LocalTermDatabase.prototype = Object.create(TermDatabase.prototype);
LocalTermDatabase.prototype.constructor = RemoteTermDatabase;

function RemoteTermDatabase() {
    
}

RemoteTermDatabase.prototype = Object.create(TermDatabase.prototype);
RemoteTermDatabase.prototype.constructor = RemoteTermDatabase;

RemoteTermDatabase.prototype.getCoursesBySubjectAndNumber = function(subject, number) {
    return this.getBasket([subject + ' ' + number]).then(function(basket) {
        if (basket.length > 0 && basket[0].length > 0) {
            return basket[0];
        }
        return [];
    });
};

RemoteTermDatabase.prototype.getBasket = function(basket) {
    var classes = basket.join('|');

    return ajax.getJson(endpoints.termdbBasket(this.term, classes)).then(function(basket) {
        basket.forEach(function(cluster) {
            cluster.forEach(function(c, i) {
                cluster[i] = new Course(c);
            });
        });

        return basket;
    });
};

RemoteTermDatabase.prototype.searchByKeyword = function(keywords) {
    var self = this;
    return ajax.getJson(endpoints.termdbSearch(this.term, keywords)).then(function(toSearch) {
        toSearch.forEach(function(item) {
            item.titleLower = item.title.toLowerCase();
        });
        return self.searchIn(toSearch, keywords);
    });
};

/**
 * @return {Promise}
 */
LocalTermDatabase.prototype.getCoursesBySubjectAndNumber = function(subject, number) {
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
};

/**
 * @return {Promise}
 */
LocalTermDatabase.prototype.getBasket = function(basket) {
    var self = this;
    return Promise.all(basket.map(function(c) {
        var split = c.split(' ');
        if (split.length != 2) {
                return null;
        }
        return self.getCoursesBySubjectAndNumber(split[0], +split[1]); 
    }))
    .then(function(clusters) {
        return clusters.filter(function(cluster) {
            return Array.isArray(cluster) && cluster.length > 0;
        });
    });
};

/**
 * @param {String} keywords
 * @return {Promise}
 */ 
LocalTermDatabase.prototype.searchByKeyword = function(keywords) {
    var results = this.searchIn(this.titleIndex, keywords);
    return Promise.resolve(results);
}

LocalTermDatabase.prototype.setTitleIndex = function(index) {
    this.titleIndex = [];
    index.index.forEach(function(item) {
        item.titleLower = item.title.toLowerCase();
        this.titleIndex.push(item);
    }, this);
};

/**
 * @return {Promise}
 */
LocalTermDatabase.prototype.applyUpdates = function(updates) {
    var self = this;
    if (updates.term != this.term) {
        return Promise.resolve(false);
    }
    var termId = updates.term;
    this.titleIndex = [];

    var titleIndexKeysToDelete = [];
    var chain = indexeddb.delete('title_typeahead_index', termId);

    for (var i=0; i < updates.diffs.length; i++) {
        (function(diff) {
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
                            for (var i=0; i < subjectsDiff['added'].length; i++) {
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
        })(updates.diffs[i]);
    }

    // Rebuild Index
    var indexHash = Object.create(null);
    var index = {term: termId, index: []};

    chain = chain.then(function() {
        return indexeddb.queryObjectStore('roster', function(rosterStore) {
            rosterStore.index('term').openCursor(IDBKeyRange.only(termId)).onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var number = cursor.value['sub'] + cursor.value['nbr'];
                    if (!(indexHash[number])) {
                        indexHash[number] = {
                            title: cursor.value['sub'] + cursor.value['nbr'] + ': ' + cursor.value['title'],
                            course: [cursor.value['sub'], cursor.value['nbr']]
                        }
                    }
                    cursor.continue();
                }
            }
        });
    })
    .then(function() {
        for (var i in indexHash) {
            index.index.push(indexHash[i]);
        }
        // Insert index
        return indexeddb.add('title_typeahead_index', index);
    })
    .then(function() {
        self.setTitleIndex(index);
    })
    .then(null, function(e) {
        console.error('Error when Applying Updates: ', e);
    });

    return chain;
};

function useLocal() {
    try {
        IDBKeyRange.only([1, 2]);
    } catch (e) {
        return false;
    }
    return window.indexedDB && !(navigator && navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') == -1);
}

function localTermDownloaded(term) {
    return meta.getLocalTerms().hasOwnProperty(term);
}

function downloadLocalTerm(term) {
    var db;
    console.log('Using indexedDB');
    var dbLoadedPromise;
    if (localTermDownloaded(term)) {
        dbLoadedPromise = Promise.resolve();
    } else {
        console.log("start downloading");
        dbLoadedPromise = loadTerm(term);
    }

    return dbLoadedPromise.then(function() {
        console.log("start loading");
        db = new LocalTermDatabase();
        db.term = term;
        db.titleIndex = [];

        return indexeddb.getByKey('title_typeahead_index', term);
    })
    .then(function(index) {
        if (index !== undefined) {
            db.setTitleIndex(index);
        }

        currentTermDB = db;

        console.log("done");
    });
}

function getRemoteTerm(term) {
    var db = new RemoteTermDatabase();
    db.term = term;

    return db;
}

async function setCurrentTerm(term, preference) {
    if (preference === undefined) {
        preference = currentPreference;
    }

    if (preference === currentPreference && currentTermDB !== null && currentTermDB.term === term) {
        return false
    }

    store.ready = false;
    store.emit('readystatechange');

    // Use Remote Term to reduce latency
    currentTermDB = getRemoteTerm(term);

    if (useLocal() && preference === PREFER_FASTER) {
        if (localTermDownloaded(term)) {
            // Downloaded, so we can just use it
            await downloadLocalTerm(term);
        } else {
            // Kick off download, but don't wait for it
            downloadLocalTerm(term);
        }
    }


    meta.setSelectedTerm(term);
    store.ready = true;
    store.emit('readystatechange');
}

function getCurrentTerm() {
    return currentTermDB;
}

async function loadTerm(term, progress) {
    if (!progress) progress = function(){};
    // Download meta
    var remoteTerms = await meta.getRemoteTerms();
    if (!remoteTerms || !remoteTerms[term]) {
        throw new Error('invalid term');
    }
    await new Promise(function(resolve, reject) {
        $.ajax({
            url: endpoints.db('termdb_' + term + '_' + remoteTerms[term] +  '.json'),
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
                    var obj = {term: term, index: []};
                    for (var title in titleHash) {
                        obj.index.push({
                            title: title,
                            course: titleHash[title]
                        });
                    }
                    return indexeddb.add('title_typeahead_index', obj);
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

    return true;
}

function checkForUpdates() {
    var current_term = getCurrentTerm();
    if (current_term && current_term.term) {
        var term_id = current_term.term;
        return meta.getRemoteTerms().then(function(remoteTerms) {
            var localTerms = meta.getLocalTerms();
            if (remoteTerms[term_id] > localTerms[term_id]) {
                // Need upgrade
                return ajax.getJson(endpoints.dbIndex('version_history.json')).then(function(history) {
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
    PREFER_REMOTE: PREFER_REMOTE,
    PREFER_FASTER: PREFER_FASTER,

    ready: false,
    setCurrentTerm: setCurrentTerm,
    getCurrentTerm: getCurrentTerm,

    getRemoteTerm: getRemoteTerm,

    checkForUpdates: function() {
        if (!useLocal()) {
            return;
        }
        var self = this;
        checkForUpdates().then(function(result) {
            if (result !== false) {
                self.emit('updateAvailable', result);
            }
        })
    }
});

module.exports = store;