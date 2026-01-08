const { JSDOM } = require('jsdom');

/**
 * Converts a CSS color string (hex or rgb) to a Google Docs API RGB color object.
 * @param {string} colorString The CSS color string (e.g., "#FF0000" or "rgb(255, 0, 0)").
 * @returns {object|null} A Google Docs RGB color object or null if invalid.
 */
function parseColor(colorString) {
    if (!colorString) {
        return null;
    }

    // Handle hex format
    if (colorString.startsWith('#')) {
        if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(colorString)) {
            return null;
        }
        let c = colorString.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return {
            red: ((c >> 16) & 255) / 255,
            green: ((c >> 8) & 255) / 255,
            blue: (c & 255) / 255,
        };
    }

    // Handle rgb format
    if (colorString.startsWith('rgb')) {
        const rgbValues = colorString.match(/\d+/g);
        if (rgbValues && rgbValues.length === 3) {
            return {
                red: parseInt(rgbValues[0], 10) / 255,
                green: parseInt(rgbValues[1], 10) / 255,
                blue: parseInt(rgbValues[2], 10) / 255,
            };
        }
    }

    return null; // Return null for unrecognized formats
}


// Helper to determine the bullet preset based on nesting level
function getBulletPreset(level) {
    // The listLevel is 1-based, so we subtract 1 for a 0-based modulo
    switch ((level - 1) % 3) {
        case 0: return 'BULLET_DISC_CIRCLE_SQUARE'; // Level 1, 4, 7...
        case 1: return 'BULLET_ARROW_DIAMOND_DISC'; // Level 2, 5, 8...
        case 2: return 'BULLET_STAR_ARROW_DIAMOND'; // Level 3, 6, 9...
        default: return 'BULLET_DISC_CIRCLE_SQUARE';
    }
}

// Helper to recursively get all block-level nodes in document order
function getBlockLevelNodes(rootNode, currentListLevel = 0) {
    let nodes = [];
    // Iterate over child elements only
    for (const childElement of rootNode.children) {
        const tagName = childElement.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            nodes.push({ node: childElement, isListItem: false, listLevel: 0 });
        } else if (tagName === 'ul' || tagName === 'ol') {
            // For UL/OL, recurse and increase list level
            nodes.push(...getBlockLevelNodes(childElement, currentListLevel + 1));
        } else if (tagName === 'li') {
            // List item itself
            nodes.push({ node: childElement, isListItem: true, listLevel: currentListLevel });
        }
        // Add other block-level elements as needed
    }
    return nodes;
}

