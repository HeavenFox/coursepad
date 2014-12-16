function queryString(p) {
    var result = '';
    for (var k in p) {
        if (p.hasOwnProperty(k)) {
            result += encodeURIComponent(k);
            result += '=';
            result += encodeURIComponent(p[k]);
        }
    }

    return result;
}

module.exports = {
	db: function(path) {
        return '/static/data/' + path;
	},

    termdbSearch: function(term, query) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/search?q=' + encodeURIComponent(query);
    },

    termdbBasket: function(term, basket) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/basket?classes=' + encodeURIComponent(basket);
    },

    userLogin: function(method, parameters) {
        return '/endpoints/user/signin/' + encodeURIComponent(method) + '?' + queryString(parameters);
    },

    share: function() {
        return '/endpoints/sharing/share';
    }
}