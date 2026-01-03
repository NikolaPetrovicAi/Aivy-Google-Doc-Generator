const { JSDOM } = require('jsdom');

function htmlToGoogleDocsRequests(htmlContent, startIndex = 1) {
    const dom = new JSDOM(htmlContent);
    const body = dom.window.document.body;
    const requests = [];
    let absoluteIndex = startIndex;

    const listStack = [];

    // This function now receives the full style object and constructs a comprehensive request.
    function applyTextStyle(startIndex, endIndex, textStyle) {
        if (startIndex >= endIndex) return;

        // Explicitly define all style properties to be set or unset.
        const comprehensiveTextStyle = {
            bold: textStyle.bold || false,
            italic: textStyle.italic || false,
            underline: textStyle.underline || false,
        };

        requests.push({
            updateTextStyle: {
                range: { startIndex: startIndex, endIndex: endIndex },
                textStyle: comprehensiveTextStyle,
                // Explicitly list all fields to ensure styles are reset correctly.
                fields: 'bold,italic,underline',
            },
        });
    }

    function applyParagraphStyle(startIndex, endIndex, style) {
         if (startIndex < endIndex && Object.keys(style).length > 0) {
            const fields = Object.keys(style).join(',');
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: startIndex, endIndex: endIndex },
                    paragraphStyle: style,
                    fields: fields,
                },
            });
        }
    }

    function traverseAndConvert(node, currentInlineStyles = {}) {
        if (node.nodeType === dom.window.Node.TEXT_NODE) {
            const text = node.textContent;
            if (text.length > 0) {
                const textStart = absoluteIndex;
                requests.push({
                    insertText: {
                        location: { index: absoluteIndex },
                        text: text,
                    },
                });
                absoluteIndex += text.length;
                
                // Always apply the full style, even if it's just to set everything to false.
                applyTextStyle(textStart, absoluteIndex, currentInlineStyles);
            }
        } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let paragraphContentStart = absoluteIndex;
            
            // Create a new style object for the current scope.
            let newInlineStyles = { ...currentInlineStyles };

            // Modify the style for the current tag.
            switch (tagName) {
                case 'strong': case 'b':
                    newInlineStyles.bold = true;
                    break;
                case 'em': case 'i':
                    newInlineStyles.italic = true;
                    break;
                case 'u':
                    newInlineStyles.underline = true;
                    break;
            }

            // This block handles all child nodes with the calculated style.
            if (['strong', 'b', 'em', 'i', 'u'].includes(tagName)) {
                 node.childNodes.forEach(child => traverseAndConvert(child, newInlineStyles));
                 return; // Return after processing children of inline elements
            }


            // This block handles block-level elements
            switch (tagName) {
                case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': case 'p': {
                    node.childNodes.forEach(child => traverseAndConvert(child, {})); // Pass empty style for children of block elements
                    
                    if (absoluteIndex > paragraphContentStart) {
                        requests.push({ insertText: { location: { index: absoluteIndex }, text: '\n' } });
                        absoluteIndex++;
                    }

                    if (tagName.startsWith('h')) {
                        const style = { namedStyleType: `HEADING_${tagName[1]}` };
                        applyParagraphStyle(paragraphContentStart, absoluteIndex, style);
                    }
                    break;
                }
                case 'ul': case 'ol': {
                    listStack.push({ type: tagName, level: listStack.length });
                    node.childNodes.forEach(child => traverseAndConvert(child, {}));
                    listStack.pop();
                    break;
                }
                case 'li': {
                    const listItemStart = absoluteIndex;
                    node.childNodes.forEach(child => traverseAndConvert(child, {}));
                    if (absoluteIndex > listItemStart) {
                        requests.push({ insertText: { location: { index: absoluteIndex }, text: '\n' } });
                        absoluteIndex++;
                    }

                    if (listStack.length > 0) {
                        const currentList = listStack[listStack.length - 1];
                        requests.push({
                            createParagraphBullets: {
                                range: { startIndex: listItemStart, endIndex: absoluteIndex },
                                bulletPreset: currentList.type === 'ul' ? 'BULLET_DISC_CIRCLE_SQUARE' : 'NUMBERED_DECIMAL_ALPHA_ROMAN',
                            }
                        });
                        if (currentList.level > 0) {
                           applyParagraphStyle(listItemStart, absoluteIndex, {
                             indentStart: { magnitude: 36 * (currentList.level + 1), unit: 'PT' },
                             indentFirstLine: { magnitude: 18 * (currentList.level + 1), unit: 'PT' },
                           });
                        }
                    }
                    break;
                }
                default: {
                    node.childNodes.forEach(child => traverseAndConvert(child, {}));
                    if (absoluteIndex > paragraphContentStart) {
                        requests.push({ insertText: { location: { index: absoluteIndex }, text: '\n' } });
                        absoluteIndex++;
                    }
                    break;
                }
            }
        }
    }

    // Start traversal with default styles off.
    traverseAndConvert(body, { bold: false, italic: false, underline: false });

    // The final return logic might need adjustment if body itself is traversed differently
    const lastRequest = requests[requests.length - 1];
    if (requests.length > 0 && absoluteIndex > startIndex && lastRequest.insertText?.text !== '\n') {
         requests.push({ insertText: { location: { index: absoluteIndex }, text: '\n' } });
        absoluteIndex++;
    }

    return { requests, endIndex: absoluteIndex };
}

module.exports = { htmlToGoogleDocsRequests };
