// google/markdownTranslator.js

/**
 * Helper to add a heading to the requests.
 */
function addHeading(requests, text, index, level = 'HEADING_2') {
    const headingText = text + '\n';
    requests.push({ insertText: { location: { index }, text: headingText } });
    requests.push({
        updateParagraphStyle: {
            range: { startIndex: index, endIndex: index + headingText.length },
            paragraphStyle: { namedStyleType: level },
            fields: 'namedStyleType',
        },
    });
    return headingText.length;
}

/**
 * Helper to add a paragraph to the requests.
 */
function addParagraph(requests, text, index) {
    if (!text || text.trim().length < 2) return 0;
    const pText = text + '\n';
    requests.push({ insertText: { location: { index }, text: pText } });
    return pText.length;
}

/**
 * Cleans the text by removing manual bullets and numbering at the start.
 */
function cleanItemText(text) {
    if (!text) return "";
    // Remove starting: "1. ", "1) ", "- ", "* ", "• ", "a. ", "i. " etc.
    // Fixed: The delimiter [. or )] is now mandatory for alphanumeric markers to avoid stripping the first letter of regular words.
    return text.replace(/^(([0-9]+|[a-zA-Z]|[ivxIVX]+)[\.\)]|[\-\*\•])\s*/, "").trim();
}

/**
 * Helper to add a list of items.
 */
function addList(requests, items, index, bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE') {
    if (!items || items.length === 0) return 0;
    
    let localIndex = index;
    const start = index;
    
    for (const item of items) {
        if (!item) continue;
        const cleanedText = cleanItemText(item) + '\n';
        requests.push({ insertText: { location: { index: localIndex }, text: cleanedText } });
        localIndex += cleanedText.length;
    }
    
    if (localIndex > start) {
        requests.push({
            createParagraphBullets: {
                range: { startIndex: start, endIndex: localIndex },
                bulletPreset: bulletPreset,
            },
        });
    }
    
    return localIndex - index;
}

/**
 * Converts a JSON object representing a page with multiple blocks into Google Docs API requests.
 */
