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

function serror(e, fatal) {
    if (!window.ga) {
        return;
    }

    window.ga('send', 'exception', {
        'exDescription': e.toString(),
        'exFatal': !!fatal,
    });
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
