import EventEmitter from "event-emitter";
import schedules from "../store/schedules";

import MagicWorker from "../workers/magic.fakeworker";
import { withMutableSchedule } from "../model/schedules";

function arrayForSection(section) {
  return {
    number: section.number,
    meetings: section.meetings.map(function(meeting) {
      return {
        startTimeHrs: meeting.startTimeHrs,
        endTimeHrs: meeting.endTimeHrs,
        startDateMills: +meeting.getStartDateObject(),
        endDateMills: +meeting.getEndDateObject(),
        pattern: meeting.pattern
      };
    })
  };
}

function arrayForSchedule(schedule) {
  return schedule.basket
    .filter(function(course) {
      return schedule.getVisibility(course[0].getNumber());
    })
    .map(function(cluster) {
      var result = cluster.map(course => {
        var result = [];
        for (var type in course.sections) {
          if (course.sections.hasOwnProperty(type)) {
            result.push(course.sections[type].map(arrayForSection));
          }
        }
        return result;
      });
      result.name = cluster[0].getNumber();
      return result;
    });
}

let worker: MagicWorker | undefined;

var oldSchedule;

var magic = EventEmitter({
  applySchedule(sections) {
    oldSchedule = schedules.getCurrentSchedule();
    var newSchedule = oldSchedule.clone();

    newSchedule.setSectionsWithClassNumbers(sections);

    schedules.setSchedule(newSchedule, "magic-new");
  },

  revert() {
    schedules.setSchedule(oldSchedule, "magic-revert");
  },

  makeSchedule(schedule, priorities) {
    var self = this;
    if (worker === undefined) {
      worker = new MagicWorker();
      worker.onmessage = function(e) {
        if (e.data.cmd === "schedule") {
          if (e.data["val"]) {
            self.applySchedule(e.data["val"]);
          } else {
            self.emit("change", {
              noValid: true
            });
          }
        }
      };
    }

    var clusters = arrayForSchedule(schedule);
    var selected = {};
    schedules.getCurrentSchedule().sections.forEach(function(section) {
      selected[section.number] = true;
    });

    worker.postMessage({
      cmd: "make",
      args: [clusters, selected, priorities]
    });
  },

  next() {
    worker.postMessage({
      cmd: "next"
    });
  },

  cancel() {
    if (worker) {
      worker.terminate();
    }
  },

  save() {
    withMutableSchedule(schedules.getCurrentSchedule(), s =>
      s.persistSections()
    );
  }
});

export default magic;
