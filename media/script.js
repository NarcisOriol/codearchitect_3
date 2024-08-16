document.addEventListener('DOMContentLoaded', () => {
    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'editObject') {
            // Reset previous content
            document.body.innerHTML = '';

            // Handle the editObject command
            vscode.postMessage({ command: 'objectEdited', item: message.item });

            // Create and append the container for title and button
            const container = createTitleContainer(message.item, vscode);
            document.body.appendChild(container);

            // Create a new div for the object
            const objectDiv = document.createElement('div');
            // Give some css
            objectDiv.style.border = '1px solid #ccc';
            objectDiv.style.padding = '10px';
            objectDiv.style.marginBottom = '10px';
            document.body.appendChild(objectDiv);

            // Render child elements
            message.item.children.forEach(child => {
                //Copy the tags of the parent to the child
                renderChild(child, objectDiv, vscode);
            });

            // Create and append the save button
            const saveButton = createSaveButton(message.item, vscode);
            document.body.appendChild(saveButton);
        }
    });

    vscode.postMessage({ command: 'webviewReady' });
});

function resolveRef(schema, root_schema) {
    for (const key in schema) {
        if (key === "$ref") {
            const ref = schema["$ref"].split("/");
            //Discard the first element
            ref.shift();
            //Convert all %24 to $ using map
            const ref_keys = ref.map((item) => item.replace(/%24/g, "$"));
            //Get the root schema
            let current_schema = root_schema;
            //Loop through the ref_keys
            for (const ref_key of ref_keys) {
                current_schema = current_schema[ref_key];
            }
            schema = current_schema;
        }
    }
    return schema;
}


// Helper functions

function createTitleContainer(item, vscode) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';

    const title = document.createElement('h2');
    title.textContent = item.$label;

    const editButton = document.createElement('button');
    editButton.innerHTML = '&#9998;';
    editButton.style.marginLeft = '10px';
    editButton.onclick = () => handleEditTitle(title, item, vscode, container);

    container.appendChild(title);
    container.appendChild(editButton);
    return container;
}

function handleEditTitle(title, item, vscode, container) {
    const titleText = title.textContent;
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = titleText;
    applyInputStyles(title, titleInput);

    titleInput.addEventListener('keydown', (event) => handleTitleInput(event, title, item, container));
    titleInput.addEventListener('focusout', () => handleTitleInputFocusOut(title, titleInput, item, container));

    container.replaceChild(titleInput, title);
    titleInput.focus();
    titleInput.select();
}

function applyInputStyles(title, titleInput) {
    titleInput.style.fontSize = window.getComputedStyle(title).fontSize;
    titleInput.style.fontFamily = window.getComputedStyle(title).fontFamily;
    titleInput.style.border = 'none';
    titleInput.style.padding = '0';
    titleInput.style.margin = '0';
    titleInput.style.outline = 'none';
}

function handleTitleInput(event, title, item, container) {
    if (event.key === 'Enter') {
        updateTitle(title, event.target, item, container);
    }
}

function handleTitleInputFocusOut(title, titleInput, item, container) {
    updateTitle(title, titleInput, item, container);
}

function updateTitle(title, titleInput, item, container) {
    title.textContent = titleInput.value;
    container.replaceChild(title, titleInput);
    item.$label = title.textContent;

    // Update child items if needed
    item.children.forEach(child => {
        if (child.$label === '$label') {
            child.value = title.textContent;
        }
    });
}

function renderChild(child, div, vscode) {
    const format = child.schema.format;
    switch (format) {
        case 'sub-object':
            renderSubObjectChild(child, div, vscode);
            break;
        case 'input-string':
            renderInputString(child, div, vscode);
            break;
        case 'checkbox':
            renderCheckbox(child, div, vscode);
            break;
        case 'dropdown-select':
            renderDropdownSelect(child, div, vscode);
            break;
        case 'dropdown-select-tag':
            renderDropdownSelectTag(child, div, vscode);
            break;
        case 'pool-dropdown-select':
            renderPoolDropdownSelect(child, div, vscode);
            break;
        case 'pool-dropdown-select-tag':
            renderPoolDropdownSelectTag(child, div, vscode);
            break;
        case 'text-area':
            renderTextArea(child, div, vscode);
            break;
        case 'array-creator':
            renderArrayCreator(child, div, vscode);
            break;
        case 'hidden':
            break;
        default:
            console.error(`Unsupported format: ${format}`);
            break;
    }
}

