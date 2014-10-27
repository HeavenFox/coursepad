var schedules = require('../store/schedules.js');
var datetime = require('../utils/datetime.js');

function printSchedule(clusters) {
    function time2str(time) {
        return '' + Math.floor(time) + ':' + (60*(time-Math.floor(time))).toFixed(0);
    }

    function meetings2str(section) {
        if (section.meetings.length == 0) {
            return 'no meetings';
        }
        return section.number + ' ' + section.meetings.map(function(meeting) {
            return datetime.bitmaskToDay(meeting.pattern) + ' ' + time2str(meeting.startTimeHrs) + '-' + time2str(meeting.endTimeHrs);
        }).join(', ') + (section.fixed ? ' (fixed)' : '');
    }


    clusters.forEach(function(cluster) {
        console.group(cluster.name);
        cluster.forEach(function(course) {
            console.group('Components');
            course.forEach(function(sections) {
                console.group('Classes');
                sections.forEach(function(section) {
                    console.log(meetings2str(section));
                });
                console.groupEnd();
            });
            console.groupEnd();
        });
        console.groupEnd();
    })
}

function arrayForSection(section) {
    return {
        number: section.number,
        meetings: section.meetings.map(function(meeting) {
            return {
                startTimeHrs: meeting.startTimeHrs,
                endTimeHrs: meeting.endTimeHrs,
                pattern: meeting.pattern
            };
        })
    };
}

function arrayForSchedule() {
    var schedule = schedules.getCurrentSchedule();
    return schedule.basket.filter(function(course) {
        return schedule.getVisibility(course[0].getNumber());
    }).map(function(cluster) {
        var result = cluster.map(function(course) {
            var result = [];
            for (var type in course.sections) {
                if (course.sections.hasOwnProperty(type)) {
                    result.push(course.sections[type].map(arrayForSection));
                }
            }
            return result;
        });
        result.name = cluster[0].getNumber();
        return result;
    });

}

window.arrayForSchedule = arrayForSchedule;
window.printSchedule = printSchedule;

function makeSchedule(priorities) {
    priorityLateStart = priorities.lateStart;
    priorityEarlyEnd = priorities.earlyEnd;
    priorityNoFriday = priorities.noFriday;
    priorityLunchBreak = priorities.lunchBreak;
    var n = performance.now();
    var clusters = arrayForSchedule(), fixed = [];
    var selected = {};
    schedules.getCurrentSchedule().sections.forEach(function(section) {
        selected[section.number] = true;
    });
    removeTBASections(clusters, selected);
    checkIfImpossible(clusters);

    var start = 0;
    while (extractFixedSections(clusters, fixed)) {
        eliminateConflictSections(clusters, fixed, start);
        start = fixed.length;
        if (checkIfImpossible(clusters)) {
            console.warn("Impossible");
            return;
        }
    }

    var result = searchForSolution(clusters, fixed);
    if (result) {
        applySolution(result);
    }
    console.log('Time elapsed:', performance.now() - n);
}

exports.makeSchedule = makeSchedule;

function applySolution(sections) {
    var s = schedules.getCurrentSchedule();
    s.sections = sections;
    s.setSectionsWithClassNumbers(sections);
}

window.applySolution = applySolution;

//---------------------------------------------------------------
// Days starting <= this time gets 0
const EARLY_CLASS_START = 8;
// Days starting >= this gets 1
const EARLY_CLASS_END = 12;
const LATE_CLASS_START = 12;
const LATE_CLASS_END = 20;


// When do we consider lunch start
const LUNCH_START = 11
// When do we consider lunch end
const LUNCH_END = 14
// How long minimum should lunch be
const LUNCH_THRESHOLD = 0.5;
// Maximum length of lunch
const LUNCH_MAX = 2;
// If we can have lunch, the minimum score should be
const LUNCH_MIN_SCORE = 0.6;

// Friday can be no class (1), little class (LITTLE_CLASS_SCORE), or other (0)
const FRIDAY_LITTLE_CLASS_THRESHOLD = 2;
const FRIDAY_LITTLE_CLASS_SCORE = 0.3;


var priorityLateStart = 3;
var priorityEarlyEnd = 3;
var priorityNoFriday = 3;
var priorityLunchBreak = 3;


