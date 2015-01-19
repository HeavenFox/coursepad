var EventEmitter = require('event-emitter');
var router = require('../router.js');
var datetime = require('../utils/datetime.js');
var conflicts = require('../model/course/conflicts.js');

var termdb = require('./termdb.js');
var user = require('./user.js');

var localStore = require('../persist/localStorage.js');


var ana = require('../analytics/analytics.js');
var schedulestorage = require('./schedulestorage.js');

const PREFER_LOCAL = 1;
const PREFER_REMOTE = 2;
const NO_PREFERENCE = 3;

var store = EventEmitter({
    ready: false,
    setCurrentSchedule: async function(term, index) {
        router.changePath('/');

        var currentTermDB = termdb.getCurrentTerm();
        var self = this;

        if (term === undefined) {
            term = currentTermDB.term;
        }
        if (index === undefined) {
            index = 0;
        }

        if (this.currentSchedule) {
            if ((this.currentSchedule.term === term) && (this.currentSchedule.index === index)) {
                return false;
            }
            self.ready = false;
            self.emit('readystatechange');
        }

        schedulestorage.setStorage(term);

        var shouldCheckForUpdates = false;

        var dbLoadedPromise;
        if (!termdb.getCurrentTerm() || termdb.getCurrentTerm().term !== term) {
            await termdb.setCurrentTerm(term);
        }

        var schedule = new MutableSchedule();
        schedule.term = term;
        schedule.index = index;
        schedule.storage = schedulestorage.getStorage();

        await schedulestorage.getStorage().loadSchedule(schedule);

        self._setCurrentSchedule(schedule);

        self.ready = true;
        self.emit('readystatechange');

        return true;
    },

    setSharedSchedule: async function(term, serialized) {
        if (this.ready) {
            this.ready = false;
            this.emit('readystatechange');
        }

        var db = termdb.getRemoteTerm(term);

        var schedule = new SharedSchedule();
        schedule.term = term;
        schedule.getTermDB = function() {
            return db;
        }

        await schedule.deserialize(serialized);

        this._setCurrentSchedule(schedule);

        this.ready = true;
        this.emit('readystatechange');
    },


    setSchedule: function(schedule, by) {
        this._setCurrentSchedule(schedule);

        this.emit('change', {by: by});
    },

    _setCurrentSchedule: function(schedule) {
        this.currentSchedule = schedule;
        schedule.on('change', this._getOnScheduleChange());
    },

    _getOnScheduleChange: function() {
        var self = this;
        return this.__onScheduleChange || (this.__onScheduleChange = function(v) {
            self.emit('change', v);
        });
    },

    getCurrentSchedule: function() {
        if (!this.ready) { return null; }
        return this.currentSchedule;
    },

    _onTermDBChange: function() {
        this.currentSchedule.onTermDBChange();
    },

});

termdb.on('change', store._onTermDBChange.bind(store));

schedulestorage.on('change', function(e) {
    function handler() {
        if (!store.ready) {
            store.once('readystatechange', handler);
        } else {
            var schedule = store.getCurrentSchedule();
            if (schedule.isMutable && schedule.term === e.term) {
                schedule.onLocalStorageChange();
            }
        }
    }

    handler();
});

