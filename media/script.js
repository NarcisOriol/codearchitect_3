let item_id = '';

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
            objectDiv.style.marginBottom = '10px';
            document.body.appendChild(objectDiv);

            const item = message.item.hidden_children.find(child => child.$label === '$id');
            item_id = item ? item.value : null;

            // Render child elements
            message.item.hidden_children.forEach(child => {
                //Copy the $links of the parent to the child
                child.$links = message.item.$links;
                //Copy the tags of the parent to the child
                renderChild(child, objectDiv, vscode);

            });
        }
    });

    vscode.postMessage({ command: 'webviewReady' });
});

function readJsonFileSync(filePath) {
    try {
        // Resolve the full path of the file
        const fullPath = path.resolve(__dirname, filePath);

        // Read the file synchronously
        const data = fs.readFileSync(fullPath, 'utf8');
        
        // Parse the JSON data
        const jsonData = JSON.parse(data);
        
        // Return the parsed data
        return jsonData;
    } catch (error) {
        // Handle errors (e.g., file not found, JSON parse error)
        console.error('Error:', error);
        return null; // or throw error if you prefer
    }
}

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

    // Create and append the edit button which is a minimalistic icon
    const editButton = document.createElement('button');
    editButton.className = 'codicon codicon-edit';
    editButton.style.marginLeft = '10px';
    editButton.style.background = 'none'; // Remove the background
    editButton.style.border = 'none'; // Remove the border
    editButton.style.padding = '0'; // Remove the padding
    editButton.style.cursor = 'pointer'; // Add cursor pointer
    editButton.style.color = '#6c6c6c'; // Set icon color to match VSCode light theme
    editButton.onclick = () => handleEditTitle(title, item, vscode);

    container.appendChild(title);
    container.appendChild(editButton);
    return container;
}

function handleEditTitle(title, item, vscode) {
    // Hide the edit button
    title.nextElementSibling.style.display = 'none';
    // Enable content-editable mode on the title
    title.contentEditable = true;

    // Apply custom styles when editing
    title.style.fontStyle = 'italic'; // Apply cursive style
    title.style.outline = 'none'; // Remove the default outline
    //I want to add the cursor to the end of the text
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(title);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    title.focus();


    // Handle Enter key and focus out event to save changes
    title.addEventListener('keydown', (event) => handleTitleInput(event, title, item, vscode));
    title.addEventListener('focusout', () => handleTitleInputFocusOut(title, item, vscode));
}

function handleTitleInput(event, title, item, vscode) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent inserting a line break
        title.contentEditable = false;

        // Reset the styles after editing
        title.style.fontStyle = '';
        title.style.border = '';
        title.style.padding = '';

        item.$label = title.textContent;
    }
}

function handleTitleInputFocusOut(title, item, vscode) {
    // Disable content-editable mode and reset styles
    title.contentEditable = false;
    title.style.fontStyle = '';
    title.style.border = '';
    title.style.padding = '';

    // Show the edit button
    title.nextElementSibling.style.display = 'block';

    item.$label = title.textContent;

    // Update child items if needed
    item.hidden_children.forEach(child => {
        if (child.$label === '$label') {
            child.value = title.textContent;
        }
    });

    vscode.postMessage({ command: 'saveObject', item: item, id: item_id });
}

function renderChild(child, div, vscode, depth = 0) {
    //console.log(child);
    const modelType = child.schema.modelType;
    switch (modelType) {
        case 'sub-object':
            renderSubObjectChild(child, div, vscode, depth);
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
        case 'pool-dropdown-select-tag':
            renderPoolDropdownSelectTag(child, div, vscode);
            break;
        case 'text-area':
            renderTextArea(child, div, vscode);
            break;
        case 'vscode-fs':
            renderVscodeFs(child, div, vscode);
            break;
        default:
            console.error(`Unsupported modelType: ${modelType}`);
            break;
    }
}