function populateStartEndTimes(sections, startTimes, endTimes) {
    for (var i=0; i < sections.length; i++) {
        var section = sections[i];
        for (var j=0; j < section.meetings.length; j++) {
            var meeting = section.meetings[j];
            if (meeting.startTimeHrs !== undefined && meeting.endTimeHrs !== undefined) {
                for (var d = 0; d < 5; d++) {
                    if (meeting.pattern & (1<<d)) {
                        if (startTimes[d] === undefined) {
                            startTimes[d] = meeting.startTimeHrs;
                        } else {
                            startTimes[d] = Math.min(meeting.startTimeHrs, startTimes[d])
                        }

                        if (endTimes[d] === undefined) {
                            endTimes[d] = meeting.endTimeHrs;
                        } else {
                            endTimes[d] = Math.max(endTimes[d], meeting.endTimeHrs);
                        }
                    }
                }
            }   
        }
    }
}


function populateLunchMeetings(sections, lunchMeetings) {
    for (var i=0; i < sections.length; i++) {
        var section = sections[i];
        for (var j=0; j < section.meetings.length; j++) {
            var meeting = section.meetings[j];
            if (meeting.startTimeHrs !== undefined &&
                meeting.endTimeHrs !== undefined &&
                meeting.endTimeHrs > LUNCH_START &&
                meeting.startTimeHrs < LUNCH_END) {
                for (var d = 0; d < 5; d++) {
                    if (meeting.pattern & (1<<d)) {
                        lunchMeetings[d].push(meeting);
                    }
                }
            }
        }
    }
    for (var d = 0; d < 5; d++) {
        lunchMeetings[d].sort(function(a, b) {
            return a.startTimeHrs - b.startTimeHrs;
        });
    }
}

function linear(v, x1, x2, y1, y2) {
    if (v <= x1) return y1;
    if (v >= x2) return y2;
    return (v-x1) / (x2-x1) * (y2-y1) + y1;
}

function scoreSolution(soln, startTimesFixed, endTimesFixed, lunchMeetingsFixed) {
    var startTimes = startTimesFixed.slice(0), endTimes = endTimesFixed.slice(0), lunchMeetings = lunchMeetingsFixed.map(function(a) {
        return a.slice(0);
    });

    populateStartEndTimes(soln, startTimes, endTimes);
    populateLunchMeetings(soln, lunchMeetings);

    var score = 0;

    var lateStartScore = 0;
    var earlyEndScore = 0;
    for (var d=0; d < 5; d++) {
        if (startTimes[d] === undefined) {
            // NO CLASS!
            lateStartScore += 0.2;
        } else {
            lateStartScore += linear(startTimes[d], EARLY_CLASS_START, EARLY_CLASS_END, 0, 0.2);
        }

        if (endTimes[d] === undefined) {
            earlyEndScore += 0.2
        } else {
            earlyEndScore += linear(endTimes[d], LATE_CLASS_START, LATE_CLASS_END, 0.2, 0);
        }
    }

    var fridayScore;
    if (startTimes[4] === undefined && endTimes[4] === undefined) {
        fridayScore = 1;
    } else if ((endTimes[4] - startTimes[4]) <= FRIDAY_LITTLE_CLASS_THRESHOLD) {
        fridayScore = FRIDAY_LITTLE_CLASS_SCORE;
    } else {
        fridayScore = 0;
    }

    var lunchScore = 0;
    for (var d=0; d < 5; d++) {
        var maxDiff = 0;
        if (lunchMeetings[d].length === 0) {
            lunchScore += 0.2;
        } else {
            // Any space in the beginning?
            if (lunchMeetings[d][0].startTimeHrs > LUNCH_START) {
                lunchMeetings[d].unshift({
                    endTimeHrs: LUNCH_START
                });
            }
            if (lunchMeetings[d][lunchMeetings[d].length-1].endTimeHrs < LUNCH_END) {
                lunchMeetings[d].push({
                    startTimeHrs: LUNCH_END
                });
            }
            for (var i=0; i < lunchMeetings[d].length - 1; i++) {
                maxDiff = Math.max(maxDiff, lunchMeetings[d][i+1].startTimeHrs - lunchMeetings[d][i].endTimeHrs);
            }
            if (maxDiff > LUNCH_THRESHOLD) {
                lunchScore += linear(maxDiff, LUNCH_THRESHOLD, LUNCH_MAX, LUNCH_MIN_SCORE / 5, 0.2);
            }
        }
    }

    var finalScore = lateStartScore * priorityLateStart +
           earlyEndScore * priorityEarlyEnd +
           fridayScore * priorityNoFriday +
           lunchScore * priorityLunchBreak;

    return finalScore;
}