schedulestorage.on('listchange', function() {
    // Update the current schedule's name
    var schedule = store.getCurrentSchedule();
    if (schedule && schedule.isMutable) {
        schedule.updateNameAndIndex();
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

    this.hidden = {};

    this.color = '#979797';
    this.name = 'My Schedule';
    this.uniqueId = -1;

    this._conflictCache = null;
}

Schedule.prototype = EventEmitter({});

Schedule.prototype.clone = function() {
    var clone = new this.constructor();

    clone.colorMapping = $.extend({}, this.colorMapping);
    clone.basket = this.basket.slice(0);
    clone.sections = this.sections.slice(0);
    clone.hidden = $.extend({}, this.hidden);
    clone.color = this.color;
    clone.name = this.name;
    clone.uniqueId = this.uniqueId;

    return clone;
}

Schedule.prototype.getTermDB = function() {
    return termdb.getCurrentTerm();
};

Schedule.prototype.getVisibility = function(courseNumber) {
    return !this.hidden[courseNumber];
}

Schedule.prototype.getVisibleClusters = function() {
    return this.basket.filter(function(cluster) {
        return !this.hidden[cluster[0].getNumber()];
    }, this);
};

Schedule.prototype.getVisibleMeetings = function() {
    var meetings = [];
    this.getVisibleSections().forEach(function(section) {
        meetings.push.apply(meetings, section.meetings);
    });

    return meetings;
};

Schedule.prototype._onChange = function() {
    this._conflictCache = null;
    this.emit('change');
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

Schedule.prototype.getColorForCourse = function(subject, number) {
    return this.colorMapping[subject + ' ' + number];
};

Schedule.prototype.serializeSections = function(sections) {
    return sections.map(function(section) {
        return section.number;
    });
};

Schedule.prototype.serializeBasket = function(basket) {
    return basket.map(function(courses) {
        return courses[0].subject + ' ' + courses[0].number;
    });
};

Schedule.prototype.onTermDBChange = function() {

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
                            (datetime.timeStringToHour(meeting.endTime) - 
                            datetime.timeStringToHour(meeting.startTime));

        });
    });

    return {units: totalCredits, classes: courses.length, hours: totalHours};
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

