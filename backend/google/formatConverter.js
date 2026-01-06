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
  
  // Return plain text if there are no styles at all
  if (!textStyle) {
    return text;
  }
  
  // Apply simple tags first
  if (textStyle.italic) text = `<em>${text}</em>`;
  if (textStyle.bold) text = `<strong>${text}</strong>`;
  if (textStyle.strikethrough) text = `<s>${text}</s>`;
  
  // Handle color styles with a wrapping span
  const styles = [];
  if (textStyle.foregroundColor?.color?.rgbColor) {
    const { red = 0, green = 0, blue = 0 } = textStyle.foregroundColor.color.rgbColor;
    styles.push(`color: ${rgbToHex(red, green, blue)}`);
  }
  if (textStyle.backgroundColor?.color?.rgbColor) {
    const { red = 0, green = 0, blue = 0 } = textStyle.backgroundColor.color.rgbColor;
    styles.push(`background-color: ${rgbToHex(red, green, blue)}`);
  }

  if (styles.length > 0) {
    return `<span style="${styles.join('; ')}">${text}</span>`;
  }

  return text;
}


function googleDocsToHtml(content) {
  if (!content) return '';

  let html = '';
  let inList = false;

  for (let i = 0; i < content.length; i++) {
    const item = content[i];

    if (item.paragraph) {
      const paragraph = item.paragraph;
      const elements = paragraph.elements || [];

      // Check if the paragraph is effectively empty (contains only whitespace or newline characters)
      const fullText = elements.map(el => el.textRun?.content || '').join('');
      const isBlankLine = fullText.trim() === '';

      // **THE FIX**: If this is the last element in the document, and it's a blank line, skip it.
      // Google Docs often adds a final empty paragraph that we don't want to convert.
      if (i === content.length - 1 && isBlankLine) {
        continue;
      }

      if (isBlankLine) {
        if(inList) {
            html += '</ul>';
            inList = false;
        }
        html += `<p>&nbsp;</p>`;
        continue;
      }

      let innerHtml = (paragraph.elements || []).map(processTextRun).join('');
      
      // Remove trailing newline if it's from paragraph termination in Google Docs.
      // HTML <p> tags implicitly handle line breaks, so explicit \n is redundant.
      if (innerHtml.endsWith('\n')) {
        innerHtml = innerHtml.slice(0, -1);
      }
      // Replace any remaining internal vertical tabs (soft breaks) with <br> tags for HTML
      innerHtml = innerHtml.replace(/\v/g, '<br>');

      const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      const isListItem = !!paragraph.bullet;
      
      if (!inList && isListItem) {
          html += `<ul>`;
          inList = true;
      }
      if (inList && !isListItem) {
          html += `</ul>`;
          inList = false;
      }
      
      if (isListItem) {
        html += `<li><p>${innerHtml}</p></li>`;
      }
      else if (styleType.startsWith('HEADING_')) {
        const level = styleType.split('_')[1];
        html += `<h${level}>${innerHtml}</h${level}>`;
      } else {
        html += `<p>${innerHtml}</p>`;
      }
    }
  }

  if (inList) {
    html += `</ul>`;
  }

  return html.trim();
}

module.exports = { googleDocsToHtml };