function renderInputString(child, div, vscode) {
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    div.appendChild($label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = child.value;
    input.style.marginBottom = '10px';
    div.appendChild(input);

    input.addEventListener('input', (event) => {
        child.value = event.target.value;
    });
}

function renderTextArea(child, div, vscode) {
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    div.appendChild($label);

    const textarea = document.createElement('textarea');
    textarea.value = child.value;
    textarea.style.marginBottom = '10px';
    textarea.style.width = '100%'; // Set textarea width to 100% of the parent div
    textarea.style.height = '100%'; // Set textarea height to 100% of the parent div
    textarea.style.resize = 'vertical'; // Allow vertical resizing
    div.appendChild(textarea);

    textarea.addEventListener('input', (event) => {
        child.value = event.target.value;
    });
}

function renderCheckbox(child, div, vscode) {
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';

    const $label = document.createElement('label');
    $label.textContent = child.$label;
    checkboxContainer.appendChild($label);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = child.value;
    checkbox.style.marginBottom = '10px';
    checkboxContainer.appendChild(checkbox);

    div.appendChild(checkboxContainer);

    checkbox.addEventListener('change', (event) => {
        child.value = event.target.checked;
    });
}

function renderDropdownSelect(child, div, vscode) {
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    div.appendChild($label);

    const select = document.createElement('select');
    select.style.marginBottom = '10px';
    div.appendChild(select);

    options = child.schema.enum;

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });

    select.value = child.value;

    select.addEventListener('change', (event) => {
        child.value = event.target.value;
    });
}

function renderDropdownSelectTag(child, div, vscode) {
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    div.appendChild($label);

    const select = document.createElement('select');
    select.style.marginBottom = '10px';
    div.appendChild(select);

    // Tag to filter
    const tags_filter = child.schema.const;

    // Filter in child.$tags only the objects that contain the tags_filter
    const tags = child.$tags.filter(tag => tag.$tag.some(t => tags_filter.includes(t)));

    tags.forEach(tag => {
        const optionElement = document.createElement('option');
        optionElement.value = tag.$id;
        optionElement.textContent = tag.$label;
        select.appendChild(optionElement);
    });

    select.value = child.value;

    select.addEventListener('change', (event) => {
        child.value = event.target.value;
    });
}

function renderArrayCreator(child, div, vscode) {
    // Create a new div for the array creator
    const arrayCreatorDiv = document.createElement('div');
    arrayCreatorDiv.style.border = '1px solid #ccc';
    arrayCreatorDiv.style.padding = '10px';
    arrayCreatorDiv.style.marginBottom = '10px';
    div.appendChild(arrayCreatorDiv);

    // Create and append the $label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    arrayCreatorDiv.appendChild($label);

    const format = child.schema.items.format;

    // Create and append the add button
    const addButton = document.createElement('button');
    addButton.textContent = 'Add';
    addButton.onclick = () => {
        if (format === 'sub-object') {
            createElement(child, vscode);
        } else {
            child.value.push('');
            //Remove previous div
            arrayCreatorDiv.remove();
            renderArrayCreator(child, div, vscode);
        }
    };
    arrayCreatorDiv.appendChild(addButton);

    if (format === 'sub-object') {
        // For children of the array creator
        child.hidden_children.forEach(subChild => {
            renderChild(subChild, arrayCreatorDiv, vscode);
            //Create a remove button in this div
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.onclick = () => {
                removeElement(subChild, vscode);
            }
            arrayCreatorDiv.appendChild(removeButton);
            //Copy subchild into child
            child.children.push(subChild);
        });
    } else {
        for (value of child.value) {
            // Create a child
            const fake_child = {
                value: value,
                schema: child.schema.items
            }

            // Create a listener to update child when fake_child changes
            Object.defineProperty(fake_child, 'value', {
                set: function (newValue) {
                    child.value[child.value.indexOf(value)] = newValue;
                },
                get: function () {
                    return child.value[child.value.indexOf(value)];
                }
            });

            renderChild(fake_child, arrayCreatorDiv, vscode);

            // Create a remove button in this div
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.onclick = () => {
                child.value.splice(child.value.indexOf(value), 1);
                // Remove previous div
                arrayCreatorDiv.remove();
                renderArrayCreator(child, div, vscode);
            }
            arrayCreatorDiv.appendChild(removeButton);
        }
    }
}