function renderPopupTree(child, parent_div, vscode) {
    function renderTreeView(node, parentDiv, depth, maxDepth, selectableNodes) {
        // Iterate through each key in the node
        Object.keys(node).forEach(key => {
            if (key.startsWith("__")) return; // Skip internal properties
            const currentNode = node[key];
    
            // Create container for the current node
            const containerDiv = document.createElement('div');
            containerDiv.style.marginLeft = '15px'; // Indentation for nested nodes
            containerDiv.style.marginBottom = '4px';
    
            // Create div to display the node information
            const div = document.createElement('div');
            styleNodeDiv(div); // Apply consistent styles using a helper function
    
            let childrenDiv = null; // Placeholder for the children container
    
            // Check if the node has children
            const hasChildren = currentNode.__children && Object.keys(currentNode.__children).length > 0;
    
            // Add toggle button if the node has children
            if (hasChildren) {
                const toggleBtn = createToggleButton(); // Create toggle button using helper function
                div.appendChild(toggleBtn);
    
                // Add event listener to toggle children visibility
                toggleBtn.addEventListener('click', () => {
                    const isVisible = childrenDiv.style.display === 'block';
                    childrenDiv.style.display = isVisible ? 'none' : 'block';
                    toggleBtn.textContent = isVisible ? '+' : '-';
                });
            }
    
            // Create icon and label for the node
            const icon = createNodeIcon(currentNode.__icon);
            const label = document.createElement('span');
            label.textContent = currentNode.__label;
    
            div.appendChild(icon);
            div.appendChild(label);
            containerDiv.appendChild(div);
            parentDiv.appendChild(containerDiv);
    
            //// Determine if this node is selectable
            //const isSelectable = selectableNodes.includes(currentNode.__id);
    //
            //if (isSelectable) {
            //    makeNodeSelectable(div, currentNode, parent_div); // Make the node selectable
            //}
    
            // Render children if the node has children
            if (hasChildren) {
                childrenDiv = document.createElement('div');
                childrenDiv.classList.add('children');
                childrenDiv.style.display = 'block';
                childrenDiv.style.marginTop = '4px';
                containerDiv.appendChild(childrenDiv);
    
                // Recursively render child nodes
                renderTreeView(currentNode.__children, childrenDiv, depth + 1, maxDepth, selectableNodes);
            }
        });
    }
    
    // Helper function to apply consistent styles to node divs
    function styleNodeDiv(div) {
        div.style.backgroundColor = '#333';
        div.style.padding = '4px';
        div.style.borderRadius = '6px';
        div.style.color = '#fff';
        div.style.cursor = 'pointer';
        div.style.fontSize = '14px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
    }
    
    // Helper function to create a toggle button
    function createToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '-';
        toggleBtn.style.backgroundColor = 'transparent';
        toggleBtn.style.color = 'inherit';
        toggleBtn.style.border = 'none';
        toggleBtn.style.padding = '0';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.marginRight = '8px';
        return toggleBtn;
    }
    
    // Helper function to create a node icon
    function createNodeIcon(iconClass) {
        const icon = document.createElement('span');
        icon.className = 'icon codicon codicon-' + iconClass;
        icon.style.marginRight = '8px';
        return icon;
    }
    
    // Helper function to make a node selectable
    function makeNodeSelectable(div, currentNode, parentDiv) {
        div.style.backgroundColor = '#222';
        div.style.color = '#fff';
        div.style.cursor = 'pointer';
        div.style.borderRadius = '6px';
        div.addEventListener('click', () => {
            // Handle node selection
            child.value = currentNode.__id;
            // Dispatch a custom event
            const event = new CustomEvent('nodeSelected', {
                detail: {
                    $id: currentNode.__id,
                    $label: currentNode.__label,
                    $icon: currentNode.__icon
                }
            });
            parentDiv.dispatchEvent(event);
            popupContainer.style.display = 'none';
            vscode.postMessage({ command: 'saveObject', item: child, id: currentNode.__id });
        });
    }
    
    function buildTree(data) {
        const root = {};
        let maxDepth = 0;

        data.forEach(item => {
            if (!item.$path || !Array.isArray(item.$path)) {
                console.error("Invalid $path in item:", item);
                return;
            }

            maxDepth = Math.max(maxDepth, item.$path.length);

            let currentNode = root;
            item.$path.forEach((pathPart, index) => {
                if (!currentNode[pathPart.key]) {
                    currentNode[pathPart.key] = {
                        __children: {},
                        __label: pathPart.key,
                        __depth: index,
                        __icon: pathPart.icon
                    };
                }
                if (index === item.$path.length - 1) {
                    currentNode[pathPart.key].__label = item.$label;
                    currentNode[pathPart.key].__id = item.$id;
                }
                currentNode = currentNode[pathPart.key].__children;
            });
        });

        return { root, maxDepth };
    }
    
    // Filter the links using the tags_filter
    const tags_filter = child.schema.const;
    const links = child.$links.filter(link => link.$tags.some(t => tags_filter?.includes(t)));
    if (!links || links.length === 0) {
        return;
    }

    // Create the popup container (hidden by default)
    const popupContainer = document.createElement('div');
    popupContainer.style.position = 'absolute'; // Changed to absolute positioning
    popupContainer.style.backgroundColor = '#222';
    popupContainer.style.border = '1px solid #555'; // More distinct border color for popup
    popupContainer.style.padding = '20px';
    popupContainer.style.boxShadow = '0 4px 15px rgba(0,0,0,0.7)'; // Darker shadow for more depth
    popupContainer.style.borderRadius = '10px';
    popupContainer.style.display = 'none';
    popupContainer.style.zIndex = 1000;

    // Add close button to the popup
    const closePopupBtn = document.createElement('button');
    closePopupBtn.textContent = 'Close';
    closePopupBtn.style.backgroundColor = '#555'; // Darker button background for better contrast
    closePopupBtn.style.color = '#fff';
    closePopupBtn.style.border = 'none';
    closePopupBtn.style.borderRadius = '5px';
    closePopupBtn.style.padding = '5px 10px';
    closePopupBtn.style.cursor = 'pointer';
    closePopupBtn.style.marginBottom = '10px';
    popupContainer.appendChild(closePopupBtn);

    closePopupBtn.addEventListener('click', () => {
        popupContainer.style.display = 'none';
    });

    // Create container for tree view inside the popup
    const treeContainer = document.createElement('div');
    treeContainer.style.maxHeight = '300px';
    treeContainer.style.overflowY = 'auto';
    treeContainer.style.padding = '10px';
    treeContainer.style.backgroundColor = '#333'; // Darker background for contrast
    treeContainer.style.color = '#fff'; // Brighter text color for readability
    treeContainer.style.borderRadius = '5px'; // Add rounded corners
    popupContainer.appendChild(treeContainer);

    const { root, maxDepth } = buildTree(links);
    const selectableNodes = links.map(link => link.$id);
    renderTreeView(root, treeContainer, 0, maxDepth, selectableNodes);

    return popupContainer;
}

