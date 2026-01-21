// google/markdownTranslator.js

/**
 * Generates Google Docs API requests for a structured accordion list section.
 * This version uses a multi-pass approach to correctly format incrementing numbered lists.
 * @param {object} data - The data object from the parsed JSON.
 * @param {number} startIndex - The starting index in the Google Doc.
 * @returns {{requests: Array<Object>, newIndex: number}} An object with the list of requests and the new index.
 */
function generateAccordionListRequests(data, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    const { section_title, section_intro, list_items } = data;

    // 1. Add Section Title
    if (section_title) {
        const titleText = section_title + '\n';
        const titleLength = titleText.length;
        requests.push({ insertText: { location: { index: currentIndex }, text: titleText } });
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: currentIndex, endIndex: currentIndex + titleLength },
                paragraphStyle: { namedStyleType: 'HEADING_2' },
                fields: 'namedStyleType',
            },
        });
        currentIndex += titleLength;
    }

    // 2. Add Section Intro
    if (section_intro) {
        const introText = section_intro + '\n';
        const introLength = introText.length;
        requests.push({ insertText: { location: { index: currentIndex }, text: introText } });
        currentIndex += introLength;
    }
    
    // Add a blank line for spacing before the list
    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
    currentIndex += 1;

    // 3. Process List Items using a multi-pass approach
    if (list_items && list_items.length > 0) {
        const listStartIndex = currentIndex;
        const contentRanges = [];

        // First Pass: Insert all text to establish ranges
        for (const item of list_items) {
            const itemTitleText = item.item_title + '\n';
            requests.push({ insertText: { location: { index: currentIndex }, text: itemTitleText } });
            currentIndex += itemTitleText.length;

            const itemContentText = item.item_content + '\n';
            const contentStartIndex = currentIndex;
            requests.push({ insertText: { location: { index: currentIndex }, text: itemContentText } });
            currentIndex += itemContentText.length;
            contentRanges.push({ start: contentStartIndex, end: currentIndex });
        }
        const listEndIndex = currentIndex;

        // Second Pass: Apply list formatting to the entire block
        requests.push({
            createParagraphBullets: {
                range: { startIndex: listStartIndex, endIndex: listEndIndex },
                bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
            },
        });

        // Third Pass: Clean up and apply styles
        for (const range of contentRanges) {
            // Remove the incorrect bullet from the content paragraph
            requests.push({
                deleteParagraphBullets: {
                    range: { startIndex: range.start, endIndex: range.end },
                },
            });
            // Apply indentation to the content paragraph
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: range.start, endIndex: range.end },
                    paragraphStyle: {
                        indentStart: { magnitude: 36, unit: 'PT' },
                    },
                    fields: 'indentStart',
                },
            });
        }
    }

    return { requests, newIndex: currentIndex };
}

/**
 * Generates Google Docs API requests for a feature list section.
 * @param {object} data - The data object from the parsed JSON.
 * @param {number} startIndex - The starting index in the Google Doc.
 * @returns {{requests: Array<Object>, newIndex: number}} An object with the list of requests and the new index.
 */
function generateFeatureListRequests(data, startIndex) {
    const requests = [];
    let currentIndex = startIndex;

    const { section_title, features } = data;

    // 1. Add Section Title
    if (section_title) {
        const titleText = section_title + '\n';
        const titleLength = titleText.length;
        requests.push({
            insertText: { location: { index: currentIndex }, text: titleText },
        });
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: currentIndex, endIndex: currentIndex + titleLength },
                paragraphStyle: { namedStyleType: 'HEADING_2' },
                fields: 'namedStyleType',
            },
        });
        currentIndex += titleLength;
    }

    // 2. Process Features
    if (features && features.length > 0) {
        for (const feature of features) {
            // Add feature title as a HEADING_3
            const featureTitleText = feature.feature_title + '\n';
            const featureTitleLength = featureTitleText.length;
            requests.push({
                insertText: { location: { index: currentIndex }, text: featureTitleText },
            });
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: currentIndex, endIndex: currentIndex + featureTitleLength },
                    paragraphStyle: { namedStyleType: 'HEADING_3' },
                    fields: 'namedStyleType',
                },
            });
            currentIndex += featureTitleLength;

            // Add feature description as a normal paragraph
            const featureDescriptionText = feature.feature_description + '\n';
            const featureDescriptionLength = featureDescriptionText.length;
            requests.push({
                insertText: { location: { index: currentIndex }, text: featureDescriptionText },
            });
            currentIndex += featureDescriptionLength;
            
            // Add a blank line for spacing after each feature description
            requests.push({
                insertText: { location: { index: currentIndex }, text: '\n' },
            });
            currentIndex += 1;
        }
    }

    return { requests, newIndex: currentIndex };
}


/**
 * Converts a JSON string representing a structured document block into an array of Google Docs API requests.
 *
 * @param {string} jsonString - The JSON string to convert.
 * @param {number} initialIndex - The starting index in the Google Doc.
 * @returns {{requests: Array<Object>, endIndex: number}} An object containing the array of requests and the final index.
 */
function markdownToGoogleDocsRequests(jsonString, initialIndex = 1) {
    let requests = [];
    let currentIndex = initialIndex;

    try {
        const doc = JSON.parse(jsonString);
        const { block_type, data } = doc;

        let result;
        switch (block_type) {
            case 'SECTION_ACCORDION_LIST':
                result = generateAccordionListRequests(data, currentIndex);
                requests = result.requests;
                currentIndex = result.newIndex;
                break;
            case 'FEATURE_LIST_BLOCK':
                result = generateFeatureListRequests(data, currentIndex);
                requests = result.requests;
                currentIndex = result.newIndex;
                break;
            // Future block types can be handled here
            default:
                console.warn(`Unknown block_type: ${block_type}. Inserting as plain text.`);
                const fallbackText = JSON.stringify(data, null, 2) + '\n';
                requests.push({
                    insertText: { location: { index: currentIndex }, text: fallbackText },
                });
                currentIndex += fallbackText.length;
                break;
        }
    } catch (error) {
        console.error("Error parsing AI-generated JSON. Inserting raw string as fallback.", error);
        const fallbackText = jsonString + '\n';
        requests.push({
            insertText: { location: { index: currentIndex }, text: fallbackText },
        });
        currentIndex += fallbackText.length;
    }

    return { requests, endIndex: currentIndex };
}

module.exports = { markdownToGoogleDocsRequests };
