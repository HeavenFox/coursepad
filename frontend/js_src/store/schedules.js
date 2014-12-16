var EventEmitter = require('event-emitter');
var datetime = require('../utils/datetime.js');
var conflicts = require('../model/course/conflicts.js');

var termdb = require('./termdb.js');
var indexeddb = require('../persist/indexeddb.js');
var localStore = require('../persist/localStorage.js');

var color = require('../utils/color.js');

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

        if (term === undefined) {
            term = this.currentSchedule.term;
        }
        if (index === undefined) {
            index = 0;
        }

        var shouldCheckForUpdates = false;

        var dbLoadedPromise;
        if (term === undefined || (termdb.getCurrentTerm() && termdb.getCurrentTerm().term == term)) {
            dbLoadedPromise = Promise.resolve();
        } else {
            dbLoadedPromise = termdb.setCurrentTerm(term);
            shouldCheckForUpdates = true;
        }

        return dbLoadedPromise.then(function() {
            self.currentSchedule = new Schedule();
            self.currentSchedule.term = term;
            self.currentSchedule.index = index;

            return self.currentSchedule.load();
        }).then(function() {
            self.ready = true;
            self.emit('readystatechange');
            if (shouldCheckForUpdates) {
                termdb.checkForUpdates();
            }
        });
    },

    getCurrentSchedule: function() {
        return this.currentSchedule;
    },

    getNewScheduleNameAndColor: function() {
        var schedule = this.getCurrentSchedule();
        var storageKey = schedule.term + '_schedules';
        var list = localStore.get(storageKey, Array);
        var nameHash = Object.create(null);
        var colorHash = Object.create(null);

        this.getAllSchedules().forEach(function(schedule) {
            nameHash[schedule.name] = true;
            colorHash[schedule.color] = true;
        });

        var name;
        var nameSn = 1;
        while (true) {
            name = 'Schedule (' + nameSn + ')';
            if (!nameHash[name]) {
                break;
            }
            nameSn++;
        }

        var scheduleColor;

        var colorDistance = 1/8;
        var currentHue = 0;
        while (true) {
            scheduleColor = color.hsvToHex(currentHue, 0.25, 0.54);
            if (!colorHash[scheduleColor]) {
                break;
            }
            currentHue += colorDistance;
            if (currentHue >= 1) {
                colorDistance /= 2;
                currentHue = colorDistance;
            }
        }

        return {name: name, color: scheduleColor};
    },

    withStorageList: function(cb, thisArg) {
        if (thisArg === undefined) thisArg = null;
        var schedule = this.getCurrentSchedule();
        var storageKey = schedule.term + '_schedules';
        var list = localStore.get(storageKey, Array);

        var result = cb.call(thisArg, list);

        localStore.fsync(storageKey);

        if (result !== undefined) {
            return result;
        }
    },

    numberOfSchedules: function() {
        return this.withStorageList(function(list) {
            return list.length;
        });
    },

    renameSchedule: function(index, name) {
        this.withStorageList(function(list) {
            list[index].name = name;
        });

        this.emit('listchange');
    },

    deleteSchedule: function(index) {
        this.withStorageList(function(list) {
            var currentSchedule = this.getCurrentSchedule();
            if (currentSchedule.index === index) {
                throw new Error();
            }
            list.splice(index, 1);
            if (index < currentSchedule.index) {
                currentSchedule.index--;
            }
        }, this);

        this.emit('listchange');
    },

    addSchedule: function(name, scheduleColor) {
        this.withStorageList(function(list) {
            list.push({
                color: scheduleColor,
                name: name,
                uniqueId: Math.floor(Math.random() * 0xFFFFFFFF)
            });
        });

        this.emit('listchange');
    },

    getAllSchedules: function() {
        var schedule = this.getCurrentSchedule();
        if (!schedule) {
            return null;
        }
        var storageKey = schedule.term + '_schedules';
        var modified = false;
        var list = localStore.get(storageKey, Array);
        var result = list.map(function(item, index) {
            // if (!item['scheduleColor']) {
            //     modified = true;
            //     item['scheduleColor'] = '';
            // }

            // if (!item['scheduleName']) {
            //     modified = true;
            //     item['scheduleName'] = 'My Schedule';
            // }

            return {
                color: item['color'],
                name: item['name'],
                isCurrent: index === schedule.index,
                uniqueId: item['uniqueId']
            };
        });

        // if (modified) {
        //     localStore.fsync(storageKey);
        // }

        return result;
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
    this.uniqueId = Math.floor(Math.random() * 0xFFFFFFFF);

    this._conflictCache = null;
}

Schedule.prototype.setVisibility = function(courseNumber, val) {
    this.hidden[courseNumber] = !val;
    this.persistSections();
    this._onChange();
}

Schedule.prototype.toggleVisibility = function(courseNumber) {
    this.setVisibility(courseNumber, !this.getVisibility(courseNumber));

    ana.sevent('course', 'toggle_visibility', courseNumber);
}

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

Schedule.prototype.removeCourseByNumber = function(courseNumber) {
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

Schedule.prototype.addCluster = function(cluster) {
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
    persist.color = this.color;
    persist.name = this.name;
    persist.uniqueId = this.uniqueId;
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

Schedule.prototype.load = function() {
    var self = this;
    var serialized = localStore.get(this.getStoreKey(), Array)[this.index];
    if (serialized === undefined) {
        this.basket = [];
        this.sections = [];
        this.persistSections();
        // Done here
        return Promise.resolve(false);
    }

    this.colorMapping = serialized.colorMapping || {};
    this.hidden = serialized.hidden || {};

    if (serialized.color) this.color = serialized.color;
    if (serialized.name) this.name = serialized.name;
    if (serialized.uniqueId) this.uniqueId = serialized.uniqueId;

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
        clusters = clusters.filter(function(cluster) {
            return Array.isArray(cluster) && cluster.length > 0;
        });
        self.basket = clusters;
        var hasSection = {};
        var courseByNumber = {};
        clusters.forEach(function(cluster) {
            hasSection[cluster[0].getNumber()] = {};
        });
        var serializedSections = serialized.sections || [];
        self.sections = serializedSections.map(function(sectionId) {
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
                        self.sections.push(course.sections[type][0]);
                    }
                }
            }
        });

        self.persistSections();

        return true;
    });
}

/**
 * @return {Promise}
 */
Schedule.prototype.termDBUpdated = function() {
    var self = this;
    this.persistSections();
    return this.load().then(function() {
        self._onChange();
    })
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


module.exports = store;