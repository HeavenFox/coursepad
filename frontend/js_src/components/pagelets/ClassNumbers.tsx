/**
 * @jsx React.DOM
 */
import schedules from '../../store/schedules.ts';
var humanize : any = require('../../consts/humanize.js');

var modal : any = require('../../utils/modal.js');

var ClassNumbers = React.createClass({
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
        this.forceUpdate();
    },


    render: function() {
        var schedule = schedules.getCurrentSchedule();

        var courseLis;

        if (!schedule) {
            courseLis = null;
        } else {
            var courseIdToCourseHash = Object.create(null);
            var sectionsByCourseIdAndType = Object.create(null);

            schedule.getVisibleSections().forEach(function(section) {
                var course = section.parent;
                courseIdToCourseHash[course.id] = course;
                if (!sectionsByCourseIdAndType[course.id]) {
                    sectionsByCourseIdAndType[course.id] = Object.create(null);
                }

                sectionsByCourseIdAndType[course.id][section.type] = section;
            });

            var courseIds = Object.keys(sectionsByCourseIdAndType).sort(function(a, b) {
                return courseIdToCourseHash[a].getNumber().localeCompare(courseIdToCourseHash[b].getNumber());
            })

            courseLis = courseIds.map(function(courseId) {
                var course = courseIdToCourseHash[courseId];
                var sectionsLis = humanize.sectionTypePriorities.filter(function(type) {
                    return sectionsByCourseIdAndType[courseId][type];
                }).map(function(type) {
                    var section = sectionsByCourseIdAndType[courseId][type];
                    return <li>
                        <span className="class-number">{section.number}</span>
                        <span className="section-number">{section.type + ' ' + section.sec}</span>
                    </li>
                });
                return <li>
                    <p className="course-title">{course.getNumber() + ': ' + course.title}</p>
                    <ul className="classnumber-section-list">
                        {sectionsLis}
                    </ul>
                </li>

            });
        }

        

        return <div className="classnumber-list">
            <h2>Class Numbers <span className="clickable modal-close" onClick={modal.stop}>&#x2716;</span></h2>
            <ul className="classnumber-course-list">
            {courseLis}
            </ul>
        </div>


        
    }
});

export default ClassNumbers;