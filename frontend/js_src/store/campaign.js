var localStore = require('../persist/localStorage.js');

exports.hasRun = function(name) {
	return !!localStore.get('campaigns', {})[name];
}

exports.markRun = function(name) {
	localStore.get('campaigns', {})[name] = true;
	localStore.fsync('campaigns');
}