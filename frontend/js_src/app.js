/** @jsx React.DOM **/
var meta = require('./store/meta.js');

var Calendar = require('./components/Calendar.react.js');
var SearchBar = require('./components/SearchBar.react.js');
var Sidebar = require('./components/Sidebar.react.js');
var termdb = require('./store/termdb.js');

var schedules = require('./store/schedules.js');
var termdb = require('./store/termdb.js');

var magic = require('./magic/magic.js');
var TermSelector = require('./components/TermSelector.react.js');
var User = require('./components/User.react.js');
var LeftBar = require('./components/LeftBar.react.js');
var humanize = require('./consts/humanize.js');

var welcome = require('./utils/welcome.js');
require('./controllers/update.js');

var router = require('./router.js');

var ajax = require('./utils/ajax.js');
var endpoints = require('./consts/endpoints.js');


React.render(<Calendar />, document.getElementById('calendar'));
React.render(<SearchBar />, document.getElementById('topsearch'));
React.render(<Sidebar />, document.getElementById('utilities'));
React.render(<TermSelector />, document.getElementById('term-selector'));
React.render(<User />, document.getElementById('current-user'));
React.render(<LeftBar />, document.getElementById('sidebar'));

welcome();
meta.upgradeSchema();

function initCurrentTerm() {
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

    return currentTermPromise;
}


var currentTermPromise = initCurrentTerm();

router.reg(/\/$/, function() {
    var currentScheduleIndex = meta.getScheduleIndex() || 0;
    return schedules.setCurrentSchedule(undefined, currentScheduleIndex);
},
function() {
    return currentTermPromise.then(function(term) {
        return termdb.setCurrentTerm(term, termdb.PREFER_FASTER);
    });
});

router.reg(/\/shared\/([a-zA-Z0-9]+)$/, async function(slug) {
    var shared = await ajax.getJson(endpoints.shared(slug));
    await schedules.setSharedSchedule(shared['term'], shared['schedule']);
},
function() {
    return currentTermPromise.then(function(term) {
        return termdb.setCurrentTerm(term, termdb.PREFER_REMOTE);
    });
});

router.init();