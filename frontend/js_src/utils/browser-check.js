/**
 * @jsx React.DOM
 */
var modal = require('./modal.js');

var localStore = require('../persist/localStorage.js');
var UnsupportedBrowserWarning = require('../components/pagelets/UnsupportedBrowserWarning.react.js');

module.exports = function() {
    if (!localStore.get('dont-warn-unsupported-browser')) {

    }
};