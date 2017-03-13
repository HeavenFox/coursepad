import {EventEmitter} from 'eventemitter3';

import {User} from '../model/users';

import * as ajax from '../utils/ajax';
import * as endpoints from '../consts/endpoints';
import * as cookies from 'cookies-js';

import * as fb from '../thirdparty/fb';
import * as google from '../thirdparty/google';

import * as ana from '../analytics/analytics';

type SessionId = string;

const LOGIN_EMAIL = 1, LOGIN_FB = 2;

// Facebook Integration
const SCOPE = 'public_profile,email,user_friends';


const REFRESH_SESSION_GRACE_PERIOD = 5 * 60 * 1000;

function storeSession(sessionId: SessionId, expires: number, isPersistent = false) {
    function scheduleRefreshSession(expirationTime) {
        window.setTimeout(async function() {
            console.log('refreshing session');
            try {
                var result = await ajax.post(endpoints.refreshSession(), {'sid': sessionId});
                if (result['expires']) {
                    scheduleRefreshSession(result['expires']);
                }
            } catch(e) {
                if (e && e.status == 401) {
                    clearSession();
                } else {
                    throw e;
                }
            }
        }, expirationTime*1000-Date.now()-REFRESH_SESSION_GRACE_PERIOD);
    }
    cookies.set('sessionId', sessionId, isPersistent ? {expires: 30 * 24 * 60 * 60} : {});
    scheduleRefreshSession(expires);
}

async function facebookLogin(accessToken) {
    try {
        var result = await ajax.post(endpoints.userLogin('fb'), {'access_token' : accessToken});
        loginMethod = LOGIN_FB;
        storeSession(result['session_id'], result['session_expires']);
        userLoggedIn(result['session_id'], new User().fromBundle(result['user']));

        ana.sdim('login_method', 'fb');
    } catch (e) {
        console.warn(e);
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


function userLoggedIn(session: SessionId, user: User) {
    var previousUser = currentUser;
    currentUser = user;
    sessionId = session;

    store.emit('loginstatuschange', {
        oldUser: previousUser,
        newUser: currentUser,
    });

    ana.suserid(user.id);
}

var store : UserStore;

var currentUser: User = null;
var sessionId: SessionId = null;
var loginMethod = null;

function clearSession() {
    var prev = currentUser;
    currentUser = null;

    sessionId = null;
    cookies.expire('sessionId');

    store.emit('loginstatuschange', {
        oldUser: prev,
        newUser: currentUser,
    });

}

class UserStore extends EventEmitter {
    loggedIn(): boolean {
        return currentUser !== null;
    }

    getCurrentUser(): User {
        return currentUser;
    }

    getSession(): SessionId {
        return sessionId;
    }

    signHeader(header) {
        if (typeof header !== 'object') {
            header = {};
        }
        if (sessionId !== null) {
            header['Authorization'] = sessionId;
        }

        return header;
    }

    async triggerLogin(method) {
        if (method === 'fb') {
            FB.login(function(response) {
                fbStatusChange(response);
            }, {'scope': SCOPE});
        }
        if (method === 'goog') {
            console.log('Google API init');

            gapi.auth.signIn({
                'clientid': google.CLIENT_ID,
                'cookiepolicy': 'single_host_origin',
                'scope': 'profile',
                'callback': function(data) {
                    console.log(data);
                },
            });

        }
    }

    async emailLogin(email, password, rememberMe = false) {
        var result = await ajax.post(endpoints.userLogin('email'), {'email' : email, 'password' : password});


        loginMethod = LOGIN_EMAIL;
        storeSession(result['session_id'], result['session_expires'], rememberMe);
        userLoggedIn(result['session_id'], new User().fromBundle(result['user']));
    }

    async register(userinfo) {

    }

    logout() {
        if (loginMethod === LOGIN_FB) {
            FB.logout((response) => {});
        }
        loginMethod = null;

        clearSession();
    }
}

store = new UserStore();
export default store;

initLogin();

google.init();
