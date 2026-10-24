import { useLayoutEffect, useRef } from 'react';
import { Tex } from '../kit';
import { Rich } from './Rich';
import { Figure } from './figures';
import { texText } from './texText';

/* ============================================================================
   EXAM PRACTICE — THE TUTOR'S HANDWRITING (a model answer, written in ink)
   ----------------------------------------------------------------------------
   Renders a leaf's Ink[] (papers/ink.js) onto the ruled answer space:
     w      Patrick Hand in blue-black ink, line-height = one ruled line, so
            the words sit on the paper's lines
     h      Caveat, blue pen
     eq     KaTeX in ink (+ a print-only plain-text twin)
     ul     a pen list, red dashes
     tbl    a small hand-ruled table
     fig    a pen sketch from ./figures.jsx (+ its one-line description,
            printed for the PDF's text layer)
     slip   the one quiet "Common slip:" line, grey
   Each block that earns marks carries a red-pen tick ("✓1") in the right
   margin, like a marker's. Blocks that aren't text (formulas, tables,
   sketches) are snapped to a whole number of ruled lines so the writing
   after them lands back on the lines. `write` plays the ink-in animation
   (CSS; reduced motion shows it at once).
   ========================================================================== */

export function Tick({ m }) {
  if (!m) return null;
  return (
    <span className="dlxp-tick" aria-label={`${m} mark${m === 1 ? '' : 's'}`}>
      <span aria-hidden="true">✓{m}</span>
    </span>
  );
}

// Keep a block's height a whole number of ruled lines (--rule on the sheet).
function Snap({ className, style, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      const rule = parseFloat(getComputedStyle(el).getPropertyValue('--rule')) || 34;
      el.style.minHeight = '';
      const hgt = el.getBoundingClientRect().height;
      el.style.minHeight = `${Math.max(1, Math.ceil(hgt / rule - 0.04)) * rule}px`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

function Block({ b, i }) {
  const style = { '--i': i };
  if (b.t === 'h') return <p className="dlxp-ink__h" style={style}><Rich text={b.text} /></p>;
  if (b.t === 'w') {
    return (
      <p className="dlxp-ink__w" style={style}>
        <Rich text={b.text} />
        <Tick m={b.m} />
      </p>
    );
  }
  if (b.t === 'eq') {
    return (
      <Snap className="dlxp-ink__eq" style={style}>
        <div className="dlxp-ink__scroll">
          <Tex src={b.tex} block />
          <span className="dlxp-texalt dlxp-texalt--block">{texText(b.tex)}</span>
        </div>
        <Tick m={b.m} />
      </Snap>
    );
  }
  if (b.t === 'ul') {
    return (
      <ul className="dlxp-ink__ul" style={style}>
        {b.items.map((it, j) => (
          <li key={j}>
            <Rich text={it.text} />
            <Tick m={it.m} />
          </li>
        ))}
      </ul>
    );
  }
  if (b.t === 'tbl') {
    return (
      <Snap className="dlxp-ink__tblwrap" style={style}>
        <div className="dlxp-ink__scroll">
          <table className="dlxp-ink__tbl">
            <thead>
              <tr>{b.head.map((c, j) => <th key={j}><Rich text={c} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>{r.map((c, k) => <td key={k}><Rich text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <Tick m={b.m} />
      </Snap>
    );
  }
  if (b.t === 'fig') {
    return (
      <Snap className="dlxp-ink__fig" style={style}>
        <Figure name={b.key} />
        <span className="dlxp-figdesc">{b.desc}</span>
        <Tick m={b.m} />
      </Snap>
    );
  }
  if (b.t === 'slip') {
    return (
      <p className="dlxp-ink__slip" style={style}>
        <span className="dlxp-ink__slipk">Common slip:</span> <Rich text={b.text} />
      </p>
    );
  }
  return null;
}

export function Ink({ answer, write = false, receipt, label }) {
  return (
    <div className={`dlxp-ink${write ? ' dlxp-ink--write' : ''}`}>
      {label && <p className="dlxp-ink__h dlxp-ink__sublabel" style={{ '--i': 0 }}>{label}</p>}
      {answer.map((b, i) => <Block key={i} b={b} i={i + (label ? 1 : 0)} />)}
      {receipt && <p className="dlxp-ink__receipt" style={{ '--i': answer.length + 1 }}>{receipt}</p>}
    </div>
  );
}
