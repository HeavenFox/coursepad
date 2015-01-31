/**
 * @jsx React.DOM
 */
var MigrationNotice = require('../components/pagelets/MigrationNotice.react.js');
var localStore = require('../persist/localStorage.js');
var modal = require('./modal.js');

module.exports = function() {
    if (localStore.get('meta_version') === undefined) {
    	window.location = 'https://coursepad.me/'
    } else {

        modal.show(<MigrationNotice />);
    }
}