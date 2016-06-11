var banner = require('./banner.js');
var UpdateAvailable = require('../components/banners/UpdateAvailable.tsx');

import termdb from '../store/termdb.ts';

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