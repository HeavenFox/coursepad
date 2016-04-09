import {RoutingRule, register} from './router';

var welcome : any = require('../utils/welcome.js');
import * as meta from '../store/meta.ts';
import * as humanize from '../consts/humanize.ts';
import termdb from '../store/termdb.ts';
import schedules from '../store/schedules.ts';

class RootRoute extends RoutingRule {
    pattern = /\/$/;

    async init() {
        welcome();
        let term = meta.getSelectedTerm();

        if (!term) {
            let terms = await meta.getRemoteTerms()
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
