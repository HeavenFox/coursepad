var WS_SERVER;
if (LEVEL == 1) {
    WS_SERVER = 'ws://ws-test.coursepad.me/';
}
if (LEVEL == 5) {
    WS_SERVER = 'wss://staging-ws.coursepad.me/';
}
if (LEVEL == 9) {
    WS_SERVER = 'wss://ws.coursepad.me/';
}

function queryString(p) {
    var result = '';
    for (var k in p) {
        if (p.hasOwnProperty(k)) {
            result += encodeURIComponent(k);
            result += '=';
            result += encodeURIComponent(p[k]);
        }
    }

    return result;
}

module.exports = {
	db: function(path) {
        return '/static/data/' + path;
	},

    dbIndex: function(path) {
        return '/static/data_index/' + path;
    },

    termdbSearch: function(term, query) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/search?q=' + encodeURIComponent(query);
    },

    termdbBasket: function(term, basket) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/basket?classes=' + encodeURIComponent(basket);
    },

    userLogin: function(method) {
        return '/endpoints/user/signin/' + encodeURIComponent(method);
    },

    bundleFromSession: function(session) {
        return '/endpoints/user/session?sid=' + encodeURIComponent(session);
    },

    refreshSession: function() {
        return '/endpoints/user/refreshsession';
    },

    share: function() {
        return '/endpoints/sharing/share';
    },

    shared: function(slug) {
        return '/endpoints/sharing/shared/' + slug;
    },

    sync: function(session, clientId) {
        return WS_SERVER + 'endpoints/sync/websocket?sid=' + encodeURIComponent(session) + '&clientid=' + encodeURIComponent(clientId);
    },

    getSchedule: function(term) {
        return '/endpoints/sync/schedule/' + encodeURIComponent(term);
    },
}