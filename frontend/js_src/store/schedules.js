var EventEmitter = require('event-emitter');
var datetime = require('../utils/datetime.js');
var conflicts = require('../model/course/conflicts.js');

var store = EventEmitter({
    ready: false,
    setCurrentSchedule: function(term, index) {
        var self = this;
        if (this.currentSchedule) {
        }

        this.currentSchedule = new Schedule();
        this.currentSchedule.term = term;
        this.currentSchedule.index = index;
        return this.currentSchedule.load().then(function() {
            self.ready = true;
            self.emit('readystatechange');

        });
    },

    getCurrentSchedule: function() {
        return this.currentSchedule;
    }
});

var termdb = require('./termdb.js');
var indexeddb = require('../persist/indexeddb.js');
var localStore = require('../persist/localStorage.js');

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
    this._onChange();
}

Schedule.prototype.toggleVisibility = function(sectionId) {
    this.setVisibility(sectionId, !this.getVisibility(sectionId));
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
}

Schedule.prototype.changeSection = function(toNumber, fromNumber) {
    var toSection;
    var fromIndex;

    if (fromNumber === undefined) {
        for (var i=0; i < this.basket.length; i++) {
            for (var j=0; j < this.basket[i].length; j++) {
                toSection = this.basket[i][j].findSectionByNumber(toNumber);
                if (toSection) break;
            }
        }
        if (!toSection) return false;
        var sections = toSection.parent.sections[toSection.type];
        for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
            if (sections.indexOf(this.sections[fromIndex]) > -1) {
                break;
            }
        }
        
        if (fromIndex === this.sections.length) {
            return false;
        }
    } else {
        for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
            if (this.sections[fromIndex].number == fromNumber) {
                break;
            }
        }

        if (fromIndex === this.sections.length) {
            return false;
        }

        toSection = this.sections[fromIndex].parent.findSectionByNumber(toNumber);
        if (!toSection) {
            return false;
        }
    }



    this.sections[fromIndex] = toSection;

    this.persistSections();
    this._onChange();

    return true;
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

            this._onChange();
            
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
    localStore.fsync(this.getStoreKey());
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

    this.colorMapping = serialized.colorMapping;

    return indexeddb.getByKeys('section_index', serialized.sections)
    .then(function(courseIds) {
        var basket = serialized.basket ? serialized.basket.slice() : [];
        // Sanity check: all courses should be in basket
        // courseIds.forEach(function(course) {
        //     if (basket.indexOf(course) < 0) {
        //         basket.push(course);
        //         console.warn("WARNING: Course " + course + " is present in sections but not in basket. Added.");
        //     }
        // });
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