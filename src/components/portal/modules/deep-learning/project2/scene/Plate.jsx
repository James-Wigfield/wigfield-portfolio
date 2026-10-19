import { cellsLabel, outLabel, inLabel } from '../nbutil';
import { cellDomId, plateDomId, useNb } from '../context';

/* ============================================================================
   DL PROJECT 2 — EXPLAINER PLATE
   ----------------------------------------------------------------------------
   An explainer is set like an illustrated plate in a printed book, so it can
   never be mistaken for a notebook cell: it leaves the notebook sheet, sits on
   the page ground between two rules, carries a plate number, and its stage
   wears crop marks. Inside, the rhythm is a ruled ledger —

     Task · How it works · What the notebook did · What came out

   — every number with a receipt (<R c={cellIndex}/> → "Out [n]" that scrolls
   to the cell; <R src="log"/> / <R src="handover"/> for experiments that are
   not in the notebook).
   ========================================================================== */

export function Plate({ meta, id = meta?.id, no = meta?.no, kicker = meta?.kicker, title = meta?.title, cells, children }) {
  const { jumpTo } = useNb();
  const [from, to] = cells || [];
  return (
    <section className="dlp2-plate" id={plateDomId(id)} aria-labelledby={`${plateDomId(id)}-h`}>
      <header className="dlp2-plate__head">
        <p className="dlp2-plate__kicker">
          <span className="dlp2-plate__no">Plate {no}</span>
          {kicker && <span className="dlp2-plate__sec">{kicker}</span>}
        </p>
        <h3 className="dlp2-plate__title" id={`${plateDomId(id)}-h`} tabIndex={-1}>{title}</h3>
        {cells && (
          <button type="button" className="dlp2-plate__explains" onClick={() => jumpTo(cellDomId(from))}>
            explains {cellsLabel(from, to)}
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
              <path d="M6 2.5v7M3 6.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </header>
      <div className="dlp2-plate__body">{children}</div>
    </section>
  );
}

export function Row({ label, children, wide = false }) {
  return (
    <div className={`dlp2-row${wide ? ' dlp2-row--wide' : ''}`}>
      <p className="dlp2-row__label">{label}</p>
      <div className="dlp2-row__body">{children}</div>
    </div>
  );
}

const SRC = { log: 'experiments/log.md', handover: 'handover', data: 'temperatures-2026.pkl', brief: 'the brief' };

// <R c={k} /> cites what code cell k PRINTS ("Out [n]"); <R c={k} code /> cites
// a fact that lives in its code ("In [n]"), e.g. a learning rate or a comment.
export function R({ c, src, code = false, children }) {
  const { jumpTo } = useNb();
  if (src) return <span className="dlp2-r">{children || SRC[src] || src}</span>;
  const text = children || (code ? inLabel(c) : outLabel(c));
  return (
    <button type="button" className="dlp2-r dlp2-r--link" onClick={() => jumpTo(cellDomId(c))} title={`Scroll to cell ${c} of the notebook`}>
      {text}
    </button>
  );
}

/* A short paragraph in the plate voice. */
export function P({ children }) {
  return <p className="dlp2-p">{children}</p>;
}
