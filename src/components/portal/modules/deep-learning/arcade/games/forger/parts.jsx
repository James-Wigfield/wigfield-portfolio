import { pyTokens } from './pyTokens.js';
import { fill } from '../../maths/forger';
import { INGREDIENTS, UI } from '../../content/forger';

/* ============================================================================
   FORGER — DRAWING PARTS (procedural SVG + the VS-Code block)
   ----------------------------------------------------------------------------
   Studio      the toy GAN on a number line: real density (originals), the
               fakes' histogram (forgeries), the discriminator's P(real)
               curve; an optional `ghost` frame drawn dashed (before)
   Legend      labelled dots for the studio
   CoverStrip  share of fakes on a real bump, every 100 iterations
   Tray        the batch you built: tiles + labels + who learns
   NetDiagram  a DCGAN generator / discriminator with the slots you pick
   CodeView    slide code in the deep-learning kit's VS-Code look; lines can
               be dimmed, lit (tappable), a gap, or marked right / wrong
   CodeText    one code string, tokenised
   Colours: --dl8s-v originals, --dl8s-dec forgeries, --dl8s-k the
   discriminator (L8 role tokens), so the three themes all work.
   ========================================================================== */

const W = 640;
const PAD = { l: 30, r: 36, t: 14, b: 30 };

function scales(frame, h) {
  const y0 = h - PAD.b;
  const top = PAD.t;
  const x = (v) => PAD.l + ((v - frame.lo) / (frame.hi - frame.lo)) * (W - PAD.l - PAD.r);
  return { x, y0, top, ph: y0 - top };
}

const stepPath = (frame, x, y) => {
  let d = `M${x(frame.lo).toFixed(1)},${y(0).toFixed(1)}`;
  frame.hist.forEach((v, i) => {
    const a = x(frame.lo + i * frame.w);
    const b = x(frame.lo + (i + 1) * frame.w);
    d += `L${a.toFixed(1)},${y(v).toFixed(1)}L${b.toFixed(1)},${y(v).toFixed(1)}`;
  });
  return `${d}L${x(frame.hi).toFixed(1)},${y(0).toFixed(1)}`;
};

const linePath = (xs, ys) => xs.map((v, i) => `${i ? 'L' : 'M'}${v.toFixed(1)},${ys[i].toFixed(1)}`).join('');

