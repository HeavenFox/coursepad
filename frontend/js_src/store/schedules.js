var EventEmitter = require('event-emitter');
var datetime = require('../utils/datetime.js');

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
}

Schedule.prototype.addDemoData = function() {
    var ctermdb = termdb.getCurrentTermDB();
    // var math1110 = ctermdb.getCoursesBySubjectAndNumber('MATH', 1110);
    // var math4310 = ctermdb.getCoursesBySubjectAndNumber('MATH', 4310);
    // var math2930 = ctermdb.getCoursesBySubjectAndNumber('MATH', 2930);

    // this.index = 0;

    // this.basket = [math1110, math4310, math2930];
    // this.sections = [math1110[0].sections['LEC'][0],
    //                  math4310[0].sections['LEC'][0],
    //                  math2930[0].sections['LEC'][0],
    //                  math2930[0].sections['DIS'][0]];

    store.emit('ready');
}

Schedule.prototype.getMeetings = function() {
    var meetings = [];
    this.sections.forEach(function(section) {
        meetings.push.apply(meetings, section.meetings);
    });

    return meetings;
};

Schedule.prototype.changeSection = function(fromNumber, toNumber) {
    var fromIndex;
    for (fromIndex = 0; fromIndex < this.sections.length; fromIndex++) {
        if (this.sections[fromIndex].number == fromNumber) {
            break;
        }
    }
    if (fromIndex === this.sections.length) {
        return false;
    }

    var toSection = this.sections[fromIndex].parent.findSectionByNumber(toNumber);
    if (!toSection) {
        return false;
    }

    this.sections[fromIndex] = toSection;

    this.persistSections();
    store.emit('change');

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
            console.log("1");

            self.persistSections();
            console.log("2");
            store.emit('change');
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

Schedule.prototype.getVisibleSections = function() {
    return this.sections;
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