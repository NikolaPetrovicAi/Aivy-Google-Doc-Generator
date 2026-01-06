// google/markdownTranslator.js
const { marked } = require('marked');

/**
 * Converts a Markdown string into an array of Google Docs API requests.
 * @param {string} markdown - The Markdown string to convert.
 * @returns {Array<Object>} An array of Google Docs API request objects.
 */
function markdownToGoogleDocsRequests(markdown, initialIndex = 1) {
  const tokens = marked.lexer(markdown);
  const requests = [];
  let currentIndex = initialIndex;

  for (const token of tokens) {
    if (token.type === 'heading') {
      const text = token.text + '\n';
      const textLength = text.length;
      const headingLevel = `HEADING_${token.depth}`;

      // 1. Insert the heading text
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: text,
        },
      });

      // 2. Style the paragraph as a heading
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + textLength,
          },
          paragraphStyle: {
            namedStyleType: headingLevel,
          },
          fields: 'namedStyleType',
        },
      });
      currentIndex += textLength;
    } else if (token.type === 'paragraph') {
      const text = token.text + '\n';
      const textLength = text.length;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: text,
        },
      });
      currentIndex += textLength;
    } else if (token.type === 'list') {
      for (const item of token.items) {
        // Check if the list item is blank
        if (item.text.trim() === '') {
          // If it's blank, just insert a newline character without a bullet
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: '\n',
            },
          });
          currentIndex += 1;
        } else {
          // If it has content, process it as a normal list item
          const text = item.text + '\n';
          const textLength = text.length;
          
          // 1. Insert the list item text
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: text,
            },
          });

          // 2. Apply the bullet point
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + textLength,
              },
              bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
            },
          });
          currentIndex += textLength;
        }
      }
    } else {
      // For other token types (like 'space'), just insert the raw text if it exists.
      const text = (token.raw || '') + '\n';
       if (text.trim()) {
         const textLength = text.length;
         requests.push({
           insertText: {
             location: { index: currentIndex },
             text: text,
           },
         });
         currentIndex += textLength;
       }
    }
  }

  return { requests, endIndex: currentIndex };
}

module.exports = { markdownToGoogleDocsRequests };
