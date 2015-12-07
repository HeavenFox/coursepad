var localStore : any = require('../persist/localStorage.js');
var endpoints : any = require('../consts/endpoints.js');
var ajax : any = require('../utils/ajax.js');

const LATEST_VERSION = 1;

var remoteMetaPromise = null;

export function getSelectedTerm() {
    return localStore.get('current_term');
}

export function setSelectedTerm(term) {
    localStore.set('current_term', term);
}

export function getScheduleIndex() {
    return localStore.get('current_schedule_index');
}

export function getLocalTerms() {
    var localTerms = localStore.get('terms') || {};
    // Upgrade from old format
    if (Array.isArray(localTerms)) {
        var newFormat = {};
        var times = {
            "fa14": 1410981659, "sp15": 1414178138
        };
        localTerms.forEach(function(t) {
            newFormat[t] = times[t]
        });
        localTerms = newFormat;
        localStore.set('terms', newFormat);
    }

    return localTerms;
}

export function addLocalTerm(term, time) {
    localStore.get('terms', Object)[term] = time;
    localStore.fsync('terms');
}

export async function getRemoteTerms(noCache = false) {
    let data = await getRemoteMeta(noCache);
    
    return data.roster_time;
}

export function getRemoteMeta(noCache = false) {
    if (noCache || remoteMetaPromise === null) {
        remoteMetaPromise = ajax.getJson(endpoints.dbIndex('meta.json'));
    }
    return remoteMetaPromise;
}

export function upgradeSchema() {
    // Upgrade schema
    var currentVersion = localStore.get('meta_version', undefined);

    if (currentVersion === undefined) {
        localStore.set('meta_version', LATEST_VERSION);
    } else if (currentVersion < LATEST_VERSION) {
        localStore.set('meta_version', LATEST_VERSION);
    }
}