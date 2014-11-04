var currentId;

exports.show = function(component, id) {
    currentId = id;
    React.render(component, document.getElementById('banner-container'));
}

exports.stop = function(id) {
    if (currentId == id) {
        React.unmountComponentAtNode(document.getElementById('banner-container'));
        currentId = undefined;
    }
}