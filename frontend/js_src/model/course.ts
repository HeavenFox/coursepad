import {timeStringToHour} from '../utils/datetime.ts';
import {strToDateObject} from '../utils/datetime';


export class Meeting {
    parent: CourseComponent;

    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    pattern: number;
    building: string;
    room: string;
    professors: string[];

    startTimeHrs: number;
    endTimeHrs: number;

    constructor(parent, obj) {
        this.startTime = obj['st'];
        this.endTime = obj['et'];
        this.startDate = obj['sd'];
        this.endDate = obj['ed'];
        this.pattern = obj['ptn'];
        this.building = obj['bldg'];
        this.room = obj['rm'];
        this.professors = obj['profs'];

        if (this.startTime)
            this.startTimeHrs = timeStringToHour(this.startTime);
        if (this.endTime)
            this.endTimeHrs = timeStringToHour(this.endTime);

        this.parent = parent;
    }

    getStartDateObject(): Date {
        return strToDateObject(this.startDate);
    }

    getEndDateObject(): Date {
        return strToDateObject(this.endDate);
    }

    getAlternateMeetings() {
        var alternatives = [];
        var type = this.parent.type;
        this.parent.parent.sections[type].forEach(function(component) {
            if (component == this.parent) {
                return;
            }
            alternatives.push.apply(alternatives, component.meetings);
        }, this);
        return alternatives;
    }
}


export class CourseComponent {
    parent: Course;

    number: number;
    sec: string;
    type: string;
    meetings: Meeting[];

    constructor(parent : Course, type, obj) {
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
}


const SECTION_PRIORITY = ['LEC', 'SEM', 'IND', 'DIS', 'LAB'];

export type Cluster = Course[];

export class Course {
    term : string;
    id: number;
    number: number;
    subject: string;
    title: string;
    units: number[];
    sections: { [type: string] : CourseComponent[] };

    constructor(obj, term) {
        this.term = term;
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

    getNumber(): string {
        return this.subject + ' ' + this.number;
    }

    getPrimarySectionType(): string {
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
    }

    getNumberOfTypes(): number {
        var number = 0;
        for (var type in this.sections) {
            if (this.sections.hasOwnProperty(type)) {
                number++;
            }
        }
        return number;
    }

    getAllSections(): CourseComponent[] {
        let all: CourseComponent[] = [];

        for (var type in this.sections) {
            if (this.sections.hasOwnProperty(type)) {
                all.push.apply(all, this.sections[type]);
            }
        }

        return all;
    }

    findSectionByNumber(number: number): CourseComponent {
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
}
