var counter = 0;

if (!PROD) {
    var reverseMapping = {};
}

module.exports = function(e) {
    for (var key in e) {
        if (e.hasOwnProperty(key)) {
            e[key] = ++counter;
            if (!PROD) {
                reverseMapping[counter] = key;
            }
        }
    }
    return e;
};

if (!PROD) {
    window.reverseEnum = function(id) {
        return reverseMapping[id];
    }
}