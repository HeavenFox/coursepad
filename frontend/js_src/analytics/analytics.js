var eventga = null;

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

exports.sevent = sevent;
exports.serror = serror;