var VERSION = 2;

var dbPromise;

function open() {
    if (dbPromise === undefined) {
        dbPromise = new Promise(function(resolve, reject) {
            var request = window.indexedDB.open('coursepad', VERSION);
            request.onsuccess = function(e) {
                db = e.target.result;
                resolve(db);
            };

            request.onupgradeneeded = function(e) {
                if (e.oldVersion == 0) {
                    initSchema(e.target.result);
                } else {
                    upgradeSchema(e.target.transaction, e.oldVersion);
                }
            }
        });
    }

    return dbPromise;
}

function close() {
    return open().then(function(db) {
        db.close();
    });
}

function upgradeSchema(transaction, version) {
    switch (version) {
    case 1:
        transaction.objectStore('subjects').createIndex('term', 'term', {unique: false});
    }
}

function initSchema(db) {
    var rosterStore = db.createObjectStore('roster', {keyPath: 'id'});
    rosterStore.createIndex('term', 'term', {unique: false});
    rosterStore.createIndex('course', ['term', 'sub', 'nbr'], {unique: false});
    rosterStore.createIndex('subject', ['term', 'sub'], {unique: false});

    var subjectsStore = db.createObjectStore('subjects', {autoIncrement: true});
    subjectsStore.createIndex('subject', ['term', 'sub'], {unique: false});
    subjectsStore.createIndex('term', 'term', {unique: false});

    var titleIndexStore = db.createObjectStore('title_index', {autoIncrement: true});
    titleIndexStore.createIndex('term', 'term', {unique: false});
}

function queryObjectStore(store, query, mode) {
    if (mode === undefined) {
        mode = 'readonly';
    }
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction([store], mode);
            var objStore = transaction.objectStore(store);

            query(objStore);

            transaction.oncomplete = function(e) {
                resolve(true);
            };

            transaction.onerror = function(e) {
                console.warn(e);
                reject(e);
            };

        });
    });
}

function cursorByIndex(objectStore, index, keyRange, callback, mode) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction([objectStore], mode);
              transaction.objectStore(objectStore)
              .index(index)
              .openCursor(keyRange)
              .onsuccess = function(e) {
                var cursor = e.target.result;
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

function queryByIndex(objectStore, index, keyRange, callback) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction([objectStore]);
            transaction.objectStore(objectStore)
                .index(index)
                .openCursor(keyRange)
                .onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        var item = cursor.value;
                        callback(item);
                        cursor.continue();
                    }
                }
            transaction.oncomplete = function(e) {
                resolve(true);
            }
        });
    });
}

function queryAllByIndex(objectStore, index, keyRange) {
    var results = [];
    return queryByIndex(objectStore, index, keyRange, function(item) {
        results.push(item);
    }).then(function() {
        return results;
    });
}

function getByKey(objectStore, key) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            db.transaction([objectStore])
              .objectStore(objectStore)
              .get(key)
              .onsuccess = function(e) {
                resolve(e.target.result);
              }
        });
    });
}

function getByKeys(objectStore, keys) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            result = new Array(keys.length);
            var tr = db.transaction([objectStore]);
            var os = tr.objectStore(objectStore);
            for (var i=0; i < keys.length; i++) {
                (function(i) {
                    os.get(keys[i]).onsuccess = function(e) {
                        result[i] = e.target.result;
                    }
                })(i);
            }

            tr.oncomplete = function(e) {
                resolve(result);
            }
        });
    });
}

exports.open = open;
exports.close = close;
exports.cursorByIndex = cursorByIndex;
exports.queryByIndex = queryByIndex;
exports.queryAllByIndex = queryAllByIndex;
exports.getByKey = getByKey;
exports.getByKeys = getByKeys;
exports.queryObjectStore = queryObjectStore;