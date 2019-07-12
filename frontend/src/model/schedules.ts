import { EventEmitter } from "eventemitter3";
import moment from "moment";

import * as datetime from "../utils/datetime";
import * as conflicts from "./course/conflicts";

import { int31 as randomInt31 } from "../utils/rand";

import termdb from "../store/termdb";

import * as ana from "../analytics/analytics";
import { Meeting, CourseComponent, Course } from "./course";

export interface WeekInterval {
  startYear: number;
  startWeek: number;
  endYear: number;
  endWeek: number;
}

const palette = [
  "lavender",
  "blue",
  "cyan",
  "applegreen",
  "beryl",
  "green",
  "pink",
  "purple",
  "yellow",
  "pearl"
];

export function withMutableSchedule(
  schedule: Schedule,
  action: (s: MutableSchedule) => void
) {
  if (schedule instanceof MutableSchedule) {
    action(schedule);
  } else {
    console.warn("Trying to mutate immutable schedule");
  }
}

export abstract class Schedule extends EventEmitter {
  term: string;

  colorMapping: { [course: string]: string };

  basket: Course[][];
  sections: CourseComponent[];

  hidden: { [course: string]: boolean };

  color: string;
  name: string;
  uniqueId: number;

  _conflictCache: any;

  constructor(term: string) {
    super();
    this.clear();
    this.term = term;
  }

  clear(): void {
    this.colorMapping = {};

    this.basket = [];
    this.sections = [];

    this.hidden = {};

    this.color = "#979797";
    this.name = "My Schedule";
    this.uniqueId = -1;

    this._conflictCache = null;
  }

  clone(): this {
    let clone: this = new (<any>this.constructor)();

    clone.term = this.term;
    clone.colorMapping = { ...this.colorMapping };
    clone.basket = this.basket.slice(0);
    clone.sections = this.sections.slice(0);
    clone.hidden = { ...this.hidden };
    clone.color = this.color;
    clone.name = this.name;
    clone.uniqueId = this.uniqueId;

    return clone;
  }

  getTermDB() {
    return termdb.getCurrentTerm();
  }

  getVisibility(courseNumber: string) {
    return !this.hidden[courseNumber];
  }

  getVisibleClusters(): Course[][] {
    return this.basket.filter(cluster => !this.hidden[cluster[0].getNumber()]);
  }

  getVisibleSections(): CourseComponent[] {
    return this.sections.filter(
      section => !this.hidden[section.parent.getNumber()]
    );
  }

  getVisibleMeetings(): Meeting[] {
    var meetings: Meeting[] = [];
    this.getVisibleSections().forEach(section => {
      meetings.push.apply(meetings, section.meetings);
    });

    return meetings;
  }

  getVisibleWeekIntervals(): WeekInterval[] {
    let timePoints = [];
    function dateToMoment(str: string) {
      return moment(str, "MM/DD/YYYY").isoWeekday(1);
    }

    this.getVisibleMeetings().forEach(meeting => {
      timePoints.push(dateToMoment(meeting.startDate));
      timePoints.push(dateToMoment(meeting.endDate).add(1, "w"));
    });

    if (timePoints.length < 2) return [];

    timePoints.sort((a, b) => +a - b);

    let result: WeekInterval[] = [];

    let last = null;

    timePoints.forEach(point => {
      if (last != null && !point.isSame(last)) {
        result.push({
          startYear: last.isoWeekYear(),
          startWeek: last.isoWeeks(),
          endYear: point.isoWeekYear(),
          endWeek: point.isoWeeks()
        });
      }
      last = point;
    });

    return result;
  }

  _onChange() {
    this._conflictCache = null;
    this.emit("change");
  }

  findCourseInBasketById(id: number): Course {
    for (let i = 0; i < this.basket.length; i++) {
      for (let j = 0; j < this.basket[i].length; j++) {
        if (this.basket[i][j].id == id) {
          return this.basket[i][j];
        }
      }
    }
    return null;
  }

  findSectionInBasketByNumber(number: number): CourseComponent {
    for (let i = 0; i < this.basket.length; i++) {
      for (let j = 0; j < this.basket[i].length; j++) {
        let toSection = this.basket[i][j].findSectionByNumber(number);
        if (toSection) return toSection;
      }
    }
    return null;
  }

