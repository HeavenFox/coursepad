var indexeddb = require('../persist/indexeddb.js');

window.nuke = function() {
    if (window.confirm('Will reset local database. YOU WILL LOSE ALL DATA. Are you sure you want to continue?')) {

        window.localStorage.clear();

        var deleteIDBTries = 3;

        function deleteIndexedDB() {
            var delReq = window.indexedDB.deleteDatabase('coursepad');
            delReq.onsuccess = function() {
                alert('Reset success');
            }
            delReq.onerror = function() {
                alert('Cannot delete database');
            }
            delReq.onblocked = function() {
                if (--deleteIDBTries > 0) {
                    window.setTimeout(deleteIndexedDB, 100);
                }
            }
        }
        
        indexeddb.close().then(function() {
            window.setTimeout(deleteIndexedDB, 100);
        });
    }
}