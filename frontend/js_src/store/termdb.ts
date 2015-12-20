import EventEmitter from 'eventemitter3';

import * as meta from './meta.ts';
import Course from '../model/Course.ts';

var endpoints: any = require('../consts/endpoints.js');
var indexeddb: any = require('../persist/indexeddb.js');
var ajax: any = require('../utils/ajax.js');


enum DBPreference {
    PREFER_REMOTE,
    PREFER_FASTER,
}

var currentTermDB: TermDatabase = null;
var currentPreference = DBPreference.PREFER_FASTER;


abstract class TermDatabase extends EventEmitter {
    term: string;
    
    constructor(term) {
        super();
        this.term = term;
    }
    
    abstract getBasket(basket: string[]) : Promise<Course[][]>;
    abstract getCoursesBySubjectAndNumber(subject: string, number: number) : Promise<Course[]>;
    abstract searchByKeyword(keywords: string);
    
    searchIn(toSearch, keywords) {
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
    }
}

class LocalTermDatabase extends TermDatabase {
    titleIndex: any;
    
    async getBasket(basket) {
        let clusters = await Promise.all(basket.map((c) => {
            var split = c.split(' ');
            if (split.length != 2) {
                    return null;
            }
            return this.getCoursesBySubjectAndNumber(split[0], +split[1]); 
        }));
        
        return clusters.filter((cluster) => Array.isArray(cluster) && cluster.length > 0);
    }
    
        
    /**
    * @param {String} keywords
    * @return {Promise}
    */ 
    searchByKeyword(keywords) {
        var results = this.searchIn(this.titleIndex, keywords);
        return Promise.resolve(results);
    }
    
    setTitleIndex(index) {
        this.titleIndex = [];
        index.index.forEach(function(item) {
            item.titleLower = item.title.toLowerCase();
            this.titleIndex.push(item);
        }, this);
    }
    
    async getCoursesBySubjectAndNumber(subject, number) {
        let courses = await indexeddb.queryAllByIndex('roster', 'course', IDBKeyRange.only([this.term, subject, number]))
        courses = courses.map(c => new Course(c, this.term));
    
        return courses;
    }
    
    /**
     * @return {Promise}
     */
    applyUpdates(updates) {
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
    
                                    rosterStore[LEVEL == 1 ? 'add' : 'put'](rosterDiff['added'][i]);
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
                                    subjectsStore[LEVEL == 1 ? 'add' : 'put'](subjectsDiff['added'][i]);
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
            self.emit('update');
        })
        .then(null, function(e) {
            console.error('Error when Applying Updates: ', e);
        });
    
        return chain;
    }
}

class RemoteTermDatabase extends TermDatabase {
    getCoursesBySubjectAndNumber(subject, number) {
        return this.getBasket([subject + ' ' + number]).then(function(basket) {
            if (basket.length > 0 && basket[0].length > 0) {
                return basket[0];
            }
            return [];
        });
    }
    
    async getBasket(classNumbers) {
        var classes = classNumbers.join('|');
    
        let basket = await ajax.getJson(endpoints.termdbBasket(this.term, classes));
    
        basket.forEach(cluster => {
            cluster.forEach((c, i) => {
                cluster[i] = new Course(c, this.term);
            });
        });
    
        return basket;
    
    }
    
    searchByKeyword(keywords) {
        var self = this;
        return ajax.getJson(endpoints.termdbSearch(this.term, keywords)).then(function(toSearch) {
            toSearch.forEach(function(item) {
                item.titleLower = item.title.toLowerCase();
            });
            return self.searchIn(toSearch, keywords);
        });
    }
}



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
        db = new LocalTermDatabase(term);
        db.titleIndex = [];

        db.on('update', function() {
            store.emit('change');
        });

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

async function loadTerm(term, progress = null) {
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
    var current_term = store.getCurrentTerm();
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

class TermDBStore extends EventEmitter {
    ready: boolean;
    
    PREFER_REMOTE: DBPreference;
    PREFER_FASTER: DBPreference;
    
    constructor() {
        super();
        this.PREFER_REMOTE = DBPreference.PREFER_REMOTE;
        this.PREFER_FASTER = DBPreference.PREFER_FASTER;
    }
    
    getCurrentTerm(): TermDatabase {
        return currentTermDB;
    }
    
    async setCurrentTerm(term, preference) {
        if (preference === undefined) {
            preference = currentPreference;
        }
    
        if (preference === currentPreference && currentTermDB !== null && currentTermDB.term === term) {
            return false
        }
    
        this.ready = false;
        this.emit('readystatechange');
    
        // Use Remote Term to reduce latency
        currentTermDB = this.getRemoteTerm(term);
    
        if (useLocal() && preference === DBPreference.PREFER_FASTER) {
            if (localTermDownloaded(term)) {
                // Downloaded, so we can just use it
                await downloadLocalTerm(term);
                this.checkForUpdates();
            } else {
                // Kick off download, but don't wait for it
                downloadLocalTerm(term);
            }
        }
    
    
        meta.setSelectedTerm(term);
        this.ready = true;
        this.emit('readystatechange');
    }
    
    
    getRemoteTerm(term) {
        var db = new RemoteTermDatabase(term);
    
        return db;
    }
    
    async checkForUpdates() {
        let result = await checkForUpdates()
        if (result !== false) {
            this.emit('updateAvailable', result);
        }
    }
    
}


var store : TermDBStore = new TermDBStore();

export default store;
