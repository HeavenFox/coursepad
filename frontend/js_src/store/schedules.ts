import EventEmitter from 'eventemitter3';
import * as router from '../routes/router.ts';
import termdb from './termdb.ts';
import {Schedule, MutableSchedule, SharedSchedule} from '../model/schedules.ts';
import user from './user.ts';
var localStore = require('../persist/localStorage.js');
var schedulestorage : any = require('./schedulestorage.js');


const PREFER_LOCAL = 1;
const PREFER_REMOTE = 2;
const NO_PREFERENCE = 3;

class ScheduleStore extends EventEmitter {
    ready: boolean;
    currentSchedule: Schedule;

    __onScheduleChange: Function;

    constructor() {
        super();
        this.ready = false;
    }

    async setCurrentSchedule(term = null, index = 0) {
        router.changePath('/');

        var currentTermDB = termdb.getCurrentTerm();
        var self = this;

        if (term === null) {
            term = currentTermDB.term;
        }

        if (this.currentSchedule) {
            let curSchedule = this.currentSchedule;
            if (curSchedule instanceof MutableSchedule) {
                if ((curSchedule.term === term) && (curSchedule.index === index)) {
                    return false;
                }
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

        var schedule = new MutableSchedule(term, index, schedulestorage.getStorage());

        await schedulestorage.getStorage().loadSchedule(schedule);

        self._setCurrentSchedule(schedule);

        self.ready = true;
        self.emit('readystatechange', true);

        return true;
    }

    async setSharedSchedule(term, serialized) {
        if (this.ready) {
            this.ready = false;
            this.emit('readystatechange', false);
        }

        var db = termdb.getRemoteTerm(term);
        schedulestorage.setStorage(term);

        var schedule = new SharedSchedule(term);
        schedule.getTermDB = function() {
            return db;
        }

        await schedule.deserialize(serialized);

        this._setCurrentSchedule(schedule);

        this.ready = true;
        this.emit('readystatechange', true);
    }

    setSchedule(schedule, by) {
        this._setCurrentSchedule(schedule);

        this.emit('change', {by: by});
    }

    _setCurrentSchedule(schedule) {
        this.currentSchedule = schedule;
        schedule.on('change', this._getOnScheduleChange());
    }

    _getOnScheduleChange() {
        var self = this;
        return this.__onScheduleChange || (this.__onScheduleChange = function(v) {
            self.emit('change', v);
        });
    }

    getCurrentSchedule() {
        if (!this.ready) { return null; }
        return this.currentSchedule;
    }

    _onTermDBChange() {
        this.currentSchedule.onTermDBChange();
    }
}

var store = new ScheduleStore();

termdb.on('change', store._onTermDBChange.bind(store));

schedulestorage.on('change', function(e) {
    function handler() {
        if (!store.ready) {
            store.once('readystatechange', handler);
        } else {
            let schedule = store.getCurrentSchedule();
            if (schedule instanceof MutableSchedule && schedule.term === e.term) {
                schedule.onLocalStorageChange();
            }
        }
    }

    handler();
});

schedulestorage.on('listchange', function() {
    // Update the current schedule's name
    var schedule = store.getCurrentSchedule();
    if (schedule && schedule instanceof MutableSchedule) {
        schedule.updateNameAndIndex();
    }
});

export default store;