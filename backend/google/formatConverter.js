function processTextRun(element) {
  if (!element.textRun || !element.textRun.content) {
    return '';
  }
  let text = element.textRun.content;
  
  if (text === '\n') {
    return ''; // Paragraph breaks are handled by the parent function
  }

  const textStyle = element.textRun.textStyle;
  if (textStyle) {
    if (textStyle.strikethrough) text = `<s>${text}</s>`;
    if (textStyle.italic) text = `<em>${text}</em>`;
    if (textStyle.bold) text = `<strong>${text}</strong>`;
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
        html += `<p><br></p>`;
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
