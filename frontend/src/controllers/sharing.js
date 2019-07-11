import * as ajax from '../utils/ajax.ts';
import * as endpoints from '../consts/endpoints.ts';
import user from '../store/user.ts';
import schedules from '../store/schedules.ts';

export async function shareSchedule() {
    var curUser = user.getCurrentUser();
    var curSchedule = schedules.getCurrentSchedule();
    if (!curUser) {
        throw new Error('Need Sign In');
    }
    if (!curSchedule) {
        throw new Error('Schedule not ready');
    }

    var json = curSchedule.serializeScheduleForSharing();
    var options = {
        'headers': user.signHeader({})
    };

    return await ajax.post(endpoints.share(), {
        'schedule': JSON.stringify(json),
        'term': curSchedule.term
    }, options);
}