  getColorForCourse(subject: string, number: number): string {
    return this.colorMapping[subject + " " + number];
  }

  serializeSections(sections: CourseComponent[]): any {
    return sections.map(section => section.number);
  }

  serializeBasket(basket: Course[][]): any {
    return basket.map(function(courses) {
      return courses[0].subject + " " + courses[0].number;
    });
  }

  onTermDBChange() {}

  getSelectedCourseIdsHash() {
    var result = Object.create(null);

    this.sections.forEach(function(section) {
      result[section.parent.id] = true;
    });

    return result;
  }

  getSelectedSectionIdsHash() {
    var result = Object.create(null);

    this.sections.forEach(function(section) {
      result[section.number] = true;
    });

    return result;
  }

  getConflictIntervals() {
    if (this._conflictCache === null) {
      var rawIntervals = [];
      var visibleSections = this.getVisibleSections();
      for (var i = 0; i < visibleSections.length; i++) {
        for (var j = 0; j < i; j++) {
          let intervals = conflicts.conflictIntervals(
            visibleSections[i].meetings,
            visibleSections[j].meetings
          );
          [].push.apply(rawIntervals, intervals);
        }
      }

      this._conflictCache = conflicts.normalizeIntervals(rawIntervals);
    }

    return this._conflictCache;
  }

  getBasicInfo() {
    var visibleSections = this.getVisibleSections();
    var courses = [];
    visibleSections.forEach(function(section) {
      for (var i = 0; i < courses.length; i++) {
        if (courses[i] === section.parent) {
          return;
        }
      }
      courses.push(section.parent);
    });
    var totalCredits = [0, 0];
    var totalHours = 0;

    courses.forEach(function(course) {
      totalCredits[0] += course.units[0];
      totalCredits[1] +=
        course.units.length > 1 ? course.units[1] : course.units[0];
    });

    visibleSections.forEach(function(section) {
      section.meetings.forEach(function(meeting) {
        if (!meeting.startTime || !meeting.endTime) {
          return;
        }
        totalHours +=
          datetime.bitmaskToDay(meeting.pattern).length *
          (datetime.timeStringToHour(meeting.endTime) -
            datetime.timeStringToHour(meeting.startTime));
      });
    });

    return { units: totalCredits, classes: courses.length, hours: totalHours };
  }

  getAlternateMeetings(meeting: Meeting, returntype = "difftime") {
    var alternatives = [];

    var course = meeting.parent.parent;
    var type = meeting.parent.type;

    // Get cluster
    var cluster = null;
    if (type === course.getPrimarySectionType()) {
      for (var i = 0; i < this.basket.length; i++) {
        var curCluster = this.basket[i];
        if (
          curCluster[0].subject == course.subject &&
          curCluster[0].number == course.number
        ) {
          cluster = curCluster;
          break;
        }
      }
    }

    function hasSameTime(curMeeting) {
      return (
        curMeeting.pattern == meeting.pattern &&
        curMeeting.startTime == meeting.startTime &&
        curMeeting.endTime == meeting.endTime
      );
    }

    // Get other sections of the same course
    meeting.parent.parent.sections[type].forEach(function(component) {
      if (component == meeting.parent) {
        return;
      }
      if (component.meetings.some(hasSameTime) == (returntype == "sametime")) {
        alternatives.push.apply(alternatives, component.meetings);
      }
    });

    // Get sections of other courses in the cluster
    if (cluster && cluster.length > 1) {
      cluster.forEach(function(curCourse) {
        if (curCourse != course) {
          curCourse.sections[type].forEach(function(component) {
            if (
              component.meetings.some(hasSameTime) ==
              (returntype == "sametime")
            ) {
              alternatives.push.apply(alternatives, component.meetings);
            }
          });
        }
      });
    }

    return alternatives;
  }