function renderInputString(child, div, vscode) {
    // Create and style the label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    $label.style.display = 'block';
    $label.style.marginBottom = '8px'; // Spacing between label and input field
    $label.style.color = '#eee'; // Lighter text color for dark mode
    div.appendChild($label);

    // Create and style the input field container
    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.flexWrap = 'wrap';
    inputContainer.style.alignItems = 'center';
    inputContainer.style.border = '1px solid #444'; // Dark border to match dark mode
    inputContainer.style.borderRadius = '4px'; // Rounded corners
    inputContainer.style.padding = '8px'; // Padding inside the container
    inputContainer.style.backgroundColor = '#333'; // Dark background
    inputContainer.style.marginBottom = '10px'; // Spacing below the input field
    inputContainer.style.position = 'relative'; // For absolute positioning of suggestion box

    // Create and style the input field itself
    const input = document.createElement('input');
    input.type = 'text';
    input.style.flex = '1'; // Allows input to expand to full width
    input.style.border = 'none'; // No border, as the container has it
    input.style.outline = 'none'; // Remove outline to make it look better
    input.style.backgroundColor = 'transparent'; // Transparent background
    input.style.color = '#eee'; // Lighter text color
    input.style.fontSize = '14px'; // Font size for better readability
    input.style.lineHeight = '24px'; // Line height for better vertical alignment

    inputContainer.appendChild(input);
    div.appendChild(inputContainer);

    // Tag to filter
    const tags_filter = child.schema.const;

    // Filter the links using the tags_filter
    const suggestions = child.$links.filter(link => link.$tags.some(t => tags_filter?.includes(t)));

    // Decode child value to create blocks
    if (child.value) {
        // Find in child value any @followed by a guid format number
        const regex = /@([a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12})/g;
        const matches = child.value.match(regex);

        if (matches) {
            // Split child value into blocks based on matches
            const blocks = [];
            let lastIndex = 0;
            matches.forEach((match) => {
                const index = child.value.indexOf(match, lastIndex);
                if (index !== -1) {
                    const textBlock = child.value.substring(lastIndex, index);
                    if (textBlock !== '') {
                        blocks.push(textBlock);
                    }
                    blocks.push(match);
                    lastIndex = index + match.length;
                }
            });

            const lastTextBlock = child.value.substring(lastIndex);
            if (lastTextBlock !== '') {
                blocks.push(lastTextBlock);
            }

            // Iterate over blocks and create corresponding blocks
            blocks.forEach((block) => {
                if (block.startsWith('@')) {
                    // Create link block
                    const link = suggestions.find(link => link.$id === block.substring(1));
                    const suggestion = {
                        $id: link.$id,
                        $label: link.$label,
                        $icon: link.$path.find(item => item.key === link.$label).icon
                    }
                    if (link) {
                        createLinkBlock(child, suggestion, true);
                    }
                } else {
                    //Check if block is not full of spaces
                    if (block.trim() !== '') {
                        // Create normal text block
                        createTextBlock(child, block, true);
                    }
                }
            });
        } else {
            // Create single normal text block
            createTextBlock(child, child.value, true);
        }
    }

    const popupTree = renderPopupTree(child, input, vscode);

    if (popupTree) {
        document.body.appendChild(popupTree);
        input.addEventListener('nodeSelected', (event) => {
            const { $id, $label } = event.detail;
            createLinkBlock(child, event.detail);
        });
    }

    // Add event listener for input changes
    input.addEventListener('input', (event) => {
        // Get the current value of the input field
        const value = event.target.value;

        // Check if "@" is present in the input to trigger suggestions
        const atIndex = value.lastIndexOf('@');

        if (atIndex !== -1) {
            // Clear the input field to remove the "@" character and everything after it
            input.value = value.substring(0, atIndex);

            popupTree.style.display = 'block';
            // Position the popup relative to the button or container
            const rect = input.getBoundingClientRect();
            popupTree.style.left = `${rect.left}px`;
            popupTree.style.top = `${rect.bottom}px`; // Position below the button
        }
    });

    // Event listener for "Enter" key or when input loses focus to create a text block
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && input.value.trim() !== '' && input.value.trim() !== '@') {
            if (input.previousSibling && input.previousSibling.tagName === 'SPAN' && input.previousSibling.dataset.type === 'text') {
                const previousBlock = input.previousSibling;
                const newValue = previousBlock.textContent.slice(0, -1) + ' ' + input.value.trim();

                // Preserve the close button
                const closeButton = previousBlock.querySelector('span');
                previousBlock.textContent = newValue;
                if (closeButton) {
                    previousBlock.appendChild(closeButton);
                }

                input.value = ''; // Clear input after creating block
                event.preventDefault(); // Prevent form submission if inside a form
                updateChildValue(true);
            } else {
                createTextBlock(child, input.value.trim());
                input.value = ''; // Clear input after creating block
                event.preventDefault(); // Prevent form submission if inside a form
            }
        }
    });

    input.addEventListener('blur', () => {
        if (input.value.trim() !== '' && input.value.trim() !== '@') {
            //Check previous node, if it is a text node, then merge this one with it
            if (input.previousSibling && input.previousSibling.tagName === 'SPAN' && input.previousSibling.dataset.type === 'text') {
                const newValue = input.previousSibling.textContent.slice(0, -1) + ' ' + input.value.trim();
                input.previousSibling.textContent = newValue;
                input.value = ''; // Clear input after creating block
                updateChildValue(true);
            } else {
                createTextBlock(child, input.value.trim());
                input.value = ''; // Clear input after creating block
            }
        }
    });

    // Function to create a block for standard text input
    function createTextBlock(child, text, newItem) {
        const block = document.createElement('span');
        block.textContent = text;
        block.style.display = 'inline-flex'; // Use inline-flex for better alignment with other elements
        block.style.alignItems = 'center'; // Align items vertically in the center
        block.style.padding = '4px 8px';
        block.style.paddingRight = '25px';
        block.style.marginRight = '5px';
        block.style.backgroundColor = '#444'; // Darker background color for better contrast
        block.style.color = '#eee';
        block.style.borderRadius = '4px';
        block.style.cursor = 'default'; // Normal cursor
        block.style.position = 'relative'; // Needed for positioning the "x" button
        block.style.marginTop = '4px';

        // Store the type of block for reference
        block.dataset.type = 'text';

        // Create the "x" button for removing the block
        const closeButton = document.createElement('span');
        closeButton.textContent = '×'; // Unicode character for "x"
        closeButton.style.position = 'absolute';
        closeButton.style.top = '50%';
        closeButton.style.right = '4px'; // Position slightly inward for padding
        closeButton.style.transform = 'translateY(-50%)'; // Center vertically
        closeButton.style.width = '16px'; // Circle size
        closeButton.style.height = '16px'; // Circle size
        closeButton.style.lineHeight = '16px'; // Center text vertically
        closeButton.style.borderRadius = '50%'; // Make it circular
        closeButton.style.backgroundColor = '#999'; // Circle color
        closeButton.style.color = '#fff';
        closeButton.style.textAlign = 'center'; // Center the "x" inside the circle
        closeButton.style.cursor = 'pointer';

        // Event listener to remove the block
        closeButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event bubbling to block click
            block.remove(); // Remove block directly
            updateChildValue(true); // Update the value after removing the block
        });

        // Show "x" button on hover
        block.addEventListener('mouseenter', () => {
            closeButton.style.display = 'block';
        });

        // Hide "x" button when not hovering
        block.addEventListener('mouseleave', () => {
            closeButton.style.display = 'none';
        });

        // Append closeButton to the block
        block.appendChild(closeButton);

        // Create a double-click event to edit the text
        block.addEventListener('dblclick', (event) => {
            block.style.display = 'none';

            // Create an input field with the text
            const input = document.createElement('input');
            input.type = 'text';
            input.value = block.textContent.slice(0, -1); // Exclude the "×" from the value
            input.style.width = 'calc(100% - 25px)'; // Full width minus padding and "x" button
            input.style.height = '24px'; // Height to match the block
            input.style.backgroundColor = '#333'; // Dark background for input field
            input.style.color = '#eee'; // Lighter text color for input field
            input.style.border = '1px solid #444'; // Border to match the dark mode theme
            input.style.borderRadius = '4px'; // Rounded corners for input field
            input.style.padding = '4px 8px'; // Padding inside input field
            input.style.margin = '0'; // Remove margins to align with block

            block.parentNode.insertBefore(input, block); // Insert input before the block
            input.focus();

            // Add event listener to the input field
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Prevent inserting a line break
                    block.textContent = input.value;
                    block.style.display = 'inline-flex'; // Restore display style
                    block.appendChild(closeButton); // Re-add the close button
                    input.remove(); // Remove input field directly
                    updateChildValue(true); // Update the value after editing the text
                }
            });

            // Handle blur event for when the input field loses focus
            input.addEventListener('blur', () => {
                block.textContent = input.value;
                block.style.display = 'inline-flex'; // Restore display style
                block.appendChild(closeButton); // Re-add the close button
                input.remove(); // Remove input field directly
                updateChildValue(true); // Update the value after editing the text
            });
        });

        inputContainer.insertBefore(block, input);
        updateChildValue(false); // Update the value after adding the block
    }

    // Function to create a block for a suggestion
    function createLinkBlock(child, suggestion, newItem) {
        const block = document.createElement('span');
        block.innerHTML =`<span class="codicon codicon-${suggestion.$icon}"></span> ${suggestion.$label}`;
        block.style.display = 'inline-flex'; // Use inline-flex for better alignment with other elements
        block.style.alignItems = 'center'; // Align items vertically in the center
        block.style.padding = '4px 8px';
        block.style.paddingRight = '25px'; // Add extra padding on the right for the "x" button
        block.style.marginRight = '5px';
        block.style.backgroundColor = '#666'; // Slightly different shade for contrast
        block.style.color = '#eee';
        block.style.borderRadius = '4px';
        block.style.position = 'relative'; // Needed for positioning the "x" button
        block.style.cursor = 'default'; // Normal cursor
        block.style.marginTop = '4px';

        // Store the id of the suggestion for reference
        block.dataset.id = suggestion.$id;
        block.dataset.type = 'suggestion';

        // Create the "x" button for removing the block
        const closeButton = document.createElement('span');
        closeButton.textContent = '×'; // Unicode character for "x"
        closeButton.style.position = 'absolute';
        closeButton.style.top = '50%';
        closeButton.style.right = '4px'; // Position slightly inward for padding
        closeButton.style.transform = 'translateY(-50%)'; // Center vertically
        closeButton.style.width = '16px'; // Circle size
        closeButton.style.height = '16px'; // Circle size
        closeButton.style.lineHeight = '16px'; // Center text vertically
        closeButton.style.borderRadius = '50%'; // Make it circular
        closeButton.style.backgroundColor = '#999'; // Circle color
        closeButton.style.color = '#fff';
        closeButton.style.textAlign = 'center'; // Center the "x" inside the circle
        closeButton.style.cursor = 'pointer';

        // Event listener to remove the block
        closeButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event bubbling to block click
            inputContainer.removeChild(block);
            updateChildValue(true);
        });

        const popupTree = renderPopupTree(child, block, vscode);

        if (popupTree) {
            document.body.appendChild(popupTree);
            block.addEventListener('nodeSelected', (event) => {
                const { $id, $label, $icon } = event.detail;
                block.innerHTML = `<span class="codicon codicon-${$icon}"></span> ${$label}`;
                block.dataset.id = $id;
                popupTree.style.display = 'none';
                updateChildValue(true);
            });
        }

        // Event listener for double click to trigger a new suggestion
        block.addEventListener('dblclick', (event) => {
            popupTree.style.display = 'block';
        });

        block.appendChild(closeButton);
        inputContainer.insertBefore(block, input);
        if(!newItem)
            updateChildValue(true); // Update the value after adding the block
    }

    // Function to update child value with text and blocks
    function updateChildValue(flag) {
        let newValue = '';
        inputContainer.childNodes.forEach(node => {
            if (node.tagName === 'SPAN' && node.dataset.type === 'text') {
                // Extract the text without the "x" button
                const textContent = node.childNodes[0].nodeValue; // This assumes the text content is the first child node
                newValue += textContent + ' '; // Add a space after each text block
            } else if (node.tagName === 'SPAN' && node.dataset.type === 'suggestion') {
                // Extract the text without the "x" button
                newValue += '@' + node.dataset.id + ' '; // Convert suggestion block back to text format
            }
        });
        child.value = newValue.trim(); // Remove any trailing space
        if(flag)
            vscode.postMessage({ command: 'saveObject', item: child, id: item_id });
    }
}

