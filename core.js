var core = {
    /**
     * Custom variables
     */
    variables: {
        fields: [],
        data_prepared: [],
        supported_fields: ['TEXTAREA', 'INPUT', 'SELECT']
    },

    /**
     * Save one input into storage
     *
     * @param {[array]} fields
     * @throws exception
     */
    save: function (fields) {
        chrome.storage.sync.get(['fields'], function(result) {
            var array = result['fields'] || [];
            fields.forEach(function (data) {
                if (!data.identifiers || !data.url) {
                    throw 'Can not save the element! Data is invalid!'
                } else {
                    array.push(data)
                }
            });

            var jsonObj = {};
            jsonObj['fields'] = array;

            chrome.storage.sync.set(jsonObj, function() {
                return true;
            });
        });
    },

    /**
     * Validate an element (for value and identity)
     *
     * @throws exception
     * @param element
     * @return {{}}
     */
    validate: function (element, url) {
        var element_data = {},
            helpers = {
                /**
                 * Get form position in DOM
                 *
                 * @param form
                 * @return {{pos: number}}
                 */
                getFormPosition: function (form) {
                    var forms = document.getElementsByTagName("FORM");

                    for (var i = 0; i < forms.length; i++) {
                        if (forms[i] === form) {
                            return {'pos': i};
                        }
                    }
                }
            };

        element_data.url = url;
        element_data.identifiers = [];

        if (element.id) {
            element_data.identifiers.push({'el': {'id': element.id}});
        }

        if (element.form) {
            if (element.name) {
                if (element.form.id) {
                    element_data.identifiers.push({'el': {'name': element.name}, 'form': {'id': element.form.id}});
                }

                element_data.identifiers.push({'el': {'name': element.name}, 'form': helpers.getFormPosition(element.form)});
            }

            if (element.form.elements) {
                for (var j = 0; j < element.form.elements.length; j++) {
                    if (element.form.elements[j] === element) {
                        element_data.identifiers.push({'el': {'pos': j}, 'form': helpers.getFormPosition(element.form)});
                    }
                }
            }
        }

        if (element_data.identifiers.length >= 1) {
            if (['SELECT', 'INPUT', 'TEXTAREA'].includes(element.nodeName)) {
                if (['radio', 'checkbox'].includes(element.getAttribute('type'))) {
                    element_data.value = element.checked;
                    element_data.valueType = 'check';
                } else {
                    element_data.value = element.value;
                    element_data.valueType = 'value';
                }
            } else {
                throw 'Can not define an element value!'
            }

            return Object.freeze(element_data);
        } else {
            throw 'Can not identify an element!'
        }
    },

    fill: function () {
        var url = window.location.href.split('//', 2)[1],

            helpers = {

                /**
                 *
                 * @param identifier
                 * @return {*}
                 */
                identifyElement: function (identifier) {
                    var form = null;

                    if (identifier.el.id) {
                        return document.getElementById(identifier.el.id);
                    } else if (identifier.form) {
                        if (identifier.form.id) {
                            form = document.getElementById(identifier.form.id);
                        } else if (identifier.form.pos || identifier.form.pos === 0) {
                            form = document.getElementsByTagName("FORM")[identifier.form.pos];
                        }

                        if (form) {
                            if (identifier.el.name) {
                                for (var i = 0; i < form.elements.length; i++) {
                                    if (form[i].name === identifier.el.name) {
                                        return form[i];
                                    }
                                }
                            } else if (identifier.el.pos || identifier.form.pos === 0) {
                                return form.elements[identifier.el.pos];
                            } else {
                                throw 'Not enough data to get the field.';
                            }
                        } else {
                            throw 'Form can not be found.';
                        }
                    } else {
                        throw 'Not enough data to get the field.';
                    }
                },

                /**
                 * Insert value to the element
                 *
                 * @param element
                 * @param type
                 * @param value
                 */
                insertValue: function (element, type, value) {
                    if (type === 'check') {
                        element.checked = value;
                    } else if (type === 'value') {
                        element.value = value;
                    } else if (type === 'text') {
                        element.innerHTML = value;
                    } else {
                        throw 'Unsupported element type.';
                    }
                }
            };

        chrome.storage.sync.get(['fields'], function(result) {
            var fields = result['fields'] ? result['fields'] : [];

            fields.forEach(function (field) {
                try {
                    if (url.includes(field.url)) {
                        if (field.identifiers.length >= 1) {
                            for (var j = 0; j < field.identifiers.length; j++) {
                                var element = helpers.identifyElement(field.identifiers[j]);
                                helpers.insertValue(element, field.valueType, field.value);
                            }
                        } else {
                            throw 'Can not get field. Identification is invalid.';
                        }
                    }
                } catch (exception) {
                    console.error(exception);
                }
            });
        });
    }
};