function renderPoolDropdownSelect(child, div, vscode) {
    // Create and append the container for the filter input and selected items
    const containerDiv = document.createElement('div');
    containerDiv.style.marginBottom = '10px'; // Add margin
    div.appendChild(containerDiv);

    // Create and append the $label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    containerDiv.appendChild($label);

    // Create and append the input field for searching
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Start typing to filter...';
    input.style.marginBottom = '10px';
    containerDiv.appendChild(input);

    // Create and append the selected items container within the same div
    const selectedItemsDiv = document.createElement('div');
    selectedItemsDiv.className = 'selected-items';
    containerDiv.appendChild(selectedItemsDiv);

    // Create and append the suggestions container
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'suggestions';
    suggestionsDiv.style.display = 'none'; // Initially hidden
    div.appendChild(suggestionsDiv);

    // Initialize with existing selected values
    const selectedValues = child.value || [];
    renderSelectedItems(selectedItemsDiv, selectedValues, child);

    // Setup event listeners
    setupPoolDropdownListeners(input, suggestionsDiv, selectedItemsDiv, selectedValues, child);

    // Helper functions
    function setupPoolDropdownListeners(input, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        // Show suggestions when input is focused
        input.addEventListener('focus', () => {
            updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child);
            suggestionsDiv.style.display = 'block';
        });

        // Update suggestions on input change
        input.addEventListener('input', () => updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child));

        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!div.contains(event.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });
    }

    function updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        const query = input.value.toLowerCase();
        const enumOptions = child.schema.items.enum;
        const filteredOptions = enumOptions.filter(option =>
            option.toLowerCase().includes(query) && !selectedValues.includes(option)
        );
        renderSuggestions(suggestionsDiv, filteredOptions, selectedItemsDiv, selectedValues, child);
    }

    function renderSuggestions(suggestionsDiv, options, selectedItemsDiv, selectedValues, child) {
        suggestionsDiv.innerHTML = '';
        options.forEach(option => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = option;
            suggestionItem.onclick = () => handleSuggestionClick(option, suggestionsDiv, selectedItemsDiv, selectedValues, child);
            suggestionsDiv.appendChild(suggestionItem);
        });
    }

    function handleSuggestionClick(option, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        selectedValues.push(option);
        renderSelectedItems(selectedItemsDiv, selectedValues, child);
        suggestionsDiv.style.display = 'none';
    }

    function renderSelectedItems(selectedItemsDiv, selectedValues, child) {
        selectedItemsDiv.innerHTML = '';
        selectedValues.forEach((value, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'selected-item';

            const itemLabel = document.createElement('span');
            itemLabel.textContent = value;
            itemDiv.appendChild(itemLabel);

            const removeButton = document.createElement('button');
            removeButton.textContent = 'X';
            removeButton.className = 'remove-button';
            removeButton.onclick = () => handleRemoveSelectedItem(index, selectedValues, selectedItemsDiv, child);
            itemDiv.appendChild(removeButton);

            selectedItemsDiv.appendChild(itemDiv);
        });

        updateChildValues(child, selectedValues);
    }

    function handleRemoveSelectedItem(index, selectedValues, selectedItemsDiv, child) {
        selectedValues.splice(index, 1);
        renderSelectedItems(selectedItemsDiv, selectedValues, child);
    }

    function updateChildValues(child, selectedValues) {
        child.value = selectedValues;
    }
}

