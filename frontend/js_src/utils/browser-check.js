/**
 * @jsx React.DOM
 */
var modal = require('./modal.js');

var localStore = require('../persist/localStorage.js');
var UnsupportedBrowserWarning = require('../components/pagelets/UnsupportedBrowserWarning.react.js');

if (!localStore.get('dont-warn-unsupported-browser')) {
    if (!window.indexedDB) {
        modal.show(<UnsupportedBrowserWarning reason="feature" />);
    } else if (navigator && navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') == -1) {
        modal.show(<UnsupportedBrowserWarning reason="safari" />);
    }
}
