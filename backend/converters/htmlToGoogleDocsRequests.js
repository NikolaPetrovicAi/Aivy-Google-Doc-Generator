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

/**
 * Ensures that <!-- PAGE_BREAK --> markers are not located inside <table> tags.
 * If found inside a table, they are moved immediately after the table.
 */
function movePageBreaksOutOfTables(html) {
    const dom = new JSDOM(`<body>${html}</body>`);
    const doc = dom.window.document;
    const body = doc.body;
    
    // NodeFilter.SHOW_COMMENT = 128
    const walker = doc.createTreeWalker(body, 128, null, false);

    const markersToMove = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
        if (currentNode.textContent.trim() === 'PAGE_BREAK') {
            let parent = currentNode.parentElement;
            let table = null;
            while (parent) {
                if (parent.tagName.toLowerCase() === 'table') {
                    table = parent;
                    break;
                }
                parent = parent.parentElement;
            }
            if (table) {
                markersToMove.push({ comment: currentNode, table: table });
            }
        }
        currentNode = walker.nextNode();
    }

    markersToMove.forEach(({ comment, table }) => {
        // Move the marker after the table
        if (table.nextSibling) {
            table.parentNode.insertBefore(comment, table.nextSibling);
        } else {
            table.parentNode.appendChild(comment);
        }
    });

    return body.innerHTML;
}

// Helper to recursively get all block-level nodes in document order
function getBlockLevelNodes(rootNode, window, currentListLevel = 0, currentListType = null) {
    let nodes = [];
    // Iterate over child elements only
    for (const childElement of rootNode.children) {
        const tagName = childElement.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            nodes.push({ 
                node: childElement, 
                isListItem: false, 
                listLevel: 0, 
                listType: null, 
                isChildParagraph: false 
            });
        } else if (tagName === 'table') {
            const rows = [];
            const trs = childElement.querySelectorAll(':scope > tr, :scope > tbody > tr');
            for (const tr of trs) {
                const cells = [];
                const tds = tr.querySelectorAll(':scope > td, :scope > th');
                for (const td of tds) {
                    cells.push({
                        node: td,
                        contentNodes: getBlockLevelNodes(td, window, 0, null)
                    });
                }
                rows.push(cells);
            }
            nodes.push({
                type: 'table',
                node: childElement,
                rows: rows
            });
        } else if (tagName === 'ul' || tagName === 'ol') {
            nodes.push(...getBlockLevelNodes(childElement, window, currentListLevel + 1, tagName));
        } else if (tagName === 'li') {
            const liLevel = currentListLevel;
            const liType = currentListType;
            
            let parts = [];
            let currentInline = [];

            // Categorize LI children into block-level elements and inline elements
            for (const child of childElement.childNodes) {
                if (child.nodeType === window.Node.ELEMENT_NODE && 
                    ['p', 'ul', 'ol', 'table', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(child.tagName.toLowerCase())) {
                    if (currentInline.length > 0) {
                        parts.push({ type: 'inline', nodes: [...currentInline] });
                        currentInline = [];
                    }
                    parts.push({ type: 'block', node: child });
                } else {
                    currentInline.push(child);
                }
            }
            if (currentInline.length > 0) {
                parts.push({ type: 'inline', nodes: [...currentInline] });
            }

            let mainItemProcessed = false;
            let blocksAddedCount = 0;

            for (const part of parts) {
                if (part.type === 'inline') {
                    const virtualLi = window.document.createElement('li');
                    if (childElement.style.textAlign) {
                        virtualLi.style.textAlign = childElement.style.textAlign;
                    }
                    part.nodes.forEach(n => virtualLi.appendChild(n.cloneNode(true)));
                    
                    if (virtualLi.textContent.trim() !== '' || (parts.length === 1 && part.nodes.length > 0)) {
                        nodes.push({
                            node: virtualLi,
                            isListItem: true,
                            listLevel: liLevel,
                            listType: liType,
                            isChildParagraph: mainItemProcessed
                        });
                        mainItemProcessed = true;
                        blocksAddedCount++;
                    }
                } else {
                    const tag = part.node.tagName.toLowerCase();
                    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                        nodes.push({
                            node: part.node,
                            isListItem: true,
                            listLevel: liLevel,
                            listType: liType,
                            isChildParagraph: mainItemProcessed
                        });
                        mainItemProcessed = true;
                        blocksAddedCount++;
                    } else if (tag === 'ul' || tag === 'ol') {
                        const subNodes = getBlockLevelNodes(part.node, window, liLevel + 1, tag);
                        nodes.push(...subNodes);
                        blocksAddedCount += subNodes.length;
                    } else if (tag === 'table') {
                        // Handle tables inside LI
                        const rows = [];
                        const trs = part.node.querySelectorAll(':scope > tr, :scope > tbody > tr');
                        for (const tr of trs) {
                            const cells = [];
                            const tds = tr.querySelectorAll(':scope > td, :scope > th');
                            for (const td of tds) {
                                cells.push({ node: td, contentNodes: getBlockLevelNodes(td, window, 0, null) });
                            }
                            rows.push(cells);
                        }
                        nodes.push({ type: 'table', node: part.node, rows: rows });
                        blocksAddedCount++;
                    }
                }
            }
            
            // If the LI is truly empty, add a placeholder block to maintain the bullet
            if (blocksAddedCount === 0) {
                const emptyLi = window.document.createElement('li');
                nodes.push({
                    node: emptyLi,
                    isListItem: true,
                    listLevel: liLevel,
                    listType: liType,
                    isChildParagraph: false
                });
            }
        }
    }
    return nodes;
}

