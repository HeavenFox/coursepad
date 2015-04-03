/**
 * @jsx React.DOM
 */
var SplashScreen = require('../components/pagelets/SplashScreen.react.js');
var campaign = require('../store/campaign.js');
var modal = require('./modal.js');

module.exports = function() {
    if (!campaign.hasRun('welcome_v2')) {
        modal.show(<SplashScreen />);
    }
}