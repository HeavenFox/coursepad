var EventEmitter = require('event-emitter');

var localStore = EventEmitter({
    get: get,
    set: set,
    fsync: fsync,
    keys: keys,
    del: del,
});

var cache = {};

function get(key, def) {
    if (!cache.hasOwnProperty(key)) {
        if (window.localStorage[key] !== undefined) {
            cache[key] = JSON.parse(window.localStorage.getItem(key));
        } else {
            if (def !== undefined) {
                if (typeof def == "function") {
                    cache[key] = def();
                } else {
                    cache[key] = def;
                }
                fsync(key);
            }
        }
    }
    return cache[key];
}

function set(key, value) {
    cache[key] = value;
    fsync(key);
}

function del(key) {
    window.localStorage.removeItem(key);
    delete cache[key];
}

function fsync(key) {
    if (cache.hasOwnProperty(key)) {
        window.localStorage.setItem(key, JSON.stringify(cache[key]));
    }
}

function keys() {
    var result = [];
    for (var i=0; i < window.localStorage.length; i++) {
        result.push(window.localStorage.key(i));
    }
    return result;
}

module.exports = localStore;

window.addEventListener('storage', function(e) {
    var inCache = cache.hasOwnProperty(e.key);
    if (inCache) {
        if (e.newValue === null) {
            delete cache[e.key];
        } else {
            cache[e.key] = JSON.parse(e.newValue);
        }
    }

    localStore.emit('change', e);
});