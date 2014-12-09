var EventEmitter = require('event-emitter');
var localStore = require('../persist/localStorage.js');
var endpoints = require('../consts/endpoints.js');
var ajax = require('../utils/ajax.js');

const LATEST_VERSION = 1;

var remoteMetaPromise = null;

var meta = EventEmitter({
    getSelectedTerm: function() {
        return localStore.get('current_term');
    },

    setSelectedTerm: function(term) {
        localStore.set('current_term', term);
    },

    getScheduleIndex: function() {
        return localStore.get('current_schedule_index');
    },

    getLocalTerms: function() {
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
    },

    addLocalTerm: function(term, time) {
        localStore.get('terms', Object)[term] = time;
        localStore.fsync('terms');
    },

    getRemoteTerms: function(noCache) {
        return this.getRemoteMeta(noCache).then(function(data) {
            return data.roster_time;
        })
    },

    getRemoteMeta: function(noCache) {
        if (noCache || remoteMetaPromise === null) {
            remoteMetaPromise = ajax.getJson(endpoints.db('meta.json'));
        }
        return remoteMetaPromise;
    },

    upgradeSchema: function() {
        // Upgrade schema
        var currentVersion = localStore.get('meta_version', undefined);

        if (currentVersion === undefined) {
            localStore.set('meta_version', LATEST_VERSION);
        } else if (currentVersion < LATEST_VERSION) {
            localStore.set('meta_version', LATEST_VERSION);
        }
    }
});

module.exports = meta;