var action = {
    /**
     * Helpers for the element rendering
     */
    helpers: {
        /**
         * Lighten/Darker HEX color
         *
         * @return {string}
         */
        lightenColor: function ColorLuminance(hex, lum) {
            hex = String(hex).replace(/[^0-9a-f]/gi, '');
            if (hex.length < 6) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            lum = lum || 0;

            var rgb = "#", c, i;
            for (i = 0; i < 3; i++) {
                c = parseInt(hex.substr(i * 2, 2), 16);
                c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
                rgb += ("00" + c).substr(c.length);
            }

            return rgb;
        }
    },

    /**
     * Variable storage
     */
    variables: {
        extensionWindowLoaded: false,
        extensionWindowOpen: true
    },

    /**
     * Render the field in #selected-inputs-group
     *
     * @throws exception
     * @param data
     * @param code
     */
    render: function (data, code) {
        if (code && data.identifiers) {
            var new_field = document.createElement('div'),
                remove_field = document.createElement('div'),
                selected_inputs_group = document.getElementById('selected-inputs-group'),
                new_field_name = '',
                label_id = 'field-' + code + '-name';

            if (data.identifiers[0].el.id) {
                new_field_name = data.identifiers[0].el.id;
            } else if (data.identifiers[0].el.name) {
                new_field_name = data.identifiers[0].el.name;
            } else {
                new_field_name = '#' + code;
            }

            new_field.classList.add('field');
            new_field.innerHTML = '<label for="field-' + code + '">Secure field <span id="' + label_id + '">' + new_field_name + '</span></label>\
            <input type="text" value="' + data.value + '" name="secure-url" id="field-' + code + '">';
            remove_field.classList.add('field-remove');
            remove_field.setAttribute('data-remove-id', 'field-' + code);
            selected_inputs_group.appendChild(new_field);
            selected_inputs_group.appendChild(remove_field);
            document.getElementById(label_id).style.backgroundColor = '#' + code;
            document.getElementById(label_id).style.color = action.helpers.lightenColor(code, 2);
            document.getElementById('secure-url').disabled = true;
        } else {
            throw 'Field can not be rendered. Field is undefined.'
        }
    },

    /**
     * Handle Field Click
     *
     * @param element
     */
    fieldClick: function (element) {
        try {
            var data = core.validate(element, document.getElementById('secure-url').value),

                /**
                 * Return a random HEX color
                 *
                 * @var function code
                 */
                code = (function co(lor){
                    return (lor += [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f'][Math.floor(Math.random()*16)]) &&
                    (lor.length === 6) ?  lor : co(lor);
                })('');

            element.classList.remove('ex-current-selected-input');
            element.classList.add('ex-selected-input');
            element.setAttribute('data-ex-code', code);
            element.style.backgroundColor = action.helpers.lightenColor(code, 0.2);
            element.style.outlineColor = '#' + code;
            element.style.outlineWidth = '5x';
            element.style.outlineStyle = 'solid';
            core.variables.fields.push(data);
            action.render(data, code);
        } catch (exception) {
            console.error(exception);
        }
    },

    /**
     * Save fields
     */
    saveFields: function () {
        try {
            core.save(core.variables.fields);
            action.clearSelected();
            core.variables.fields = [];
        } catch (exception) {
            console.error(exception);
        }
    },

    /**
     * Clear all the selection
     */
    clearSelected: function () {
        var selected_inputs_group = document.getElementById('selected-inputs-group');

        document.getElementById('secure-url').disabled = false;
        document.querySelectorAll(".ex-selected-input").forEach(function (element) {
            element.removeAttribute('style');
            element.removeAttribute('data-ex-code');
        });
        selected_inputs_group.innerHTML = '';
    },

    /**
     * Build extension window
     */
    buildExtensionWindow: function () {
        var block_to_insert,
            container_block;

        block_to_insert = document.createElement( 'div' );
        block_to_insert.innerHTML =
            '<div id="ex-container">\
                <div id="ex-container-header">\
                </div>\
                <input id="add-new" type="checkbox" name="add-new" value="add-new">\
                <div class="fill-form" id="fill-form">\
                    <div class="fill-form-button"></div>\
                    <div class="fill-form-button-text">Fill data on page</div>\
                </div>\
                <label for="add-new" class="add-new-labels">\
                    <div class="add-new-button"></div>\
                    <div class="add-new-button-text">Add new secure data</div>\
                </label>\
                <label for="add-new" class="cancel-new-labels" id="cancel-new-labels">\
                    <div class="cancel-new-button"></div>\
                    <div class="cancel-new-button-text">Cancel adding new secure data</div>\
                </label>\
                <div class="add-new-form">\
                    <div class="field">\
                        <label for="secure-url">Secure URL</label>\
                        <input type="text" value="' + window.location.href.split('//', 2)[1] + '" name="secure-url" id="secure-url">\
                    </div>\
                <div class="ex-input-group" id="selected-inputs-group">\
                </div>\
            </div>\
            <div class="choose-field" id="select-field">\
                <div class="choose-field-label"></div>\
                <div class="choose-field-text">Choose one more field</div>\
            </div>\
            <label for="add-new" class="save-new-fields" id="save-new-fields">\
                <div class="save-new-button"></div>\
                <div class="save-new-button-text">Save selected secure fields</div>\
            </label>\
        </div>';

        container_block = document.getElementsByTagName("BODY")[0];
        container_block.appendChild(block_to_insert);
        this.dragWindow(document.getElementById(("ex-container")));
    },

    dragWindow: function (element) {
        var helpers = {
            /**
             * Variables
             */
            variables: {
                pos1: 0,
                pos2: 0,
                pos3: 0,
                pos4: 0
            },

            /**
             * Handle mouse drag
             *
             * @param e
             */
            dragMouseDown: function (e) {
                e = e || window.event;
                helpers.variables.pos3 = e.clientX;
                helpers.variables.pos4 = e.clientY;
                document.onmousemove = function (e) { helpers.elementDrag(e) };
                document.onmouseup = function (e) { helpers.closeDragElement() };
            },

            /**
             * Drag the element
             *
             * @param e
             */
            elementDrag: function (e) {
                e = e || window.event;
                helpers.variables.pos1 = helpers.variables.pos3 - e.clientX;
                helpers.variables.pos2 = helpers.variables.pos4 - e.clientY;
                helpers.variables.pos3 = e.clientX;
                helpers.variables.pos4 = e.clientY;
                element.style.top = (element.offsetTop - helpers.variables.pos2) + "px";
                element.style.left = (element.offsetLeft - helpers.variables.pos1) + "px";
            },

            /**
             * Stop element dragging
             */
            closeDragElement: function () {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        };

        if (document.getElementById(element.id + "-header")) {
            document.getElementById(element.id + "-header").onmousedown = function (e) {
                helpers.dragMouseDown(e);
            }
        }
    },

    synchronizeInput: function (element) {
        if (element.classList.contains('ex-selected-input')) {
            var value = '';

            if (['SELECT', 'INPUT', 'TEXTAREA'].includes(element.nodeName)) {
                if (['radio', 'checkbox'].includes(element.getAttribute('type'))) {
                    value = element.checked;
                } else {
                    value = element.value;
                }
            }

            document.getElementById('field-' + element.getAttribute('data-ex-code')).value = value;
        }
    },

    loadExtensionWindow: function () {
        if (!action.variables.extensionWindowLoaded) {
            action.buildExtensionWindow();
            action.variables.extensionWindowOpen = true;
            action.variables.extensionWindowLoaded = true;

            var enable_input_select = false,
                previous_selected_input = null;

            document.addEventListener("click", function (e) {
                if (e.srcElement.hasAttribute('data-remove-id')) {
                    document.getElementById(e.srcElement.getAttribute("data-remove-id")).classList.remove('ex-selected-input');
                    var field = document.querySelectorAll('[data-id="' + e.srcElement.getAttribute("data-remove-id") + '"]')[0].parentNode;
                    field.parentNode.removeChild(field);
                    e.srcElement.parentNode.removeChild(e.srcElement);
                } else if (e.srcElement.id === 'cancel-new-labels' || e.srcElement.parentElement.id === 'cancel-new-labels') {
                    action.clearSelected();
                } else if (e.srcElement.id === 'save-new-fields' || e.srcElement.parentElement.id === 'save-new-fields') {
                    action.saveFields();
                } else if (e.srcElement.id === 'select-field' || e.srcElement.parentElement.id === 'select-field') {
                    enable_input_select = true;
                } else if (e.srcElement.id === 'fill-form' || e.srcElement.parentElement.id === 'fill-form') {
                    try {
                        core.fill();
                    } catch (exception) {
                        console.error(exception);
                    }
                } else {
                    if (enable_input_select) {
                        action.fieldClick(e.srcElement);
                        enable_input_select = false;
                    }
                }
            }, false);

            document.addEventListener('mousemove', function (e) {
                var source_element = e.srcElement,
                    current_selected_input_class = 'ex-current-selected-input';

                if (enable_input_select) {
                    if (core.variables.supported_fields.includes(source_element.nodeName)) {
                        if (!source_element.classList.contains('ex-selected-input')) {
                            if (previous_selected_input != null) {
                                previous_selected_input.classList.remove(current_selected_input_class);
                            }
                            source_element.classList.add(current_selected_input_class);
                            previous_selected_input = source_element;
                        }
                    }
                }
            }, false);

            document.addEventListener('input', function (e) {
                if (document.getElementById('add-new').checked) {
                    action.synchronizeInput(e.srcElement);
                }
            });

            document.addEventListener('change', function (e) {
                if (document.getElementById('add-new').checked) {
                    action.synchronizeInput(e.srcElement);
                }
            });
        } else {
            action.triggerExtensionWindow();
        }
    },

    triggerExtensionWindow: function () {
        var ex_container = document.getElementById('ex-container');

        if (action.variables.extensionWindowOpen) {
            ex_container.style.display = 'none';
            action.variables.extensionWindowOpen = false;
            document.getElementById('add-new').checked = false;
            action.clearSelected();
        } else {
            ex_container.removeAttribute('style');
            action.variables.extensionWindowOpen = true;
        }
    }
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    sendResponse(action.loadExtensionWindow());
});