import {RoutingRule, register} from './router';

import welcome from '../utils/welcome.js';
import * as meta from '../store/meta';
import * as humanize from '../consts/humanize';
import termdb from '../store/termdb';
import schedules from '../store/schedules';

class RootRoute extends RoutingRule {
    pattern = /\/$/;

    async init() {
        welcome();
        let term = meta.getSelectedTerm();

        if (!term) {
            let terms = await meta.getRemoteTerms();
            let data = humanize.sortTerms(Object.keys(terms), true);
            term = data[0];
        }

        await termdb.setCurrentTerm(term, termdb.PREFER_FASTER);
    }

    async push() {
        var currentScheduleIndex = meta.getScheduleIndex() || 0;
        await schedules.setCurrentSchedule(undefined, currentScheduleIndex);
    }
}

register(new RootRoute());