function renderTextArea(child, div, vscode) {
    // Create the container for the collapsible content
    const collapsibleDiv = document.createElement('div');
    collapsibleDiv.style.marginBottom = '10px'; // Reduced spacing between sections
    collapsibleDiv.style.border = '1px solid #444'; // Border for collapsible section
    collapsibleDiv.style.borderRadius = '6px'; // Slightly smaller rounded corners
    collapsibleDiv.style.backgroundColor = '#222'; // Dark background for container
    collapsibleDiv.style.overflow = 'hidden'; // Prevent content overflow
    div.appendChild(collapsibleDiv);

    // Create the header for the collapsible section
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.padding = '8px'; // Reduced padding
    headerDiv.style.cursor = 'pointer';
    headerDiv.style.userSelect = 'none'; // Prevent text selection on click
    headerDiv.style.backgroundColor = '#333'; // Darker background for header
    headerDiv.style.borderBottom = '1px solid #444'; // Border separating header and content
    collapsibleDiv.appendChild(headerDiv);

    // Create the label
    const $label = document.createElement('h4');
    $label.textContent = child.$label;
    $label.style.margin = '0';
    $label.style.color = '#eee'; // Lighter text color for better contrast
    headerDiv.appendChild($label);

    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '▼'; // Default to "expanded" icon
    toggleButton.style.background = 'none';
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.color = '#aaa'; // Lighter color for better contrast
    toggleButton.style.fontSize = '14px'; // Smaller font size
    toggleButton.style.marginLeft = '8px'; // Reduced space between label and button
    headerDiv.appendChild(toggleButton);

    // Create the collapsible content container
    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'none'; // Initially hidden
    contentDiv.style.padding = '8px'; // Reduced padding
    contentDiv.style.backgroundColor = '#333'; // Dark background for content
    collapsibleDiv.appendChild(contentDiv);

    // Create the textarea element
    const textarea = document.createElement('textarea');
    textarea.value = child.value;
    textarea.style.width = 'calc(100% - 16px)'; // Full width minus padding
    textarea.style.height = '80px'; // Reduced height for a more compact appearance
    textarea.style.resize = 'vertical'; // Allow vertical resizing
    textarea.style.backgroundColor = '#333'; // Dark background for textarea
    textarea.style.color = '#eee'; // Lighter text color for textarea
    textarea.style.border = '1px solid #444'; // Border to match the dark mode theme
    textarea.style.borderRadius = '6px'; // Rounded corners for textarea
    textarea.style.padding = '8px'; // Padding inside textarea
    textarea.style.margin = '0 auto'; // Center the textarea horizontally
    contentDiv.appendChild(textarea);

    // Add input event listener to the textarea
    textarea.addEventListener('input', (event) => {
        child.value = event.target.value;
        vscode.postMessage({ command: 'saveObject', item: child, id: item_id });
    });

    // Toggle function for showing/hiding content
    headerDiv.addEventListener('click', () => {
        const isExpanded = contentDiv.style.display === 'block';
        contentDiv.style.display = isExpanded ? 'none' : 'block';
        toggleButton.textContent = isExpanded ? '▼' : '▲'; // Change icon
    });
}

