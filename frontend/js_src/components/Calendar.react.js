/**
 * @jsx React.DOM
 */
var SingleMeeting = require('./SingleMeeting.react.js');
var MeetingDropoff = require('./MeetingDropoff.react.js');
var ConflictIndicator = require('./ConflictIndicator.react.js');

var schedules = require('../store/schedules.js');

var datetime = require('../utils/datetime.ts');
var humanize = require('../consts/humanize.js');

var DropoffSet = React.createClass({
    getInitialState: function() {
        return {dropoffs: []};
    },

    render: function() {
        var dropoffs = [];
        this.state.dropoffs.forEach(function(dropoff) {
            dropoffs.push(<MeetingDropoff {...dropoff} />);
        });
        return <div>{dropoffs}</div>;
    }
});

var Calendar = React.createClass({

    minTime: 8,
    maxTime: 22,

    getMeetingContainer: function() {
        return this.refs['container'];
    },

    getInitialState: function() {
        return {meetings: [], dropoffs: [], conflicts: [], needWeekend: false, readOnly: false};
    },

    componentDidMount: function() {
        schedules.on('change', this._onScheduleChange);
        schedules.on('readystatechange', this._onScheduleReadyStateChange);
    },

    componentWillUnmount: function() {
        schedules.off('change', this._onScheduleChange);
        schedules.off('readystatechange', this._onScheduleReadyStateChange);
    },

    _onScheduleReadyStateChange: function() {
        if (schedules.ready) {
            this._onScheduleChange();
        }
    },

    _onScheduleChange: function() {
        this.setSchedule(schedules.getCurrentSchedule());
    },

    _onDragStartHandler: function(meeting) {
        var alternatives = schedules.getCurrentSchedule().getAlternateMeetings(meeting);
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
            if (!meeting.startTime || !meeting.endTime) {
                return;
            }
            var startHour = datetime.timeStringToHour(meeting.startTime);
            var length = datetime.timeStringToHour(meeting.endTime) - startHour;
            var time = meeting.startTime + ' \u2013 ' + meeting.endTime;
            var location = humanize.getShortLocation(meeting.building, meeting.room)

            var longBuilding = humanize.getLongBuildingName(meeting.building);
            if (longBuilding) {
                longBuilding = longBuilding + ' (' + meeting.building + ')';
                if (meeting.room) {
                    longBuilding += (', ' + meeting.room);
                }
            }
            var title = meeting.parent.parent.subject + ' ' + meeting.parent.parent.number;
            for (var day = 0; day < 7; day++) {
                if (meeting.pattern & (1<<day)) {
                    singleMeetings.push({
                        key: meeting.parent.number + '-' + day,
                        nbr: meeting.parent.number,
                        title: title,
                        location: location,
                        longLocation: longBuilding,
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
        var meetings = schedule.getVisibleMeetings();
        
        var singleMeetings = this._splitMeetings(meetings);

        singleMeetings.forEach(function(meeting) {
            meeting.color = schedule.getColorForCourse(meeting.meeting.parent.parent.subject, meeting.meeting.parent.parent.number);
            meeting.dragStartHandler = this._onDragStartHandler.bind(this, meeting.meeting);
            meeting.dragStopHandler = this._onDragStopHandler.bind(this, meeting.meeting);
        }, this);

        var hasWeekend = schedule.getVisibleClusters().some(function(cluster) {
            return cluster.some(function(course) {
                return course.getAllSections().some(function(section) {
                    return section.meetings.some(function(meeting) {
                        return meeting.pattern & (3<<5);
                    });
                });
            });
        });

        this.setState({meetings: singleMeetings, conflicts: schedule.getConflictIntervals(), needWeekend: hasWeekend, readOnly: !schedule.isMutable});
    },

    render: function() {
        var stripes = [];
        var minTime = this.minTime, maxTime = this.maxTime;
        for (var i=minTime; i<=maxTime; i++) {
            var ampm = i >= 12 ? "p" : "a";
            var twelveHour = i > 12 ? i - 12 : i;
            var formattedTime = "" + twelveHour + ":00" + ampm;
            var classes = "cal-stripe";
            if ((i-minTime) % 2 === 0) {
                classes += ' odd';
            } else {
                classes += ' even';
            }

            stripes.push(<div className={classes} key={i}>
                    <div className="cal-time">{formattedTime}</div>
                </div>);
        }


        var meetings = [];
        this.state.meetings.forEach(function(meeting) {
            meeting.readOnly = this.state.readOnly;
            meetings.push(<SingleMeeting {...meeting} owner={this} />);
        }, this);

        var fullWeek = this.state.needWeekend;

        var conflicts = this.state.conflicts.map(function(conflict) {
            return <ConflictIndicator key={conflict.startTimeHrs.toFixed(1) + '-' + conflict.pattern} day={datetime.bitmaskToDay(conflict.pattern)} st_offset={conflict.startTimeHrs - this.minTime} length={conflict.endTimeHrs - conflict.startTimeHrs} />;
        }, this);
        return <div className="cal-inner" ref="container">
                <div className="cal-meetings">
                    <div className={"cal-meetings-inner" + (fullWeek ? ' cal-meetings-inner-fullweek' : '')}>
                        {meetings}
                        <DropoffSet ref="dropoffset" />
                        <div id="conflict-overlay">
                        {conflicts}
                        </div>
                    </div>
                </div>
                <div className="cal-stripes">
                    {stripes}
                </div>
            </div>;
    }
});

module.exports = Calendar;