module.exports = {
    show: function(component) {
        $('body').addClass('modal-open');
        $('.modal-container').removeClass('hidden');

        React.render(component, $('.modal-window').get(0));
    },

    stop: function() {
        $('body').removeClass('modal-open');
        $('.modal-container').addClass('hidden');
        React.unmountComponentAtNode($('.modal-window').get());
    }
}