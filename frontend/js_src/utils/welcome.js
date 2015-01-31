/**
 * @jsx React.DOM
 */
var MigrationNotice = require('../components/pagelets/MigrationNotice.react.js');
var Redirecting = require('../components/pagelets/Redirecting.react.js');
var localStore = require('../persist/localStorage.js');
var modal = require('./modal.js');

module.exports = function() {
	// Handle redirection
	if (window.location.hash === '#redirect') {
		localStore.set('redirect', true);
	} else if (window.location.hash === '#noredirect') {
		localStore.set('redirect', false);
	}

	if (localStore.get('redirect') || localStore.get('meta_version') === undefined) {
        modal.show(<Redirecting />);
		window.location = 'https://coursepad.me/';
	} else {
        modal.show(<MigrationNotice />);
	}
}