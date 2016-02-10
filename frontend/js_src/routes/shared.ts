import {RoutingRule, register} from './router';

import termdb from '../store/termdb';
import schedules from '../store/schedules';
import * as ajax from '../utils/ajax';
import * as endpoints from '../consts/endpoints';

class SharedRoute extends RoutingRule {
    pattern = /\/shared\/([a-zA-Z0-9]+)$/;
    
    private sharedInfo : any;
    
    async getSharedInfo(slug: string) {
        if (this.sharedInfo) {
            return;
        }
        this.sharedInfo = await ajax.getJson(endpoints.shared(slug));
    }
    
    async init(slug) {
        await this.getSharedInfo(slug);
        await termdb.setCurrentTerm(this.sharedInfo['term'], termdb.PREFER_REMOTE);
    }
    
    async push(slug) {
        await this.getSharedInfo(slug);
        await schedules.setSharedSchedule(this.sharedInfo['term'], this.sharedInfo['schedule']);
    }
    
}

register(new SharedRoute());