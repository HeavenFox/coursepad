var currentTermDB = null;

var Course = require('../model/Course.js');

var allMath = require('./test_math_term_db_readable.json');
//var allMath = {roster_fa14: []};

allMath.roster_fa14 = allMath.roster_fa14.map(function(obj) {
    return new Course(obj);
});

function TermDatabase() {
    
}

currentTermDB = new TermDatabase();

/**
 * @return Promise
 */
TermDatabase.prototype.getCoursesBySubjectAndNumber = function(subject, number) {
    var classes = [];
    allMath.roster_fa14.forEach(function(course) {
        if (course.subject == subject && course.number == number) {
            classes.push(course);
        }
    });

    return classes;
}

function setCurrentTerm(term) {

}

function getCurrentTermDB() {
    return currentTermDB;
}

exports.setCurrentTerm = setCurrentTerm;
exports.getCurrentTermDB = getCurrentTermDB;
