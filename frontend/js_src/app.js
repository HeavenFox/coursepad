var flux = require('flux');

var meta = require('./store/meta.js');

var Calendar = require('./components/Calendar.react.js');
var SearchBar = require('./components/SearchBar.react.js');
var Sidebar = require('./components/Sidebar.react.js');
var termdb = require('./store/termdb.js');

var schedules = require('./store/schedules.js');



React.renderComponent(Calendar(), document.getElementById('calendar'));
React.renderComponent(SearchBar(), document.getElementById('topsearch'));
React.renderComponent(Sidebar(), document.getElementById('utilities'));

function initCurrentTerm() {
    var currentTerm = meta.getSelectedTerm();
    var currentTermPromise;

    if (currentTerm) {
        currentTermPromise = Promise.resolve(currentTerm);
    } else {
        currentTermPromise = meta.getRemoteTerms().then(function(data) {
            currentTerm = data[data.length-1];
            meta.setSelectedTerm(currentTerm);
            return currentTerm;
        });
    }

    return currentTermPromise.then(function(term) {
        var localTerms = meta.getLocalTerms();
        if (!localTerms || localTerms.indexOf(term) < 0) {
            return termdb.loadTerm(term).then(function() {
                return term;
            });
        }
        return term;
    }).then(function(term) {
        return termdb.setCurrentTerm(term);
    });
}




function initCurrentSchedule() {
    var currentScheduleIndex = meta.getScheduleIndex() || 0;
    var currentTermName = termdb.getCurrentTerm().term;
    return schedules.setCurrentSchedule(currentTermName, currentScheduleIndex);
}

$(function() {
    initCurrentTerm().then(function(){
        return initCurrentSchedule();
    });

});