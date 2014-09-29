/**
 * @jsx React.DOM
 */
var SingleMeeting = require('./SingleMeeting.react.js');
var MeetingDropoff = require('./MeetingDropoff.react.js');

var schedules = require('../store/schedules.js');

var datetime = require('../utils/datetime.js');

var DropoffSet = React.createClass({
    getInitialState: function() {
        return {dropoffs: []};
    },

    render: function() {
        var dropoffs = [];
        this.state.dropoffs.forEach(function(dropoff) {
            dropoffs.push(MeetingDropoff(dropoff));
        });
        return <div>{dropoffs}</div>;
    }
});

var Calendar = React.createClass({

    getMeetingContainer: function() {
        return this.refs['container'].getDOMNode();
    },

    getInitialState: function() {
        return {meetings: [], dropoffs: []};
    },

    componentDidMount: function() {
        schedules.on('ready', this._onScheduleChange);
        schedules.on('change', this._onScheduleChange);
    },

    componentWillUnmount: function() {
        schedules.off('ready', this._onScheduleChange);
        schedules.off('chane', this._onScheduleChange);
    },

    _onScheduleChange: function() {
        this.setSchedule(schedules.getCurrentSchedule());
    },

    _onDragStartHandler: function(meeting) {
        var alternatives = meeting.getAlternateMeetings();
        if (alternatives) {
            var dropoffs = [];
            var singleMeetings = this._splitMeetings(alternatives);
            singleMeetings.forEach(function(meeting) {
                meeting.times = meeting.meeting.parent.meetings.map(function(meeting){
                    return datetime.bitmaskToDay(meeting.pattern) + ' ' + meeting.startTime + '\u2013' + meeting.endTime;
                });
            });
            this.refs.dropoffset.setState({dropoffs: singleMeetings});
        }
    },

    _onDragStopHandler: function(meeting) {
        this.refs.dropoffset.setState({dropoffs: []});
    },

    _splitMeetings: function(meetings) {
        var singleMeetings = [];
        var days = "MTWRFSU";
        meetings.forEach(function(meeting) {
            var startHour = datetime.timeStringToHour(meeting.startTime);
            var length = datetime.timeStringToHour(meeting.endTime) - startHour;
            var time = meeting.startTime + ' \u2013 ' + meeting.endTime;
            var location = meeting.building + meeting.room;
            var title = meeting.parent.parent.subject + ' ' + meeting.parent.parent.number;
            for (var day = 0; day < 7; day++) {
                if (meeting.pattern & (1<<day)) {
                    singleMeetings.push({
                        nbr: meeting.parent.number,
                        title: title,
                        location: location,
                        time: time,
                        day: days[day],
                        st_offset: startHour - 8,
                        length: length,

                        meeting: meeting
                    });
                }
            }
        }, this);
        return singleMeetings;
    },

    setSchedule: function(schedule) {
        var meetings = schedule.getMeetings();
        
        var singleMeetings = this._splitMeetings(meetings);

        singleMeetings.forEach(function(meeting) {
            meeting.color = schedule.getColorForCourse(meeting.meeting.parent.parent.subject, meeting.meeting.parent.parent.number);
            meeting.dragStartHandler = this._onDragStartHandler.bind(this, meeting.meeting);
            meeting.dragStopHandler = this._onDragStopHandler.bind(this, meeting.meeting);
        }, this);

        this.setState({meetings: singleMeetings});
    },

    render: function() {
        var stripes = [];
        var minTime = 8, maxTime = 22;
        for (var i=minTime; i<=maxTime; i++) {
            var ampm = i >= 12 ? "p" : "a";
            var twelveHour = i > 12 ? i - 12 : i;
            var formattedTime = "" + twelveHour + ":00" + ampm;
            var classes = "cal-stripe";
            if ((i-minTime) % 2 == 0) {
                classes += ' odd';
            } else {
                classes += ' even';
            }

            stripes.push(<div className={classes}>
                    <div className="cal-time">{formattedTime}</div>
                </div>)
        }


        var meetings = [];
        this.state.meetings.forEach(function(meeting) {
            meetings.push(SingleMeeting(meeting));
        });
        return <div className="cal-inner" ref="container">
                <div className="cal-meetings">
                    <div className="cal-meetings-inner">
                        {meetings}
                        <DropoffSet ref="dropoffset" />
                    </div>
                </div>
                <div className="cal-stripes">
                    {stripes}
                </div>
            </div>;
    }
});

module.exports = Calendar