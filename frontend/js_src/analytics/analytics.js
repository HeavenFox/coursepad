var eventga = null;

var DIMS = {
    'login_method' : '1'
};

function sevent() {
    if (!eventga) {
        if (!window.ga) {
            return;
        }
        eventga = window.ga.bind(window, 'send', 'event');
    }
    eventga.apply(null, arguments);
}

var errorga = null;

function serror(e) {
    if (!errorga) {
        if (!window.ga) {
            return;
        }
        errorga = window.ga.bind(window, 'send', 'exception');
    }
    errorga(e.toString());
}

function queued(f) {
    var queue = null;
    return function() {
        if (!window.ga) {
            if (!queue) {
                queue = [];
            } else {
                queue.push(arguments);
            }
            return;
        }
        if (queue) {
            for (var i=0; i < queue.length; i++) {
                f.apply(null, queue[i]);
            }
        }
        f.apply(null, arguments);
    }
}

function sdim(d, val) {
    if (!DIMS[d]) {
        throw new Error('Invalid dimension ' + d);
    }

    if (!window.ga) {
        return;
    }

    window.ga('set', 'dimension' + DIMS[d], val.toString());
}

function suserid(uid) {
    if (!window.ga) {
        return;
    }
    window.ga('set', '&uid', uid.toString());
};

exports.sevent = sevent;
exports.serror = serror;
exports.sdim = sdim;
exports.suserid = suserid;