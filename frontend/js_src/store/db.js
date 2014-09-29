var endpoints = require('../consts/endpoints.js');

function clearGlobalDatabase() {

}

function clearTermDatabase(term) {

}


/**
 * @return Promise
 */
function getMeta() {

}

function update(terms) {
	return new Promise(function(resolve, reject) {
		$.get(urls.cdnUrl('meta.js'), '', function(metaJson) {
			if (metaJson == window.localStorage['db_meta']) {
				resolve(false);
			} else {
				var oldMeta;

				var oldMetaJson = window.localStorage['db_meta'];
				if (oldMetaJson) {
					oldMeta = JSON.parse(oldMetaJson);
				}
				
				window.localStorage['db_meta'] = metaJson;
				meta = JSON.parse(metaJson);

				if (!oldMeta || meta['global_db_time'] > oldMeta['global_db_time']) {

				}

				if (!oldMeta || )



			}
			
		}, 'string');
	});

}
