var showing = false;

function show(component, priority) {
    if (showing) {
        stop();
    }

    showing = true;

    $('body').addClass('modal-open');
    $('.modal-container').removeClass('hidden');

    React.render(component, $('.modal-window').get(0));
}

function stop() {
    showing = false;
    $('body').removeClass('modal-open');
    $('.modal-container').addClass('hidden');
    React.unmountComponentAtNode($('.modal-window').get());
}

module.exports = {
    show: show,
    stop: stop
}