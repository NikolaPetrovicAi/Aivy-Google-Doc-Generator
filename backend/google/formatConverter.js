// google-api-program/google/formatConverter.js

function processTextRun(element) {
  let text = element.textRun.content;
  
  // Replace tabs with spaces and trim lines
  text = text.replace(/\t/g, ' ').replace(/\v/g, '\n').trim();

  if (!text.trim()) return '';

  const textStyle = element.textRun.textStyle;
  if (textStyle) {
    if (textStyle.bold) {
      text = `<strong>${text}</strong>`;
    }
    if (textStyle.italic) {
      text = `<em>${text}</em>`;
    }
    if (textStyle.underline) {
      text = `<u>${text}</u>`;
    }
    if (textStyle.strikethrough) {
      text = `<s>${text}</s>`;
    }
  }
  return text;
}

function googleDocsToHtml(content) {
  let html = '';
  let inList = false;

  for (const item of content) {
    if (item.paragraph) {
      const paragraph = item.paragraph;
      const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      
      const isListItem = !!paragraph.bullet;

      // Close list if the current paragraph is not a list item
      if (inList && !isListItem) {
        html += '</ul>';
        inList = false;
      }

      // Start a new list if the current paragraph is a list item and we're not in one
      if (isListItem && !inList) {
        html += '<ul>';
        inList = true;
      }

      let innerHtml = (paragraph.elements || []).map(processTextRun).join('');

      if (!innerHtml.trim()) continue; // Skip empty paragraphs

      if (isListItem) {
        html += `<li>${innerHtml}</li>`;
      } else if (styleType.startsWith('HEADING_')) {
        const level = styleType.split('_')[1];
        html += `<h${level}>${innerHtml}</h${level}>`;
      } else {
        html += `<p>${innerHtml}</p>`;
      }
    }
  }

  // Close any open list at the end
  if (inList) {
    html += '</ul>';
  }

  return html;
}

module.exports = { googleDocsToHtml };
