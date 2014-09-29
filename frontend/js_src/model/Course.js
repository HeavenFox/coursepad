function Meeting(parent, obj) {
    this.startTime = obj['st'];
    this.endTime = obj['et'];
    this.startDate = obj['sd'];
    this.endDate = obj['ed'];
    this.pattern = obj['ptn'];
    this.building = obj['bldg'];
    this.room = obj['rm'];
    this.professors = obj['profs'];

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
    this.meetings = obj['mt'].map(function(obj) {
        return new Meeting(this, obj);
    }, this);
}

function Course(obj) {
    this.id = obj['id'];
    this.number = obj['nbr'];
    this.subject = obj['sub'];
    this.title = obj['title'];
    this.units = obj['units'] || [0];
    // this.minUnits = obj['units'][0];
    // this.maxUnits = obj['units'][1] || obj['units'][0];

    this.sections = {};
    for (var type in obj['secs']) {
        if (obj['secs'].hasOwnProperty(type)) {
            this.sections[type] = obj['secs'][type].map(function(obj) {
                return new CourseComponent(this, type, obj);
            }, this);
        }
    }
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
}

module.exports = Course;