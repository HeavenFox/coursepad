import React from "react";
import createReactClass from "create-react-class";
import schedules from "../../store/schedules";
import { SECTION_TYPE_PRIORITIES } from "../../consts/humanize";

import * as modal from "../../utils/modal";

var ClassNumbers = createReactClass({
  componentDidMount: function() {
    schedules.on("change", this._onScheduleChange);
    schedules.on("readystatechange", this._onScheduleReadyStateChange);
  },

  componentWillUnmount: function() {
    schedules.off("change", this._onScheduleChange);
    schedules.off("readystatechange", this._onScheduleReadyStateChange);
  },

  _onScheduleReadyStateChange: function() {
    if (schedules.ready) {
      this._onScheduleChange();
    }
  },

  _onScheduleChange: function() {
    this.forceUpdate();
  },

  render() {
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

      let courseIds = Object.keys(sectionsByCourseIdAndType).sort((a, b) =>
        courseIdToCourseHash[a]
          .getNumber()
          .localeCompare(courseIdToCourseHash[b].getNumber())
      );

      courseLis = courseIds.map(courseId => {
        var course = courseIdToCourseHash[courseId];
        var sectionsLis = SECTION_TYPE_PRIORITIES.filter(
          type => sectionsByCourseIdAndType[courseId][type]
        ).map(type => {
          var section = sectionsByCourseIdAndType[courseId][type];
          return (
            <li key={section.number}>
              <span className="class-number">{section.number}</span>
              <span className="section-number">
                {section.type + " " + section.sec}
              </span>
            </li>
          );
        });
        return (
          <li key={courseId}>
            <p className="course-title">
              {course.getNumber() + ": " + course.title}
            </p>
            <ul className="classnumber-section-list">{sectionsLis}</ul>
          </li>
        );
      });
    }

    return (
      <div className="classnumber-list">
        <h2>
          Class Numbers{" "}
          <span className="clickable modal-close" onClick={modal.stop}>
            &#x2716;
          </span>
        </h2>
        <ul className="classnumber-course-list">{courseLis}</ul>
      </div>
    );
  }
});

export default ClassNumbers;
