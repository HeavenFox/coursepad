/** @jsx React.DOM **/
var meta = require('./store/meta.js');

var Calendar = require('./components/Calendar.react.js');
var SearchBar = require('./components/SearchBar.react.js');
var Sidebar = require('./components/Sidebar.react.js');
var termdb = require('./store/termdb.js');

var schedules = require('./store/schedules.js');

var magic = require('./magic/magic.js');
var TermSelector = require('./components/TermSelector.react.js');
var humanize = require('./consts/humanize.js');

React.render(<Calendar />, document.getElementById('calendar'));
React.render(<SearchBar />, document.getElementById('topsearch'));
React.render(<Sidebar />, document.getElementById('utilities'));
React.render(<TermSelector />, document.getElementById('term-selector'));


function initCurrentSchedule() {
    var currentTerm = meta.getSelectedTerm();
    var currentTermPromise;

    if (currentTerm) {
        currentTermPromise = Promise.resolve(currentTerm);
    } else {
        currentTermPromise = meta.getRemoteTerms().then(function(terms) {
            var data = humanize.sortTerms(Object.keys(terms), true);
            currentTerm = data[0];
            return currentTerm;
        });
    }

    var currentScheduleIndex = meta.getScheduleIndex() || 0;

    return currentTermPromise.then(function(term) {
        return schedules.setCurrentSchedule(term, currentScheduleIndex);
    });
}

$(function() {
    initCurrentSchedule();

});