Schedule.prototype.deserialize = async function(serialized) {
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
    this.sections = serializedSections.map(function(sectionId) {
        for (var i=0; i < clusters.length; i++) {
            for (var j=0; j < clusters[i].length; j++) {
                var section = clusters[i][j].findSectionByNumber(sectionId);
                if (section) {
                    var courseNumber = clusters[i][j].getNumber();
                    // Make sure there's only one component chosen per section type
                    // And sections do not cross course boundary
                    if (hasSection[courseNumber].hasOwnProperty(section.type) ||
                        (courseByNumber[courseNumber] && courseByNumber[courseNumber]['id'] !== clusters[i][j]['id'])) {
                        perfectDeserialization = false;
                        console.warn("Section " + sectionId + " is a duplicate, or crossed boundary");
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
    }).filter(function(x) {
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
                    console.warn("Section type " + type + " does not have any sections");
                    perfectDeserialization = false;
                }
            }
        }
    });


    return perfectDeserialization;
};

Schedule.prototype.setSectionsWithClassNumbers = function(sections) {
    var clusters = this.basket;
    var hasSection = {};
    var courseByNumber = {};
    clusters.forEach(function(cluster) {
        hasSection[cluster[0].getNumber()] = {};
    });
    
    this.sections = sections.map(function(sectionId) {
        for (var i=0; i < clusters.length; i++) {
            for (var j=0; j < clusters[i].length; j++) {
                var section = clusters[i][j].findSectionByNumber(sectionId);
                if (section) {
                    var courseNumber = clusters[i][j].getNumber();
                    // Make sure there's only one component chosen per section type
                    // And sections do not cross course boundary
                    if (hasSection[courseNumber].hasOwnProperty(section.type) ||
                        (courseByNumber[courseNumber] && courseByNumber[courseNumber]['id'] !== clusters[i][j]['id'])) {
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
    }).filter(function(x) {
        return x !== null;
    });

    this._onChange();
};

function MutableSchedule() {
    Schedule.call(this);

    this.index = 0;
    this.isMutable = true;
}

MutableSchedule.prototype = Object.create(Schedule.prototype);
MutableSchedule.prototype.constructor = MutableSchedule;

MutableSchedule.prototype.clone = function() {
    var superclone = Schedule.prototype.clone.call(this);
    superclone.storage = this.storage;
    superclone.index = this.index;
    return superclone;
}

MutableSchedule.prototype.setVisibility = function(courseNumber, val) {
    this.hidden[courseNumber] = !val;
    this.persistSections();
    this._onChange();
}

MutableSchedule.prototype.toggleVisibility = function(courseNumber) {
    this.setVisibility(courseNumber, !this.getVisibility(courseNumber));

    ana.sevent('course', 'toggle_visibility', courseNumber);
}



MutableSchedule.prototype.removeCourseByNumber = function(courseNumber) {
    for (var i=0; i < this.basket.length; i++) {
        if (this.basket[i].length && this.basket[i][0].getNumber() == courseNumber) {
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
};

MutableSchedule.prototype.changeSection = function(toNumber, fromNumber) {
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

MutableSchedule.prototype.changeCourse = function(to, from) {
    this._changeCourse(to, from);
    this.persistSections();
    this._onChange();
};

MutableSchedule.prototype._changeCourse = function(toCourse, fromCourse) {
    var i, j;
    if (!isNaN(toCourse)) {
        toCourse = this.findCourseInBasketById(toCourse);
    }

    if (fromCourse === undefined) {
        var selectedCoursesHash = this.getSelectedCourseIdsHash();
        find_course:
        for (i=0; i < this.basket.length; i++) {
            if (this.basket[i].indexOf(toCourse) > -1) {
                for (j=0; j < this.basket[i].length; j++) {
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
                    for (i=0; i < toCourse.sections[type].length; i++) {
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

MutableSchedule.prototype.addCluster = function(cluster) {
    if (cluster.length === 0) {
        throw new Error('This class does not exist');
    }
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

MutableSchedule.prototype.addCourse = function(subject, number) {
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
        return this.getTermDB()
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

MutableSchedule.prototype.serializeScheduleForSharing = function() {
    var persist = {};
    persist['sections'] = this.serializeSections(this.getVisibleSections());
    persist['basket'] = this.serializeBasket(this.getVisibleClusters());
    persist['colorMapping'] = {};
    for (var course in this.colorMapping) {
        if (this.colorMapping.hasOwnProperty(course) && !this.hidden[course]) {
            persist['colorMapping'][course] = this.colorMapping[course];
        }
    }

    return persist;
};

MutableSchedule.prototype.serialize = function() {
    var persist = {}
    persist['sections'] = this.serializeSections(this.sections);
    persist['basket'] = this.serializeBasket(this.basket);
    persist['colorMapping'] = $.extend({}, this.colorMapping);
    persist['hidden'] = $.extend({}, this.hidden);
    persist['color'] = this.color;
    persist['name'] = this.name;
    if (this.uniqueId === -1) {
        this.uniqueId = randomInt31();
    }
    persist['uniqueId'] = this.uniqueId;

    return persist;
}

MutableSchedule.prototype.persistSections = function() {
    this.storage.persistAndDirtySchedule(this);
};


MutableSchedule.prototype.reload = function() {
    return this.storage.reloadSchedule(this);
}

MutableSchedule.prototype.clear = function() {
    MutableSchedule.call(this);
};

MutableSchedule.prototype.onTermDBChange = function() {
    var self = this;
    return this.reload().then(function() {
        self._onChange();
    });
}

MutableSchedule.prototype.onLocalStorageChange = function() {
    var self = this;
    return this.reload().then(function() {
        self._onChange();
    });
}

MutableSchedule.prototype.updateNameAndIndex = function() {
    var serialized = this.storage.getSerializedByUniqueId(this.uniqueId);
    if (serialized) {
        this.name = serialized[1]['name'];
        this.color = serialized[1]['color'];
        this.index = serialized[0];
    }
}

function SharedSchedule() {
    Schedule.call(this);

    this.isShared = true;
}

SharedSchedule.prototype = Object.create(Schedule.prototype);
SharedSchedule.prototype.constructor = SharedSchedule;

module.exports = store;