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
    return window.indexedDB && !(navigator && navigator.userAgent.indexOf('Safari') > -1
           && navigator.userAgent.indexOf('Chrome') == -1);
}

function localTermDownloaded(term) {
    return meta.getLocalTerms().hasOwnProperty(term);
}

function undownloadLocalTerm(term) {
    meta.removeLocalTerm(term);
}

async function downloadLocalTerm(term) {
    console.log("Downloading term DB: " + term);
    return await loadTerm(term);
}

async function replaceWithLocalTerm(term) {
    if (!currentTermDB || currentTermDB.term === term) {
        await setLocalTerm(term);
        return true;
    }
    return false;
}

async function setLocalTerm(term) {
    console.log(`Loading term ${term} from indexeddb`);

    let db = new LocalTermDatabase(term);
    if (!(await db.checkIntegrity())) {
        return false;
    }

    await db.update();

    db.titleIndex = [];

    let index = await indexeddb.getByKey('title_typeahead_index', term);

    if (index !== undefined) {
        db.setTitleIndex(index);
    }

    currentTermDB = db;

    console.log("indexeddb loaded");

    return true;
}

async function loadTerm(term, progress = null) {
    if (!progress) progress = () => {};
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
            dataType: 'json',
        });
    });

    return true;
}

async function checkForUpdates() {
    var current_term = store.getCurrentTerm();
    if (current_term && current_term.term) {
        var term_id = current_term.term;
        let remoteTerms = await meta.getRemoteTerms();
        let localTerms = meta.getLocalTerms();
            if (remoteTerms[term_id] > localTerms[term_id]) {
                // Need upgrade
                let history = await ajax.getJson(endpoints.dbIndex('version_history.json'));
                let timestamps = history['term_db'][term_id];
                let index = timestamps.indexOf(localTerms[term_id]);
                if (index < 0) {
                    throw new Error('cannot find history');
                }

                let path = timestamps.slice(index);

                var diffPromises = [];
                for (let i=0; i < path.length-1; i++) {
                    diffPromises.push(
                        ajax.getJson(endpoints.db(`diffs/diff_termdb_${term_id}_${path[i]}_${path[i+1]}.json`))
                    );
                }

                let diffs = await Promise.all(diffPromises);

                // Add sequentially, to prevent dangling diff
                for (const d of diffs) {
                    await indexeddb.add('diffs', {term: term_id, diff: d});
                }

                return true;
            } else {
                return false;
            }
    }
    return false;
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
            return false;
        }

        this.ready = false;
        this.emit('readystatechange');

        // Use Remote Term to reduce latency
        currentTermDB = this.getRemoteTerm(term);

        // Kick off download, but don't wait for it
        let asyncDownload = () => {
            downloadLocalTerm(term).then(() => {
                replaceWithLocalTerm(term);
            });
        };

        if (useLocal() && preference === DBPreference.PREFER_FASTER) {
            console.log('Using indexedDB');
            if (localTermDownloaded(term)) {
                // Downloaded, so we can just use it
                if (await setLocalTerm(term)) {
                    this.checkForUpdates();
                } else {
                    console.log('Integrity check failed. Redownloading.');
                    // Remove the term from meta
                    undownloadLocalTerm(term);

                    asyncDownload();
                }
            } else {
                asyncDownload();
            }
        }

        meta.setSelectedTerm(term);
        this.ready = true;
        this.emit('readystatechange');
    }


    getRemoteTerm(term) {
        return new RemoteTermDatabase(term);
    }

    checkForUpdates() {
        return checkForUpdates();
    }
}


var store : TermDBStore = new TermDBStore();

export default store;
