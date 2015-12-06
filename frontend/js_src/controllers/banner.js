var currentId;

exports.show = function(component, id) {
    currentId = id;
    ReactDOM.render(component, document.getElementById('banner-container'));
}

exports.stop = function(id) {
    if (currentId == id) {
        ReactDOM.unmountComponentAtNode(document.getElementById('banner-container'));
        currentId = undefined;
    }
}