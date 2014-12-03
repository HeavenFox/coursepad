module.exports = {
	db: function(path) {
        return '/static/data/' + path;
	},

    termdbSearch: function(term, query) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/search?q=' + encodeURIComponent(query);
    },

    termdbBasket: function(term, basket) {
        return '/endpoints/termdb/' + encodeURIComponent(term) + '/basket?classes=' + encodeURIComponent(basket);
    }

}