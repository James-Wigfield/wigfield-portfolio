import { useRef, useState } from 'react';

/* ============================================================================
   TRAINING RUNS — ANALYSIS KIT
   ----------------------------------------------------------------------------
   The shared building blocks every run-analysis page is composed from. A run
   page should be assembled ONLY from these components (plus plain text) so all
   runs read as one set — if a new run genuinely needs a new visual, add it
   HERE so the next run gets it too, don't inline it in the run page.

   Components:
     <RunPage run>                 page shell — header built from the run's
                                   registry entry (single source of truth)
     <Verdict tone lead>…</>       the one-paragraph takeaway banner
     <Section label note>…</>      labelled section wrapper
     <Prose>…</>                   explanatory paragraph inside a Section
     <StatGrid stats>              headline metric cards  [{ v, k, note? }]
     <LineChart …>                 curves over steps — see contract below
     <FigureGrid> + <Figure …>     W&B PNG exports (see ../figures/README.md)
     <MetricTable …>               comparison table (e.g. vs nnU-Net)
     <Findings items>              observations  [{ tone, t, why }]
     <NextSteps items>             what the NEXT run changes  [{ t, why? }]
     <CodeBlock label text>        log / console excerpt with a copy button

   CHART RULES (non-negotiable):
     • One measure per chart — a loss chart and a Dice chart, never a dual
       axis. Series share the chart only if they share the unit.
     • ≤ 4 series per chart. Series colours are --trx-s1…s4, a CVD-safe
       categorical set validated on all three portal theme surfaces (jade &
       coral light, arcade dark). The ORDER is the safety mechanism — assign
       s1, s2, … in order, never skip, reorder or invent hues.
     • On the light themes s2–s4 sit under 3:1 contrast, which is legal only
       because the chart always draws its ink-coloured legend + direct end
       labels — never disable those.
   Tones ('good' | 'warn' | 'bad') are status colours: they must always sit
   next to a text label, never carry meaning alone.
   ========================================================================== */

const STATUS = {
  complete: { label: 'complete', cls: 'good' },
  'in-progress': { label: 'in progress', cls: 'live' },
  aborted: { label: 'aborted', cls: 'bad' },
};

export function RunPage({ run, children }) {
  const status = STATUS[run.status] || STATUS.complete;
  const meta = [
    { k: 'date', v: run.date },
    { k: 'machine', v: run.machine },
    { k: 'config', v: run.config },
    ...(run.meta || []),
  ];
  return (
    <div className="trx">
      <style>{KIT_CSS}</style>
      <header className="pt-card trx-head">
        <div className="trx-head__row">
          <span className="trx-runno">RUN {String(run.n).padStart(2, '0')}</span>
          <span className={`trx-status trx-status--${status.cls}`}>{status.label}</span>
          {run.sample && <span className="trx-flag">sample — fabricated numbers</span>}
        </div>
        <h3 className="trx-title">{run.title}</h3>
        <p className="trx-sub">{run.summary}</p>
        <div className="trx-meta">
          {meta.filter((m) => m.v).map((m) => (
            <span key={m.k} className="trx-meta__chip"><span>{m.k}</span>{m.v}</span>
          ))}
        </div>
      </header>
      {children}
    </div>
  );
}

const TONE_WORD = { good: 'good', warn: 'mixed', bad: 'poor' };

export function Verdict({ tone = 'good', lead, children }) {
  return (
    <div className={`trx-verdict trx-verdict--${tone}`}>
      <p className="trx-verdict__tag"><span className="trx-dot" />verdict · {TONE_WORD[tone]}</p>
      <p className="trx-verdict__lead">{lead}</p>
      {children && <p className="trx-verdict__sub">{children}</p>}
    </div>
  );
}

export function Section({ label, note, children }) {
  return (
    <section className="trx-sec">
      <p className="trx-sec__label">{label}{note && <span className="trx-sec__note">{note}</span>}</p>
      {children}
    </section>
  );
}

/* A paragraph of explanatory copy inside a Section — for the rare case where a
   section needs framing before its component (e.g. "here is why this list
   exists"). Measure-capped like the verdict's sub so body text never runs the
   full width of a wide viewport. Prefer the section `note` for one-liners. */
export function Prose({ children }) {
  return <p className="trx-prose">{children}</p>;
}