function scoreCurrentSchedule() {
    var s = schedules.getCurrentSchedule();
    var soln = s.getVisibleSections().map(arrayForSection);
    return scoreSolution(soln, new Array(5), new Array(5), [[], [], [], [], []]);
}

window.scoreCurrentSchedule = scoreCurrentSchedule;

function searchBySimulatedAnnealing(clusters, fixed, startTimesFixed, endTimesFixed, lunchMeetingsFixed) {
    var rand = function(n) {
        return Math.floor(Math.random() * n);
    }
    var filteredClusters = clusters.map(function(cluster) {
        if (cluster.length > 1) {
            return cluster;
        }
        return cluster.map(function(course) {
            return course.filter(function(sections) {
                return sections.length > 1;
            });
        }).filter(function(course) {
            return course.length > 0;
        });
    }).filter(function(cluster) {
        return cluster.length > 0;
    });

    var chosenCourse = filteredClusters.map(function(cluster) {
        return Math.floor(Math.random() * cluster.length);
    });

    var chooseRandomSections = function(course) {
        return course.map(function(sections) {
            return Math.floor(Math.random() * sections.length);
        });
    };

    var chosenSections = chosenCourse.map(function(course, i) {
        return chooseRandomSections(filteredClusters[i][course]);
    });

    var makeSoln = function(chosenCourse, chosenSections) {
        var soln = [];
        for (var i=0; i < chosenCourse.length; i++) {
            for (var j=0; j < chosenSections[i].length; j++) {
                soln.push(filteredClusters[i][chosenCourse[i]][j][chosenSections[i][j]]);
            }

        }
        return soln;
    };

    var scoreCurrent = function() {
        var soln = makeSoln(chosenCourse, chosenSections);
        if (isConflict(soln)) {
            return -1;
        }
        return scoreSolution(soln, startTimesFixed, endTimesFixed, lunchMeetingsFixed);
    };

    // Start simulated annealing

    var t = 10000;
    var t_delta = -0.02;
    var currentScore = scoreCurrent();

    var maxScore = 0;
    var bestCourse, bestSections;

    while (t > 0) {
        // Generate neighbor
        var mutateCluster = rand(filteredClusters.length);
        var mutateCourse = rand(filteredClusters[mutateCluster].length);
        if (mutateCourse !== chosenCourse[mutateCluster]) {
            var prevSections = chosenSections[mutateCluster];
            var prevCourse = chosenCourse[mutateCluster];

            chosenCourse[mutateCluster] = mutateCourse;
            chosenSections[mutateCluster] = chooseRandomSections(filteredClusters[mutateCluster][mutateCourse]);
        } else {
            var mutateSectionType = rand(filteredClusters[mutateCluster][mutateCourse].length);
            var prevChosenSection = chosenSections[mutateCluster][mutateSectionType];
            var prevCourse = undefined;

            var cur = rand(filteredClusters[mutateCluster][mutateCourse][mutateSectionType].length);

            if (cur === prevChosenSection) {
                continue;
            }

            chosenSections[mutateCluster][mutateSectionType] = cur;
        }
        // generate score
        var newScore = scoreCurrent();
        if (newScore <= currentScore && Math.random() > Math.exp((newScore - currentScore) / t)) {
            // rollback
            if (prevCourse === undefined) {
                chosenSections[mutateCluster][mutateSectionType] = prevChosenSection;
            } else {
                chosenCourse[mutateCluster] = prevCourse;
                chosenSections[mutateCluster] = prevSections;
            }
        } else {
            currentScore = newScore;
            if (currentScore > maxScore) {
                maxScore = currentScore;
                bestCourse = chosenCourse.slice(0);
                bestSections = chosenSections.map(function(x) { return x.slice(0); });
            }
        }

        t += t_delta;
    }
    console.log("max score:", maxScore);
    console.log("cur score:", currentScore);
    if (maxScore < 0) return null;

    return makeSoln(bestCourse, bestSections).map(function(x) {
        return x.number;
    });
}

