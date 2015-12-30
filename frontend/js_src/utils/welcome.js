import SplashScreen from '../components/pagelets/SplashScreen.tsx';
var campaign = require('../store/campaign.js');
var modal = require('./modal.js');

module.exports = function() {
    if (!campaign.hasRun('welcome_v2')) {
        modal.show(<SplashScreen />);
    }
}