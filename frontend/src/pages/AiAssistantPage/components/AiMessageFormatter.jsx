import React from 'react';

/**
 * Lightweight, zero-dependency Markdown formatter for CraveToBuild AI responses.
 * Safely parses headers, tables, bullet points, numbered lists, blockquotes, code, and bold text.
 */
export default function AiMessageFormatter({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;
  let listItems = [];
  let listType = null; // 'ul' | 'ol'

  const flushTable = (key) => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1).filter(r => !r.isSeparator);

    elements.push(
      <div key={`table-${key}`} className="ai-table-wrapper">
        <table className="ai-markdown-table">
          <thead>
            <tr>
              {headerRow.cells.map((cell, cIdx) => (
                <th key={cIdx}>{formatInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.cells.map((cell, cIdx) => (
                  <td key={cIdx}>{formatInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  const flushList = (key) => {
    if (listItems.length === 0) return;
    if (listType === 'ol') {
      elements.push(
        <ol key={`list-${key}`} className="ai-markdown-ol">
          {listItems.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`list-${key}`} className="ai-markdown-ul">
          {listItems.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 1. Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(index);
      inTable = true;
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push({ cells, isSeparator });
      return;
    } else if (inTable) {
      flushTable(index);
    }

    // 2. Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList(index);
      elements.push(<hr key={`hr-${index}`} className="ai-markdown-hr" />);
      return;
    }

    // 3. Headers
    if (trimmed.startsWith('#### ')) {
      flushList(index);
      elements.push(<h4 key={`h4-${index}`} className="ai-markdown-h4">{formatInline(trimmed.slice(5))}</h4>);
      return;
    }
    if (trimmed.startsWith('### ')) {
      flushList(index);
      elements.push(<h3 key={`h3-${index}`} className="ai-markdown-h3">{formatInline(trimmed.slice(4))}</h3>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList(index);
      elements.push(<h2 key={`h2-${index}`} className="ai-markdown-h2">{formatInline(trimmed.slice(3))}</h2>);
      return;
    }

    // 4. Blockquote
    if (trimmed.startsWith('> ')) {
      flushList(index);
      elements.push(
        <blockquote key={`bq-${index}`} className="ai-markdown-blockquote">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // 5. Unordered List item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (listType !== 'ul') {
        flushList(index);
        listType = 'ul';
      }
      listItems.push(trimmed.slice(2));
      return;
    }

    // 6. Ordered List item (e.g. "1. ")
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList(index);
        listType = 'ol';
      }
      listItems.push(olMatch[2]);
      return;
    }

    // Not a list item
    flushList(index);

    // 7. Empty line
    if (!trimmed) {
      return;
    }

    // 8. Standard paragraph
    elements.push(
      <p key={`p-${index}`} className="ai-markdown-p">
        {formatInline(trimmed)}
      </p>
    );
  });

  // Flush any remaining tables or lists
  if (inTable) flushTable('end');
  flushList('end');

  return <div className="ai-message-markdown">{elements}</div>;
}

/**
 * Parses bold (**text**), italics (*text*), inline code (`code`), and linebreaks within a string
 */
function formatInline(text) {
  if (!text) return null;

  // Split by inline code first
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={pIdx} className="ai-markdown-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold (**...**) within non-code parts
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
        return <strong key={`${pIdx}-${bIdx}`}>{bPart.slice(2, -2)}</strong>;
      }

      // Process italics (*...*)
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length >= 2) {
          return <em key={`${pIdx}-${bIdx}-${iIdx}`}>{iPart.slice(1, -1)}</em>;
        }
        return iPart;
      });
    });
  });
}