function htmlToGoogleDocsRequests(htmlContent, baseStartIndex = 1) {
    const dom = new JSDOM(`<body>${htmlContent}</body>`);
    const body = dom.window.document.body;
    let accumulatedRequests = []; // To store all requests before sorting
    let currentTextIndex = baseStartIndex;
    let paragraphsInfo = []; // Stores { text: string, styles: [], isListItem: boolean, listLevel: number } for each block

    // First pass: Extract text and style info from HTML, calculate relative indices
    // This pass does NOT generate API requests yet, only collects structured data
    function traverseAndExtract(node, currentStyles = {}) {
        if (node.nodeType === dom.window.Node.TEXT_NODE) {
            return [{
                type: 'text',
                content: node.textContent,
                styles: { ...currentStyles },
            }];
        }

        if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let newStyles = { ...currentStyles };
            let childResults = [];

            switch (tagName) {
                case 'strong': case 'b': newStyles.bold = true; break;
                case 'em': case 'i': newStyles.italic = true; break;
                case 's': newStyles.strikethrough = true; break;
                case 'span':
                    if (node.style) {
                        const foreColor = parseColor(node.style.color);
                        if (foreColor) {
                            newStyles.foregroundColor = { color: { rgbColor: foreColor } };
                        }
                        const backColor = parseColor(node.style.backgroundColor);
                        if (backColor) {
                            newStyles.backgroundColor = { color: { rgbColor: backColor } };
                        }
                    }
                    break;
                case 'br': // Handle <br> tags as soft newlines with a vertical tab '\v'
                    return [{ type: 'text', content: '\v', styles: { ...currentStyles } }];
            }

            // For UL/OL, don't directly process children's content here, getBlockLevelNodes handles it
            // If it's a list container or item, its children will be processed as part of block-level nodes or inline content
            for (const child of node.childNodes) {
                childResults.push(...traverseAndExtract(child, newStyles));
            }
            return childResults;
        }
        return [];
    }
	
    // Get all block-level nodes in correct document order
    const allBlockNodes = getBlockLevelNodes(body);

    for (const blockInfo of allBlockNodes) {
        const blockNode = blockInfo.node;
        const isListItem = blockInfo.isListItem;
        const listLevel = blockInfo.listLevel;

        const contentNodes = traverseAndExtract(blockNode, {});
        
        let plainText = '';
        let inlineStyleSpans = []; // Stores { text, styles, startIndex, endIndex }

        // Aggregate text and styles for the current block
        for (const item of contentNodes) {
            if (item.type === 'text' && item.content !== undefined) {
                const start = plainText.length;
                plainText += item.content;
                const end = plainText.length;

                if (Object.keys(item.styles).length > 0) {
                    inlineStyleSpans.push({
                        styles: item.styles,
                        relativeStartIndex: start,
                        relativeEndIndex: end,
                    });
                }
            }
        }

        // Handle empty paragraphs or list items carefully to ensure single newlines
        if (plainText.trim() === '' && !isListItem) {
            paragraphsInfo.push({
                text: '\n', // Represents an empty paragraph in Google Docs
                inlineStyles: [],
                isListItem: false,
                listLevel: 0,
                alignment: null,
                tagName: 'p',
            });
        } else {
            // Remove the leadingTabs logic, as tabs in text are not the correct way to handle indentation.
            // The API handles indentation via paragraph style updates.
            paragraphsInfo.push({
                text: plainText + '\n',
                inlineStyles: inlineStyleSpans,
                isListItem: isListItem,
                listLevel: listLevel,
                tagName: blockNode.tagName.toLowerCase(), // Store the tag name
                alignment: blockNode.style.textAlign || null,
            });
        }
    }

    // Second pass: Generate API requests with absolute indices
    let currentAbsoluteIndex = baseStartIndex;
    let requestsToProcess = [];

    // Process paragraphs in their original order first to get text insertion requests
    for (const paraInfo of paragraphsInfo) {
        const insertionStartIndex = currentAbsoluteIndex;
        
        // Insert the paragraph text
        requestsToProcess.push({
            type: 'insertText',
            request: {
                insertText: {
                    location: { index: currentAbsoluteIndex },
                    text: paraInfo.text,
                }
            },
            absoluteIndex: currentAbsoluteIndex // Store for sorting
        });
        currentAbsoluteIndex += paraInfo.text.length;

        // Add inline style requests for this paragraph
        for (const span of paraInfo.inlineStyles) {
            requestsToProcess.push({
                type: 'updateTextStyle',
                request: {
                    updateTextStyle: {
                        range: {
                            startIndex: insertionStartIndex + span.relativeStartIndex,
                            endIndex: insertionStartIndex + span.relativeEndIndex,
                        },
                        textStyle: span.styles,
                        fields: Object.keys(span.styles).join(','),
                    }
                },
                absoluteIndex: insertionStartIndex + span.relativeStartIndex // Store for sorting
            });
        }

        // --- Paragraph Style and Bullet Requests ---

        const paragraphStyle = {};
        const styleFields = [];

        // Style for headings
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(paraInfo.tagName)) {
            const level = paraInfo.tagName.substring(1);
            paragraphStyle.namedStyleType = `HEADING_${level}`;
            styleFields.push('namedStyleType');
        }

        // Style for text alignment
        if (paraInfo.alignment) {
            const alignmentMap = {
                left: 'START',
                center: 'CENTER',
                right: 'END',
                justify: 'JUSTIFIED',
            };
            const apiAlignment = alignmentMap[paraInfo.alignment.toLowerCase()];
            if (apiAlignment) {
                paragraphStyle.alignment = apiAlignment;
                styleFields.push('alignment');
            }
        }
        
        // Add bullet request for list items
        if (paraInfo.isListItem) {
            requestsToProcess.push({
                type: 'createParagraphBullets',
                request: {
                    createParagraphBullets: {
                        range: {
                            startIndex: insertionStartIndex,
                            endIndex: insertionStartIndex + paraInfo.text.length,
                        },
                        bulletPreset: getBulletPreset(paraInfo.listLevel),
                    }
                },
                absoluteIndex: insertionStartIndex // Store for sorting
            });

            // Handle nesting by setting indentation on the paragraph
            if (paraInfo.listLevel > 0) {
                // Indent by 36 points per level. Standard indentation.
                paragraphStyle.indentStart = { magnitude: 36 * paraInfo.listLevel, unit: 'PT' };
                styleFields.push('indentStart');
            }
        }

        // If any paragraph styles were added, create the request
        if (styleFields.length > 0) {
            requestsToProcess.push({
                type: 'updateParagraphStyle',
                request: {
                    updateParagraphStyle: {
                        range: {
                            startIndex: insertionStartIndex,
                            endIndex: insertionStartIndex + paraInfo.text.length,
                        },
                        paragraphStyle: paragraphStyle,
                        fields: styleFields.join(','),
                    }
                },
                absoluteIndex: insertionStartIndex,
            });
        }
    }

    // Separate structural requests from stylistic requests
    let structuralRequests = [];
    let stylisticRequests = [];

    for (const req of requestsToProcess) {
        if (req.type === 'insertText' || req.type === 'deleteContentRange') { // Add other structural types if needed
            structuralRequests.push(req);
        } else {
            stylisticRequests.push(req);
        }
    }

    // Sort structural requests by absoluteIndex in ASCENDING order for sequential insertions
    structuralRequests.sort((a, b) => a.absoluteIndex - b.absoluteIndex);

    // Sort stylistic requests by absoluteIndex in ASCENDING order
    // (They operate on content that is already there or is about to be inserted by structural changes)
    stylisticRequests.sort((a, b) => a.absoluteIndex - b.absoluteIndex);

    // Combine them: structural requests first, then stylistic requests
    // This ensures content exists before styles are applied.
    accumulatedRequests = structuralRequests.map(req => req.request)
                               .concat(stylisticRequests.map(req => req.request));

    return { requests: accumulatedRequests, endIndex: currentAbsoluteIndex };
}

module.exports = { htmlToGoogleDocsRequests };
