// google-api-program/google/formatConverter.js

/**
 * Extracts a CSS color string from a Google Docs Color object.
 * @param {object} colorObj The Color object from the Google Docs API.
 * @returns {string|null} A CSS color string (e.g., "rgb(255, 0, 0)") or null.
 */
function getColor(colorObj) {
  // The API response shows we are getting rgbColor, so we focus only on that.
  if (!colorObj?.rgbColor) return null;

  const rgb = colorObj.rgbColor;
  
  // Convert Google's 0-1 scale to standard 0-255.
  const r = Math.round((rgb.red || 0) * 255);
  const g = Math.round((rgb.green || 0) * 255);
  const b = Math.round((rgb.blue || 0) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}


function processTextRun(element) {
  let text = element.textRun.content;
  
  // Replace vertical tabs with newlines, but preserve other whitespace
  text = text.replace(/\v/g, '\n');

  if (!text) return ''; // Return if the content is empty after processing

  const textStyle = element.textRun.textStyle;
  let styledText = text;

  if (textStyle) {
    if (textStyle.bold) {
      styledText = `<strong>${styledText}</strong>`;
    }
    if (textStyle.italic) {
      styledText = `<em>${styledText}</em>`;
    }
    if (textStyle.underline) {
      styledText = `<u>${styledText}</u>`;
    }
    if (textStyle.strikethrough) {
      styledText = `<s>${styledText}</s>`;
    }

    let styles = [];
    
    // Handle foreground color
    const textColor = getColor(textStyle.foregroundColor?.color);
    if (textColor) {
      styles.push(`color: ${textColor}`);
    }

    // Handle background color
    const backgroundColor = getColor(textStyle.backgroundColor?.color);
    if (backgroundColor) {
      styles.push(`background-color: ${backgroundColor}`);
    }

    if (styles.length > 0) {
      styledText = `<span style="${styles.join('; ')}">${styledText}</span>`;
    }
  }

  return styledText;
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
