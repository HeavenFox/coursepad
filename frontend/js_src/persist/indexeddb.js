var VERSION = 1;

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
                initSchema(e.target.result);
            }
        });
    }

    return dbPromise;
}

function initSchema(db) {
    var rosterStore = db.createObjectStore('roster', {keyPath: 'id'});
    rosterStore.createIndex('term', 'term', {unique: false});
    rosterStore.createIndex('course', ['term', 'sub', 'nbr'], {unique: false});
    rosterStore.createIndex('subject', ['term', 'sub'], {unique: false});

    var subjectsStore = db.createObjectStore('subjects', {autoIncrement: true});
    subjectsStore.createIndex('subject', ['term', 'sub'], {unique: false});

    var titleIndexStore = db.createObjectStore('title_index', {autoIncrement: true});
    titleIndexStore.createIndex('term', 'term', {unique: false});
}

function queryByIndex(objectStore, index, keyRange, callback) {
    return open().then(function(db) {
        return new Promise(function(resolve, reject) {
            db.transaction([objectStore])
              .objectStore(objectStore)
              .index(index)
              .openCursor(keyRange)
              .onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var item = cursor.value;
                    callback(item);
                    cursor.continue();
                } else {
                    resolve(true);
                }
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

window.nuke = function() {
    indexedDB.deleteDatabase("coursepad").onsuccess = function() {
        console.log("Nuked!");
    };
}

exports.open = open;
exports.queryByIndex = queryByIndex;
exports.queryAllByIndex = queryAllByIndex;
exports.getByKey = getByKey;
exports.getByKeys = getByKeys;