module.exports = {
    get: get,
    set: set,
    fsync: fsync
};

var cache = {};

function get(key, def) {
    if (!cache.hasOwnProperty(key)) {
        if (window.localStorage[key] !== undefined) {
            cache[key] = JSON.parse(window.localStorage[key]);
        } else {
            if (def !== undefined) {
                if (typeof def == "function") {
                    cache[key] = new def();
                } else {
                    cache[key] = def;
                }
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