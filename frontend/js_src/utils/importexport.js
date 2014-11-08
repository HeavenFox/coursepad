var saveAs = require('FileSaver.js');

exports.export = function() {
    var store = {localStorage: {}};
    for (var i=0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var split = key.split('_');
        if (split.length == 2 && split[1] == 'schedules') {
            store.localStorage[key] = localStorage.getItem(key);
        }
    }
    store['meta_version'] = +localStorage.getItem('meta_version');

    var blob = new Blob([JSON.stringify(store)], {type: 'application/json'});
    saveAs(blob, 'coursepad.json');
}

exports.import = function(file) {
    console.log(file);
    var reader = new FileReader();
    reader.onload = function(e) {
        var json = JSON.parse(e.target.result);
        if (json['localStorage']) {
            for (var k in json['localStorage']) {
                if (json['localStorage'].hasOwnProperty(k)) {
                    localStorage.setItem(k, json['localStorage'][k]);
                }
            }
        }

        window.location.reload();
        
    }

    reader.readAsText(file);

}