function markdownToGoogleDocsRequests(jsonString, initialIndex = 1) {
    let requests = [];
    let currentIndex = initialIndex;

    try {
        const doc = JSON.parse(jsonString);
        const { page_title, blocks } = doc;

        // 1. Add Page Title
        if (page_title) {
            currentIndex += addHeading(requests, page_title, currentIndex, 'HEADING_2');
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex += 1;
        }

        // 2. Iterate through blocks
        if (blocks && Array.isArray(blocks)) {
            for (const block of blocks) {
                const { type, title, content, list_items, faqs, swot_data } = block;

                // Add Block Title (Heading 3)
                if (title && title.length > 2) {
                    currentIndex += addHeading(requests, title, currentIndex, 'HEADING_3');
                }

                // Add Intro Content
                if (content && content.length > 5) {
                    currentIndex += addParagraph(requests, content, currentIndex);
                }

                // Handle block specific data
                switch (type) {
                    case 'BULLET_POINTS_BLOCK':
                        currentIndex += addList(requests, list_items, currentIndex, 'BULLET_DISC_CIRCLE_SQUARE');
                        break;

                    case 'STEP_BY_STEP_BLOCK':
                        currentIndex += addList(requests, list_items, currentIndex, 'NUMBERED_DECIMAL_ALPHA_ROMAN');
                        break;

                    case 'PROS_CONS_BLOCK':
                        if (block.pros_cons) {
                            currentIndex += addHeading(requests, 'Advantages', currentIndex, 'HEADING_4');
                            currentIndex += addList(requests, block.pros_cons.pros, currentIndex);
                            currentIndex += addHeading(requests, 'Disadvantages', currentIndex, 'HEADING_4');
                            currentIndex += addList(requests, block.pros_cons.cons, currentIndex);
                        }
                        break;

                    case 'KEY_TAKEAWAYS_BLOCK':
                        if (list_items) {
                            currentIndex += addHeading(requests, 'Key Takeaways', currentIndex, 'HEADING_4');
                            currentIndex += addList(requests, list_items, currentIndex, 'BULLET_CHECKBOX');
                        }
                        break;

                    case 'STATS_ROW_BLOCK':
                        if (block.stats && Array.isArray(block.stats)) {
                            const tableIndex = currentIndex;
                            // 1. Insert Table 1x3
                            requests.push({
                                insertTable: {
                                    rows: 1,
                                    columns: 3,
                                    location: { index: tableIndex }
                                }
                            });
                            
                            // Each cell in a new table initially has one empty paragraph (1 character: \n)
                            // According to documentation, a newline is inserted BEFORE the table.
                            // Indices relative to tableIndex:
                            // tableIndex: \n (auto-inserted)
                            // tableIndex + 1: [TS] (Table Start)
                            // tableIndex + 2: [RS] (Row Start)
                            // tableIndex + 3: [CS] (Cell 1 Start)
                            // tableIndex + 4: [Cell 1 Content Start]
                            
                            // 1x3 table structure discovered indices:
                            // Table Start (TS), Row Start (RS), Cell Start (CS), Cell Content (\n), Cell Boundary (CB), Cell End (CE), Row End (RE), Table End (TE)
                            // Empty: [TS][RS][CS0][\n][CS1][\n][CS2][\n][RE][TE]
                            // Indices relative to tableIndex (if tableIndex is 1 and auto-newline at 1 exists):
                            // 2:TS, 3:RS, 4:CS0, 5:\n, 6:CS1, 7:\n, 8:CS2, 9:\n, 10:RE, 11:TE
                            let cellOffsets = [4, 6, 8];
                            for (let i = 0; i < 3; i++) {
                                const stat = block.stats[i];
                                const cellText = `${stat.value}\n${stat.label}`;
                                const cellIndex = tableIndex + cellOffsets[i];

                                requests.push({
                                    insertText: {
                                        location: { index: cellIndex },
                                        text: cellText
                                    }
                                });

                                // Style the Value (Bold, Larger)
                                requests.push({
                                    updateTextStyle: {
                                        range: { startIndex: cellIndex, endIndex: cellIndex + stat.value.length },
                                        textStyle: { bold: true, fontSize: { magnitude: 14, unit: 'PT' } },
                                        fields: 'bold,fontSize'
                                    }
                                });

                                // Center align the cell content (including the original \n that was pushed)
                                requests.push({
                                    updateParagraphStyle: {
                                        range: { startIndex: cellIndex, endIndex: cellIndex + cellText.length + 1 },
                                        paragraphStyle: { alignment: 'CENTER' },
                                        fields: 'alignment'
                                    }
                                });

                                // Update subsequent offsets based on inserted text length
                                for (let j = i + 1; j < 3; j++) {
                                    cellOffsets[j] += cellText.length;
                                }
                            }

                            // Set column widths and make borders invisible
                            requests.push({
                                updateTableColumnProperties: {
                                    tableStartLocation: { index: tableIndex + 1 },
                                    columnIndices: [0, 1, 2],
                                    tableColumnProperties: {
                                        width: { magnitude: 150, unit: 'PT' },
                                        widthType: 'FIXED_WIDTH'
                                    },
                                    fields: 'width,widthType'
                                }
                            });

                            // Make all table borders invisible
                            requests.push({
                                updateTableCellStyle: {
                                    tableStartLocation: { index: tableIndex + 1 },
                                    tableCellStyle: {
                                        borderTop: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                        borderBottom: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                        borderLeft: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                        borderRight: { dashStyle: 'SOLID', width: { magnitude: 0, unit: 'PT' }, color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } },
                                    },
                                    fields: 'borderTop,borderBottom,borderLeft,borderRight'
                                }
                            });
                            
                            // Total structural overhead: 10
                            // Reverted to 10. The previous increase to 11 caused "Index must be less than end index" error.
                            // 10 matches the correct insertion point (before the final newline).
                            const totalTextLength = block.stats.reduce((acc, s) => acc + s.value.length + s.label.length + 1, 0);
                            currentIndex += (totalTextLength + 10);
                        }
                        break;

                    case 'FAQ_BLOCK':
                        if (faqs && Array.isArray(faqs)) {
                            for (const faq of faqs) {
                                const qText = `Q: ${faq.question}\n`;
                                requests.push({ insertText: { location: { index: currentIndex }, text: qText } });
                                requests.push({
                                    updateTextStyle: {
                                        range: { startIndex: currentIndex, endIndex: currentIndex + qText.length },
                                        textStyle: { bold: true },
                                        fields: 'bold',
                                    },
                                });
                                currentIndex += qText.length;
                                currentIndex += addParagraph(requests, faq.answer, currentIndex);
                                requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                                currentIndex += 1;
                            }
                        }
                        break;

                    case 'SWOT_LIST_BLOCK':
                        if (swot_data) {
                            const sections = [
                                { label: 'Strengths', data: swot_data.strengths },
                                { label: 'Weaknesses', data: swot_data.weaknesses },
                                { label: 'Opportunities', data: swot_data.opportunities },
                                { label: 'Threats', data: swot_data.threats }
                            ];
                            for (const section of sections) {
                                currentIndex += addHeading(requests, section.label, currentIndex, 'HEADING_4');
                                currentIndex += addList(requests, section.data, currentIndex);
                                requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                                currentIndex += 1;
                            }
                        }
                        break;
                }

                // Add spacing between blocks
                requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                currentIndex += 1;
            }
        }
    } catch (error) {
        console.error("Error parsing AI-generated JSON.", error);
        const fallbackText = jsonString + '\n';
        requests.push({ insertText: { location: { index: currentIndex }, text: fallbackText } });
        currentIndex += fallbackText.length;
    }

    return { requests, endIndex: currentIndex };
}

module.exports = { markdownToGoogleDocsRequests };