  async deserialize(serialized) {
    var perfectDeserialization = true;

    this.colorMapping = serialized.colorMapping || {};
    this.hidden = serialized.hidden || {};

    if (serialized.color) this.color = serialized.color;
    if (serialized.name) this.name = serialized.name;
    if (serialized.uniqueId) this.uniqueId = serialized.uniqueId;

    var basket = serialized.basket ? serialized.basket.slice() : [];

    var clusters = await this.getTermDB().getBasket(basket);
    this.basket = clusters;

    var hasSection = {};
    var courseByNumber = {};
    clusters.forEach(function(cluster) {
      hasSection[cluster[0].getNumber()] = {};
    });
    var serializedSections = serialized.sections || [];
    this.sections = serializedSections
      .map(function(sectionId) {
        for (var i = 0; i < clusters.length; i++) {
          for (var j = 0; j < clusters[i].length; j++) {
            var section = clusters[i][j].findSectionByNumber(sectionId);
            if (section) {
              var courseNumber = clusters[i][j].getNumber();
              // Make sure there's only one component chosen per section type
              // And sections do not cross course boundary
              if (
                hasSection[courseNumber].hasOwnProperty(section.type) ||
                (courseByNumber[courseNumber] &&
                  courseByNumber[courseNumber]["id"] !== clusters[i][j]["id"])
              ) {
                perfectDeserialization = false;
                console.warn(
                  "Section " +
                    sectionId +
                    " is a duplicate, or crossed boundary"
                );
                return null;
              } else {
                hasSection[courseNumber][section.type] = true;
                courseByNumber[courseNumber] = clusters[i][j];
                return section;
              }
            }
          }
        }
        perfectDeserialization = false;
        console.warn("Section " + sectionId + " is not found.");
        return null;
      })
      .filter(function(x) {
        return x !== null;
      });

    clusters.forEach(function(cluster) {
      var courseNumber = cluster[0].getNumber();
      var course;
      var addedSections = {};
      if (courseByNumber[courseNumber]) {
        course = courseByNumber[courseNumber];
        addedSections = hasSection[courseNumber];
      } else {
        course = cluster[0];
      }

      for (var type in course.sections) {
        if (course.sections.hasOwnProperty(type)) {
          if (!addedSections.hasOwnProperty(type)) {
            this.sections.push(course.sections[type][0]);
            console.warn(
              "Section type " + type + " does not have any sections"
            );
            perfectDeserialization = false;
          }
        }
      }
    }, this);

    return perfectDeserialization;
  }

  setSectionsWithClassNumbers(sections) {
    var clusters = this.basket;
    var hasSection = {};
    var courseByNumber = {};
    clusters.forEach(function(cluster) {
      hasSection[cluster[0].getNumber()] = {};
    });

    this.sections = sections
      .map(function(sectionId) {
        for (var i = 0; i < clusters.length; i++) {
          for (var j = 0; j < clusters[i].length; j++) {
            var section = clusters[i][j].findSectionByNumber(sectionId);
            if (section) {
              var courseNumber = clusters[i][j].getNumber();
              // Make sure there's only one component chosen per section type
              // And sections do not cross course boundary
              if (
                hasSection[courseNumber].hasOwnProperty(section.type) ||
                (courseByNumber[courseNumber] &&
                  courseByNumber[courseNumber]["id"] !== clusters[i][j]["id"])
              ) {
                return null;
              } else {
                hasSection[courseNumber][section.type] = true;
                courseByNumber[courseNumber] = clusters[i][j];
                return section;
              }
            }
          }
        }
        console.warn("Section " + sectionId + " is not found.");
        return null;
      })
      .filter(function(x) {
        return x !== null;
      });

    this._onChange();
  }
}

export class MutableSchedule extends Schedule {
  index: number;
  isMutable: boolean;

  storage: any; // TODO

  constructor(term: string, index: number, storage: any /* TODO */) {
    super(term);
    this.index = index;
    this.storage = storage;

    this.isMutable = true;
  }

  clone(): this {
    var superclone: this = <this>super.clone();
    superclone.storage = this.storage;
    superclone.index = this.index;
    return superclone;
  }

  setVisibility(courseNumber: string, val: boolean): void {
    this.hidden[courseNumber] = !val;
    this.persistSections();
    this._onChange();
  }

  toggleVisibility(courseNumber: string): void {
    this.setVisibility(courseNumber, !this.getVisibility(courseNumber));

    ana.sevent("course", "toggle_visibility", courseNumber);
  }