function renderPoolDropdownSelectTag(child, div, vscode) {
    // Create and append the container for the filter input and selected items
    const containerDiv = document.createElement('div');
    containerDiv.style.marginBottom = '10px'; // Add margin
    div.appendChild(containerDiv);

    // Create and append the $label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    containerDiv.appendChild($label);

    // Create and append the input field for searching
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Start typing to filter...';
    input.style.marginBottom = '10px';
    containerDiv.appendChild(input);

    // Create and append the selected items container within the same div
    const selectedItemsDiv = document.createElement('div');
    selectedItemsDiv.className = 'selected-items';
    containerDiv.appendChild(selectedItemsDiv);

    // Create and append the suggestions container
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'suggestions';
    suggestionsDiv.style.display = 'none'; // Initially hidden
    div.appendChild(suggestionsDiv);

    // Initialize with existing selected values
    const selectedValues = child.value || [];
    renderSelectedItems(selectedItemsDiv, selectedValues, child);

    // Setup event listeners
    setupPoolDropdownListeners(input, suggestionsDiv, selectedItemsDiv, selectedValues, child);

    // Helper functions
    function setupPoolDropdownListeners(input, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        // Show suggestions when input is focused
        input.addEventListener('focus', () => {
            updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child);
            suggestionsDiv.style.display = 'block';
        });

        // Update suggestions on input change
        input.addEventListener('input', () => updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child));

        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!div.contains(event.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });
    }

    function updateSuggestions(input, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        const query = input.value.toLowerCase();
        const tagsFilter = child.schema.items.const;
        const tags = child.$tags.filter(tag => tag.$tag.some(t => tagsFilter.includes(t)));
        const filteredTags = tags
            .filter(tag => tag.$label.toLowerCase().includes(query) && !selectedValues.includes(tag.$id))
            .map(tag => tag.$label);
        renderSuggestions(suggestionsDiv, filteredTags, selectedItemsDiv, selectedValues, child);
    }

    function renderSuggestions(suggestionsDiv, options, selectedItemsDiv, selectedValues, child) {
        suggestionsDiv.innerHTML = '';
        options.forEach(option => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = option;
            suggestionItem.onclick = () => handleSuggestionClick(option, suggestionsDiv, selectedItemsDiv, selectedValues, child);
            suggestionsDiv.appendChild(suggestionItem);
        });
    }

    function handleSuggestionClick(optionLabel, suggestionsDiv, selectedItemsDiv, selectedValues, child) {
        const tag = child.$tags.find(tag => tag.$label === optionLabel);
        if (tag && tag.$id) {
            selectedValues.push(tag.$id);
            renderSelectedItems(selectedItemsDiv, selectedValues, child);
            suggestionsDiv.style.display = 'none';
        }
    }

    function renderSelectedItems(selectedItemsDiv, selectedValues, child) {
        selectedItemsDiv.innerHTML = '';
        selectedValues.forEach((id, index) => {
            const tag = child.$tags.find(tag => tag.$id === id);
            if (tag) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'selected-item';

                const itemLabel = document.createElement('span');
                itemLabel.textContent = tag.$label;
                itemDiv.appendChild(itemLabel);

                const removeButton = document.createElement('button');
                removeButton.textContent = 'X';
                removeButton.className = 'remove-button';
                removeButton.onclick = () => handleRemoveSelectedItem(index, selectedValues, selectedItemsDiv, child);
                itemDiv.appendChild(removeButton);

                selectedItemsDiv.appendChild(itemDiv);
            }
        });

        updateChildValues(child, selectedValues);
    }

    function handleRemoveSelectedItem(index, selectedValues, selectedItemsDiv, child) {
        selectedValues.splice(index, 1);
        renderSelectedItems(selectedItemsDiv, selectedValues, child);
    }

    function updateChildValues(child, selectedValues) {
        child.value = selectedValues;
    }
}

function renderSubObjectChild(child, div, vscode) {
    const subObjectDiv = document.createElement('div');
    subObjectDiv.style.border = '1px solid #ccc';
    subObjectDiv.style.padding = '10px';
    subObjectDiv.style.marginBottom = '10px';
    div.appendChild(subObjectDiv);

    const $label = document.createElement('h3');
    $label.textContent = child.$label;
    subObjectDiv.appendChild($label);

    child.hidden_children.forEach(subChild => {
        renderChild(subChild, subObjectDiv, vscode);
        //Copy subchild into child
        child.children.push(subChild);
    });
}

function createSaveButton(item, vscode) {
    console.log(item);
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.onclick = () => {
        vscode.postMessage({ command: 'saveObject', item: item });
    };
    return saveButton;
}

function createElement(item, vscode) {
    vscode.postMessage({ command: 'createItem', item: item });
}

function removeElement(item, vscode) {
    vscode.postMessage({ command: 'removeItem', item: item });
}
