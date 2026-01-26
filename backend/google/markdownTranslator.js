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
    // Remove starting: "1. ", "1) ", "- ", "* ", "• ", "1.", "a. ", "i. " etc.
    return text.replace(/^((\d+|[a-zA-Z]|[ivxIVX]+)[\.\)]?|[\-\*\•])\s*/, "").trim();
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
                                { label: 'Snage (Strengths)', data: swot_data.strengths },
                                { label: 'Slabosti (Weaknesses)', data: swot_data.weaknesses },
                                { label: 'Prilike (Opportunities)', data: swot_data.opportunities },
                                { label: 'Pretnje (Threats)', data: swot_data.threats }
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
