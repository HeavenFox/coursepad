var EventEmitter = require('event-emitter');

var ajax = require('../utils/ajax.js');
var endpoints = require('../consts/endpoints.js');
var cookies = require('cookies-js');

var fb = require('../thirdparty/fb.js');

const LOGIN_EMAIL = 1, LOGIN_FB = 2;

// Facebook Integration
const FB_APP_ID = '399310430207216';
const SCOPE = 'public_profile,email,user_friends';

function storeSession(sessionId, isPersistent) {
    cookies.set('sessionId', sessionId, isPersistent ? {expires: 30 * 24 * 60 * 60} : {});
}

async function facebookLogin(accessToken) {
    try {
        var result = await ajax.post(endpoints.userLogin('fb'), {'access_token' : accessToken});
        loginMethod = LOGIN_FB;
        storeSession(result['session_id']);
        userLoggedIn(result['session_id'], new User().fromBundle(result['user']));
    } catch (e) {

    }
}

function fbStatusChange(response) {
    if (response['status'] === 'connected') {
        facebookLogin(response['authResponse']['accessToken']);
    }
}

async function initFacebookLogin() {
    await fb.init();
    FB.getLoginStatus(function(response) {
        fbStatusChange(response);
    });
}

async function initSessionLogin(session) {
    try {
        var bundle = await ajax.getJson(endpoints.bundleFromSession(session));
        userLoggedIn(session, new User().fromBundle(bundle));
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

async function initLogin() {
    // Check session first
    var sessionId = cookies.get('sessionId');
    if (sessionId) {
        var sessionResult = await initSessionLogin(sessionId);
        if (sessionResult) {
            return;
        } else {
            cookies.expire('sessionId');
        }
    }
    // Session not good
    initFacebookLogin();
}


function userLoggedIn(session, user) {
    var previousUser = currentUser;
    currentUser = user;
    sessionId = session;

    store.emit('loginstatuschange', {
        oldUser: previousUser,
        newUser: currentUser
    });
}


function User() {

}

User.prototype.fromBundle = function(bundle) {
    this.name = bundle['name'];
    this.profilePicture = bundle['profile_picture'];
    this.id = bundle['id'];

    return this;
}

var currentUser = null;
var sessionId = null;
var loginMethod = null;

var store = EventEmitter({
    loggedIn: function() {
        return currentUser !== null;
    },

    getCurrentUser: function() {
        return currentUser;
    },

    getSession: function() {
        return sessionId;
    },

    signHeader: function(header) {
        if (typeof header !== 'object') {
            header = {};
        }
        if (sessionId !== null) {
            header['Authorization'] = sessionId;
        }

        return header;
    },

    triggerLogin: function(method) {
        if (method === 'fb') {
            FB.login(function(response) {
                fbStatusChange(response);
            }, {'scope': SCOPE});
        }
    },

    emailLogin: async function(email, password, rememberMe) {
        var result = await ajax.post(endpoints.userLogin('email'), {'email' : email, 'password' : password});


        loginMethod = LOGIN_EMAIL;
        storeSession(result['session_id'], rememberMe);
        userLoggedIn(result['session_id'], new User().fromBundle(result['user']));
    },

    register: async function(userinfo) {

    },

    logout: function() {
        var prev = currentUser;
        currentUser = null;

        sessionId = null;
        cookies.expire('sessionId');

        if (loginMethod === LOGIN_FB) {
            FB.logout();
        }

        this.emit('loginstatuschange', {
            oldUser: prev,
            newUser: currentUser
        });
    },
});

module.exports = store;

initLogin();