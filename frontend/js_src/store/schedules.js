var EventEmitter = require('event-emitter');
var datetime = require('../utils/datetime.js');
var conflicts = require('../model/course/conflicts.js');

var termdb = require('./termdb.js');
var indexeddb = require('../persist/indexeddb.js');
var localStore = require('../persist/localStorage.js');

var ana = require('../analytics/analytics.js');

var store = EventEmitter({
    ready: false,
    setCurrentSchedule: function(term, index) {
        var self = this;
        if (this.currentSchedule) {
            if ((term === undefined || this.currentSchedule.term === term) && 
                (index === undefined || this.currentSchedule.index === index)) {
                return Promise.resolve(false);
            }
            self.ready = false;
            self.emit('readystatechange');
        }

        if (index === undefined) {
            index = 0;
        }

        var dbLoadedPromise;
        if (term === undefined || (termdb.getCurrentTerm() && termdb.getCurrentTerm().term == term)) {
            dbLoadedPromise = Promise.resolve();
        } else {
            dbLoadedPromise = termdb.setCurrentTerm(term);
        }

        return dbLoadedPromise.then(function() {
            self.currentSchedule = new Schedule();
            self.currentSchedule.term = term;
            self.currentSchedule.index = index;

            return self.currentSchedule.load();
        }).then(function() {
            self.ready = true;
            self.emit('readystatechange');
        });
    },

    getCurrentSchedule: function() {
        return this.currentSchedule;
    }
});


var palette = [
    'lavender',
    'blue',
    'cyan',
    'applegreen',
    'beryl',
    'green',
    'pink',
    'purple',
    'yellow',
    'pearl'
];

function Schedule() {
    this.colorMapping = {};

    this.basket = [];
    this.sections = [];

    this.ready = false;

    this.hidden = {};

    this._conflictCache = null;
}

Schedule.prototype.setVisibility = function(sectionId, val) {
    this.hidden[sectionId] = !val;
    this.persistSections();
    this._onChange();
}

Schedule.prototype.toggleVisibility = function(sectionId) {
    this.setVisibility(sectionId, !this.getVisibility(sectionId));

    ana.sevent('course', 'toggle_visibility', sectionId);
}

Schedule.prototype.getVisibility = function(sectionId) {
    return !this.hidden[sectionId];
}

Schedule.prototype.getVisibleMeetings = function() {
    var meetings = [];
    this.getVisibleSections().forEach(function(section) {
        meetings.push.apply(meetings, section.meetings);
    });

    return meetings;
};

Schedule.prototype._onChange = function() {
    this._conflictCache = null;
    store.emit('change');
};

Schedule.prototype.findCourseInBasketById = function(id) {
    for (var i=0; i < this.basket.length; i++) {
        for (var j=0; j < this.basket[i].length; j++) {
            if (this.basket[i][j].id == id) {
                return this.basket[i][j];
            }
        }
    }
    return null;
};

Schedule.prototype.findSectionInBasketByNumber = function(number) {
    for (var i=0; i < this.basket.length; i++) {
        for (var j=0; j < this.basket[i].length; j++) {
            var toSection = this.basket[i][j].findSectionByNumber(number);
            if (toSection) return toSection;
        }
    }
    return null;
};

Schedule.prototype.changeSection = function(toNumber, fromNumber) {
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
            find_from:
            for (var i=0; i < this.basket.length; i++) {
                if (this.basket[i].indexOf(toSection.parent) > -1) {
                    for (var j=0; j < this.basket[i].length; j++) {
                        if (selectedCoursesHash[this.basket[i][j].id]) {
                            fromCourse = this.basket[i][j];
                            break find_from;
                        }
                    }
                }
            }

            if (!fromCourse) {
                console.warn("Cannot find corresponding from course for to section " + toNumber);
                return false;
            }

            this._changeCourse(toSection.parent, fromCourse);

            for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
                if (this.sections[fromIndex].parent == toSection.parent && this.sections[fromIndex].type == toSection.type) {
                    break;
                }
            }

            if (fromIndex == this.sections.length) {
                console.warn("Internal Consistency Exception: cannot find from section.");
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
                if (this.sections[fromIndex].parent == toSection.parent && this.sections[fromIndex].type == toSection.type) {
                    break;
                }
            }

            if (fromIndex === this.sections.length) {
                console.warn("Internal Consistency Exception: cannot find from section");
                return false;
            }
        }
    }



    this.sections[fromIndex] = toSection;

    this.persistSections();
    this._onChange();

    return true;
};

