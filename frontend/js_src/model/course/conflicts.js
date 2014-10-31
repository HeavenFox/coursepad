function conflicts(meetings1, meetings2) {
    for (var i=0; i < meetings1.length; i++) {
        var m1 = meetings1[i];
        if (m1.startTimeHrs === undefined) {
            continue;
        }
        for (var j=0; j < meetings2.length; j++) {
            var m2 = meetings2[j];
            if (m2.startTimeHrs === undefined) {
                continue;
            }
            if ((m1.pattern & m2.pattern) && (m1.endTimeHrs > m2.startTimeHrs) && (m1.startTimeHrs < m2.endTimeHrs)) {
                return true;
            }
        }
    }
    return false;
}

function conflictIntervals(meetings1, meetings2) {
    var intervals = [];
    for (var i=0; i < meetings1.length; i++) {
        var m1 = meetings1[i];
        if (m1.startTimeHrs === undefined) {
            continue;
        }
        for (var j=0; j < meetings2.length; j++) {
            var m2 = meetings2[j];
            if (m2.startTimeHrs === undefined) {
                continue;
            }
            if ((m1.pattern & m2.pattern) && (m1.endTimeHrs > m2.startTimeHrs) && (m1.startTimeHrs < m2.endTimeHrs)) {
                intervals.push({
                    pattern: m1.pattern & m2.pattern,
                    startTimeHrs: Math.max(m1.startTimeHrs, m2.startTimeHrs),
                    endTimeHrs: Math.min(m1.endTimeHrs, m2.endTimeHrs)
                });
            }
        }
    }
    return intervals;
}

function normalizeIntervals(intervals) {
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
                    endTimeHrs: interval.endTimeHrs
                });
            }
        }
    });
    var result = [];
    for (d in intervalsByDay) {
        if (intervalsByDay[d].length == 0) {
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

exports.conflictIntervals = conflictIntervals;
exports.normalizeIntervals = normalizeIntervals;