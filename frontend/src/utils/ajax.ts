const $ = window.jQuery;

export function ajax(settings): any {
  return new Promise(function(resolve, reject) {
    $.ajax(
      $.extend(
        {
          success: function(data) {
            resolve(data);
          },
          error: function(xhr, status, error) {
            reject({
              status: xhr.status,
              body: xhr.responseText
            });
          }
        },
        settings
      )
    );
  });
}

export function getJson(url, options = {}): any {
  var settings = $.extend(
    {
      url: url,
      dataType: "json"
    },
    options
  );
  return ajax(settings);
}

export function post(url, data, options = {}): any {
  var settings = $.extend(
    {
      method: "POST",
      url: url,
      data: data,
      dataType: "json"
    },
    options
  );
  return ajax(settings);
}
