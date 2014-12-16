var EventEmitter = require('event-emitter');

var ajax = require('../utils/ajax.js');
var endpoints = require('../consts/endpoints.js');

// Facebook Integration
const FB_APP_ID = '399310430207216';
const SCOPE = 'public_profile,email,user_friends';

window.fbAsyncInit = function() {
    FB.init({
        appId : FB_APP_ID,
        xfbml : false,
        cookie : false,
        version : 'v2.2'
    });
    FB.getLoginStatus(function(response) {
        fbStatusChange(response);
    });
};

function userLoggedIn(session, user) {
    currentUser = user;
    sessionId = session;

    store.emit('loginstatuschange');
}

function fbStatusChange(response) {
    if (response['status'] === 'connected') {
        facebookLogin(response['authResponse']['accessToken']);
    }
}

async function facebookLogin(accessToken) {
    var result = await ajax.getJson(endpoints.userLogin('fb', {'access_token' : accessToken}));
    userLoggedIn(result['session_id'], new User().fromBundle(result['user']));
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

var store = EventEmitter({
    getCurrentUser: function() {
        return currentUser;
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
    }
});

module.exports = store;