function renderCheckbox(child, div, vscode) {
    // Create and style the container for the checkbox
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.marginBottom = '10px'; // Spacing between items
    div.appendChild(checkboxContainer);

    // Create and style the label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    $label.style.marginRight = '8px'; // Space between label and checkbox
    $label.style.color = '#eee'; // Lighter text color for dark mode
    checkboxContainer.appendChild($label);

    // Create and style the checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = child.value;
    checkbox.style.cursor = 'pointer'; // Pointer cursor for interactivity
    checkboxContainer.appendChild(checkbox);

    // Add event listener for checkbox changes
    checkbox.addEventListener('change', (event) => {
        child.value = event.target.checked;
        vscode.postMessage({ command: 'saveObject', item: child, id: item_id });
    });
}

function renderDropdownSelect(child, div, vscode) {
    // Create and style the label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    $label.style.display = 'block';
    $label.style.marginBottom = '10px';
    $label.style.color = '#eee'; // Lighter text color for better contrast
    div.appendChild($label);

    // Create and style the select element
    const select = document.createElement('select');
    select.style.marginBottom = '10px';
    select.style.padding = '8px';
    select.style.border = '1px solid #444';
    select.style.borderRadius = '8px';
    select.style.backgroundColor = '#333';
    select.style.color = '#eee'; // Lighter text color for better contrast
    select.style.fontSize = '14px'; // Consistent font size
    select.style.cursor = 'pointer';

    div.appendChild(select);

    // Populate the select options
    const options = child.schema.enum;

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.style.backgroundColor = '#333'; // Dark background for options
        optionElement.style.color = '#eee'; // Lighter text color for options
        select.appendChild(optionElement);
    });

    select.value = child.value;

    // Event listener for when the select value changes
    select.addEventListener('change', (event) => {
        child.value = event.target.value;
        vscode.postMessage({ command: 'saveObject', item: child, id: item_id });
    });
}