  removeCourseByNumber(courseNumber: string) {
    for (let i = 0; i < this.basket.length; i++) {
      if (
        this.basket[i].length &&
        this.basket[i][0].getNumber() == courseNumber
      ) {
        this.basket.splice(i, 1);
        break;
      }
    }

    this.sections = this.sections.filter(function(section) {
      return section.parent.getNumber() !== courseNumber;
    });

    delete this.hidden[courseNumber];
    delete this.colorMapping[courseNumber];

    this.persistSections();

    this._onChange();
  }

  changeSection(toNumber, fromNumber = undefined) {
    var toSection;
    var fromIndex;

    if (fromNumber === undefined) {
      toSection = this.findSectionInBasketByNumber(toNumber);
      if (!toSection) {
        console.warn("Unable to find to section: " + toNumber);
        return false;
      }
      var sections = toSection.parent.sections[toSection.type];
      for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
        if (sections.indexOf(this.sections[fromIndex]) > -1) {
          break;
        }
      }

      if (fromIndex === this.sections.length) {
        // Find from courses in the cluster
        var fromCourse = null;
        var selectedCoursesHash = this.getSelectedCourseIdsHash();
        find_from: for (var i = 0; i < this.basket.length; i++) {
          if (this.basket[i].indexOf(toSection.parent) > -1) {
            for (var j = 0; j < this.basket[i].length; j++) {
              if (selectedCoursesHash[this.basket[i][j].id]) {
                fromCourse = this.basket[i][j];
                break find_from;
              }
            }
          }
        }

        if (!fromCourse) {
          console.warn(
            "Cannot find corresponding from course for to section " + toNumber
          );
          return false;
        }

        this._changeCourse(toSection.parent, fromCourse);

        for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
          if (
            this.sections[fromIndex].parent == toSection.parent &&
            this.sections[fromIndex].type == toSection.type
          ) {
            break;
          }
        }

        if (fromIndex == this.sections.length) {
          console.warn(
            "Internal Consistency Exception: cannot find from section."
          );
          return false;
        }
      }
    } else {
      for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
        if (this.sections[fromIndex].number == fromNumber) {
          break;
        }
      }

      if (fromIndex === this.sections.length) {
        console.warn("Unable to find from section: " + fromNumber);
        return false;
      }

      var fromSection = this.sections[fromIndex];

      toSection = this.sections[fromIndex].parent.findSectionByNumber(toNumber);
      if (!toSection) {
        toSection = this.findSectionInBasketByNumber(toNumber);
        if (!toSection) {
          console.warn("Unable to find to section: " + toNumber);
          return false;
        }

        this._changeCourse(toSection.parent, fromSection.parent);

        for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
          if (
            this.sections[fromIndex].parent == toSection.parent &&
            this.sections[fromIndex].type == toSection.type
          ) {
            break;
          }
        }

        if (fromIndex === this.sections.length) {
          console.warn(
            "Internal Consistency Exception: cannot find from section"
          );
          return false;
        }
      }
    }

    this.sections[fromIndex] = toSection;

    this.persistSections();
    this._onChange();

    return true;
  }

  changeCourse(to, from = undefined) {
    this._changeCourse(to, from);
    this.persistSections();
    this._onChange();
  }

  _changeCourse(toCourse, fromCourse) {
    var i, j;
    if (!isNaN(toCourse)) {
      toCourse = this.findCourseInBasketById(toCourse);
    }

    if (fromCourse === undefined) {
      var selectedCoursesHash = this.getSelectedCourseIdsHash();
      find_course: for (i = 0; i < this.basket.length; i++) {
        if (this.basket[i].indexOf(toCourse) > -1) {
          for (j = 0; j < this.basket[i].length; j++) {
            if (selectedCoursesHash[this.basket[i][j].id]) {
              fromCourse = this.basket[i][j];
              break find_course;
            }
          }
        }
      }
      if (fromCourse === undefined) {
        console.warn("From course not in basket");
        return false;
      }
    } else if (!isNaN(fromCourse)) {
      fromCourse = this.findCourseInBasketById(fromCourse);
    }

    var removedSections = Object.create(null);
    var newSections = this.sections.filter(function(section) {
      if (section.parent == fromCourse) {
        removedSections[section.type] = section;
        return false;
      }
      return true;
    });
    for (var type in toCourse.sections) {
      if (toCourse.sections.hasOwnProperty(type)) {
        var prevSection = removedSections[type];
        if (!prevSection) {
          console.warn(
            "Type " +
              type +
              " not found in " +
              fromCourse.id +
              " but in " +
              toCourse.id
          );
          newSections.push(toCourse.sections[type][0]);
        } else {
          var added = false;
          if (prevSection.meetings.length > 0) {
            for (i = 0; i < toCourse.sections[type].length; i++) {
              var curSection = toCourse.sections[type][i];
              if (
                curSection.meetings.length > 0 &&
                curSection.meetings[0].startTime ==
                  prevSection.meetings[0].startTime &&
                curSection.meetings[0].pattern ==
                  prevSection.meetings[0].pattern
              ) {
                added = true;
                newSections.push(curSection);
                break;
              }
            }
          }
          if (!added) {
            newSections.push(toCourse.sections[type][0]);
          }
        }
      }
    }

    this.sections = newSections;
  }

  private _addCluster(cluster: Course[]): void {
    if (cluster.length === 0) {
      throw new Error("This class does not exist");
    }
    this.basket.push(cluster);
    for (var type in cluster[0].sections) {
      if (cluster[0].sections.hasOwnProperty(type)) {
        this.sections.push(cluster[0].sections[type][0]);
      }
    }

    this.colorMapping[cluster[0].getNumber()] = function() {
      for (var i = 0; i < palette.length; i++) {
        let color = palette[i];
        let found = false;
        for (var course in this.colorMapping) {
          if (this.colorMapping[course] == color) {
            found = true;
            break;
          }
        }
        if (!found) {
          return color;
        }
      }
      return palette[Math.floor(Math.random() * palette.length)];
    }.call(this);
  }

  async addCourse(subject, number): Promise<this> {
    var self = this;
    var course;
    for (var i = 0; i < this.basket.length; i++) {
      if (
        this.basket[i][0].subject == subject &&
        this.basket[i][0].number == number
      ) {
        course = this.basket[i];
        break;
      }
    }

    if (course) {
      // Mark this course as visible
      this.setVisibility(subject + " " + number, true);
      return this;
    } else {
      let courses = await this.getTermDB().getCoursesBySubjectAndNumber(
        subject,
        number
      );

      self._addCluster(courses);

      self.persistSections();
      self._onChange();

      ana.sevent("course", "add", subject + " " + number);

      return this;
    }
  }

  serializeScheduleForSharing() {
    var persist = {};
    persist["sections"] = this.serializeSections(this.getVisibleSections());
    persist["basket"] = this.serializeBasket(this.getVisibleClusters());
    persist["colorMapping"] = {};
    for (var course in this.colorMapping) {
      if (this.colorMapping.hasOwnProperty(course) && !this.hidden[course]) {
        persist["colorMapping"][course] = this.colorMapping[course];
      }
    }

    return persist;
  }

  serialize() {
    var persist = {};
    persist["sections"] = this.serializeSections(this.sections);
    persist["basket"] = this.serializeBasket(this.basket);
    persist["colorMapping"] = { ...this.colorMapping };
    persist["hidden"] = { ...this.hidden };
    persist["color"] = this.color;
    persist["name"] = this.name;
    if (this.uniqueId === -1) {
      this.uniqueId = randomInt31();
    }
    persist["uniqueId"] = this.uniqueId;

    return persist;
  }

  persistSections() {
    this.storage.persistAndDirtySchedule(this);
  }

  reload() {
    return this.storage.reloadSchedule(this);
  }

  clear() {
    super.clear();
    this.index = 0;
  }

  async onTermDBChange() {
    await this.reload();
    this._onChange();
  }

  async onLocalStorageChange() {
    await this.reload();
    this._onChange();
  }

  updateNameAndIndex() {
    var serialized = this.storage.getSerializedByUniqueId(this.uniqueId);
    if (serialized) {
      this.name = serialized[1]["name"];
      this.color = serialized[1]["color"];
      this.index = serialized[0];
    }
  }
}

export class SharedSchedule extends Schedule {
  isShared: boolean;

  constructor(term: string) {
    super(term);
    this.isShared = true;
  }
}
