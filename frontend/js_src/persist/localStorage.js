module.exports = {
  get: get,
  set: set,
  fsync: fsync
};

var cache = {};

function get(key) {
  if (!cache.hasOwnProperty(key)) {
    if (window.localStorage[key] !== undefined) {
      cache[key] = JSON.parse(window.localStorage[key]);
    }
  }
  return cache[key];
},

function set(key, value) {
  cache[key] = value;
  fsync(key);
}

function fsync(key) {
  window.localStorage[key] = JSON.stringify(cache[key]);
}