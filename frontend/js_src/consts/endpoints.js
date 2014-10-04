module.exports = {
	db: function(path) {
        if (PROD) {
            return 'http://coursepad.github.io/static/data/' + path;
        } else {
            return 'http://coursepadtest.me/static/data/' + path;
        }
	}

}