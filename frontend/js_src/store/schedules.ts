import EventEmitter from 'eventemitter3';
import moment from 'moment';
import * as router from '../routes/router.ts';
import termdb from './termdb.ts';
import {Schedule, MutableSchedule, SharedSchedule, WeekInterval} from '../model/schedules.ts';
import {Meeting} from '../model/course';
import user from './user.ts';
var localStore = require('../persist/localStorage.js');
var schedulestorage : any = require('./schedulestorage.js');


const PREFER_LOCAL = 1;
const PREFER_REMOTE = 2;
const NO_PREFERENCE = 3;

class ScheduleStore extends EventEmitter {
    ready: boolean;
    currentSchedule: Schedule;

    private _weekIntervalStartMoment;
    private _weekIntervalEndMoment;
    private _possibleWeekIntervals: WeekInterval[];
    private _weekIntervalIndex: number;
    private _showAllWeeks: boolean;

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

        this._possibleWeekIntervals = schedule.getVisibleWeekIntervals();
        this._setShowAllWeeks(true);
        this._setWeekIntervalIndex(0);

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

    hasWeekIntervals() {
        return this._possibleWeekIntervals && this._possibleWeekIntervals.length > 0;
    }

    getWeekIntervalMoments() {
        return [this._weekIntervalStartMoment, this._weekIntervalEndMoment];
    }

    setWeekIntervalIndex(index: number) {
        this._setWeekIntervalIndex(index);
        this.emit('change');
    }

    showAllWeeks() {
        return this._showAllWeeks;
    }

    moveWeek(shift: number) {
        this.setWeekIntervalIndex(this._weekIntervalIndex + shift);
    }

    hasNext() {
        if (!this._possibleWeekIntervals) return false;
        return this._weekIntervalIndex < this._possibleWeekIntervals.length - 1;
    }

    hasPrev() {
        if (!this._possibleWeekIntervals) return false;
        return this._weekIntervalIndex > 0;
    }

    setShowAllWeeks(show: boolean) {
        this._setShowAllWeeks(show);
        this.emit('change');
    }

    private _setShowAllWeeks(show: boolean) {
        this._showAllWeeks = show;
    }

    private _setWeekIntervalIndex(index: number) {
        this._weekIntervalIndex = index;
        let interval = this._possibleWeekIntervals[index];
        if (interval) {
            this._weekIntervalStartMoment = moment(`${interval.startYear}-${interval.startWeek}-1`, 'GGGG-W-E');
            this._weekIntervalEndMoment = moment(`${interval.endYear}-${interval.endWeek}-1`, 'GGGG-W-E');
        } else {
            this._weekIntervalStartMoment = null;
            this._weekIntervalEndMoment = null;
        }
    }

    _setCurrentSchedule(schedule) {
        this.currentSchedule = schedule;
        schedule.on('change', this._onScheduleChange);
    }

    _onScheduleChange = (v) => {
        // Update current interval
        this._possibleWeekIntervals = this.currentSchedule.getVisibleWeekIntervals();
        if (this._weekIntervalIndex >= this._possibleWeekIntervals.length) {
            if (this._possibleWeekIntervals.length === 0) {
                this._setShowAllWeeks(true);
                this._weekIntervalIndex = 0;
            } else {
                this._setWeekIntervalIndex(this._possibleWeekIntervals.length - 1);
            }
        } else {
            this._setWeekIntervalIndex(this._weekIntervalIndex);
        }

        this.emit('change', v);
    }

    getCurrentSchedule() {
        if (!this.ready) { return null; }
        return this.currentSchedule;
    }

    getVisibleMeetings(): Meeting[] {
        return this.currentSchedule.getVisibleMeetings().filter(meeting => {
            if (this._showAllWeeks) return true;

            let startMoment = moment(meeting.getStartDateObject());
            let endMoment = moment(meeting.getEndDateObject());

            return endMoment.isSameOrAfter(this._weekIntervalStartMoment) && startMoment.isBefore(this._weekIntervalEndMoment);
        });
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