function htmlToGoogleDocsRequests(htmlContent, baseStartIndex = 1) {
    const pageBreakMarker = '<!-- PAGE_BREAK -->';

    // 0. Pre-process HTML to move any page breaks out of tables to avoid API errors
    if (htmlContent.includes(pageBreakMarker)) {
        htmlContent = movePageBreaksOutOfTables(htmlContent);
    }

    if (htmlContent.includes(pageBreakMarker)) {
        const parts = htmlContent.split(pageBreakMarker);
        let allRequests = [];
        let currentIndex = baseStartIndex;

        for (let i = 0; i < parts.length; i++) {
            // Recursively call for each part (parts won't have the marker)
            const { requests, endIndex } = htmlToGoogleDocsRequests(parts[i], currentIndex);
            allRequests.push(...requests);
            currentIndex = endIndex;

            if (i < parts.length - 1) {
                // Insert Page Break logic matching docs.js
                allRequests.push({
                    insertPageBreak: {
                        location: { index: currentIndex }
                    }
                });
                allRequests.push({
                    insertText: {
                        text: '\n',
                        location: { index: currentIndex + 1 }
                    }
                });
                currentIndex += 2;
            }
        }
        return { requests: allRequests, endIndex: currentIndex };
    }

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
    let blocksInfo = []; // Stores info about paragraphs and tables

    function processNodes(nodes, infoArray) {
        for (const blockInfo of nodes) {
            if (blockInfo.type === 'table') {
                const tableData = {
                    type: 'table',
                    node: blockInfo.node,
                    rows: []
                };

                for (const row of blockInfo.rows) {
                    const rowData = [];
                    for (const cell of row) {
                        const cellBlocks = [];
                        processNodes(cell.contentNodes, cellBlocks);
                        rowData.push({
                            node: cell.node,
                            blocks: cellBlocks
                        });
                    }
                    tableData.rows.push(rowData);
                }
                infoArray.push(tableData);
                continue;
            }

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
                infoArray.push({
                    type: 'paragraph',
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
                const finalText = plainText.trim() + '\n';
                infoArray.push({
                    type: 'paragraph',
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
    }

    processNodes(allBlockNodes, blocksInfo);

    let currentAbsoluteIndex = baseStartIndex;
    let requestsToProcess = [];
    let allBlocksSequentially = []; // Track EVERY block (paragraph OR table) in order

    function generateRequestsForBlocks(blocks, startIndex) {
        let localIndex = startIndex;

        for (const block of blocks) {
            if (block.type === 'table') {
                const tableStartIndex = localIndex;

                // FIX: Pre-insert table block to maintain document order in allBlocksSequentially
                const tableSeqBlock = {
                    type: 'table',
                    startIndex: tableStartIndex,
                    endIndex: 0 // Will be updated below
                };
                allBlocksSequentially.push(tableSeqBlock);

                const rows = block.rows.length;
                const cols = block.rows[0]?.length || 0;

                // 1. Insert Table
                requestsToProcess.push({
                    type: 'insertTable',
                    request: {
                        insertTable: {
                            rows,
                            columns: cols,
                            location: { index: tableStartIndex }
                        }
                    },
                    absoluteIndex: tableStartIndex
                });

                const tableIndex = tableStartIndex + 1;
                
                // Generic cell processing for any table dimensions
                let currentCellIndex = tableStartIndex + 4;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const cell = block.rows[r][c];
                        const cellResultIndex = generateRequestsForBlocks(cell.blocks, currentCellIndex);
                        const cellTextLength = cellResultIndex - currentCellIndex;
                        
                        // Structural character offsets between cells and rows:
                        // - Between cells in same row: [Cell End][Cell Start] = 2 chars
                        // - Between last cell of row and first cell of next row: [Cell End][Row End][Row Start][Cell Start] = 3 chars (adjusted for Google Docs API behavior)
                        // - At the end of the table: [Cell End][Row End][Table End] = 2 chars (adjusted)
                        if (c < cols - 1) {
                            currentCellIndex += cellTextLength + 2;
                        } else if (r < rows - 1) {
                            currentCellIndex += cellTextLength + 3;
                        } else {
                            currentCellIndex += cellTextLength + 2;
                        }
                    }
                }
                
                localIndex = currentCellIndex;
                tableSeqBlock.endIndex = localIndex;

                const styleAttr = block.node.getAttribute('style') || '';
                const classList = block.node.classList;
                const isLayoutTable = 
                    styleAttr.replace(/\s/g, '').includes('border:none') || 
                    styleAttr.replace(/\s/g, '').includes('border-width:0') ||
                    styleAttr.replace(/\s/g, '').includes('border-style:none') ||
                    block.node.getAttribute('border') === '0' || 
                    classList.contains('border-none') ||
                    classList.contains('border-0');

                if (isLayoutTable) {
                    requestsToProcess.push({
                        type: 'updateTableCellStyle',
                        request: {
                            updateTableCellStyle: {
                                tableStartLocation: { index: tableIndex },
                                tableCellStyle: {
                                    borderTop: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                    borderBottom: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                    borderLeft: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                    borderRight: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                },
                                fields: 'borderTop,borderBottom,borderLeft,borderRight'
                            }
                        },
                        absoluteIndex: tableIndex
                    });
                }
                continue;
            }

            const insertionStartIndex = localIndex;
            
            // Insert the paragraph text
            requestsToProcess.push({
                type: 'insertText',
                request: {
                    insertText: {
                        location: { index: localIndex },
                        text: block.text,
                    }
                },
                absoluteIndex: localIndex
            });
            localIndex += block.text.length;
            const insertionEndIndex = localIndex;

            // Add inline style requests
            for (const span of block.inlineStyles) {
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

            allBlocksSequentially.push({
                ...block,
                type: 'paragraph',
                startIndex: insertionStartIndex,
                endIndex: insertionEndIndex
            });
        }
        return localIndex;
    }

    currentTextIndex = generateRequestsForBlocks(blocksInfo, baseStartIndex);

    // 2. Process Block Formatting (Lists, Headings, Alignment)
    let i = 0;
    while (i < allBlocksSequentially.length) {
        const block = allBlocksSequentially[i];

        // Ensure we ALWAYS clean up any inherited bullets for every paragraph block
        if (block.type === 'paragraph') {
            requestsToProcess.push({
                type: 'deleteParagraphBullets',
                request: {
                    deleteParagraphBullets: {
                        range: { startIndex: block.startIndex, endIndex: block.endIndex },
                    }
                },
                absoluteIndex: block.startIndex
            });
        }

        if (block.type === 'paragraph' && block.isListItem === true && block.listType) {
            // Found the start of a list. Find the end of this continuous list block.
            // We group by listType and listLevel to ensure we apply the correct preset and maintain boundaries.
            let j = i;
            while (j < allBlocksSequentially.length) {
                const nextBlock = allBlocksSequentially[j];
                if (nextBlock.type === 'paragraph' && 
                    nextBlock.isListItem === true && 
                    nextBlock.listType === block.listType) {
                    j++;
                } else {
                    break;
                }
            }
            // List block is from index i to j-1
            const groupStart = allBlocksSequentially[i].startIndex;
            const groupEnd = allBlocksSequentially[j - 1].endIndex;

            // A. Apply ONE bullet preset for the entire group to ensure continuity
            requestsToProcess.push({
                type: 'createParagraphBullets',
                request: {
                    createParagraphBullets: {
                        range: { startIndex: groupStart, endIndex: groupEnd },
                        bulletPreset: getBulletPreset(block.listLevel, block.listType),
                    }
                },
                absoluteIndex: groupStart
            });

            // B. Handle individual items within the group (Indentation & Child Cleanup)
            for (let k = i; k < j; k++) {
                const item = allBlocksSequentially[k];
                
                // Note: deleteParagraphBullets for children is now handled by the global clean-up above
                
                const itemStyle = {};
                const itemFields = [];

                if ((item.listLevel > 1 && !item.isChildParagraph) || item.isChildParagraph) {
                    const indentLevel = item.isChildParagraph ? item.listLevel + 1 : item.listLevel;
                    itemStyle.indentStart = { magnitude: 18 * indentLevel, unit: 'PT' };
                    itemFields.push('indentStart');
                }

                if (item.alignment) {
                    const alignmentMap = { left: 'START', center: 'CENTER', right: 'END', justify: 'JUSTIFIED' };
                    const apiAlignment = alignmentMap[item.alignment.toLowerCase()];
                    if (apiAlignment) {
                        itemStyle.alignment = apiAlignment;
                        itemFields.push('alignment');
                    }
                }

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
            i = j;

        } else if (block.type === 'paragraph') {
            // Handle Non-List Paragraphs (Headings, Alignment)
            const paragraphStyle = {};
            const styleFields = [];

            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.tagName)) {
                const level = block.tagName.substring(1);
                paragraphStyle.namedStyleType = `HEADING_${level}`;
                styleFields.push('namedStyleType');
            }

            if (block.alignment) {
                const alignmentMap = { left: 'START', center: 'CENTER', right: 'END', justify: 'JUSTIFIED' };
                const apiAlignment = alignmentMap[block.alignment.toLowerCase()];
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
                            range: { startIndex: block.startIndex, endIndex: block.endIndex },
                            paragraphStyle: paragraphStyle,
                            fields: styleFields.join(','),
                        }
                    },
                    absoluteIndex: block.startIndex
                });
            }
            i++;
        } else {
            // It's a table or something else that doesn't need paragraph formatting here
            i++;
        }
    }

    // DEBUG: Check if listType is propagating correctly
    console.log("--- DEBUG ALL BLOCKS SEQUENTIALLY ---");
    allBlocksSequentially.forEach((b, idx) => {
        if (b.type === 'paragraph' && b.isListItem) {
            console.log(`Idx: ${idx}, Text: "${b.text.substring(0, 20)}...", IsList: ${b.isListItem}, Type: ${b.listType}, Child: ${b.isChildParagraph}`);
        } else {
            console.log(`Idx: ${idx}, Type: ${b.type}, Start: ${b.startIndex}, End: ${b.endIndex}`);
        }
    });

    // Separate structural requests from stylistic requests
    let structuralRequests = [];
    let stylisticRequests = [];

    for (const req of requestsToProcess) {
        if (req.type === 'insertText' || req.type === 'deleteContentRange' || req.type === 'insertTable') { 
            structuralRequests.push(req);
        } else {
            stylisticRequests.push(req);
        }
    }

    // Sort structural requests by absoluteIndex in ASCENDING order for sequential insertions
    structuralRequests.sort((a, b) => a.absoluteIndex - b.absoluteIndex);

    // Sort stylistic requests.
    // CRITICAL: Ensure correct order when indices match.
    // Order: deleteParagraphBullets -> createParagraphBullets -> updateParagraphStyle
    const typePriority = {
        'deleteParagraphBullets': 1,
        'createParagraphBullets': 2,
        'updateParagraphStyle': 3,
        'updateTextStyle': 4,
        'updateTableCellStyle': 5
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

