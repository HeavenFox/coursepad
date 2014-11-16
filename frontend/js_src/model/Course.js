var datetime = require('../utils/datetime.js');

function Meeting(parent, obj) {
    this.startTime = obj['st'];
    this.endTime = obj['et'];
    this.startDate = obj['sd'];
    this.endDate = obj['ed'];
    this.pattern = obj['ptn'];
    this.building = obj['bldg'];
    this.room = obj['rm'];
    this.professors = obj['profs'];

    if (this.startTime)
        this.startTimeHrs = datetime.timeStringToHour(this.startTime);
    if (this.endTime)
        this.endTimeHrs = datetime.timeStringToHour(this.endTime);

    this.parent = parent;
}

Meeting.prototype.getAlternateMeetings = function() {
    var alternatives = [];
    var type = this.parent.type;
    this.parent.parent.sections[type].forEach(function(component) {
        if (component == this.parent) {
            return;
        }
        alternatives.push.apply(alternatives, component.meetings);
    }, this);
    return alternatives;
};

function CourseComponent(parent, type, obj) {
    this.number = obj['nbr'];
    this.sec = obj['sec'];
    this.parent = parent;
    this.type = type;
    if (obj['mt']) {
        this.meetings = obj['mt'].map(function(obj) {
            return new Meeting(this, obj);
        }, this);
    } else {
        this.meetings = [];
    }
    
}

var SECTION_PRIORITY = ['LEC', 'SEM', 'IND', 'DIS', 'LAB'];

function Course(obj) {
    this.id = obj['id'];
    this.number = obj['nbr'];
    this.subject = obj['sub'];
    this.title = obj['title'];
    this.units = obj['unit'] || [0];

    this.sections = {};
    for (var type in obj['secs']) {
        if (obj['secs'].hasOwnProperty(type)) {
            this.sections[type] = obj['secs'][type].map(function(obj) {
                return new CourseComponent(this, type, obj);
            }, this);
        }
    }
}

Course.prototype.getNumber = function() {
    return this.subject + ' ' + this.number;
};

Course.prototype.getPrimarySectionType = function() {
    for (var i=0; i < SECTION_PRIORITY.length; i++) {
        if (this.sections.hasOwnProperty(SECTION_PRIORITY[i])) {
            return SECTION_PRIORITY[i];
        }
    }
    for (var type in this.sections) {
        if (this.sections.hasOwnProperty(type)) {
            return type;
        }
    }
};

Course.prototype.getNumberOfTypes = function() {
    var number = 0;
    for (var type in this.sections) {
        if (this.sections.hasOwnProperty(type)) {
            number++;
        }
    }
    return number;
};

Course.prototype.getAllSections = function() {
    var all = [];

    for (var type in this.sections) {
        if (this.sections.hasOwnProperty(type)) {
            all.push.apply(all, this.sections[type]);
        }
    }

    return all;
};

Course.prototype.findSectionByNumber = function(number) {
    for (var type in this.sections) {
        if (this.sections.hasOwnProperty(type)) {
            var list = this.sections[type];
            for (var i=0; i < list.length; i++) {
                if (list[i].number == number) {
                    return list[i];
                }
            }
        }
    }
    return null;
};

module.exports = Course;