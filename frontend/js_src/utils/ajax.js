function ajax(settings) {
    return new Promise(function(resolve, reject) {
        $.ajax($.extend({
            success: function(data) {
                console.log('ajax success', data)
                resolve(data);
            },
            error: function(xhr, status, error) {
                console.log(error);
                reject(error);
            }
        }, settings));
    });
}

function getJson(url) {
    var settings = {
        url: url,
        dataType: 'json'
    }
    return ajax(settings);
}

module.exports = {
    ajax: ajax,
    getJson: getJson
}