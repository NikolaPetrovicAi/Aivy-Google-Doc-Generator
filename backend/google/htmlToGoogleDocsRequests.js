const { JSDOM } = require('jsdom');

/**
 * Parses a color string (either hex or rgb) and returns a Google Docs RGB object.
 * @param {string} colorString The color string (e.g., "#ff0000" or "rgb(255, 0, 0)").
 * @returns {object|null} A Google Docs RGB object or null if parsing fails.
 */
function parseColor(colorString) {
    if (!colorString) return null;

    // Handle RGB or RGBA strings: "rgb(255, 0, 0)"
    const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
        return {
            red: parseInt(rgbMatch[1], 10) / 255,
            green: parseInt(rgbMatch[2], 10) / 255,
            blue: parseInt(rgbMatch[3], 10) / 255,
        };
    }

    // Handle hex strings
    let hex = colorString;
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (hexMatch) {
        return {
            red: parseInt(hexMatch[1], 16) / 255,
            green: parseInt(hexMatch[2], 16) / 255,
            blue: parseInt(hexMatch[3], 16) / 255,
        };
    }

    return null;
}


function htmlToGoogleDocsRequests(htmlContent, startIndex = 1) {
    const dom = new JSDOM(htmlContent);
    const body = dom.window.document.body;
    const requests = [];
    let absoluteIndex = startIndex;

    const listStack = [];

    function applyTextStyle(startIndex, endIndex, textStyle) {
        if (startIndex >= endIndex || !textStyle || Object.keys(textStyle).length === 0) return;

        const styleToApply = {};
        const fields = [];

        // Reset fields
        if (textStyle.bold === false) { fields.push('bold'); }
        if (textStyle.italic === false) { fields.push('italic'); }
        if (textStyle.underline === false) { fields.push('underline'); }
        if (textStyle.strikethrough === false) { fields.push('strikethrough'); }

        // Set fields
        if (textStyle.bold) { styleToApply.bold = true; fields.push('bold'); }
        if (textStyle.italic) { styleToApply.italic = true; fields.push('italic'); }
        if (textStyle.underline) { styleToApply.underline = true; fields.push('underline'); }
        if (textStyle.strikethrough) { styleToApply.strikethrough = true; fields.push('strikethrough'); }
        
        if (textStyle.foregroundColor) {
            styleToApply.foregroundColor = { color: { rgbColor: textStyle.foregroundColor } };
            fields.push('foregroundColor');
        }
         if (textStyle.backgroundColor) {
            styleToApply.backgroundColor = { color: { rgbColor: textStyle.backgroundColor } };
            fields.push('backgroundColor');
        }

        if (fields.length === 0) return;
        
        // Remove duplicates from fields
        const uniqueFields = [...new Set(fields)];

        requests.push({
            updateTextStyle: {
                range: { startIndex: startIndex, endIndex: endIndex },
                textStyle: styleToApply,
                fields: uniqueFields.join(','),
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

    function traverseAndConvert(node, inheritedStyles = {}) {
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
                applyTextStyle(textStart, absoluteIndex, inheritedStyles);
            }
        } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let paragraphContentStart = absoluteIndex;
            
            let currentStyles = { ...inheritedStyles };

            // Apply styles from the current node
            switch (tagName) {
                case 'strong': case 'b': currentStyles.bold = true; break;
                case 'em': case 'i': currentStyles.italic = true; break;
                case 'u': currentStyles.underline = true; break;
                case 's': case 'strike': case 'del': currentStyles.strikethrough = true; break;
                case 'span':
                    if (node.style.color) {
                        currentStyles.foregroundColor = parseColor(node.style.color);
                    }
                    break;
                case 'mark':
                     if (node.style.backgroundColor) {
                        currentStyles.backgroundColor = parseColor(node.style.backgroundColor);
                    }
                    break;
            }
            
             if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'ul', 'ol'].includes(tagName)) {
                const isList = ['ul', 'ol'].includes(tagName);
                const isListItem = tagName === 'li';

                if(isList) listStack.push({ type: tagName, level: listStack.length });
                
                const childrenStyles = isListItem ? currentStyles : {};
                node.childNodes.forEach(child => traverseAndConvert(child, childrenStyles));

                if(isList) listStack.pop();

                if (absoluteIndex > paragraphContentStart || (isListItem && node.textContent.trim().length > 0) ) {
                    requests.push({ insertText: { location: { index: absoluteIndex }, text: '\n' } });
                    absoluteIndex++;
                }

                const paraStyle = {};
                if (tagName.startsWith('h')) paraStyle.namedStyleType = `HEADING_${tagName[1]}`;
                
                const alignment = node.style.textAlign;
                if (alignment) {
                    switch (alignment.toLowerCase()) {
                        case 'center': paraStyle.alignment = 'CENTER'; break;
                        case 'right': paraStyle.alignment = 'END'; break;
                        case 'left': paraStyle.alignment = 'START'; break;
                    }
                }
                 if(isListItem && listStack.length > 0){
                      const currentList = listStack[listStack.length - 1];
                        requests.push({
                            createParagraphBullets: {
                                range: { startIndex: paragraphContentStart, endIndex: absoluteIndex },
                                bulletPreset: currentList.type === 'ul' ? 'BULLET_DISC_CIRCLE_SQUARE' : 'NUMBERED_DECIMAL_ALPHA_ROMAN',
                            }
                        });
                        if (currentList.level > 0) {
                           paraStyle.indentStart = { magnitude: 36 * (currentList.level), unit: 'PT' };
                        }
                 }

                applyParagraphStyle(paragraphContentStart, absoluteIndex, paraStyle);
                
            } else {
                 node.childNodes.forEach(child => traverseAndConvert(child, currentStyles));
            }
        }
    }

    traverseAndConvert(body, {});

    return { requests, endIndex: absoluteIndex };
}

module.exports = { htmlToGoogleDocsRequests };
