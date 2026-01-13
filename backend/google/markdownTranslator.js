// google/markdownTranslator.js
const { marked } = require('marked');

/**
 * Converts a Markdown string into an array of Google Docs API requests.
 * This new version handles nested styles (bold, italic) within paragraphs and lists,
 * and correctly processes empty lines between blocks to avoid creating empty list items.
 * It also includes special logic to handle AI-generated patterns where a bolded list item
 * serves as a title for a subsequent list item that should be a paragraph.
 *
 * @param {string} markdown - The Markdown string to convert.
 * @param {number} initialIndex - The starting index in the Google Doc.
 * @returns {{requests: Array<Object>, endIndex: number}} An object containing the array of requests and the final index.
 */
function markdownToGoogleDocsRequests(markdown, initialIndex = 1) {
    const tokens = marked.lexer(markdown);
    const requests = [];
    let currentIndex = initialIndex;

    const processInline = (inlineTokens, startIndex) => {
        let text = '';
        const styles = [];

        function recurse(tokens) {
            for (const token of tokens) {
                const start = text.length;
                switch (token.type) {
                    case 'strong':
                        recurse(token.tokens);
                        styles.push({ type: 'bold', range: { start, end: text.length } });
                        break;
                    case 'em':
                        recurse(token.tokens);
                        styles.push({ type: 'italic', range: { start, end: text.length } });
                        break;
                    case 'text':
                        text += token.text;
                        break;
                    case 'br':
                        text += '\n';
                        break;
                    case 'list':
                        text += token.raw;
                        break;
                }
            }
        }

        recurse(inlineTokens);

        const googleDocsStyles = styles.map(style => {
            const styleRequest = {
                updateTextStyle: {
                    range: { startIndex: startIndex + style.range.start, endIndex: startIndex + style.range.end },
                    textStyle: {},
                    fields: '',
                },
            };
            if (style.type === 'bold') {
                styleRequest.updateTextStyle.textStyle.bold = true;
                styleRequest.updateTextStyle.fields = 'bold';
            } else if (style.type === 'italic') {
                styleRequest.updateTextStyle.textStyle.italic = true;
                styleRequest.updateTextStyle.fields = 'italic';
            }
            return styleRequest;
        });

        return { text, styles: googleDocsStyles };
    };

    for (const token of tokens) {
        if (token.type === 'space') {
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex += 1;
            continue;
        }

        if (token.type === 'heading') {
            const text = token.text + '\n';
            const textLength = text.length;
            requests.push({ insertText: { location: { index: currentIndex }, text } });
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
                    paragraphStyle: { namedStyleType: `HEADING_${token.depth}` },
                    fields: 'namedStyleType',
                },
            });
            currentIndex += textLength;
        } else if (token.type === 'paragraph') {
            const { text: rawText, styles } = processInline(token.tokens, currentIndex);
            const text = rawText + '\n';
            const textLength = text.length;

            if (textLength > 1 || (textLength === 1 && text !== '\n')) {
                requests.push({ insertText: { location: { index: currentIndex }, text } });
                requests.push(...styles);
                currentIndex += textLength;
            }
        } else if (token.type === 'list') {
            for (let i = 0; i < token.items.length; i++) {
                const item = token.items[i];
                const isTitleItem = item.tokens.length === 1 && item.tokens[0].type === 'strong';
                const nextItem = token.items[i + 1];
                const nextItemIsParagraph = nextItem && (nextItem.tokens.length !== 1 || nextItem.tokens[0].type !== 'strong');

                if (isTitleItem && nextItemIsParagraph) {
                    // This block handles the "bolded title list item" + "paragraph list item" pattern.
                    
                    // 1. Process the title item with a bullet point.
                    const { text: titleText, styles: titleStyles } = processInline(item.tokens, currentIndex);
                    const titleWithNewline = titleText.trimEnd() + '\n';
                    const titleLength = titleWithNewline.length;

                    if (titleLength > 1) {
                        requests.push({ insertText: { location: { index: currentIndex }, text: titleWithNewline } });
                        requests.push(...titleStyles);
                        requests.push({
                            createParagraphBullets: {
                                range: { startIndex: currentIndex, endIndex: currentIndex + titleLength },
                                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                            },
                        });
                        currentIndex += titleLength;
                    }

                    // 2. Process subsequent items as paragraphs (without bullets).
                    while (i + 1 < token.items.length && (token.items[i + 1].tokens.length !== 1 || token.items[i + 1].tokens[0].type !== 'strong')) {
                        i++; // Consume the paragraph item.
                        const paragraphItem = token.items[i];
                        const { text: paraText, styles: paraStyles } = processInline(paragraphItem.tokens, currentIndex);
                        const paraWithNewline = paraText.trimEnd() + '\n';
                        const paraLength = paraWithNewline.length;

                        if (paraLength > 1) {
                            requests.push({ insertText: { location: { index: currentIndex }, text: paraWithNewline } });
                            requests.push(...paraStyles); // Apply styles if any
                            currentIndex += paraLength;
                        }
                    }

                    // 3. Add a blank line between blocks.
                    if (i < token.items.length -1) { // Avoid adding a blank line at the very end
                        requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                        currentIndex += 1;
                    }

                } else {
                    // This is a regular list item.
                    const { text: rawText, styles } = processInline(item.tokens, currentIndex);
                    const text = rawText + '\n';
                    const textLength = text.length;

                    if (textLength > 1 || (textLength === 1 && text !== '\n')) {
                        requests.push({ insertText: { location: { index: currentIndex }, text } });
                        requests.push(...styles);
                        requests.push({
                            createParagraphBullets: {
                                range: { startIndex: currentIndex, endIndex: currentIndex + textLength },
                                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                            },
                        });
                        currentIndex += textLength;
                    }
                }
            }
        }
    }

    return { requests, endIndex: currentIndex };
}

module.exports = { markdownToGoogleDocsRequests };
