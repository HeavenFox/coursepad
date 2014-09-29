var termdb = require('./termdb.js');
var EventEmitter = require('event-emitter');

var store = EventEmitter({
    getCurrentSchedule: function() {
        if (!this.currentSchedule) {
            this.currentSchedule = new Schedule();
            this.currentSchedule.addDemoData(); 
        }
        return this.currentSchedule;
    }
});


var palette = ['pearl',
    'pink',
    'purple',
    'lavender',
    'blue',
    'cyan',
    'applegreen',
    'green',
    'beryl',
    'yellow'];

function Schedule() {
    this.colorMapping = {
        MATH1110: 'pink',
        MATH4310: 'lavender',
        MATH2930: 'green'
    };

    this.basket = [];
    this.sections = [];
}

Schedule.prototype.addDemoData = function() {
    var ctermdb = termdb.getCurrentTermDB();
    var math1110 = ctermdb.getCoursesBySubjectAndNumber('MATH', 1110);
    var math4310 = ctermdb.getCoursesBySubjectAndNumber('MATH', 4310);
    var math2930 = ctermdb.getCoursesBySubjectAndNumber('MATH', 2930);

    this.basket = [math1110, math4310, math2930];
    this.sections = [math1110[0].sections['LEC'][0],
                     math4310[0].sections['LEC'][0],
                     math2930[0].sections['LEC'][0],
                     math2930[0].sections['DIS'][0]];

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

    store.emit('change');

    return true;
};

Schedule.prototype.getColorForCourse = function(subject, number) {
    return this.colorMapping[subject + number];
};


function getCurrentSchedule() {
    return currentSchedule;
}

module.exports = store;