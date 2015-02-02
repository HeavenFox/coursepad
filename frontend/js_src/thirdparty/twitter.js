
var loadAwaitable, initialized;

async function init() {
	if (initialized) {
		return true;
	}

	if (!loadAwaitable) {
		loadAwaitable = new Promise(function(resolve, reject) {

			window.twttr = (function(d, s, id) {
			 	var js, fjs = d.getElementsByTagName(s)[0],
				t = window.twttr || {};
				if (d.getElementById(id)) return;
				js = d.createElement(s);
				js.id = id;
				js.src = "https://platform.twitter.com/widgets.js";
				fjs.parentNode.insertBefore(js, fjs);

				t._e = [];
				t.ready = function(f) {
					t._e.push(f);
				};

				return t;
			}(document, "script", "twitter-wjs"));

			window.twttr.ready(function() {
				resolve(true);
			});
		});
	}

	await loadAwaitable;
	return true;
}

exports.init = init;