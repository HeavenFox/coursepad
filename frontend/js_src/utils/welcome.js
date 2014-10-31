/**
 * @jsx React.DOM
 */
var SplashScreen = require('../components/pagelets/SplashScreen.react.js');
var localStore = require('../persist/localStorage.js');
var modal = require('./modal.js');

module.exports = function() {
    if (localStore.get('meta_version') === undefined) {
        modal.show(<SplashScreen />);
    }
}