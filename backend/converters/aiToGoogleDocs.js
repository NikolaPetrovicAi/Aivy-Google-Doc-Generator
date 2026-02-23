// converters/aiToGoogleDocs.js

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
function aiToGoogleDocsRequests(jsonString, initialIndex = 1) {
    let requests = [];
    let currentIndex = initialIndex;

    try {
        const doc = JSON.parse(jsonString);
        const { page_title, blocks } = doc;

        // 1. Add Page Title
        if (page_title) {
            currentIndex += addHeading(requests, page_title, currentIndex, 'HEADING_2');
            // UKLONJEN suvišan newline ovde
        }

        // 2. Iterate through blocks
        if (blocks && Array.isArray(blocks)) {
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
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
                            const tableIndex = currentIndex;
                            // 1. Insert Table 1x2
                            requests.push({
                                insertTable: {
                                    rows: 1,
                                    columns: 2,
                                    location: { index: tableIndex }
                                }
                            });

                            let cellOffsets = [4, 6];
                            let cellTextLengths = [0, 0];

                            // Cell 0: Advantages
                            let cell0Index = tableIndex + cellOffsets[0];
                            let len0 = addHeading(requests, 'Advantages', cell0Index, 'HEADING_4');
                            len0 += addList(requests, block.pros_cons.pros, cell0Index + len0);
                            cellTextLengths[0] = len0;

                            // Cell 1: Disadvantages
                            let cell1Index = tableIndex + cellOffsets[1] + cellTextLengths[0];
                            let len1 = addHeading(requests, 'Disadvantages', cell1Index, 'HEADING_4');
                            len1 += addList(requests, block.pros_cons.cons, cell1Index + len1);
                            cellTextLengths[1] = len1;

                            // 2. Set column widths (225 PT)
                            requests.push({
                                updateTableColumnProperties: {
                                    tableStartLocation: { index: tableIndex + 1 },
                                    columnIndices: [0, 1],
                                    tableColumnProperties: {
                                        width: { magnitude: 225, unit: 'PT' },
                                        widthType: 'FIXED_WIDTH'
                                    },
                                    fields: 'width,widthType'
                                }
                            });

                            // 3. Make all table borders invisible
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

                            currentIndex += (cellTextLengths[0] + cellTextLengths[1] + 8);
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
                            
                            let cellOffsets = [4, 6, 8];
                            for (let i = 0; i < 3; i++) {
                                const stat = block.stats[i];
                                // Value (Number) first, then Label
                                const cellText = `${stat.value}\n${stat.label}`;
                                const cellIndex = tableIndex + cellOffsets[i];

                                requests.push({
                                    insertText: {
                                        location: { index: cellIndex },
                                        text: cellText
                                    }
                                });

                                // Style the Value (Number) as HEADING_3
                                requests.push({
                                    updateParagraphStyle: {
                                        range: { startIndex: cellIndex, endIndex: cellIndex + stat.value.length },
                                        paragraphStyle: { namedStyleType: 'HEADING_3', alignment: 'CENTER' },
                                        fields: 'namedStyleType,alignment'
                                    }
                                });

                                // Style the Label (below) as centered plain text (removing previous bold/size)
                                const labelStartIndex = cellIndex + stat.value.length + 1;
                                requests.push({
                                    updateParagraphStyle: {
                                        range: { startIndex: labelStartIndex, endIndex: labelStartIndex + stat.label.length + 1 },
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
                            
                            const totalTextLength = block.stats.reduce((acc, s) => acc + s.value.length + s.label.length + 1, 0);
                            currentIndex += (totalTextLength + 10);
                        }
                        break;

                    case 'FAQ_BLOCK':
                        if (faqs && Array.isArray(faqs)) {
                            for (let i = 0; i < faqs.length; i++) {
                                const faq = faqs[i];

                                if (i === 0) {
                                    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                                    currentIndex += 1;
                                }

                                const questionLabel = `Q: ${faq.question}`;
                                currentIndex += addHeading(requests, questionLabel, currentIndex, 'HEADING_4');
                                
                                currentIndex += addParagraph(requests, faq.answer, currentIndex);
                                
                                // Samo ako nije poslednji FAQ, dodajemo prazan red radi razmaka
                                if (i < faqs.length - 1) {
                                    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                                    currentIndex += 1;
                                }
                            }
                        }
                        break;

                    case 'SWOT_LIST_BLOCK':
                        if (swot_data) {
                            const tableIndex = currentIndex;
                            // 1. Insert Table 2x2
                            requests.push({
                                insertTable: {
                                    rows: 2,
                                    columns: 2,
                                    location: { index: tableIndex }
                                }
                            });

                            let cellTextLengths = [0, 0, 0, 0];

                            // Cell 0: Strengths (Top Left) - Offset 4
                            let c0Idx = tableIndex + 4;
                            let l0 = addHeading(requests, 'Strengths', c0Idx, 'HEADING_4');
                            l0 += addList(requests, swot_data.strengths, c0Idx + l0);
                            cellTextLengths[0] = l0;

                            // Cell 1: Weaknesses (Top Right) - Offset 6
                            let l1Idx = tableIndex + 6 + cellTextLengths[0];
                            let l1 = addHeading(requests, 'Weaknesses', l1Idx, 'HEADING_4');
                            l1 += addList(requests, swot_data.weaknesses, l1Idx + l1);
                            cellTextLengths[1] = l1;

                            // Cell 2: Opportunities (Bottom Left) - Offset 9
                            let l2Idx = tableIndex + 9 + cellTextLengths[0] + cellTextLengths[1];
                            let l2 = addHeading(requests, 'Opportunities', l2Idx, 'HEADING_4');
                            l2 += addList(requests, swot_data.opportunities, l2Idx + l2);
                            cellTextLengths[2] = l2;

                            // Cell 3: Threats (Bottom Right) - Offset 11
                            let l3Idx = tableIndex + 11 + cellTextLengths[0] + cellTextLengths[1] + cellTextLengths[2];
                            let l3 = addHeading(requests, 'Threats', l3Idx, 'HEADING_4');
                            l3 += addList(requests, swot_data.threats, l3Idx + l3);
                            cellTextLengths[3] = l3;

                            // 2. Set column widths (225 PT)
                            requests.push({
                                updateTableColumnProperties: {
                                    tableStartLocation: { index: tableIndex + 1 },
                                    columnIndices: [0, 1],
                                    tableColumnProperties: {
                                        width: { magnitude: 225, unit: 'PT' },
                                        widthType: 'FIXED_WIDTH'
                                    },
                                    fields: 'width,widthType'
                                }
                            });

                            // 3. Make all table borders invisible
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

                            const totalTextLength = cellTextLengths.reduce((acc, len) => acc + len, 0);
                            currentIndex += (totalTextLength + 13);
                        }
                        break;
                }

                // Add spacing between blocks, but NOT after the last block of the page
                if (i < blocks.length - 1) {
                    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                    currentIndex += 1;
                }
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

module.exports = { aiToGoogleDocsRequests };
