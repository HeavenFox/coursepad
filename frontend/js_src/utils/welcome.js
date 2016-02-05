import SplashScreen from '../components/pagelets/SplashScreen.tsx';
var campaign = require('../store/campaign.js');
import * as modal from './modal';

module.exports = function() {
    if (!campaign.hasRun('welcome_v2')) {
        modal.show(<SplashScreen />);
    }
}