import EventEmitter from 'eventemitter3';

import * as meta from './meta.ts';
import {TermDatabase, LocalTermDatabase, RemoteTermDatabase} from '../model/termdb.ts';

import * as endpoints from '../consts/endpoints.ts';
import * as indexeddb from '../persist/indexeddb.ts';
import * as ajax from '../utils/ajax.ts';


enum DBPreference {
    PREFER_REMOTE,
    PREFER_FASTER,
}

var currentTermDB: TermDatabase = null;
var currentPreference = DBPreference.PREFER_FASTER;


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
    var db: LocalTermDatabase;
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
                LocalTermDatabase.loadTerm(term, data).then(() => {
                    meta.addLocalTerm(term, data.time);
                    progress(1);
                    resolve(true);
                }).then(null, (e) => {
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

    async setCurrentTerm(term, preference = undefined) {
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
