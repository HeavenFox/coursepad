import * as meta from './store/meta.ts';

var Calendar : any = require('./components/Calendar.react.js');
var SearchBar : any = require('./components/SearchBar.react.js');
var Sidebar : any = require('./components/Sidebar.react.js');

var schedules : any = require('./store/schedules.js');
var termdb : any = require('./store/termdb.js');

var TermSelector : any = require('./components/TermSelector.react.js');
var User : any = require('./components/User.react.js');
var LeftBar : any = require('./components/LeftBar.react.js');
var humanize : any = require('./consts/humanize.js');

var welcome : any = require('./utils/welcome.js');
require('./controllers/update.js');

import * as router from './router.ts';

var ajax : any = require('./utils/ajax.js');
var endpoints : any = require('./consts/endpoints.js');


ReactDOM.render(<Calendar />, document.getElementById('calendar'));
ReactDOM.render(<SearchBar />, document.getElementById('topsearch'));
ReactDOM.render(<Sidebar />, document.getElementById('utilities'));
ReactDOM.render(<TermSelector />, document.getElementById('term-selector'));
ReactDOM.render(<User />, document.getElementById('current-user'));
ReactDOM.render(<LeftBar />, document.getElementById('sidebar'));

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