function renderDropdownSelectTag(child, div, vscode) {
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    $label.style.display = 'block';
    $label.style.marginBottom = '10px';
    $label.style.color = '#eee'; // Lighter text color for better contrast
    div.appendChild($label);

    // Create a div to display the selected value
    const valueDisplay = document.createElement('div');
    valueDisplay.style.marginBottom = '10px';
    valueDisplay.style.padding = '10px';
    valueDisplay.style.border = '1px solid #444';
    valueDisplay.style.borderRadius = '8px';
    valueDisplay.style.backgroundColor = '#333';
    valueDisplay.style.color = '#eee'; // Lighter text color for better contrast
    valueDisplay.style.cursor = 'pointer';
    div.appendChild(valueDisplay);

    const popupTree = renderPopupTree(child, valueDisplay, vscode);

    if (popupTree) {
        document.body.appendChild(popupTree);
        valueDisplay.addEventListener('nodeSelected', (event) => {
            const { $id, $label, $icon } = event.detail;
            valueDisplay.innerHTML = `<span class="codicon codicon-${$icon}"></span> ${$label}`;
            popupTree.style.display = 'none';
        });

        // Open the popup when the valueDisplay div is clicked
        valueDisplay.addEventListener('click', () => {
            popupTree.style.display = 'block';
            // Position the popup relative to the button or container
            const rect = valueDisplay.getBoundingClientRect();
            popupTree.style.left = `${rect.left}px`;
            popupTree.style.top = `${rect.bottom}px`; // Position below the button
        });

        // Hide the popup when clicking outside
        function handleClickOutside(event) {
            if (!valueDisplay.contains(event.target) && !popupTree.contains(event.target)) {
                popupTree.style.display = 'none';
            }
        }

        document.addEventListener('click', handleClickOutside);
    }

    // Initialize display with selected value
    if (child.value) {
        // Find the link with matching $id
        const selectedLink = child.$links.find(link => link.$id === child.value);
        if (selectedLink) {
            const $icon = selectedLink.$path.find(item => item.key === selectedLink.$label).icon;
            valueDisplay.innerHTML = `<span class="codicon codicon-${$icon}"></span> ${selectedLink.$label}`;
        }
    }
}

