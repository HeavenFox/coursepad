import {Meeting} from '../course';

function mayConflict(meeting: Meeting) {
    return meeting.startTimeHrs !== undefined && meeting.endTimeHrs !== undefined;
}

function hasDate(meeting: Meeting) {
    return meeting.endDate !== undefined && meeting.startDate !== undefined;
}

export function conflicts(m1: Meeting, m2: Meeting) {
    return mayConflict(m1) && mayConflict(m2) && ((m1.pattern & m2.pattern)
        && (m1.endTimeHrs > m2.startTimeHrs) && (m1.startTimeHrs < m2.endTimeHrs))
        && (!(hasDate(m1) && hasDate(m2))
            || ((m1.getEndDateObject() >= m2.getStartDateObject())
                && (m1.getStartDateObject() <= m2.getEndDateObject())));
}

interface IConflictInterval {
    pattern: number;
    startTimeHrs: number;
    endTimeHrs: number;
}

export function conflictIntervals(meetings1: Meeting[], meetings2: Meeting[]) {
    let intervals: IConflictInterval[] = [];
    for (let i=0; i < meetings1.length; i++) {
        let m1 = meetings1[i];
        if (!mayConflict(m1)) {
            continue;
        }
        for (let j=0; j < meetings2.length; j++) {
            let m2 = meetings2[j];
            if (conflicts(m1, m2)) {
                intervals.push({
                    pattern: m1.pattern & m2.pattern,
                    startTimeHrs: Math.max(m1.startTimeHrs, m2.startTimeHrs),
                    endTimeHrs: Math.min(m1.endTimeHrs, m2.endTimeHrs),
                });
            }
        }
    }
    return intervals;
}

export function normalizeIntervals(intervals) {
    var intervalsByDay = Object.create(null);
    intervals.forEach(function(interval) {
        for (var d = 1; d < (1 << 7); d <<= 1) {
            if (interval.pattern & d) {
                if (!(d in intervalsByDay)) {
                    intervalsByDay[d] = [];
                }
                intervalsByDay[d].push({
                    pattern: d,
                    startTimeHrs: interval.startTimeHrs,
                    endTimeHrs: interval.endTimeHrs,
                });
            }
        }
    });
    var result = [];
    for (var d in intervalsByDay) {
        if (intervalsByDay[d].length === 0) {
            console.warn('Consistency Warning: Empty Interval');
            continue;
        }

        intervalsByDay[d].sort(function(a, b) {
            return a.startTimeHrs - b.startTimeHrs;
        });

        result.push(intervalsByDay[d][0]);
        for (var i=1; i < intervalsByDay[d].length; i++) {
            var lastEnd = result[result.length-1].endTimeHrs;
            if (lastEnd < intervalsByDay[d][i].startTimeHrs) {
                result.push(intervalsByDay[d][i]);
            } else {
                result[result.length-1].endTimeHrs = Math.max(lastEnd, intervalsByDay[d][i].endTimeHrs);
            }
        }
    }
    return result;
}
