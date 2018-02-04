chrome.storage.sync.get(['fields'], function(result) {
    var array = result['fields'] || [],
        urls = {},
        counter = 0;

    array.forEach(function (value) {
        if (!urls[value.url]) {
            urls[value.url] = [];
        }

        urls[value.url].push(value.value);
    });

    for (var url in urls) {
        var short_url = url.split('/'),
            field_html =
            '<div data-url="' + url + '" class="field">\
                <div class="url">\
                    <img src="https://www.google.com/s2/favicons?domain=' + short_url[0] + '">\
                    <a href="http://' + url + '" target="_blank">' + url + '</a>\
                </div>\
                <div class="value-list" id="field-' + counter + '">\
                </div>\
            </div>',
            field = document.createElement("div");

        field.innerHTML = field_html;
        document.getElementById('field-list').appendChild(field);

        urls[url].forEach(function (field) {
            var value_html =
                '<div class="data">\
                    value: ' + field + '\
                </div>\
                <div data-value="' + field + '" data-url="' + url + '" class="remove-field"></div>',
                value = document.createElement('div');

            value.classList.add('value');
            value.innerHTML = value_html;
            document.getElementById('field-' + counter).appendChild(value)
        });

        counter++;
    }
});

window.addEventListener('click', function (ev) {
    if (ev.srcElement.classList.contains('remove-field')) {
        chrome.storage.sync.get(['fields'], function(result) {
            var array = result['fields'] || [];

            for (var i = 0; i < array.length; i++) {
                if (array[i]['url'] === ev.srcElement.getAttribute('data-url') &&
                    array[i]['value'] === ev.srcElement.getAttribute('data-value')) {
                    array.splice(i, 1);

                    var jsonObj = {};
                    jsonObj['fields'] = array;

                    chrome.storage.sync.set(jsonObj, function() {
                        ev.srcElement.parentElement.style.display = 'none';
                        return true;
                    });
                }
            }
        });
    }
});