function renderPoolDropdownSelectTag(child, div, vscode) {
    // Create and append the container for the selected items
    const containerDiv = document.createElement('div');
    containerDiv.style.marginBottom = '10px';
    div.appendChild(containerDiv);

    // Create a wrapper to hold the label and the codicon item together
    const labelContainer = document.createElement('div');
    labelContainer.style.display = 'flex'; // Use flexbox to align items
    labelContainer.style.alignItems = 'center'; // Center align vertically
    containerDiv.appendChild(labelContainer);

    // Create and append the label
    const $label = document.createElement('label');
    $label.textContent = child.$label;
    $label.style.color = '#eee'; // Lighter text color for better contrast
    $label.style.marginRight = '10px'; // Space between label and codicon
    labelContainer.appendChild($label);

    // Create and append the + codicon item
    const codiconItem = document.createElement('span');
    codiconItem.className = 'codicon codicon-add'; // Assuming the codicon class is used here
    codiconItem.style.cursor = 'pointer';
    codiconItem.style.color = '#eee'; // Lighter text color for better contrast
    labelContainer.appendChild(codiconItem);

    const popupTree = renderPopupTree(child, containerDiv, vscode);
    if (popupTree) {
        document.body.appendChild(popupTree);

        containerDiv.addEventListener('nodeSelected', (event) => {
            const { $id, $label } = event.detail;
            // Handle leaf node selection
            const selectedId = $id;
            if (!selectedValues.includes(selectedId)) {
                selectedValues.push(selectedId);
                renderSelectedItems(containerDiv, selectedValues, child);
                // Update the child value with the list of selected divs.
                child.value = [...selectedValues];
                vscode.postMessage({ command: 'saveObject', item: child, id: selectedId });
            }
            popupTree.style.display = 'none';
        });

        codiconItem.addEventListener('click', () => {
            // Show the popup
            popupTree.style.display = 'block';

            // Position the popup relative to the label or container
            const rect = containerDiv.getBoundingClientRect();
            popupTree.style.left = `${rect.left}px`;
            popupTree.style.top = `${rect.bottom}px`; // Position below the codicon
        });

        // Hide the popup when clicking outside
        function handleClickOutside(event) {
            if (!containerDiv.contains(event.target) && !popupTree.contains(event.target)) {
                popupTree.style.display = 'none';
            }
        }

        document.addEventListener('click', handleClickOutside);
    }

    // Initialize with existing selected values
    const selectedValues = child.value;
    renderSelectedItems(containerDiv, selectedValues, child);

    function renderSelectedItems(containerDiv, selectedValues, child) {
        // Ensure selectedValues is an array
        if (!Array.isArray(selectedValues)) {
            console.error("Expected selectedValues to be an array, but got:", selectedValues);
            selectedValues = []; // Fallback to an empty array
        }

        const selectedItemsDiv = containerDiv.querySelector('.selected-items') || document.createElement('div'); // Scoped to the containerDiv
        selectedItemsDiv.className = 'selected-items';
        selectedItemsDiv.style.marginTop = '10px'; // Space between the label and the list
        selectedItemsDiv.style.marginBottom = '10px';
        selectedItemsDiv.style.borderRadius = '8px';
        selectedItemsDiv.style.backgroundColor = 'transparent'; // Transparent background
        containerDiv.appendChild(selectedItemsDiv);
        selectedItemsDiv.innerHTML = ''; // Clear previous items

        selectedValues.forEach((id, index) => {
            const link = child.$links.find(link => link.$id === id);
            if (link) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'selected-item';
                itemDiv.style.padding = '6px';
                itemDiv.style.borderRadius = '8px';
                itemDiv.style.marginBottom = '5px';
                itemDiv.style.backgroundColor = '#444';
                itemDiv.style.color = '#eee'; // Lighter text color for better contrast
                itemDiv.style.display = 'flex';
                itemDiv.style.border = 'none';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.justifyContent = 'space-between';
                itemDiv.style.fontSize = '14px';

                const label = document.createElement('span');
                const $icon = link.$path.find(item => item.key === link.$label).icon;
                label.innerHTML = `<span class="codicon codicon-${$icon}"></span> ${link.$label}`;
                itemDiv.appendChild(label);

                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'x';
                removeBtn.style.backgroundColor = '#555';
                removeBtn.style.border = 'none';
                removeBtn.style.color = '#eee'; // Lighter text color for better contrast
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '20px';
                removeBtn.style.height = '20px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.fontSize = '12px';
                removeBtn.style.display = 'flex';
                removeBtn.style.alignItems = 'center';
                removeBtn.style.justifyContent = 'center';
                itemDiv.appendChild(removeBtn);

                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    selectedValues.splice(index, 1); // Remove item from selectedValues
                    renderSelectedItems(containerDiv, selectedValues, child); // Re-render selected items
                    // Update the child value with the list of selected divs.
                    child.value = [...selectedValues];
                    vscode.postMessage({ command: 'saveObject', item: child, id: id });
                });

                selectedItemsDiv.appendChild(itemDiv);
            }
        });
    }
}

