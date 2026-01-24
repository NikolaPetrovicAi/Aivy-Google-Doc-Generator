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
function getBulletPreset(level, listType) {
    if (listType === 'ol') {
        return 'NUMBERED_DECIMAL_ALPHA_ROMAN';
    }
    // The listLevel is 1-based, so we subtract 1 for a 0-based modulo
    switch ((level - 1) % 3) {
        case 0: return 'BULLET_DISC_CIRCLE_SQUARE'; // Level 1, 4, 7...
        case 1: return 'BULLET_ARROW_DIAMOND_DISC'; // Level 2, 5, 8...
        case 2: return 'BULLET_STAR_ARROW_DIAMOND'; // Level 3, 6, 9...
        default: return 'BULLET_DISC_CIRCLE_SQUARE';
    }
}

// Helper to recursively get all block-level nodes in document order
function getBlockLevelNodes(rootNode, window, currentListLevel = 0, currentListType = null) {
    let nodes = [];
    // Iterate over child elements only
    for (const childElement of rootNode.children) {
        const tagName = childElement.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            nodes.push({ node: childElement, isListItem: false, listLevel: 0, listType: null, isChildParagraph: false });
        } else if (tagName === 'ul' || tagName === 'ol') {
            nodes.push(...getBlockLevelNodes(childElement, window, currentListLevel + 1, tagName));
        } else if (tagName === 'li') {
            const liLevel = currentListLevel;
            const liType = currentListType;

            const virtualLiNode = window.document.createElement('li');
            // Propagate text-align style from the original li to the virtual li
            if (childElement.style.textAlign) {
                virtualLiNode.style.textAlign = childElement.style.textAlign;
            }
            
            let childParagraphs = [];

            for (const liChild of childElement.childNodes) {
                if (liChild.nodeType === window.Node.ELEMENT_NODE && liChild.tagName.toLowerCase() === 'p') {
                    childParagraphs.push(liChild);
                } else {
                    virtualLiNode.appendChild(liChild.cloneNode(true));
                }
            }

            // Logic to determine which node is the "Main" list item (receives bullet/number)
            // vs which are "Child" paragraphs (indent only, no bullet)
            
            if (virtualLiNode.textContent.trim() !== '') {
                // Case 1: LI has direct text. e.g. <li>Main Text<p>Child</p></li>
                nodes.push({ node: virtualLiNode, isListItem: true, listLevel: liLevel, listType: liType, isChildParagraph: false });
                
                // All paragraphs are children
                for (const pNode of childParagraphs) {
                    nodes.push({ node: pNode, isListItem: true, listLevel: liLevel, listType: liType, isChildParagraph: true });
                }
            } else {
                // Case 2: LI has no direct text, starts with P. e.g. <li><p>Main Text</p><p>Child</p></li>
                if (childParagraphs.length > 0) {
                    // The FIRST paragraph is the main item
                    nodes.push({ node: childParagraphs[0], isListItem: true, listLevel: liLevel, listType: liType, isChildParagraph: false });
                    
                    // Subsequent paragraphs are children
                    for (let k = 1; k < childParagraphs.length; k++) {
                        nodes.push({ node: childParagraphs[k], isListItem: true, listLevel: liLevel, listType: liType, isChildParagraph: true });
                    }
                }
            }
        }
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
                        if (node.style.fontFamily) {
                            const font = node.style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
                            if (font) {
                                newStyles.weightedFontFamily = {
                                    fontFamily: font,
                                    weight: 400
                                };
                            }
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
    const allBlockNodes = getBlockLevelNodes(body, dom.window);

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
                listType: null,
                isChildParagraph: false,
                alignment: null,
                tagName: 'p',
            });
        } else {
            // Trim plainText to remove leading/trailing whitespace from parsing, then add a single newline.
            // This prevents the "double newline" issue that was creating extra bullet points.
            const finalText = plainText.trim() + '\n';
            paragraphsInfo.push({
                text: finalText,
                inlineStyles: inlineStyleSpans,
                isListItem: isListItem,
                listLevel: listLevel,
                listType: blockInfo.listType,
                isChildParagraph: blockInfo.isChildParagraph,
                tagName: blockNode.tagName.toLowerCase(), // Store the tag name
                alignment: blockNode.style.textAlign || null,
            });
        }
    }

    // Second pass: Generate API requests with absolute indices
    let currentAbsoluteIndex = baseStartIndex;
    let requestsToProcess = [];
    let processedParagraphs = []; // Store info with calculated absolute indices

    // 1. Generate Text Insertions and Inline Styles (and calculate indices)
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
            absoluteIndex: currentAbsoluteIndex
        });
        currentAbsoluteIndex += paraInfo.text.length;
        const insertionEndIndex = currentAbsoluteIndex;

        // Add inline style requests
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
                absoluteIndex: insertionStartIndex + span.relativeStartIndex
            });
        }

        // Store processing info for the next pass
        processedParagraphs.push({
            ...paraInfo,
            startIndex: insertionStartIndex,
            endIndex: insertionEndIndex
        });
    }

    // 2. Process Block Formatting (Lists, Headings, Alignment)
    let i = 0;
    while (i < processedParagraphs.length) {
        const para = processedParagraphs[i];

        if (para.isListItem) {
            // Found the start of a list. Find the end of this continuous list block.
            // We group by listType to ensure we apply the correct preset (OL vs UL).
            let j = i;
            while (j < processedParagraphs.length && 
                   processedParagraphs[j].isListItem && 
                   processedParagraphs[j].listType === para.listType) {
                j++;
            }
            // List block is from index i to j-1
            const groupStart = processedParagraphs[i].startIndex;
            const groupEnd = processedParagraphs[j - 1].endIndex;

            // A. Apply ONE bullet preset for the entire group to ensure continuity
            requestsToProcess.push({
                type: 'createParagraphBullets',
                request: {
                    createParagraphBullets: {
                        range: { startIndex: groupStart, endIndex: groupEnd },
                        bulletPreset: getBulletPreset(para.listLevel, para.listType),
                    }
                },
                absoluteIndex: groupStart
            });

            // B. Handle individual items within the group (Indentation & Child Cleanup)
            for (let k = i; k < j; k++) {
                const item = processedParagraphs[k];
                
                // 1. Remove bullet from child paragraphs FIRST.
                // Critical: 'deleteParagraphBullets' resets indentation, so it must happen BEFORE we apply our custom indent.
                if (item.isChildParagraph) {
                    requestsToProcess.push({
                        type: 'deleteParagraphBullets',
                        request: {
                            deleteParagraphBullets: {
                                range: { startIndex: item.startIndex, endIndex: item.endIndex },
                            }
                        },
                        absoluteIndex: item.startIndex
                    });
                }

                const itemStyle = {};
                const itemFields = [];

                // Indentation
                // Only apply explicit indent for nested levels or child paragraphs.
                // For level 1 main items, let the bulletPreset handle the default indent.
                if ((item.listLevel > 1 && !item.isChildParagraph) || item.isChildParagraph) {
                    // Child paragraphs get extra indent to align with parent text
                    const indentLevel = item.isChildParagraph ? item.listLevel + 1 : item.listLevel;
                    itemStyle.indentStart = { magnitude: 18 * indentLevel, unit: 'PT' };
                    itemFields.push('indentStart');
                }

                // Handle Alignment for List Items
                if (item.alignment) {
                    const alignmentMap = { left: 'START', center: 'CENTER', right: 'END', justify: 'JUSTIFIED' };
                    const apiAlignment = alignmentMap[item.alignment.toLowerCase()];
                    if (apiAlignment) {
                        itemStyle.alignment = apiAlignment;
                        itemFields.push('alignment');
                    }
                }

                // 2. Apply Indentation and other styles LAST.
                // This ensures our indentation persists even after bullet deletion.
                if (itemFields.length > 0) {
                    requestsToProcess.push({
                        type: 'updateParagraphStyle',
                        request: {
                            updateParagraphStyle: {
                                range: { startIndex: item.startIndex, endIndex: item.endIndex },
                                paragraphStyle: itemStyle,
                                fields: itemFields.join(','),
                            }
                        },
                        absoluteIndex: item.startIndex
                    });
                }
            }

            // Move main loop index to end of this group
            i = j;

        } else {
            // Handle Non-List Paragraphs (Headings, Alignment)
            const paragraphStyle = {};
            const styleFields = [];

            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(para.tagName)) {
                const level = para.tagName.substring(1);
                paragraphStyle.namedStyleType = `HEADING_${level}`;
                styleFields.push('namedStyleType');
            }

            if (para.alignment) {
                const alignmentMap = { left: 'START', center: 'CENTER', right: 'END', justify: 'JUSTIFIED' };
                const apiAlignment = alignmentMap[para.alignment.toLowerCase()];
                if (apiAlignment) {
                    paragraphStyle.alignment = apiAlignment;
                    styleFields.push('alignment');
                }
            }

            if (styleFields.length > 0) {
                requestsToProcess.push({
                    type: 'updateParagraphStyle',
                    request: {
                        updateParagraphStyle: {
                            range: { startIndex: para.startIndex, endIndex: para.endIndex },
                            paragraphStyle: paragraphStyle,
                            fields: styleFields.join(','),
                        }
                    },
                    absoluteIndex: para.startIndex
                });
            }
            
            i++; // Process next paragraph
        }
    }

    // DEBUG: Check if listType is propagating correctly
    console.log("--- DEBUG PROCESSED PARAGRAPHS ---");
    processedParagraphs.forEach((p, idx) => {
        if (p.isListItem) {
            console.log(`Idx: ${idx}, Text: "${p.text.substring(0, 20)}...", IsList: ${p.isListItem}, Type: ${p.listType}, Child: ${p.isChildParagraph}`);
        }
    });

    // Separate structural requests from stylistic requests
    let structuralRequests = [];
    let stylisticRequests = [];

    for (const req of requestsToProcess) {
        if (req.type === 'insertText' || req.type === 'deleteContentRange') { 
            structuralRequests.push(req);
        } else {
            stylisticRequests.push(req);
        }
    }

    // Sort structural requests by absoluteIndex in ASCENDING order for sequential insertions
    structuralRequests.sort((a, b) => a.absoluteIndex - b.absoluteIndex);

    // Sort stylistic requests.
    // CRITICAL: Ensure correct order when indices match.
    // Order: createParagraphBullets -> deleteParagraphBullets -> updateParagraphStyle
    const typePriority = {
        'createParagraphBullets': 1,
        'deleteParagraphBullets': 2,
        'updateParagraphStyle': 3,
        'updateTextStyle': 4
    };

    stylisticRequests.sort((a, b) => {
        if (a.absoluteIndex !== b.absoluteIndex) {
            return a.absoluteIndex - b.absoluteIndex;
        }
        // If indices match, enforce priority
        const pA = typePriority[a.type] || 99;
        const pB = typePriority[b.type] || 99;
        return pA - pB;
    });

    // Combine them: structural requests first, then stylistic requests
    accumulatedRequests = structuralRequests.map(req => req.request)
                               .concat(stylisticRequests.map(req => req.request));

    return { requests: accumulatedRequests, endIndex: currentTextIndex };
}

module.exports = { htmlToGoogleDocsRequests };

