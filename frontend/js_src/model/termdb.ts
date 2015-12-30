import EventEmitter from 'eventemitter3';
import {Course} from '../model/course.ts';
import * as meta from '../store/meta.ts';

var endpoints: any = require('../consts/endpoints.js');
var ajax: any = require('../utils/ajax.js');
var indexeddb: any = require('../persist/indexeddb.js');

export abstract class TermDatabase extends EventEmitter {
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

export class LocalTermDatabase extends TermDatabase {
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

export class RemoteTermDatabase extends TermDatabase {
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
