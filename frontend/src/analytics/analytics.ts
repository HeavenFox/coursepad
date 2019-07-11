var eventga = null;

var DIMS = {
    'login_method' : '1',
};

export function sevent(...args) {
    if (!eventga) {
        if (!window.ga) {
            return;
        }
        eventga = window.ga.bind(window, 'send', 'event');
    }
    eventga.apply(null, arguments);
}

export function serror(e, fatal) {
    if (!window.ga) {
        return;
    }

    window.ga('send', 'exception', {
        'exDescription': e.toString(),
        'exFatal': !!fatal,
    });
}

export function sdim(d, val) {
    if (!DIMS[d]) {
        throw new Error('Invalid dimension ' + d);
    }

    if (!window.ga) {
        return;
    }

    window.ga('set', 'dimension' + DIMS[d], val.toString());
}

export function suserid(uid) {
    if (!window.ga) {
        return;
    }
    window.ga('set', '&uid', uid.toString());
}
