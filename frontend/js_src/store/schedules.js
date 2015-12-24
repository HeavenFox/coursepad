var EventEmitter = require('event-emitter');
var router = require('../router.ts');
var termdb = require('./termdb.ts');
var user = require('./user.js');

var localStore = require('../persist/localStorage.js');


var schedulestorage = require('./schedulestorage.js');

import {MutableSchedule, SharedSchedule} from '../model/schedules.ts';

const PREFER_LOCAL = 1;
const PREFER_REMOTE = 2;
const NO_PREFERENCE = 3;

var store = EventEmitter({
    ready: false,
    setCurrentSchedule: async function(term, index) {
        router.changePath('/');

        var currentTermDB = termdb.getCurrentTerm();
        var self = this;

        if (term === undefined) {
            term = currentTermDB.term;
        }
        if (index === undefined) {
            index = 0;
        }

        if (this.currentSchedule) {
            if ((this.currentSchedule.term === term) && (this.currentSchedule.index === index)) {
                return false;
            }
            self.ready = false;
            self.emit('readystatechange', false);
        }

        schedulestorage.setStorage(term);

        var shouldCheckForUpdates = false;

        var dbLoadedPromise;
        if (!termdb.getCurrentTerm() || termdb.getCurrentTerm().term !== term) {
            await termdb.setCurrentTerm(term);
        }

        var schedule = new MutableSchedule();
        schedule.term = term;
        schedule.index = index;
        schedule.storage = schedulestorage.getStorage();

        await schedulestorage.getStorage().loadSchedule(schedule);

        self._setCurrentSchedule(schedule);

        self.ready = true;
        self.emit('readystatechange', true);

        return true;
    },

    setSharedSchedule: async function(term, serialized) {
        if (this.ready) {
            this.ready = false;
            this.emit('readystatechange', false);
        }

        var db = termdb.getRemoteTerm(term);
        schedulestorage.setStorage(term);

        var schedule = new SharedSchedule();
        schedule.term = term;
        schedule.getTermDB = function() {
            return db;
        }

        await schedule.deserialize(serialized);

        this._setCurrentSchedule(schedule);

        this.ready = true;
        this.emit('readystatechange', true);
    },


    setSchedule: function(schedule, by) {
        this._setCurrentSchedule(schedule);

        this.emit('change', {by: by});
    },

    _setCurrentSchedule: function(schedule) {
        this.currentSchedule = schedule;
        schedule.on('change', this._getOnScheduleChange());
    },

    _getOnScheduleChange: function() {
        var self = this;
        return this.__onScheduleChange || (this.__onScheduleChange = function(v) {
            self.emit('change', v);
        });
    },

    getCurrentSchedule: function() {
        if (!this.ready) { return null; }
        return this.currentSchedule;
    },

    _onTermDBChange: function() {
        this.currentSchedule.onTermDBChange();
    },

});

termdb.on('change', store._onTermDBChange.bind(store));

schedulestorage.on('change', function(e) {
    function handler() {
        if (!store.ready) {
            store.once('readystatechange', handler);
        } else {
            var schedule = store.getCurrentSchedule();
            if (schedule.isMutable && schedule.term === e.term) {
                schedule.onLocalStorageChange();
            }
        }
    }

    handler();
});

schedulestorage.on('listchange', function() {
    // Update the current schedule's name
    var schedule = store.getCurrentSchedule();
    if (schedule && schedule.isMutable) {
        schedule.updateNameAndIndex();
    }
});


module.exports = store;