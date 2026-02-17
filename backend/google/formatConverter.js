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
 * This version correctly handles paragraphs, lists, and tables.
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

    // 1. Handle Section Breaks (Page Breaks)
    if (item.sectionBreak) {
      if (currentList) { html += `</${currentList.tag}>`; currentList = null; }
      // Only add a page break if we have content AND it's not the very last item
      if (html.length > 0 && i < content.length - 1) {
        html += '<!-- PAGE_BREAK -->';
      }
      continue;
    }

    // 2. Handle Tables
    if (item.table) {
      if (currentList) { html += `</${currentList.tag}>`; currentList = null; }

      const table = item.table;
      let tableStyle = '';
      const firstCell = table.tableRows[0]?.tableCells[0];
      const borderTop = firstCell?.tableCellStyle?.borderTop;
      const isWhite = borderTop?.color?.color?.rgbColor?.red === 1 && 
                      borderTop?.color?.color?.rgbColor?.green === 1 && 
                      borderTop?.color?.color?.rgbColor?.blue === 1;
      const isInvisible = !borderTop || !borderTop.width || borderTop.width.magnitude === 0 || isWhite;
      
      if (isInvisible) {
        tableStyle = ' class="border-none" style="border-collapse: collapse; border: none; width: 100%;"';
      } else {
        tableStyle = ' style="border-collapse: collapse; width: 100%;" border="1"';
      }

      html += `<table${tableStyle}><tbody>`;
      for (const row of table.tableRows) {
        html += '<tr>';
        for (const cell of row.tableCells) {
          html += `<td style="padding: 5px;">`;
          let cellHtml = '';
          let cellList = null;
          for (const cellItem of (cell.content || [])) {
            if (cellItem.paragraph) {
              const p = cellItem.paragraph;
              const b = p.bullet;
              const alignStyle = getAlignmentStyle(p.paragraphStyle?.alignment);
              let inner = (p.elements || []).map(processTextRun).join('').replace(/\v/g, '<br>');
              if (!b) {
                if (cellList) { cellHtml += `</${cellList.tag}>`; cellList = null; }
                const isBlank = inner.trim() === '';
                const styleType = p.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
                if (styleType.startsWith('HEADING_')) {
                  const level = styleType.split('_')[1];
                  cellHtml += `<h${level}${alignStyle}>${isBlank ? '&nbsp;' : inner}</h${level}>`;
                } else {
                  cellHtml += `<p${alignStyle}>${isBlank ? '&nbsp;' : inner}</p>`;
                }
              } else {
                const lid = b.listId;
                if (!cellList || cellList.id !== lid) {
                  if (cellList) { cellHtml += `</${cellList.tag}>`; }
                  const lp = lists[lid].listProperties;
                  const nl = lp.nestingLevels[b.nestingLevel || 0];
                  const tag = ['DECIMAL', 'ALPHA', 'ROMAN'].includes(nl.glyphType || '') ? 'ol' : 'ul';
                  cellHtml += `<${tag}>`;
                  cellList = { id: lid, tag: tag };
                }
                cellHtml += `<li><p${alignStyle}>${inner}</p></li>`;
              }
            }
          }
          if (cellList) cellHtml += `</${cellList.tag}>`;
          html += cellHtml || '&nbsp;';
          html += '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      continue;
    }

    // 3. Handle Paragraphs (and Page Breaks inside them)
    if (item.paragraph) {
      const paragraph = item.paragraph;

      // Check for Page Break inside paragraph
      if ((paragraph.elements || []).some(el => el.pageBreak)) {
        if (currentList) { html += `</${currentList.tag}>`; currentList = null; }
        // Only add if we have content and it's not the end
        if (html.length > 0 && i < content.length - 1) {
          html += '<!-- PAGE_BREAK -->';
        }
        continue;
      }

      const bullet = paragraph.bullet;
      const alignStyle = getAlignmentStyle(paragraph.paragraphStyle?.alignment);
      let innerHtml = (paragraph.elements || []).map(processTextRun).join('').replace(/\v/g, '<br>');

      if (!bullet) {
        if (currentList) { html += `</${currentList.tag}>`; currentList = null; }
        const styleType = paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
        if (styleType.startsWith('HEADING_')) {
          const level = styleType.split('_')[1];
          html += `<h${level}${alignStyle}>${innerHtml}</h${level}>`;
        } else {
            const isBlankLine = innerHtml.trim() === '';
            if (i === content.length - 1 && isBlankLine) continue;
            html += `<p${alignStyle}>${isBlankLine ? '&nbsp;' : innerHtml}</p>`;
        }
      } else {
        const listId = bullet.listId;
        if (!lists[listId]) continue;
        if (!currentList || currentList.id !== listId) {
          if (currentList) { html += `</${currentList.tag}>`; }
          const lp = lists[listId].listProperties;
          const nl = lp.nestingLevels[bullet.nestingLevel || 0];
          const tag = ['DECIMAL', 'ALPHA', 'ROMAN'].includes(nl.glyphType || '') ? 'ol' : 'ul';
          html += `<${tag}>`;
          currentList = { id: listId, tag: tag };
        }

        let fullListItemContent = `<p${alignStyle}>${innerHtml}</p>`;
        let lookaheadIndex = i + 1;
        while (
          lookaheadIndex < content.length &&
          content[lookaheadIndex].paragraph &&
          !content[lookaheadIndex].paragraph.bullet &&
          (content[lookaheadIndex].paragraph.paragraphStyle?.indentStart?.magnitude > 0)
        ) {
          const contentParagraph = content[lookaheadIndex].paragraph;
          const contentAlignStyle = getAlignmentStyle(contentParagraph.paragraphStyle?.alignment);
          const contentHtml = (contentParagraph.elements || []).map(processTextRun).join('').replace(/\v/g, '<br>');
          fullListItemContent += `<p${contentAlignStyle}>${contentHtml || '&nbsp;'}</p>`;
          lookaheadIndex++;
        }
        html += `<li>${fullListItemContent}</li>`;
        i = lookaheadIndex - 1;
      }
    }
  }

  if (currentList) { html += `</${currentList.tag}>`; }
  return html.trim();
}

module.exports = { googleDocsToHtml };
