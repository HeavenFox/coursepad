export let LEVEL = 1;

if (process.env.NODE_ENV === "production") {
  LEVEL = 9;
} else if (process.env.STAGING) {
  LEVEL = 5;
}

var WS_SERVER;
if (LEVEL >= 9) {
  WS_SERVER = "wss://ws.coursepad.me/";
} else if (LEVEL >= 5) {
  WS_SERVER = "wss://staging-ws.coursepad.me/";
} else {
  WS_SERVER = "ws://ws-test.coursepad.me/";
}

function queryString(p) {
  var result = "";
  for (var k in p) {
    if (p.hasOwnProperty(k)) {
      result += encodeURIComponent(k);
      result += "=";
      result += encodeURIComponent(p[k]);
    }
  }

  return result;
}

export function db(path) {
  return "/static/data/" + path;
}

export function dbIndex(path) {
  return "/static/data_index/" + path;
}

export function termdbSearch(term, query) {
  return (
    "/endpoints/termdb/" +
    encodeURIComponent(term) +
    "/search?q=" +
    encodeURIComponent(query)
  );
}

export function termdbBasket(term, basket) {
  return (
    "/endpoints/termdb/" +
    encodeURIComponent(term) +
    "/basket?classes=" +
    encodeURIComponent(basket)
  );
}

export function userLogin(method) {
  return "/endpoints/user/signin/" + encodeURIComponent(method);
}

export function bundleFromSession(session) {
  return "/endpoints/user/session?sid=" + encodeURIComponent(session);
}

export function refreshSession() {
  return "/endpoints/user/refreshsession";
}

export function share() {
  return "/endpoints/sharing/share";
}

export function shared(slug) {
  return "/endpoints/sharing/shared/" + slug;
}

export function sync(session, clientId) {
  return (
    WS_SERVER +
    "endpoints/sync/websocket?sid=" +
    encodeURIComponent(session) +
    "&clientid=" +
    encodeURIComponent(clientId)
  );
}

export function getSchedule(term) {
  return "/endpoints/sync/schedule/" + encodeURIComponent(term);
}
