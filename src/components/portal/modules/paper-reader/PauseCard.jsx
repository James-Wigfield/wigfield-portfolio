import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Icon from '../../icons';
import { parseMarkdownTable, isNumericCell } from './mdTable';

/* ============================================================================
   RSVP PAPERS — pause card for a float (figure / table / equation / algorithm)
   ----------------------------------------------------------------------------
   Playback stops on the card; it shows the label and the plain-English caption
   the chat Claude wrote. When `content` is present the card can expand: a
   table renders as a real <table> (markdown → rows), an equation through
   KaTeX (display mode, errors rendered inline rather than thrown), an
   algorithm as a mono <pre>. Continue = space / → / the button.
   ========================================================================== */

const KIND = {
  figure: { label: 'Figure', detail: null },
  table: { label: 'Table', detail: 'Show table' },
  equation: { label: 'Equation', detail: 'Show equation' },
  algorithm: { label: 'Algorithm', detail: 'Show pseudocode' },
};

export default function PauseCard({ block, expanded, onToggle, onContinue, autoSeconds }) {
  const kind = KIND[block.type] || KIND.figure;
  const hasDetail = Boolean(block.content && block.content.trim());
  return (
    <div className={`rsv-card rsv-card--${block.type}`} role="group" aria-label={`${block.label || kind.label} — paused`}>
      <p className="rsv-card__eyebrow">
        <span className="rsv-dot rsv-dot--pause" aria-hidden="true" />
        {(block.label || kind.label).toUpperCase()}
        <span className="rsv-card__sep">·</span>
        {autoSeconds ? `CONTINUES IN ${autoSeconds}s` : 'PAUSED'}
      </p>
      {block.caption && <p className="rsv-card__caption">{block.caption}</p>}
      {!block.caption && <p className="rsv-card__caption rsv-card__caption--none">No caption was provided for this {kind.label.toLowerCase()}.</p>}

      {hasDetail && expanded && (
        <div className="rsv-card__detail">
          <Detail block={block} />
        </div>
      )}

      <div className="rsv-card__actions">
        {hasDetail && (
          <button type="button" className="rsv-btn" onClick={onToggle} aria-expanded={expanded}>
            <Icon name="chevron" size={12} /> {expanded ? 'Hide detail' : kind.detail || 'Show detail'}
          </button>
        )}
        <button type="button" className="rsv-btn rsv-btn--solid" onClick={onContinue}>
          <Icon name="play" size={13} /> Continue <kbd>space</kbd>
        </button>
      </div>
    </div>
  );
}

function Detail({ block }) {
  if (block.type === 'table') {
    const t = parseMarkdownTable(block.content);
    if (!t) return <pre className="rsv-pre">{block.content}</pre>;
    return (
      <div className="rsv-table-wrap">
        <table className="rsv-table">
          <thead>
            <tr>{t.header.map((h, i) => <th key={i} style={{ textAlign: t.align[i] || undefined }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className={isNumericCell(c) ? 'rsv-table__num' : undefined} style={{ textAlign: t.align[ci] || undefined }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === 'equation') return <Katex src={block.content} />;
  return <pre className="rsv-pre">{block.content}</pre>;
}

// KaTeX in display mode. `throwOnError: false` prints the offending source in
// place of crashing on LaTeX the chat Claude got slightly wrong.
function Katex({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(src, ref.current, { throwOnError: false, displayMode: true, strict: 'ignore' });
    } catch {
      ref.current.textContent = src;
    }
  }, [src]);
  return <div ref={ref} className="rsv-katex" />;
}