export function StatGrid({ stats }) {
  return (
    <div className="trx-stats">
      {stats.map((s) => (
        <div key={s.k} className="pt-card trx-stat">
          <span className="trx-stat__v">{s.v}</span>
          <span className="trx-stat__k">{s.k}</span>
          {s.note && <span className="trx-stat__n">{s.note}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---- LineChart -------------------------------------------------------------
   <LineChart yLabel="loss" xLabel="step"
              series={[{ name: 'train', data: [[step, value], …] }, …]}
              yDomain={[0, 1]} />                       // optional, else auto
   Curves over training steps. Draws hairline grid, 2px lines, a legend for
   ≥2 series, a colour dot + ink end-label per series, and a hover crosshair
   with a tooltip reading every series at the nearest logged step. */

const fmtStep = (v) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));
const fmtVal = (v) => String(+v.toFixed(Math.abs(v) < 1 ? 3 : 2));

function ticks(min, max, count) {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / pow;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * pow;
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) out.push(+t.toFixed(10));
  return out;
}

export function LineChart({ series, xLabel = 'step', yLabel, yDomain, xFmt = fmtStep, yFmt = fmtVal, height = 250 }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const W = 680, H = height;
  const P = { t: 22, r: 96, b: 34, l: 52 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;

  const allX = series.flatMap((s) => s.data.map((d) => d[0]));
  const allY = series.flatMap((s) => s.data.map((d) => d[1]));
  const x0 = Math.min(...allX), x1 = Math.max(...allX);
  let [y0, y1] = yDomain || [];
  if (y0 === undefined) {
    const lo = Math.min(...allY), hi = Math.max(...allY);
    y0 = lo >= 0 && lo <= hi * 0.45 ? 0 : lo - (hi - lo) * 0.08;
    y1 = hi + (hi - lo) * 0.06;
  }

  const sx = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * iw;
  const sy = (y) => P.t + ih - ((y - y0) / (y1 - y0 || 1)) * ih;

  const unionX = [...new Set(allX)].sort((a, b) => a - b);
  const nearest = (arr, v) => arr.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b));

  // End labels: colour dot carries identity, text stays in ink; nudge apart if stacked.
  const ends = series
    .map((s, i) => ({ name: s.name, ci: i, y: sy(s.data[s.data.length - 1][1]) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 15);

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const ux = nearest(unionX, x0 + ((vx - P.l) / iw) * (x1 - x0));
    setHover({
      ux,
      rows: series.map((s, i) => {
        const p = s.data.reduce((b, d) => (Math.abs(d[0] - ux) < Math.abs(b[0] - ux) ? d : b));
        return { name: s.name, ci: i, x: p[0], y: p[1] };
      }),
    });
  }

  const flip = hover && sx(hover.ux) > P.l + iw * 0.62;

  return (
    <div className="trx-chart">
      {series.length > 1 && (
        <div className="trx-legend">
          {series.map((s, i) => (
            <span key={s.name} className="trx-legend__item">
              <span className="trx-dot" style={{ background: `var(--trx-s${i + 1})` }} />{s.name}
            </span>
          ))}
        </div>
      )}
      <div className="trx-chart__box">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="trx-chart__svg"
          role="img"
          aria-label={`${yLabel} against ${xLabel}: ${series.map((s) => s.name).join(', ')}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks(y0, y1, 4).map((t) => (
            <g key={`y${t}`}>
              <line x1={P.l} x2={P.l + iw} y1={sy(t)} y2={sy(t)} className="trx-grid" />
              <text x={P.l - 8} y={sy(t) + 3.5} textAnchor="end" className="trx-tick">{yFmt(t)}</text>
            </g>
          ))}
          {ticks(x0, x1, 5).map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - P.b + 16} textAnchor="middle" className="trx-tick">{xFmt(t)}</text>
          ))}
          <line x1={P.l} x2={P.l + iw} y1={P.t + ih} y2={P.t + ih} className="trx-axis" />
          {yLabel && <text x={P.l} y={12} className="trx-axlabel">{yLabel}</text>}
          <text x={P.l + iw / 2} y={H - 4} textAnchor="middle" className="trx-axlabel">{xLabel}</text>

          {hover && (
            <line x1={sx(hover.ux)} x2={sx(hover.ux)} y1={P.t} y2={P.t + ih} className="trx-crosshair" />
          )}
          {series.map((s, i) => (
            <path
              key={s.name}
              d={s.data.map((d, j) => `${j ? 'L' : 'M'}${sx(d[0]).toFixed(1)} ${sy(d[1]).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={`var(--trx-s${i + 1})`}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {ends.map((e) => (
            <g key={e.name}>
              <circle cx={P.l + iw + 6} cy={e.y} r="3.2" fill={`var(--trx-s${e.ci + 1})`} />
              <text x={P.l + iw + 13} y={e.y + 3.5} className="trx-endlabel">{e.name}</text>
            </g>
          ))}
          {hover && hover.rows.map((r) => (
            <circle key={r.name} cx={sx(r.x)} cy={sy(r.y)} r="3.5"
              fill={`var(--trx-s${r.ci + 1})`} stroke="var(--surface)" strokeWidth="2" />
          ))}
        </svg>
        {hover && (
          <div
            className="trx-tip"
            style={{
              left: `${(sx(hover.ux) / W) * 100}%`,
              transform: flip ? 'translate(calc(-100% - 10px), 0)' : 'translate(10px, 0)',
            }}
          >
            <p className="trx-tip__x">{xLabel} {xFmt(hover.ux)}</p>
            {hover.rows.map((r) => (
              <p key={r.name} className="trx-tip__row">
                <span className="trx-dot" style={{ background: `var(--trx-s${r.ci + 1})` }} />
                <span className="trx-tip__name">{r.name}</span>
                <span className="trx-tip__v">{yFmt(r.y)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- MetricTable -----------------------------------------------------------
   columns: ['Model', 'val Dice', …]  (first column left-aligned text, the
   rest right-aligned numbers) · rows: [{ cells: […], accent?: true }] —
   accent marks THIS run's row. */
export function MetricTable({ columns, rows }) {
  return (
    <div className="pt-card trx-tablewrap">
      <table className="trx-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.accent ? 'is-accent' : undefined}>
              {r.cells.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Findings({ items }) {
  return (
    <div className="trx-findings">
      {items.map((f) => (
        <div key={f.t} className={`trx-finding trx-finding--${f.tone}`}>
          <span className="trx-finding__t"><span className="trx-dot" />{f.t}</span>
          <span className="trx-finding__w">{f.why}</span>
        </div>
      ))}
    </div>
  );
}

export function NextSteps({ items }) {
  return (
    <ol className="trx-next">
      {items.map((s, i) => (
        <li key={s.t} className="trx-next__item">
          <span className="trx-next__n">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <span className="trx-next__t">{s.t}</span>
            {s.why && <span className="trx-next__w">{s.why}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---- Figures (W&B PNG exports) ----------------------------------------------
   Files live in ../figures/run-<nn>-<shortname>/ (see the README there), get
   imported by the run page and passed as `src`. The white frame is deliberate:
   W&B exports have light backgrounds, and the frame keeps them legible on the
   dark arcade theme. Omit `src` to render a dashed placeholder, so a page can
   be written before the exports are dropped in. */
export function Figure({ src, caption, alt, source = 'wandb' }) {
  return (
    <figure className={`trx-fig${src ? '' : ' trx-fig--empty'}`}>
      <div className="trx-fig__frame">
        {src
          ? <img src={src} alt={alt || caption} loading="lazy" />
          : <span>png pending — drop it in figures/&lt;run-id&gt;/ and import it here</span>}
      </div>
      {caption && <figcaption><span className="trx-fig__src">{source}</span>{caption}</figcaption>}
    </figure>
  );
}

export function FigureGrid({ children }) {
  return <div className="trx-figgrid">{children}</div>;
}

export function CodeBlock({ label, text }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="trx-code">
      {label && <span className="trx-code__label">{label}</span>}
      <pre>{text}</pre>
      <button
        type="button"
        className={`trx-copy${ok ? ' is-ok' : ''}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setOk(true);
            setTimeout(() => setOk(false), 1200);
          } catch { /* clipboard blocked; ignore */ }
        }}
      >
        {ok ? 'copied' : 'copy'}
      </button>
    </div>
  );
}

const KIT_CSS = `
/* Series + tone colours. Light values validated on the jade & coral surfaces,
   the arcade block swaps in the dark-stepped set — same hues, re-stepped. */
.trx { --trx-s1: #2a78d6; --trx-s2: #eb6834; --trx-s3: #1baf7a; --trx-s4: #eda100;
  --trx-good: var(--signal); --trx-warn: #E0A82E; --trx-bad: #D9605A;
  display: flex; flex-direction: column; gap: 1.2rem; }
.hp.portal[data-portal-theme="arcade"] .trx {
  --trx-s1: #3987e5; --trx-s2: #d95926; --trx-s3: #199e70; --trx-s4: #c98500; --trx-bad: #E66767; }

/* header */
.trx-head { padding: 1.2rem 1.35rem; }
.trx-head__row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.trx-runno { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.72rem; font-weight: 800;
  color: #fff; background: var(--signal); border-radius: 99px; padding: 0.15rem 0.6rem; letter-spacing: 0.04em; }
.trx-status { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  border: 1px solid var(--line-2); border-radius: 99px; padding: 0.12rem 0.55rem; color: var(--ink-3); }
.trx-status--good { color: var(--trx-good); border-color: var(--trx-good); }
.trx-status--live { color: var(--accent-ink); border-color: var(--accent); }
.trx-status--bad { color: var(--trx-bad); border-color: var(--trx-bad); }
.trx-flag { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--trx-warn); border: 1px dashed var(--trx-warn); border-radius: 99px; padding: 0.12rem 0.55rem; }
.trx-title { font-size: 1.35rem; line-height: 1.2; margin: 0 0 0.4rem; color: var(--ink); }
.trx-sub { font-size: 0.93rem; line-height: 1.6; color: var(--ink-2); margin: 0 0 0.75rem; max-width: 64ch; }
.trx-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.trx-meta__chip { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.72rem; color: var(--ink-2);
  background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 4px; padding: 0.22rem 0.5rem; }
.trx-meta__chip span { color: var(--text-faint); text-transform: uppercase; font-size: 0.62rem; margin-right: 0.4rem; }

/* verdict — a ruled editorial standfirst, not a callout box; the tone lives in
   the labelled dot, never in a coloured border */
.trx-verdict { padding: 0.85rem 0.2rem 1rem; border-top: 2px solid var(--ink); border-bottom: 1px solid var(--line-2); }
.trx-verdict__tag { display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.55rem;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.66rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); }
.trx-verdict .trx-verdict__tag .trx-dot { width: 8px; height: 8px; background: var(--trx-good); }
.trx-verdict--warn .trx-verdict__tag .trx-dot { background: var(--trx-warn); }
.trx-verdict--bad .trx-verdict__tag .trx-dot { background: var(--trx-bad); }
.trx-verdict__lead { font-size: 1.02rem; font-weight: 700; color: var(--ink); margin: 0 0 0.25rem; max-width: 70ch; }
.trx-verdict__sub { font-size: 0.87rem; line-height: 1.6; color: var(--ink-2); margin: 0; max-width: 78ch; }

/* sections */
.trx-sec__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint);
  font-weight: 700; margin: 0 0 0.7rem; }
.trx-sec__note { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--ink-3); margin-left: 0.6rem; }
.trx-prose { font-size: 0.89rem; line-height: 1.65; color: var(--ink-2); margin: 0 0 0.9rem; max-width: 78ch; }
.trx-prose code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.84em;
  background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 3px; padding: 0.05rem 0.28rem; }

/* stat cards */
.trx-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.7rem; }
.trx-stat { padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; border-top: 3px solid var(--accent); }
.trx-stat__v { font-size: 1.4rem; font-weight: 800; line-height: 1.05; color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.trx-stat__k { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--ink); }
.trx-stat__n { font-size: 0.76rem; line-height: 1.5; color: var(--ink-3); margin-top: 0.15rem; }

/* chart */
.trx-chart { display: flex; flex-direction: column; gap: 0.4rem; }
.trx-legend { display: flex; flex-wrap: wrap; gap: 0.9rem; padding: 0 0.2rem; }
.trx-legend__item { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--ink-2); }
.trx-dot { flex: none; width: 9px; height: 9px; border-radius: 99px; }
.trx-chart__box { position: relative; background: var(--surface); border: 1px solid var(--line-2); border-radius: 8px; padding: 0.5rem 0.4rem 0.2rem; }
.trx-chart__svg { display: block; width: 100%; height: auto; }
.trx-grid { stroke: var(--line-2); stroke-width: 1; }
.trx-axis { stroke: var(--line-2); stroke-width: 1.4; }
.trx-tick { font-size: 10.5px; fill: var(--text-faint); font-family: ui-monospace, Menlo, Consolas, monospace; }
.trx-axlabel { font-size: 10.5px; fill: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
.trx-endlabel { font-size: 11px; fill: var(--ink-2); font-weight: 600; }
.trx-crosshair { stroke: var(--ink-3); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.6; }
.trx-tip { position: absolute; top: 12%; pointer-events: none; z-index: 3; min-width: 128px;
  background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 6px; padding: 0.45rem 0.6rem;
  box-shadow: 0 4px 14px rgba(10, 20, 30, 0.14); }
.trx-tip__x { margin: 0 0 0.25rem; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.68rem; color: var(--text-faint); }
.trx-tip__row { margin: 0.15rem 0 0; display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--ink-2); }
.trx-tip__name { flex: 1 1 auto; }
.trx-tip__v { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

/* table */
.trx-tablewrap { padding: 0.4rem 0.6rem; overflow-x: auto; }
.trx-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.trx-table th { text-align: right; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-faint); font-weight: 700; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--line-2); }
.trx-table th:first-child { text-align: left; }
.trx-table td { text-align: right; padding: 0.55rem 0.7rem; color: var(--ink-2); border-bottom: 1px solid var(--line-2);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.trx-table td:first-child { text-align: left; color: var(--ink); font-weight: 600; white-space: normal; }
.trx-table tbody tr:last-child td { border-bottom: none; }
.trx-table tr.is-accent td { background: var(--accent-soft); color: var(--ink); }
.trx-table tr.is-accent td:first-child { color: var(--accent-ink); }

/* findings — a ruled list; the tone dot sits beside the title, no boxes */
.trx-findings { display: flex; flex-direction: column; }
.trx-finding { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.7rem 0.15rem; }
.trx-finding + .trx-finding { border-top: 1px solid var(--line-2); }
.trx-finding__t { font-weight: 700; color: var(--ink); font-size: 0.88rem; display: flex; align-items: center; gap: 0.5rem; }
.trx-finding .trx-dot { background: var(--trx-good); }
.trx-finding--warn .trx-dot { background: var(--trx-warn); }
.trx-finding--bad .trx-dot { background: var(--trx-bad); }
.trx-finding__w { font-size: 0.84rem; line-height: 1.55; color: var(--ink-2); padding-left: 1.05rem; max-width: 80ch; }

/* next steps — plain ruled list with mono counters */
.trx-next { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.trx-next__item { display: flex; gap: 0.75rem; align-items: baseline; padding: 0.65rem 0.15rem; }
.trx-next__item + .trx-next__item { border-top: 1px solid var(--line-2); }
.trx-next__n { flex: none; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.78rem; font-weight: 700; color: var(--accent-ink); }
.trx-next__t { display: block; font-weight: 700; color: var(--ink); font-size: 0.88rem; }
.trx-next__w { display: block; font-size: 0.82rem; line-height: 1.5; color: var(--ink-2); margin-top: 0.15rem; max-width: 80ch; }

/* figures — W&B PNG exports on a fixed white frame (stays legible on arcade) */
.trx-figgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.9rem; }
.trx-fig { margin: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.trx-fig__frame { background: #fff; border: 1px solid var(--line-2); border-radius: 4px; padding: 0.5rem; }
.trx-fig img { display: block; width: 100%; height: auto; }
.trx-fig figcaption { font-size: 0.78rem; line-height: 1.5; color: var(--ink-3); padding: 0 0.15rem; }
.trx-fig__src { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.62rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-faint); margin-right: 0.5rem; }
.trx-fig--empty .trx-fig__frame { background: transparent; border-style: dashed; display: grid; place-items: center;
  min-height: 120px; padding: 1rem; text-align: center; color: var(--text-faint);
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.72rem; line-height: 1.6; }

/* code block */
.trx-code { position: relative; background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 8px; padding: 0.7rem 0.85rem; }
.trx-code__label { display: block; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em;
  font-weight: 700; color: var(--text-faint); margin-bottom: 0.4rem; }
.trx-code pre { margin: 0; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem; line-height: 1.7; color: var(--ink); white-space: pre; }
.trx-copy { position: absolute; top: 0.55rem; right: 0.6rem; border: 1px solid var(--line-2); background: var(--surface);
  color: var(--ink-3); font: inherit; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em;
  cursor: pointer; border-radius: 4px; padding: 0.18rem 0.5rem; transition: all 0.15s; }
.trx-copy:hover { color: var(--ink); border-color: var(--accent); }
.trx-copy.is-ok { color: var(--signal); border-color: var(--signal); }

@media (max-width: 620px) {
  .trx-head { padding: 1rem; }
  .trx-title { font-size: 1.15rem; }
}
`;
