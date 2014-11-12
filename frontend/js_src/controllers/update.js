var banner = require('./banner.js');
var UpdateAvailable = require('../components/banners/UpdateAvailable.react.js');

var termdb = require('../store/termdb.js');

function finish() {
    banner.stop('updateAvailable');
}

termdb.on('updateAvailable', function(updates) {
    banner.show(<UpdateAvailable updates={updates} onFinish={finish} />, 'updateAvailable');
});

termdb.on('readystatechange', function() {
    if (!termdb.ready) {
        banner.stop('updateAvailable');
    }
});