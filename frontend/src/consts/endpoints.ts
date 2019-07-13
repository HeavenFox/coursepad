export let LEVEL = 1;

if (process.env.NODE_ENV === "production") {
  LEVEL = 9;
} else if (process.env.STAGING) {
  LEVEL = 5;
}

let DATA_PATH_BASE = "";
if (process.env.NODE_ENV === "production") {
  DATA_PATH_BASE = "https://data.coursepad.me";
}

let ENDPOINT_PATH_BASE = "";
if (process.env.NODE_ENV === "production") {
  ENDPOINT_PATH_BASE = "https://api.coursepad.me";
}

var WS_SERVER;
if (process.env.NODE_ENV === "production") {
  WS_SERVER = "wss://ws.coursepad.me/";
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

export function db(path: string) {
  return DATA_PATH_BASE + "/static/data/" + path;
}

export function dbIndex(path: string) {
  return DATA_PATH_BASE + "/static/data_index/" + path;
}

export function termdbSearch(term, query) {
  return (
    ENDPOINT_PATH_BASE +
    "/endpoints/termdb/" +
    encodeURIComponent(term) +
    "/search?q=" +
    encodeURIComponent(query)
  );
}

export function termdbBasket(term, basket) {
  return (
    ENDPOINT_PATH_BASE +
    "/endpoints/termdb/" +
    encodeURIComponent(term) +
    "/basket?classes=" +
    encodeURIComponent(basket)
  );
}

export function userLogin(method) {
  return (
    ENDPOINT_PATH_BASE + "/endpoints/user/signin/" + encodeURIComponent(method)
  );
}

export function bundleFromSession(session) {
  return (
    ENDPOINT_PATH_BASE +
    "/endpoints/user/session?sid=" +
    encodeURIComponent(session)
  );
}

export function refreshSession() {
  return ENDPOINT_PATH_BASE + "/endpoints/user/refreshsession";
}

export function share() {
  return ENDPOINT_PATH_BASE + "/endpoints/sharing/share";
}

export function shared(slug) {
  return ENDPOINT_PATH_BASE + "/endpoints/sharing/shared/" + slug;
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
  return (
    ENDPOINT_PATH_BASE + "/endpoints/sync/schedule/" + encodeURIComponent(term)
  );
}
