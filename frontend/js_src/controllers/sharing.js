var ajax = require('../utils/ajax.js');
var endpoints = require('../consts/endpoints.js');
var user = require('../store/user.js');
var schedule = require('../store/schedules.js');

async function shareSchedule() {
    var curUser = user.getCurrentUser();
    var curSchedule = schedule.getCurrentSchedule();
    if (!curUser) {
        //throw new Error('Need Sign In');
    }
    if (!curSchedule) {
        throw new Error('Schedule not ready');
    }

    var json = curSchedule.serializeScheduleForSharing();
    var options = {
        'headers': user.signHeader({})
    };

    console.log(JSON.stringify(JSON.stringify(json)));

    return await ajax.post(endpoints.share(), {
        'schedule': JSON.stringify(json),
        'term': curSchedule.term
    }, options);
}


exports.shareSchedule = shareSchedule;