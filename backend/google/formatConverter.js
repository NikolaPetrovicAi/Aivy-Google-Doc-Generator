function componentToHex(c) {
  const scaled = Math.round(c * 255);
  const hex = scaled.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function processTextRun(element) {
  if (!element.textRun || !element.textRun.content) {
    return '';
  }
  let text = element.textRun.content;
  
  if (text === '\n') {
    return ''; // Paragraph breaks are handled by the parent function
  }

  const textStyle = element.textRun.textStyle;
  
  if (!textStyle) {
    return text;
  }
  
  if (textStyle.italic) text = `<em>${text}</em>`;
  if (textStyle.bold) text = `<strong>${text}</strong>`;
  if (textStyle.strikethrough) text = `<s>${text}</s>`;
  
  const styles = [];
  if (textStyle.foregroundColor?.color?.rgbColor) {
    const { red = 0, green = 0, blue = 0 } = textStyle.foregroundColor.color.rgbColor;
    styles.push(`color: ${rgbToHex(red, green, blue)}`);
  }
  if (textStyle.backgroundColor?.color?.rgbColor) {
    const { red = 0, green = 0, blue = 0 } = textStyle.backgroundColor.color.rgbColor;
    styles.push(`background-color: ${rgbToHex(red, green, blue)}`);
  }

  if (textStyle.weightedFontFamily?.fontFamily) {
    styles.push(`font-family: '${textStyle.weightedFontFamily.fontFamily}'`);
  }

  if (styles.length > 0) {
    return `<span style="${styles.join('; ')}">${text}</span>`;
  }

  return text;
}

function getAlignmentStyle(alignment) {
  if (!alignment) return '';
  const map = {
    'START': 'left',
    'CENTER': 'center',
    'END': 'right',
    'JUSTIFIED': 'justify'
  };
  const cssValue = map[alignment.toUpperCase()];
  return cssValue ? ` style="text-align: ${cssValue};"` : '';
}


/**
 * Converts a full Google Docs document object to an HTML string.
 * This version correctly differentiates between ordered (numbered) and unordered (bullet) lists.
 * @param {object} doc - The full Google Docs document object.
 */
function googleDocsToHtml(doc) {
  if (!doc || !doc.body || !doc.body.content) return '';

  const content = doc.body.content;
  const lists = doc.lists;
  let html = '';
  let currentList = null; // Tracks the current list state { id: string, tag: 'ul' | 'ol' }

  for (let i = 0; i < content.length; i++) {
    const item = content[i];

    if (item.paragraph) {
      const paragraph = item.paragraph;
      const bullet = paragraph.bullet;
      
      const align = paragraph.paragraphStyle?.alignment;
      const alignStyle = getAlignmentStyle(align);

      let innerHtml = (paragraph.elements || []).map(processTextRun).join('');
      innerHtml = innerHtml.replace(/\v/g, '<br>');

      // Logic to close a list if the current paragraph is not a list item
      if (!bullet) {
        if (currentList) {
          html += `</${currentList.tag}>`;
          currentList = null;
        }

        // Handle headings and normal paragraphs
        const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
        if (styleType.startsWith('HEADING_')) {
          const level = styleType.split('_')[1];
          html += `<h${level}${alignStyle}>${innerHtml}</h${level}>`;
        } else {
            const isBlankLine = innerHtml.trim() === '';
            if (i === content.length - 1 && isBlankLine) continue; // Skip final blank line
            html += `<p${alignStyle}>${isBlankLine ? '&nbsp;' : innerHtml}</p>`;
        }
      } else { // This paragraph is a list item
        const listId = bullet.listId;
        if (!lists[listId]) continue; // Skip if list definition is missing

        // --- LIST START/CONTINUATION LOGIC ---
        if (!currentList || currentList.id !== listId) {
          if (currentList) {
            html += `</${currentList.tag}>`;
          }
          const listProperties = lists[listId].listProperties;
          const nestingLevel = listProperties.nestingLevels[bullet.nestingLevel || 0];
          const glyphType = nestingLevel.glyphType || '';
          const listTag = ['DECIMAL', 'ALPHA', 'ROMAN'].includes(glyphType) ? 'ol' : 'ul';
          
          html += `<${listTag}>`;
          currentList = { id: listId, tag: listTag };
        }

        // --- LOOKAHEAD LOGIC TO BUILD FULL LIST ITEM CONTENT ---
        let fullListItemContent = `<p${alignStyle}>${innerHtml}</p>`; // Start with the bulleted paragraph

        let lookaheadIndex = i + 1;
        // Check for subsequent paragraphs that belong to this list item
        while (
          lookaheadIndex < content.length &&
          content[lookaheadIndex].paragraph &&
          !content[lookaheadIndex].paragraph.bullet && // Must not be another bullet point
          (content[lookaheadIndex].paragraph.paragraphStyle?.indentStart?.magnitude > 0) // Must be indented
        ) {
          const contentParagraph = content[lookaheadIndex].paragraph;
          const contentAlign = contentParagraph.paragraphStyle?.alignment;
          const contentAlignStyle = getAlignmentStyle(contentAlign);

          const contentHtml = (contentParagraph.elements || []).map(processTextRun).join('').replace(/\v/g, '<br>');
          
          if (contentHtml.trim() !== '') {
            fullListItemContent += `<p${contentAlignStyle}>${contentHtml}</p>`;
          } else {
            fullListItemContent += `<p${contentAlignStyle}>&nbsp;</p>`; // Handle blank lines
          }
          
          lookaheadIndex++; // Consume this paragraph
        }
        
        html += `<li>${fullListItemContent}</li>`;

        // Jump the main loop forward past the paragraphs we just consumed
        i = lookaheadIndex - 1;
      }
    }
  }

  // Close any list that's still open at the end of the document
  if (currentList) {
    html += `</${currentList.tag}>`;
  }

  return html.trim();
}

module.exports = { googleDocsToHtml };