Schedule.prototype.changeCourse = function(to, from) {
    this._changeCourse(to, from);
    this.persistSections();
    this._onChange();
};

Schedule.prototype._changeCourse = function(toCourse, fromCourse) {
    if (!isNaN(toCourse)) {
        toCourse = this.findCourseInBasketById(toCourse);
    }

    if (fromCourse === undefined) {
        var selectedCoursesHash = this.getSelectedCourseIdsHash();
        find_course:
        for (var i=0; i < this.basket.length; i++) {
            if (this.basket[i].indexOf(toCourse) > -1) {
                for (var j=0; j < this.basket[i].length; j++) {
                    if (selectedCoursesHash[this.basket[i][j].id]) {
                        fromCourse = this.basket[i][j];
                        break find_course;
                    }
                }
            }
        }
        if (fromCourse === undefined) {
            console.warn('From course not in basket');
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
                console.warn("Type " + type + " not found in " + fromCourse.id + " but in " + toCourse.id);
                newSections.push(toCourse.sections[type][0]);
            } else {
                var added = false;
                if (prevSection.meetings.length > 0) {
                    for (var i=0; i < toCourse.sections[type].length; i++) {
                        var curSection = toCourse.sections[type][i];
                        if (curSection.meetings.length > 0 && curSection.meetings[0].startTime == prevSection.meetings[0].startTime && curSection.meetings[0].pattern == prevSection.meetings[0].pattern) {
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
};

Schedule.prototype.addCluster = function(cluster) {
    this.basket.push(cluster);
    for (var type in cluster[0].sections) {
        if (cluster[0].sections.hasOwnProperty(type)) {
            this.sections.push(cluster[0].sections[type][0]);
        }
    }

    this.colorMapping[cluster[0].getNumber()] = (function(){
        for (var i=0; i < palette.length; i++) {
            color = palette[i];
            found = false;
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
    }).call(this);

};

Schedule.prototype.addCourse = function(subject, number) {
    var self = this;
    var course;
    for (var i=0; i < this.basket.length; i++) {
        if (this.basket[i][0].subject == subject && this.basket[i][0].number == number) {
            course = this.basket[i];
            break;
        }
    }

    if (course) {
        // Mark this course as visible
        return Promise.resolve(false);
    } else {
        return termdb.getCurrentTerm()
              .getCoursesBySubjectAndNumber(subject, number)
              .then(function(courses) {


            self.addCluster(courses);

            self.persistSections();

            self._onChange();


            ana.sevent('course', 'add', subject + ' ' + number);

            return true;
        });
    }
};

Schedule.prototype.getStoreKey = function() {
    return this.term + '_schedules';

};

Schedule.prototype.getColorForCourse = function(subject, number) {
    return this.colorMapping[subject + ' ' + number];
};

Schedule.prototype.serializeSections = function() {
    return this.sections.map(function(section) {
        return section.number;
    });
};

Schedule.prototype.serializeBasket = function() {
    return this.basket.map(function(courses) {
        return courses[0].subject + ' ' + courses[0].number;
    });
};

Schedule.prototype.persistSections = function() {
    if (localStore.get(this.getStoreKey(), Array)[this.index] === undefined) {
        localStore.get(this.getStoreKey(), Array)[this.index] = {};
    }
    var persist = localStore.get(this.getStoreKey())[this.index];
    persist.sections = this.serializeSections();
    persist.basket = this.serializeBasket();
    persist.colorMapping = $.extend({}, this.colorMapping);
    persist.hidden = $.extend({}, this.hidden);
    localStore.fsync(this.getStoreKey());
};

Schedule.prototype.getAlternateMeetings = function(meeting, returntype) {
    if (returntype === undefined) {
        returntype = "difftime";
    }
    var alternatives = [];

    var course = meeting.parent.parent;
    var type = meeting.parent.type;

    // Get cluster
    var cluster = null;
    if (type === course.getPrimarySectionType()) {
        for (var i=0; i < this.basket.length; i++) {
            var curCluster = this.basket[i];
            if (curCluster[0].subject == course.subject && curCluster[0].number == course.number) {
                cluster = curCluster;
                break;
            }
        }
    }

    function hasSameTime(curMeeting) {
        return curMeeting.pattern == meeting.pattern && curMeeting.startTime == meeting.startTime && curMeeting.endTime == meeting.endTime;
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
                    if (component.meetings.some(hasSameTime) == (returntype == "sametime")) {
                        alternatives.push.apply(alternatives, component.meetings);
                    }
                });
            }
        });
    }

    return alternatives;
};

Schedule.prototype.load = function() {
    var self = this;
    var serialized = localStore.get(this.getStoreKey(), Array)[this.index];
    if (serialized === undefined) {
        this.basket = [];
        this.sections = [];
        // Done here
        return Promise.resolve(false);
    }

    this.colorMapping = serialized.colorMapping || {};
    this.hidden = serialized.hidden || {};

    return Promise.resolve()
    .then(function() {
        var basket = serialized.basket ? serialized.basket.slice() : [];
        
        return Promise.all(basket.map(function(c) {
            var split = c.split(' ');
            if (split.length != 2) {
                return null;
            }
            return termdb.getCurrentTerm().getCoursesBySubjectAndNumber(split[0], +split[1]); 
        }));
    }).then(function(clusters) {
        self.basket = clusters;
        self.sections = serialized.sections.map(function(sectionId) {
            for (var i=0; i < clusters.length; i++) {
                for (var j=0; j < clusters[i].length; j++) {
                    var section = clusters[i][j].findSectionByNumber(sectionId);
                    if (section) {
                        return section;
                    }
                }
            }
            console.warn("Section " + sectionId + " is not found.");
            return null;
        }).filter(function(x) {
            return x !== null;
        });
        return true;
    });
}

Schedule.prototype.getSelectedCourseIdsHash = function() {
    var result = Object.create(null);

    this.sections.forEach(function(section) {
        result[section.parent.id] = true;
    })

    return result;
}

Schedule.prototype.getSelectedSectionIdsHash = function() {
    var result = Object.create(null);

    this.sections.forEach(function(section) {
        result[section.number] = true;
    })

    return result;
}

Schedule.prototype.getVisibleSections = function() {
    return this.sections.filter(function(section) {
        return !this.hidden[section.parent.getNumber()];
    }, this);
}

Schedule.prototype.getConflictIntervals = function() {
    if (this._conflictCache === null) {
        var rawIntervals = [];
        var visibleSections = this.getVisibleSections();
        for (var i=0; i < visibleSections.length; i++) {
            for (var j=0; j < i; j++) {
                rawIntervals.push.apply(rawIntervals, conflicts.conflictIntervals(visibleSections[i].meetings, visibleSections[j].meetings));
            }
        }

        this._conflictCache = conflicts.normalizeIntervals(rawIntervals);
    }

    return this._conflictCache;
}

Schedule.prototype.getBasicInfo = function() {
    var visibleSections = this.getVisibleSections();
    var courses = [];
    visibleSections.forEach(function(section) {
        for (var i=0; i < courses.length; i++) {
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
        totalCredits[1] += (course.units.length > 1 ? course.units[1] : course.units[0]);
    });

    visibleSections.forEach(function(section) {
        section.meetings.forEach(function(meeting) {
            if (!meeting.startTime || !meeting.endTime) {
                return;
            }
            totalHours += datetime.bitmaskToDay(meeting.pattern).length * 
                             (datetime.timeStringToHour(meeting.endTime)
                              - datetime.timeStringToHour(meeting.startTime));

        });
    });

    return {units: totalCredits, classes: courses.length, hours: totalHours};
};


module.exports = store;