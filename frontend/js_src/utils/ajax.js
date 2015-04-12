function ajax(settings) {
    return new Promise(function(resolve, reject) {
        $.ajax($.extend({
            success: function(data) {
                resolve(data);
            },
            error: function(xhr, status, error) {
                reject({
                    status: xhr.status,
                    body: xhr.responseText
                });
            }
        }, settings));
    });
}

function getJson(url, options) {
    if (options === undefined) {
        options = {};
    }
    var settings = $.extend({
        url: url,
        dataType: 'json'
    }, options);
    return ajax(settings);
}

function post(url, data, options) {
    if (options === undefined) {
        options = {};
    }
    var settings = $.extend({
        method: 'POST',
        url: url,
        data: data,
        dataType: 'json'
    }, options);
    return ajax(settings);
}

module.exports = {
    ajax: ajax,
    getJson: getJson,
    post: post
}