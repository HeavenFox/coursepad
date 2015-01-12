var EventEmitter = require('event-emitter');

var localStore = EventEmitter({
    get: get,
    set: set,
    fsync: fsync
});

var cache = {};

function get(key, def) {
    if (!cache.hasOwnProperty(key)) {
        if (window.localStorage[key] !== undefined) {
            cache[key] = JSON.parse(window.localStorage[key]);
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

function fsync(key) {
    window.localStorage[key] = JSON.stringify(cache[key]);
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