function searchByEnumeration(clusters, fixed, startTimesFixed, endTimesFixed, lunchMeetingsFixed) {

    var sections = [];
    var chosen = [];

    var solutions = [];

    function chooseSection(idx) {
        if (idx >= sections.length) {
            if (!isConflict(chosen)) {
                // Good
                solutions.push({
                    sections: chosen.map(function(section) {
                            return section.number;
                    }),
                    score: scoreSolution(chosen, startTimesFixed, endTimesFixed, lunchMeetingsFixed)
                });
            }
        } else {
            var hasUnfixed = false;
            for (var i=0; i < sections[idx].length; i++) {
                if (!sections[idx][i].fixed) {
                    hasUnfixed = true;
                    chosen.push(sections[idx][i]);
                    chooseSection(idx + 1);
                    chosen.pop();
                }
            }
            if (!hasUnfixed) {
                chooseSection(idx + 1);
            }

        }

    }

    function chooseCourses(idx) {
        if (idx >= clusters.length) {
            chooseSection(0);
        } else {
            var oldLength = sections.length;
            for (var i=0; i < clusters[idx].length; i++) {
                sections.push.apply(sections, clusters[idx][i]);
                chooseCourses(idx + 1);
                sections.length = oldLength;
            }
        }

    }

    chooseCourses(0);

    console.log(solutions.length);

    if (solutions.length === 0) return null;

    var maxScore = 0;
    var bestSolution;
    solutions.forEach(function(solution) {
        if (solution.score > maxScore) {
            maxScore = solution.score;
            bestSolution = solution.sections;
        }
    });

    var fixedSectionNumbers = fixed.map(function(section) {
                            return section.number;
                    });
    Array.prototype.push.apply(bestSolution, fixedSectionNumbers);

    return bestSolution;
}

function searchForSolution(clusters, fixed) {

    // Precalculate
    var startTimesFixed = new Array(5);
    var endTimesFixed = new Array(5);
    populateStartEndTimes(fixed, startTimesFixed, endTimesFixed);
    
    var lunchMeetingsFixed = [[], [], [], [], []];
    populateLunchMeetings(fixed, lunchMeetingsFixed);

    // Get number of possibilities, to choose algorithm
    var possibilities = clusters.reduce(function(acc, cur) {
        var result = 0;
        cur.forEach(function(course) {
            result += course.reduce(function(acc, sections) {
                return acc * sections.length;
            }, 1);

        });

        return acc * result;
    }, 1);

    console.log('Size of Search Space: ', possibilities);

    if (possibilities < 10000) {
        return searchByEnumeration(clusters, fixed, startTimesFixed, endTimesFixed, lunchMeetingsFixed);
    } else {
        // Simulated annealing
        var result = searchBySimulatedAnnealing(clusters, fixed, startTimesFixed, endTimesFixed, lunchMeetingsFixed);
        fixed.forEach(function(section) {
            result.push(section.number);
        });

        return result;
    }

}


function isConflict(sections) {
    for (var i=0; i < sections.length; i++) {
        for (var j=i+1; j < sections.length; j++) {
            if (conflicts(sections[i], sections[j])) {
                return true;
            }
        }
    }
    return false;
}

function removeTBASections(clusters, selected) {
    clusters.forEach(function(cluster) {
        cluster.forEach(function(course) {
            course.forEach(function(sections, i, arr) {
                arr[i] = sections.filter(function(section) {
                    return selected[section.section] || section.meetings.every(function(meeting) { return meeting.startTimeHrs !== undefined; });
                });
            });
        });
    })
}


function extractFixedSections(clusters, fixed) {
    var hasFixed = false;
    clusters.forEach(function(cluster) {
        if (cluster.length == 1) {
            cluster[0].forEach(function(sections) {
                if (sections.length == 1 && !sections[0].fixed) {
                    fixed.push(sections[0]);
                    sections[0].fixed = true;
                    hasFixed = true;
                }
            })
        }
    });
    return hasFixed;
}

function conflicts(section1, section2) {
    var meetings1 = section1.meetings, meetings2 = section2.meetings;
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

function checkIfImpossible(clusters) {
    var clusterslength = clusters.length;
    for (var i=0; i < clusterslength; i++) {
        var cluster = clusters[i];
        for (var j=0; j < cluster.length; ) {
            var impossible = false;
            var course = cluster[j];
            for (var k=0; k < course.length; k++) {
                var sections = course[k];
                if (sections.length == 0) {
                    impossible = true;
                    break;
                }
            }

            if (impossible) {
                cluster.splice(j, 1);
            } else {
                j++;
            }
        }

        if (cluster.length == 0) {
            return true;
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
                for (var l=0; l < sections.length; ) {
                    var section = sections[l];
                    var conflict = false;
                    for (var m=0; m < fixedlength; m++) {
                        if (section !== fixed[m] && conflicts(section, fixed[m])) {
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
            }
        }
    }

    return false;
}
