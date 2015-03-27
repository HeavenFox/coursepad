import schedules from '../../store/schedules.js';
import * as calendarsync from '../../utils/calendarsync.js';

export default React.createClass({
    _downloadICal() {
        let curSchedule = schedules.getCurrentSchedule().getVisibleSections();
        calendarsync.saveiCal(curSchedule, 'schedule.ics');
    },

    _syncToGoogleCalendar() {

        let curSchedule = schedules.getCurrentSchedule().getVisibleSections();
    },

    render() {
        return <div className="rightbar-simple-ul utilities-item">
        <h2>Sync</h2>
            <ul>
                <li><a href="javascript:;" onClick={this._syncToGoogleCalendar}>Sync to Google Calendar</a></li>
                <li><a href="javascript:;" onClick={this._downloadICal}>Save As iCal (.ics)</a></li>
            </ul>
        </div>;
    }
});