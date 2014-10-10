var schedules = require('../store/schedules.js');

function arrayForSchedule() {
    var schedule = schedules.getCurrentSchedule();
    return schedule.basket.map(function(cluster) {
        return cluster.map(function(course) {
            var result = [];
            for (var type in course.sections) {
                if (course.sections.hasOwnProperty(type)) {
                    result.push(course.sections[type].map(function(section) {
                        return section.meetings.map(function(meeting) {
                            return {
                                startTimeHrs: meeting.startTimeHrs,
                                endTimeHrs: meeting.endTimeHrs,
                                pattern: meeting.pattern,
                                section: section.number
                            };
                        })
                    }));
                }
            }
            return result;
        });
    });

}

function test() {
    var clusters = arrayForSchedule(), fixed = [];

    var start = 0;
    while (extractFixedSections(clusters, fixed)) {
        if (eliminateConflictSections(clusters, fixed, start)) {
            console.log("impossible");
            return;
        }
        start = fixed.length;
    }

    console.log(clusters);
    console.log(fixed);
}

window.test = test;
window.arrayForSchedule = arrayForSchedule;


function extractFixedSections(clusters, fixed) {
    var hasFixed = false;
    clusters.forEach(function(cluster) {
        if (cluster.length == 1) {
            cluster[0].forEach(function(sections) {
                if (sections.length == 1) {
                    fixed.push(sections.pop());
                    hasFixed = true;
                }
            })
        }
    });
    return hasFixed;
}

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

function eliminateConflictSections(clusters, fixed, start) {
    var clusterslength = clusters.length;
    var fixedlength = fixed.length;
    for (var i=0; i < clusterslength; i++) {
        var cluster = clusters[i];
        for (var j=0; j < cluster.length; j++) {
            var course = cluster[j];
            for (var k=0; k < course.length; k++) {
                var sections = course[k];
                if (sections.length == 0) {
                    continue;
                }
                for (var l=0; l < sections.length; ) {
                    var section = sections[l];
                    var conflict = false;
                    for (var m=0; m < fixedlength; m++) {
                        if (conflicts(section, fixed[m])) {
                            conflict = true;
                            break;
                        }
                    }
                    if (conflict) {
                        sections.splice(l, 1);
                    } else {
                        l++;
                    }
                }
                if (sections.length == 0) {
                    return true;
                }
            }
        }
    }

    return false;
}