const CLIENT_ID = '338972481097-abik47er8hh87gblpifptb3409thqs2i.apps.googleusercontent.com';
var loadAwaitable, initialized;

/**
 * idempotent
 */
async function init() {
	if (initialized) {
		return true;
	}

	if (!loadAwaitable) {
		loadAwaitable = new Promise(function(resolve, reject) {
			window['_googAsyncInit'] = function() {
				gapi.client.setApiKey(CLIENT_ID);
				initialized = true;
				resolve(true);
			};

	        (function(d, s, id){
			    var js, fjs = d.getElementsByTagName(s)[0];
			    if (d.getElementById(id)) {return;}
			    js = d.createElement(s); js.id = id;
			    js.src = "https://apis.google.com/js/client:platform.js?onload=_googAsyncInit";
			    fjs.parentNode.insertBefore(js, fjs);
			}(document, 'script', 'google-jssdk'));
		});
	}

	await loadAwaitable;
	return true;
}

exports.init = init;
exports.CLIENT_ID = CLIENT_ID;