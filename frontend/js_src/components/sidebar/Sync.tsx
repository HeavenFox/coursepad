import React from 'react';
import schedules from '../../store/schedules';
import {saveiCal, syncToGoogle} from '../../utils/calendarsync';
import {sevent} from '../../analytics/analytics';

let GoogleSync = React.createClass({
    getInitialState() {
        return {status: 'ready'};
    },

    _startReadyTimer() {
        this._stopReadyTimer();
        this._readyTimeOut = window.setTimeout(() => {
            this.setState({status: 'ready'});
        }, 5000);
    },

    _stopReadyTimer() {
        if (this._readyTimeOut) {
            window.clearTimeout(this._readyTimeOut);
            this._readyTimeOut = null;
        }
    },

    _reset() {
        this._stopReadyTimer();
        if (this.state.status !== 'pending') {
            this.setState({status: 'ready'});
        }
    },

    _readyStateChange(ready) {
        this._stopReadyTimer();
        this.setState({ready: ready});
    },

    async _syncToGoogleCalendar() {
        this._stopReadyTimer();
        let curSchedule = schedules.getCurrentSchedule();
        let sections = curSchedule.getVisibleSections();
        this.setState({status: 'pending'});
        try {
            await syncToGoogle(sections, [curSchedule.term]);
            this.setState({status: 'done'});
            this._startReadyTimer();
        } catch (e) {
            console.error(e);
            this.setState({status: 'error'});
        }

        sevent('calendarsync', 'google');
    },

    componentDidMount() {
        schedules.on('change', this._reset);
        schedules.on('readystatechange', this._readyStateChange);
    },

    componentWillUnmount() {
        this._stopReadyTimer();
        schedules.off('change', this._reset);
        schedules.off('readystatechange', this._readyStateChange);
    },

    render() {
        switch (this.state.status) {
        case 'pending':
            return <li>Syncing...</li>;
        case 'done':
            return <li>Done</li>;
        case 'error':
            return <li><a href="javascript:;" onClick={this._syncToGoogleCalendar}>Error. Click to retry.</a></li>;
        case 'ready':
            let syncToGoogleText = 'Sync to Google Calendar';
            if (!this.state.ready) {
                return <li>{syncToGoogleText}</li>;
            }
            return <li><a href="javascript:;" onClick={this._syncToGoogleCalendar}>{syncToGoogleText}</a></li>;
        }
    }

});

export default React.createClass({
    _downloadICal() {
        let curSchedule = schedules.getCurrentSchedule().getVisibleSections();
        saveiCal(curSchedule, 'schedule.ics');
        sevent('calendarsync', 'ical');
    },

    render() {
        return <div className="rightbar-simple-ul utilities-item">
        <h2>Sync</h2>
            <ul>
                <GoogleSync />
                <li><a href="javascript:;" onClick={this._downloadICal}>Save As iCal (.ics)</a></li>
            </ul>
        </div>;
    }
});
