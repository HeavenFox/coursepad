var VERSION = 3;

var dbPromise: Promise<IDBDatabase>;

var DB_NAME = 'coursepad';

export function setDatabase(name: string) {
    DB_NAME = name;
}

export function open() {
    if (dbPromise === undefined) {
        dbPromise = new Promise(function(resolve, reject) {
            let request = window.indexedDB.open(DB_NAME, VERSION);
            request.onsuccess = function(e) {
                resolve(request.result);
            };

            request.onupgradeneeded = function(e) {
                if (e.oldVersion === 0) {
                    initSchema(request.result);
                } else {
                    upgradeSchema(request.transaction, e.oldVersion);
                }
            }
        });
    }

    return dbPromise;
}

export function close(): Promise<void> {
    return open().then(function(db) {
        db.close();
    });
}

function upgradeSchema(transaction: IDBTransaction, version: number) {
    switch (version) {
    case 1:
        transaction.objectStore('subjects').createIndex('term', 'term', {unique: false});
        /* falls through */
    case 2:
        var newCacheStore = transaction.db.createObjectStore('title_typeahead_index', {keyPath: 'term'});
        var index = Object.create(null);
        transaction.objectStore('title_index').openCursor().onsuccess = function(e: any) {
            var cursor = e.target.result;
            var term;
            if (cursor) {
                var obj = cursor.value;
                term = obj.term;
                delete obj.term;
                if (index[term] === undefined) {
                    index[term] = {term: term, index: []};
                }
                index[term].index.push(obj);
                cursor.continue();
            } else {
                transaction.db.deleteObjectStore('title_index');
                for (term in index) {
                    newCacheStore.add(index[term]);
                }
            }
        }
    }
}

function initSchema(db: IDBDatabase) {
    // FIXME: TS Bug: compound key not supported. Use <any> as workaround
    var rosterStore = db.createObjectStore('roster', {keyPath: 'id'});
    rosterStore.createIndex('term', 'term', {unique: false});
    rosterStore.createIndex('course', <any>['term', 'sub', 'nbr'], {unique: false});
    rosterStore.createIndex('subject', <any>['term', 'sub'], {unique: false});

    var subjectsStore = db.createObjectStore('subjects', {autoIncrement: true});
    subjectsStore.createIndex('subject', <any>['term', 'sub'], {unique: false});
    subjectsStore.createIndex('term', 'term', {unique: false});

    db.createObjectStore('title_typeahead_index', {keyPath: 'term'});
}

export function queryObjectStore(store: string, query: (store: IDBObjectStore) => void, mode = 'readonly') {
    return open().then(function(db) {
        return new Promise<boolean>(function(resolve, reject) {
            var transaction = db.transaction([store], mode);
            var objStore = transaction.objectStore(store);

            query(objStore);

            transaction.oncomplete = function(e) {
                resolve(true);
            };

            transaction.onerror = function(e) {
                reject(e);
            };

        });
    });
}

export function keyCursorByIndex(objectStore: string, index: string, keyRange: IDBKeyRange, callback: (c: IDBCursor)=>void, mode: string) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction([objectStore], mode);
            transaction.objectStore(objectStore)
              .index(index)
              .openKeyCursor(keyRange)
              .onsuccess = function(e) {
                var cursor: IDBCursor = (<IDBRequest>e.target).result;
                if (cursor) {
                    callback(cursor);
                    cursor.continue();
                }
              }
            transaction.oncomplete = function() {
                resolve(true);
            }

        });
    });
}

export function cursorByIndex(objectStore, index, keyRange, callback: (c: IDBCursorWithValue)=>void, mode = 'readonly') {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction([objectStore], mode);
            transaction.objectStore(objectStore)
                .index(index)
                .openCursor(keyRange)
                .onsuccess = function(e) {
                    let cursor: IDBCursorWithValue = (<IDBRequest>e.target).result;
                    if (cursor) {
                        callback(cursor);
                        cursor.continue();
                    }
                }
            transaction.oncomplete = function(e) {
                resolve(true);
            }
        });
    });
}

export function queryAllByIndex(objectStore, index, keyRange) {
    var results = [];
    return cursorByIndex(objectStore, index, keyRange, function(item) {
        results.push(item.value);
    }).then(function() {
        return results;
    });
}

export function getByKey(objectStore, key) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            db.transaction([objectStore])
              .objectStore(objectStore)
              .get(key)
              .onsuccess = function(e) {
                resolve((<IDBRequest>e.target).result);
              }
        });
    });
}

export function getByKeys(objectStore: string, keys: any[]) {
    return open().then(function(db) {
        return new Promise<any[]>(function(resolve, reject) {
            let result = new Array(keys.length);
            var tr = db.transaction([objectStore]);
            var os = tr.objectStore(objectStore);
            for (var i=0; i < keys.length; i++) {
                (function(i) {
                    os.get(keys[i]).onsuccess = function(e) {
                        result[i] = (<IDBRequest>e.target).result;
                    }
                })(i);
            }

            tr.oncomplete = function(e) {
                resolve(result);
            }
        });
    });
}

export function add(objectStore: string, obj, key = undefined) {
    return open().then(function(db) {
        return new Promise<boolean>(function(resolve, reject) {
            var tr = db.transaction([objectStore], 'readwrite');
            var os = tr.objectStore(objectStore);

            if (key === undefined) {
                os.add(obj);
            } else {
                os.add(obj, key);
            }

            tr.oncomplete = function(e) {
                resolve(true);
            }
        });
    });
}

export function deleteRecord(objectStore: string, key: any) {
    return open().then(function(db) {
        return new Promise<boolean>(function(resolve, reject) {
            var tr = db.transaction([objectStore], 'readwrite');
            var os = tr.objectStore(objectStore);

            os.delete(key);

            tr.oncomplete = function(e) {
                resolve(true);
            }

            tr.onerror = function(e) {
                reject(e.target);
            }
        });
    });
}
