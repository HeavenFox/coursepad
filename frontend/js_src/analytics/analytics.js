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
}

exports.sevent = sevent;
exports.serror = serror;
exports.sdim = sdim;
exports.suserid = suserid;