function renderSubObjectChild(child, div, vscode, depth = 0) {
    // Create and style the container for the collapsible content
    const subObjectDiv = document.createElement('div');
    subObjectDiv.style.marginBottom = '5px'; // Spacing between sections
    subObjectDiv.style.border = '1px solid #444'; // Dark border
    subObjectDiv.style.borderRadius = '8px'; // Rounded corners
    subObjectDiv.style.backgroundColor = getColorForDepth(depth); // Dynamic background color based on depth
    subObjectDiv.style.overflow = 'hidden'; // Prevent content overflow
    div.appendChild(subObjectDiv);

    // Create and style the header for the collapsible section
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.padding = '8px'; // Padding for compact look
    headerDiv.style.cursor = 'pointer';
    headerDiv.style.userSelect = 'none'; // Prevent text selection
    headerDiv.style.backgroundColor = adjustColor(getColorForDepth(depth), -10); // Slightly darker background for header
    headerDiv.style.borderBottom = '1px solid #444'; // Border separating header and content
    subObjectDiv.appendChild(headerDiv);

    // Create and style the label
    const $label = document.createElement('h4');
    $label.textContent = child.$label;
    $label.style.margin = '0';
    $label.style.color = '#eee'; // Lighter text color
    headerDiv.appendChild($label);

    // Create and style the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '▼'; // Default to "expanded" icon
    toggleButton.style.background = 'none';
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.color = '#aaa'; // Lighter color for better contrast
    toggleButton.style.fontSize = '14px'; // Smaller font size
    toggleButton.style.marginLeft = '8px'; // Space between label and button
    headerDiv.appendChild(toggleButton);

    // Create and style the collapsible content container
    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'none'; // Initially hidden
    contentDiv.style.padding = '8px'; // Padding for content area
    contentDiv.style.backgroundColor = adjustColor(getColorForDepth(depth), -20); // Darker background for nested content
    subObjectDiv.appendChild(contentDiv);

    // Add sub-children to the collapsible content
    child.hidden_children.forEach(subChild => {
        // Copy the $links of the parent to the child
        subChild.$links = child.$links;
        renderChild(subChild, contentDiv, vscode, depth + 1);
        // Copy subchild into child
        child.hidden_children.push(subChild);
    });

    // Toggle function for showing/hiding content
    headerDiv.addEventListener('click', () => {
        const isExpanded = contentDiv.style.display === 'block';
        contentDiv.style.display = isExpanded ? 'none' : 'block';
        toggleButton.textContent = isExpanded ? '▼' : '▲'; // Change icon
    });

    // Helper function to get color based on depth
    function getColorForDepth(depth) {
        // Base color for the deepest level
        const baseColor = '#222';
        const colorStep = Math.min(depth * 15, 60); // Adjust the color gradient step based on depth
        return shadeColor(baseColor, colorStep);
    }

    // Helper function to adjust color brightness
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = Math.min(255, Math.max(0, R + (R * percent / 100)));
        G = Math.min(255, Math.max(0, G + (G * percent / 100)));
        B = Math.min(255, Math.max(0, B + (B * percent / 100)));

        return `#${(0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    }

    // Helper function to adjust color brightness by a fixed amount
    function adjustColor(color, amount) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = Math.min(255, Math.max(0, R + amount));
        G = Math.min(255, Math.max(0, G + amount));
        B = Math.min(255, Math.max(0, B + amount));

        return `#${(0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    }
}

function renderVscodeFs(child, div, vscode) {
    // Create a label for the input field
    const label = document.createElement('label');
    label.textContent = child.label;
    div.appendChild(label);

    // Create a text field to display the selected path
    const pathDisplay = document.createElement('input');
    pathDisplay.type = 'text';
    pathDisplay.readOnly = true; // Make the input field read-only
    if (child.value && child.value != "") {
        pathDisplay.value = child.value;
    } else {
        pathDisplay.placeholder = 'No path selected';
    }

    // Append the path display input to the div
    div.appendChild(pathDisplay);

    // Function to request file system access from VS Code
    function requestFsAccess() {
        // Send a message to the VS Code extension to open the file picker
        vscode.postMessage({ command: 'selectDirectory', item: child, id: item_id });
    }

    // Example button to trigger file picker
    const searchButton = document.createElement('searchButton');
    searchButton.className = 'codicon codicon-search';
    searchButton.style.marginLeft = '10px';
    searchButton.style.background = 'none'; // Remove the background
    searchButton.style.border = 'none'; // Remove the border
    searchButton.style.padding = '0'; // Remove the padding
    searchButton.style.cursor = 'pointer'; // Add cursor pointer
    searchButton.style.color = '#6c6c6c'; // Set icon color to match VSCode light theme
    searchButton.onclick = requestFsAccess;
    div.appendChild(searchButton);
}

function createElement(item, vscode) {
    vscode.postMessage({ command: 'createItem', item: item });
}

function removeElement(item, vscode) {
    vscode.postMessage({ command: 'removeItem', item: item });
}
