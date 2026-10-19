import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from './md';
import { pyLines } from './pyTokens';
import { cellDomId } from './context';
import { prefersReducedMotion } from './scene/motion';
import { FIG_CAPTIONS } from './figcaps';

/* ============================================================================
   DL PROJECT 2 — ONE NOTEBOOK CELL
   ----------------------------------------------------------------------------
   A markdown cell renders through ./md.js; a code cell is an `In [n]:` gutter
   plus a VS Code Dark+ editor (kit token colours), then its outputs in
   Jupyter's own order: stream text, Out[n] for an execute_result only (as
   Jupyter does), images as the real PNGs, text/plain in monospace with the
   Keras summary box-drawing intact. stderr is folded to one line by default
   (it is TensorFlow log noise) and prints as a one-line note.

   Collapsing input or output only hides it on screen — the DOM keeps it, so
   print always shows every cell expanded.

   Flavour: the first time a code cell scrolls into view its prompt ticks
   In [*] → In [n]. It touches only the prompt text, never hides content, and
   is skipped under reduced motion and in print.
   ========================================================================== */

const FIG_URLS = import.meta.glob('./figures/*.png', { eager: true, query: '?url', import: 'default' });
const figUrl = (name) => FIG_URLS[`./figures/${name}`];

function CodeEditor({ src }) {
  const lines = useMemo(() => pyLines(src), [src]);
  return (
    <pre className="dlp2-code">
      <code className="dlp2-code__code">
        {lines.map((toks, i) => (
          <span className="dlp2-code__line" key={i}>
            {toks.map((tok, j) => (tok.cls ? <span key={j} className={tok.cls}>{tok.t}</span> : tok.t))}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  );
}

function StreamOut({ o }) {
  const [open, setOpen] = useState(false);
  const text = o.text.replace(/\n$/, '');
  if (o.name !== 'stderr') return <pre className="dlp2-out__text">{text}</pre>;
  const first = text.split('\n')[0];
  const what = o.noise ? 'TensorFlow log' : 'stderr';
  return (
    <div className={`dlp2-err${open ? ' dlp2-err--open' : ''}`}>
      <button type="button" className="dlp2-err__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="dlp2-err__chev" aria-hidden="true" />
        <span className="dlp2-err__kind">stderr</span>
        <span className="dlp2-err__sum">
          {o.lines} line{o.lines === 1 ? '' : 's'} · {what}
        </span>
        <span className="dlp2-err__first">{first}</span>
      </button>
      <pre className="dlp2-err__body">{text}</pre>
      <p className="dlp2-err__print">
        [stderr: {o.lines} line{o.lines === 1 ? '' : 's'} of {o.noise ? 'TensorFlow/CUDA start-up log' : 'warnings'} omitted from this print]
      </p>
    </div>
  );
}

function Output({ o, cellIdx, ec, k, nFigs }) {
  if (o.kind === 'stream') return <StreamOut o={o} />;
  if (o.kind === 'error') {
    return <pre className="dlp2-out__text dlp2-out__text--error">{o.traceback || `${o.ename}: ${o.evalue}`}</pre>;
  }
  if (o.png) {
    const src = figUrl(o.png);
    const w = o.dispW || o.w;
    const cap = FIG_CAPTIONS[o.png];
    const which = `Figure${nFigs > 1 ? ` ${k + 1} of ${nFigs}` : ''} · Out [${ec ?? ' '}]`;
    return (
      <figure className="dlp2-fig">
        {src ? (
          <img
            src={src}
            alt={cap || `Figure ${k + 1} output by cell ${cellIdx}${o.text ? ` (${o.text.trim()})` : ''}`}
            width={o.w}
            height={o.h}
            style={{ width: w ? `min(100%, ${w}px)` : undefined }}
            decoding="async"
          />
        ) : (
          <span className="dlp2-fig__missing">figure {o.png} not extracted</span>
        )}
        {/* print only: the PDF's text layer has no trace of a plot otherwise */}
        <figcaption className="dlp2-fig__print">
          <b>{which}</b>
          {cap ? ` · ${cap}` : ''}
        </figcaption>
      </figure>
    );
  }
  if (o.text !== undefined) {
    return <pre className={`dlp2-out__text${o.fromHtml ? ' dlp2-out__text--html' : ''}`}>{o.text.replace(/\n$/, '')}</pre>;
  }
  return null;
}

// Keras summaries arrive as separate outputs (title, table, three param lines):
// group each run from 'Model: "…"' to its last params line so print keeps it whole
const isHead = (o) => o.text !== undefined && /^Model: "/.test(o.text);
const isTail = (o) => o.text !== undefined && /^\s*(Total|Trainable|Non-trainable) params/.test(o.text);
function groupOutputs(outs) {
  const groups = [];
  for (let k = 0; k < outs.length; k += 1) {
    if (!isHead(outs[k])) {
      groups.push({ ks: [k] });
      continue;
    }
    let end = k;
    for (let j = k + 1; j < outs.length && !isHead(outs[j]); j += 1) if (isTail(outs[j])) end = j;
    groups.push({ ks: Array.from({ length: end - k + 1 }, (_, n) => k + n), summary: end > k });
    k = end;
  }
  return groups;
}

function Prompt({ kind, ec, ticking }) {
  const n = ec === null || ec === undefined ? ' ' : ec;
  return (
    <span className={`dlp2-prompt${ticking ? ' dlp2-prompt--run' : ''}`}>
      {kind}&nbsp;[<span className="dlp2-prompt__n">{ticking ? '*' : n}</span>]:
    </span>
  );
}

function Collapser({ collapsed, onClick, label }) {
  return (
    <button type="button" className={`dlp2-collapser${collapsed ? ' dlp2-collapser--shut' : ''}`} aria-expanded={!collapsed} aria-label={label} title={label} onClick={onClick}>
      <span aria-hidden="true" />
    </button>
  );
}

function useTick(enabled) {
  const ref = useRef(null);
  const [ticking, setTicking] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTicking(true);
        timer = window.setTimeout(() => setTicking(false), 520);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return [ref, ticking];
}

const CodeCell = memo(function CodeCell({ cell, inShut, outShut, onToggle }) {
  const [ref, ticking] = useTick(true);
  const outs = cell.outputs || [];
  const nLines = cell.src.replace(/\n$/, '').split('\n').length;
  const resultIdx = outs.findIndex((o) => o.kind === 'execute_result');
  const groups = useMemo(() => groupOutputs(cell.outputs || []), [cell.outputs]);
  const nFigs = outs.filter((x) => x.png).length;
  const out = (k) => <Output key={k} o={outs[k]} cellIdx={cell.i} ec={cell.ec} k={outs.slice(0, k).filter((x) => x.png).length} nFigs={nFigs} />;
  return (
    <div className={`dlp2-cell dlp2-cell--code${nLines <= 15 ? ' dlp2-cell--short' : ''}`} id={cellDomId(cell.i)} data-cell={cell.i}>
      <div className={`dlp2-cell__row${inShut ? ' dlp2-cell__row--shut' : ''}`} ref={ref}>
        <div className="dlp2-gutter">
          <Collapser collapsed={inShut} onClick={() => onToggle('in', cell.i)} label={`${inShut ? 'Expand' : 'Collapse'} the code of In [${cell.ec ?? ' '}]`} />
          <Prompt kind="In" ec={cell.ec} ticking={ticking} />
        </div>
        <div className="dlp2-cell__body">
          <div className="dlp2-cell__fold">
            <CodeEditor src={cell.src} />
          </div>
          <button type="button" className="dlp2-cell__stub" onClick={() => onToggle('in', cell.i)}>
            ··· {nLines} line{nLines === 1 ? '' : 's'} of code hidden
          </button>
        </div>
      </div>
      {outs.length > 0 && (
        <div className={`dlp2-cell__row dlp2-cell__row--out${outShut ? ' dlp2-cell__row--shut' : ''}`}>
          <div className="dlp2-gutter">
            <Collapser collapsed={outShut} onClick={() => onToggle('out', cell.i)} label={`${outShut ? 'Expand' : 'Collapse'} the output of In [${cell.ec ?? ' '}]`} />
            {resultIdx >= 0 && <Prompt kind="Out" ec={outs[resultIdx].ec ?? cell.ec} />}
          </div>
          <div className="dlp2-cell__body">
            <div className="dlp2-cell__fold dlp2-outs">
              {groups.map((g) =>
                g.summary ? (
                  <div className="dlp2-summary" key={`s${g.ks[0]}`}>
                    {g.ks.map(out)}
                  </div>
                ) : (
                  out(g.ks[0])
                ),
              )}
            </div>
            <button type="button" className="dlp2-cell__stub" onClick={() => onToggle('out', cell.i)}>
              ··· {outs.length} output{outs.length === 1 ? '' : 's'} hidden
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const MarkdownCell = memo(function MarkdownCell({ cell }) {
  const blocks = useMemo(
    () => renderMarkdown(cell.src, { headingIds: (cell.headings || []).map((x) => x.id), keyPrefix: `c${cell.i}` }),
    [cell],
  );
  const lead = cell.headings?.[0];
  const isTitle = cell.i === 0;
  return (
    <div
      className={`dlp2-cell dlp2-cell--md${isTitle ? ' dlp2-cell--title' : ''}${lead && /^\s*#\s/.test(cell.src) && !isTitle ? ' dlp2-cell--part' : ''}`}
      id={cellDomId(cell.i)}
      data-cell={cell.i}
    >
      <div className="dlp2-cell__row">
        <div className="dlp2-gutter" aria-hidden="true" />
        <div className="dlp2-cell__body dlp2-md">{blocks}</div>
      </div>
    </div>
  );
});

export default function Cell({ cell, inShut, outShut, onToggle }) {
  if (cell.type === 'code') return <CodeCell cell={cell} inShut={inShut} outShut={outShut} onToggle={onToggle} />;
  if (cell.type === 'markdown') return <MarkdownCell cell={cell} />;
  return (
    <div className="dlp2-cell dlp2-cell--raw" id={cellDomId(cell.i)} data-cell={cell.i}>
      <div className="dlp2-cell__row">
        <div className="dlp2-gutter" aria-hidden="true" />
        <pre className="dlp2-cell__body dlp2-out__text">{cell.src}</pre>
      </div>
    </div>
  );
}
