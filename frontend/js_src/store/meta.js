var EventEmitter = require('event-emitter');
var localStore = require('../persist/localStorage.js');
var endpoints = require('../consts/endpoints.js');

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
        return localStore.get('terms') || [];
    },

    addLocalTerm: function(term) {
        localStore.get('terms', Array).push(term);
        localStore.fsync('terms');
    },

    getRemoteTerms: function() {
        return this.getRemoteMeta().then(function(data) {
            return data.available_terms;
        })
    },

    getRemoteMeta: function() {
        return new Promise(function(resolve, reject) {
            $.get(endpoints.db('meta.json'), function(data) {
                resolve(data);
            });
        });
    }
});

module.exports = meta;