export function Studio({ frame, ghost = null, showD = true, compact = false, label, animate = '', className = '' }) {
  const h = compact ? 150 : 210;
  const { x, y0, top, ph } = scales(frame, h);
  const hmax = Math.max(...frame.real, ...frame.hist, ...(ghost ? ghost.hist : [])) * 1.08 || 1;
  const dens = (v) => y0 - Math.min(v / hmax, 1.04) * ph;
  const pr = (p) => y0 - p * ph;
  const gx = frame.grid.map(x);
  const realD = `${linePath(gx, frame.real.map(dens))}L${gx[gx.length - 1].toFixed(1)},${y0}L${gx[0].toFixed(1)},${y0}Z`;
  const ticks = [];
  const step = frame.hi - frame.lo > 8 ? 2 : 1;
  for (let v = Math.ceil(frame.lo / step) * step; v <= Math.floor(frame.hi); v += step) ticks.push(v);
  const bw = x(frame.lo + frame.w) - x(frame.lo);
  return (
    <svg className={`dla-svg dla-fg__studio${compact ? ' dla-fg__studio--compact' : ''} ${className}`} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label ?? UI.studioAria}>
      {/* axes */}
      <line x1={PAD.l} x2={W - PAD.r} y1={y0} y2={y0} className="dla-fg__axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={y0} y2={y0 + 4} className="dla-fg__axis" />
          <text x={x(v)} y={y0 + 17} textAnchor="middle" className="dla-t dla-t--s dla-t--m">{v < 0 ? `−${-v}` : v}</text>
        </g>
      ))}
      {showD && (
        <g className="dla-fg__daxis">
          <line x1={W - PAD.r} x2={W - PAD.r} y1={top} y2={y0} />
          {[0, 0.5, 1].map((p) => (
            <text key={p} x={W - PAD.r + 5} y={pr(p) + 4} className="dla-t dla-t--xs dla-t--m">{p}</text>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={pr(0.5)} y2={pr(0.5)} className="dla-fg__half" />
        </g>
      )}
      {/* originals */}
      <path d={realD} className="dla-fg__real" />
      {/* the ghost (before) */}
      {ghost && (
        <g className="dla-fg__ghost">
          <path d={stepPath(ghost, x, dens)} className="dla-fg__ghosthist" />
          {showD && <path d={linePath(ghost.grid.map(x), ghost.d.map(pr))} className="dla-fg__ghostd" />}
        </g>
      )}
      {/* forgeries + the discriminator (after) */}
      <g className={animate ? `dla-fg__after dla-fg__after--${animate}` : 'dla-fg__after'}>
        {frame.hist.map((v, i) => (v > 0 ? (
          <rect key={i} x={x(frame.lo + i * frame.w) + 0.6} width={Math.max(bw - 1.2, 0.8)} y={dens(v)} height={y0 - dens(v)} className="dla-fg__bar" />
        ) : null))}
        {showD && <path d={linePath(gx, frame.d.map(pr))} className="dla-fg__d" />}
      </g>
      {frame.left > 0 && <text x={PAD.l + 2} y={top + 10} className="dla-t dla-t--xs dla-fg__off">{fill(UI.offLeft, { n: frame.left })}</text>}
      {frame.right > 0 && <text x={W - PAD.r - 2} y={top + 10} textAnchor="end" className="dla-t dla-t--xs dla-fg__off">{fill(UI.offRight, { n: frame.right })}</text>}
    </svg>
  );
}

export function Legend({ showD = true, ghost = false }) {
  return (
    <p className="dla-fg__legend">
      <span><i className="dla-fg__key dla-fg__key--real" aria-hidden="true" />{UI.real}</span>
      <span><i className="dla-fg__key dla-fg__key--fake" aria-hidden="true" />{UI.fake}</span>
      {showD && <span><i className="dla-fg__key dla-fg__key--d" aria-hidden="true" />{UI.dcurve}</span>}
      {ghost && <span><i className="dla-fg__key dla-fg__key--ghost" aria-hidden="true" />{UI.ghostKey}</span>}
    </p>
  );
}

export function CoverStrip({ history, t }) {
  const n = Math.max(history.length, 1);
  const bw = 600 / n;
  return (
    <figure className="dla-fg__strip">
      <svg className="dla-svg" viewBox="0 0 640 46" role="img" aria-label={UI.stripAria}>
        <line x1="20" x2="620" y1="40" y2="40" className="dla-fg__axis" />
        {history.map((p, i) => (
          <rect key={p.t} x={20 + i * bw + 1} width={Math.max(bw - 2, 1)} y={40 - p.v * 34} height={p.v * 34} className={`dla-fg__sbar${p.t === t ? ' dla-fg__sbar--now' : ''}`} />
        ))}
      </svg>
      <figcaption className="dla-k">{UI.stripK}</figcaption>
    </figure>
  );
}

/* ── the batch tray (recipe) ───────────────────────────────────────────── */
function Tile({ x, kind, label, on }) {
  return (
    <g className={`dla-fg__tile dla-fg__tile--${kind}`} transform={`translate(${x} 6)`}>
      <g className={on ? 'dla-fg__stamp' : undefined}>
        <rect width="36" height="36" rx="5" className="dla-fg__tilebox" />
        <path d="M7 27c4-11 8-13 12-5s7 5 10-7" className="dla-fg__tileink" />
        <text x="18" y="58" textAnchor="middle" className="dla-t dla-t--b dla-t--m">{label}</text>
      </g>
    </g>
  );
}

export function Tray({ pick, revealOn = false }) {
  const batch = INGREDIENTS.batch.find((o) => o.key === pick.batch);
  const labels = INGREDIENTS.labels.find((o) => o.key === pick.labels);
  const learns = INGREDIENTS.learns.find((o) => o.key === pick.learns);
  const tiles = [];
  if (batch?.fake) for (let i = 0; i < 4; i++) tiles.push({ kind: 'fake', label: labels ? String(labels.fakeLabel) : '?' });
  if (batch?.real) for (let i = 0; i < 4; i++) tiles.push({ kind: 'real', label: labels ? String(labels.realLabel) : '?' });
  const gap = tiles.length > 4 ? 10 : 0;
  return (
    <figure className="dla-fg__tray">
      <svg className="dla-svg" viewBox="0 0 530 70" role="img" aria-label={UI.trayAria}>
        {!batch && <text x="10" y="34" className="dla-t dla-t--s">{UI.trayEmpty}</text>}
        {tiles.map((tl, i) => (
          <Tile key={i} x={6 + i * 44 + (i >= 4 ? gap : 0)} kind={tl.kind} label={tl.label} on={revealOn} />
        ))}
        <g transform="translate(392 6)">
          {[['D', learns?.d], ['G', learns?.g]].map(([k, on], i) => (
            <g key={k} transform={`translate(${i * 74} 0)`} className={`dla-fg__net${learns ? (on ? ' dla-fg__net--on' : ' dla-fg__net--off') : ''}`}>
              <rect width="58" height="36" rx="8" className="dla-fg__netbox" />
              <text x="29" y="24" textAnchor="middle" className="dla-t dla-t--b">{k}</text>
              <text x="29" y="56" textAnchor="middle" className="dla-t dla-t--xs">{learns ? (on ? UI.learnsOn : k === 'D' ? UI.dOff : UI.gOff) : ''}</text>
            </g>
          ))}
        </g>
      </svg>
    </figure>
  );
}

/* ── the DCGAN build drawing ───────────────────────────────────────────── */
const SLOT_ROLE = ['q', 'k', 'pos'];

export function NetDiagram({ item, pick }) {
  const layers = UI.netLayers[item.net];
  const bx = (i) => 14 + i * 132;
  const tagsAt = (li) => item.slots
    .map((s, si) => ({ s, si }))
    .filter(({ s }) => s.at.includes(li) && !(s.id.endsWith('.bn') && bnSkips(pick[s.id], li)))
    .map(({ s, si }) => {
      const o = s.options.find((op) => op.key === pick[s.id]);
      return { si, text: o ? o.tag : '?', empty: !o, none: o && o.tag === '' };
    })
    .filter((tg) => !tg.none);
  return (
    <svg className="dla-svg dla-fg__netdia" viewBox="0 0 410 196" role="img" aria-label={fill(UI.netAria, { net: item.net === 'gen' ? 'generator' : 'discriminator' })}>
      <text x="14" y="13" className="dla-t dla-t--s">{UI.netIn[item.net]} →</text>
      <text x="396" y="190" textAnchor="end" className="dla-t dla-t--s">→ {UI.netOut[item.net]}</text>
      {[0, 1].map((i) => <line key={i} x1={bx(i) + 116} x2={bx(i + 1)} y1="98" y2="98" className="dla-fg__wire" />)}
      {layers.map((name, li) => (
        <g key={li} transform={`translate(${bx(li)} 38)`}>
          <rect width="116" height="128" rx="8" className="dla-fg__layer" />
          <text x="58" y="-6" textAnchor="middle" className="dla-t dla-t--xs">{name}</text>
          {tagsAt(li).map((tg, k) => (
            <g key={k} transform={`translate(8 ${10 + k * 38})`} className={`dla-fg__tag dla-fg__tag--${SLOT_ROLE[tg.si]}${tg.empty ? ' dla-fg__tag--empty' : ''}`}>
              <rect width="100" height="30" rx="5" />
              <text x="50" y="20" textAnchor="middle" className="dla-t dla-t--m">{tg.text}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

// which layer a Batch Normalization choice leaves out (layer index 0 = input side, 2 = output)
function bnSkips(key, li) {
  if (!key) return false;
  if (key === 'none') return true;
  if (key === 'notOut') return li === 2;
  if (key === 'notIn') return li === 0;
  return false;
}

/* ── code ──────────────────────────────────────────────────────────────── */
// break opportunities after . ( , = [ so long calls wrap at sensible points
const withBreaks = (t) => t.split(/(?<=[.(,=[])/).flatMap((piece, i) => (i ? [<wbr key={`w${i}`} />, piece] : [piece]));

export function CodeText({ code }) {
  return (
    <>
      {pyTokens(code).map((tok, j) => (tok.cls ? <span key={j} className={`tok-${tok.cls}`}>{withBreaks(tok.t)}</span> : <span key={j}>{withBreaks(tok.t)}</span>))}
    </>
  );
}

// one printed line -> a span with a hanging indent (continuations sit 4 columns in)
function Part({ text, first, base }) {
  const lead = text.match(/^ */)[0].length;
  const indent = first ? lead : base + 4;
  return (
    <span className="dla-fg__part" style={{ paddingLeft: `${indent + 2}ch`, textIndent: '-2ch' }}>
      <CodeText code={text.slice(lead)} />
    </span>
  );
}

/* lines: [{ id, code, state?: 'dim'|'lit'|'gap'|'right'|'wrong', n?, onPick?, aria? }] */
export function CodeView({ lines, file, meta, label }) {
  return (
    <figure className="dlk-code dla-fg__code" aria-label={label}>
      <figcaption className="dlk-code__bar">
        <span className="dlk-code__dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="dlk-code__file">{file}</span>
        {meta && <span className="dlk-code__meta">{meta}</span>}
      </figcaption>
      <pre className="dlk-code__pre dla-fg__pre">
        <code className="dlk-code__code dla-fg__codebody">
          {lines.map((ln, i) => {
            const cls = `dla-fg__ln${ln.state ? ` dla-fg__ln--${ln.state}` : ''}`;
            const parts = ln.code.split('\n');
            const base = parts[0].match(/^ */)[0].length;
            const body = ln.state === 'gap'
              ? <span className="dla-fg__part dla-fg__gapmark" style={{ paddingLeft: `${base}ch` }}>{ln.code.trim()}</span>
              : parts.map((part, k) => <Part key={k} text={part} first={k === 0} base={base} />);
            if (ln.onPick) {
              return (
                <button key={ln.id ?? i} type="button" className={`${cls} dla-fg__lnbtn`} onClick={ln.onPick} disabled={ln.disabled} aria-label={ln.aria}>
                  {ln.n !== undefined && <span className="dla-fg__lnkey" aria-hidden="true">{ln.n}</span>}
                  <span className="dla-fg__lnbody">{body}</span>
                </button>
              );
            }
            return <span key={ln.id ?? i} className={cls}><span className="dla-fg__lnbody">{body}</span></span>;
          })}
        </code>
      </pre>
    </figure>
  );
}
