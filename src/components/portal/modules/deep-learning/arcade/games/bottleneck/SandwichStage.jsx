import { useEffect, useMemo, useState } from 'react';
import { SANDWICH, BUILD, TIE, INDEX } from '../../content/bottleneck';
import { sandwich, buildCombos, tieCounts, fill, fmtInt, tiedSource } from '../../maths/bottleneck';
import { stackParams } from '../../../lecture5-study/ae.js';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Why } from '../../kit/WhyText';
import { StageHead, Lines } from './Parts';

/* ============================================================================
   BOTTLENECK · STAGE 2 — THE SANDWICH (slides 10–12, 18–21)
   ----------------------------------------------------------------------------
   Figure 17-3's stack, drawn from the item's widths (input at the bottom,
   box width ∝ √units; green input / output, blue hidden, pink coding):
     BuildStage   pick the widths within the budget; each connection shows
                  its Dense layer's count and the meter the total
     TieStage     slide 19's labels W₁, W₂ … W₂ᵀ, W₁ᵀ; count on the keypad
                  (or four choices for slide 21's anchor)
     IndexStage   which W a layer uses / the coding layer / what is learned
   ========================================================================== */
const VW = 360;
const CX = 170;
const BOX_H = 22;
const GAP = 30;
const PAD = 14;

const boxW = (u) => 72 + 128 * Math.sqrt(u / SANDWICH.inputUnits);

function WLabel({ x, y, k, t, className = '' }) {
  return (
    <text className={`dla-bn__w ${className}`} x={x} y={y}>
      W<tspan className="dla-bn__wsub" dy="4">{k}</tspan>{t && <tspan className="dla-bn__wsub" dy="-10">⊤</tspan>}
    </text>
  );
}

// labels: 'count' (per-layer parameters) | 'tied' (W labels + bias only) | 'pair' | 'coding' | 'learn'
export function Sandwich({ sizes, labels, layer = null, reveal = false }) {
  const N = sizes.length - 1;
  const half = N / 2;
  const H = 2 * PAD + (N + 1) * BOX_H + N * GAP;
  const y = (k) => H - PAD - BOX_H - k * (BOX_H + GAP);
  const counts = stackParams(sizes).layers;
  const named = labels !== 'coding';
  const numbered = labels === 'pair' || labels === 'learn';
  const role = (k) => (k === 0 || k === N ? 'io' : k === half ? 'code' : 'hid');
  const name = (k) => (k === 0 ? SANDWICH.names.input : k === N ? SANDWICH.names.output : fill(SANDWICH.names.hidden, { n: k }));
  return (
    <svg className="dla-svg dla-bn__sand" viewBox={`0 0 ${VW} ${H}`} role="img" aria-label={`A symmetric stacked autoencoder: ${sizes.join(', ')} units from input to output.`}>
      {Array.from({ length: N }, (_, i) => i + 1).map((k) => {
        const y1 = y(k - 1);
        const y2 = y(k) + BOX_H;
        const mid = (y1 + y2) / 2 + 4;
        const dec = k > half;
        const asked = labels === 'pair' && k === layer;
        let lab = null;
        if (labels === 'count') lab = <text className="dla-t--s dla-t--m dla-bn__cnt" x={CX + 104} y={mid}>{fmtInt(counts[k - 1].total)}</text>;
        else if (labels === 'tied' || labels === 'learn') {
          lab = (
            <>
              <WLabel x={CX + 100} y={mid} k={dec ? tiedSource(N, k) : k} t={dec} />
              {labels === 'tied' && dec && <text className="dla-t--xs dla-bn__bias" x={CX + 134} y={mid}>{TIE.labels.biasOnly}</text>}
            </>
          );
        } else if (labels === 'pair') {
          if (!dec) lab = <WLabel x={CX + 100} y={mid} k={k} t={false} />;
          else if (asked && reveal) lab = <WLabel x={CX + 100} y={mid} k={tiedSource(N, k)} t className="dla-bn__w--ask" />;
          else if (asked) lab = <text className="dla-bn__w dla-bn__w--ask" x={CX + 100} y={mid}>?</text>;
        }
        return (
          <g key={`c${k}`} className={`dla-bn__link${dec && labels !== 'count' && labels !== 'coding' ? ' dla-bn__link--tied' : ''}${asked ? ' dla-bn__link--ask' : ''}`}>
            <line x1={CX} y1={y1} x2={CX} y2={y2} />
            <line className="dla-bn__tick" x1={CX + 6} y1={mid - 4} x2={CX + 94} y2={mid - 4} />
            {lab}
          </g>
        );
      })}
      {sizes.map((u, k) => {
        const w = boxW(u);
        return (
          <g key={`b${k}`} className={`dla-bn__box dla-bn__box--${role(k)}`}>
            <rect x={CX - w / 2} y={y(k)} width={w} height={BOX_H} rx="5" />
            {named && <text className="dla-t dla-t--b dla-bn__boxt" x={CX} y={y(k) + 15} textAnchor="middle">{name(k)}</text>}
            <text className="dla-t--xs dla-bn__units" x={CX - w / 2 - 7} y={y(k) + 15} textAnchor="end">{fill(SANDWICH.names.units, { u })}</text>
            {numbered && k > 0 && <text className="dla-t--xs dla-t--m dla-bn__num" x={VW - 2} y={y(k) + 15} textAnchor="end">{fill(INDEX.layerWord, { n: k })}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ── build ───────────────────────────────────────────────────────────── */
export function BuildStage({ item, round }) {
  const [enc, setEnc] = useState(() => item.lists.map((l) => l.options[0]));
  const live = round.state === 'play' && !round.feedback;
  const sizes = sandwich(enc);
  const total = stackParams(sizes).total;
  const max = useMemo(() => buildCombos(item.N).at(-1).total, [item.N]);
  const over = total > item.budget;
  const multi = item.lists.map((l, k) => (l.options.length > 1 ? k : -1)).filter((k) => k >= 0);
  const step = (k, d) => setEnc((e) => {
    const opts = item.lists[k].options;
    const i = Math.max(0, Math.min(opts.length - 1, opts.indexOf(e[k]) + d));
    return e.map((v, j) => (j === k ? opts[i] : v));
  });
  const submit = () => { if (live) round.submit(sizes); };

  // keys: ↑ ↓ the first width, ← → the last one you can pick, Enter builds
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      if (e.key === 'Enter') { if (tag === 'BUTTON' && !e.target.dataset?.enter) return; e.preventDefault(); submit(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(multi[0], 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); step(multi[0], -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(multi[multi.length - 1], 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(multi[multi.length - 1], -1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fb = round.feedback;
  return (
    <>
      <StageHead item={item} round={round} />
      <div className="dla-stagegrid dla-bn__grid">
        <div className={`dla-floor dla-bn__floor${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}>
          <Sandwich sizes={sizes} labels="count" />
        </div>
        <div className="dla-bn__side">
          <div className={`dla-bn__budget${over ? ' dla-bn__budget--over' : ''}`} aria-live="polite">
            <span className="dla-k">{BUILD.meter.label}</span>
            <span className="dla-bn__mse">{fmtInt(total)}</span>
            <span className="dla-bn__bar" aria-hidden="true">
              <span className="dla-bn__fill" style={{ transform: `scaleX(${Math.min(1, total / max)})` }} />
              <span className="dla-bn__line" style={{ left: `${(100 * item.budget) / max}%` }} />
            </span>
            <span className="dla-bn__floorv">
              {BUILD.meter.budget} {fmtInt(item.budget)} · {over ? fill(BUILD.meter.over, { n: fmtInt(total - item.budget) }) : BUILD.meter.fits}
            </span>
          </div>
          {item.lists.map((l, k) => (l.options.length > 1 ? (
            <div key={l.key} className="dla-bn__pick" role="radiogroup" aria-label={l.label}>
              <span className="dla-k">{l.label}</span>
              <div className="dla-bn__chips">
                {l.options.map((o) => (
                  <button key={o} type="button" data-enter="submit" role="radio" aria-checked={enc[k] === o} className={`dla-bn__chip${enc[k] === o ? ' dla-bn__chip--on' : ''}`} disabled={!live} onClick={() => setEnc((e) => e.map((v, j) => (j === k ? o : v)))}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p key={l.key} className="dla-k dla-bn__fixed">{fill(BUILD.fixed, { label: l.label, units: l.options[0] })}</p>
          )))}
          <button type="button" className="dla-btn dla-btn--primary dla-bn__go" onClick={submit} disabled={!live}>
            {BUILD.build} <span className="dla-btn__key">Enter</span>
          </button>
        </div>
      </div>
      <Lines lines={BUILD.drawer} />
    </>
  );
}

/* ── tie ─────────────────────────────────────────────────────────────── */
function TieRows({ sizes }) {
  const t = tieCounts(sizes);
  return t.layers.map((l) => (
    <p key={l.l} className="dla-mline">
      <Why text={l.tiedTo ? fill(TIE.rowTied, { l: l.l, k: l.tiedTo, u: l.units }) : fill(TIE.rowOwn, { l: l.l, i: l.inputs, u: l.units })} />
    </p>
  ));
}

export function TieStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = round.state === 'play' && !round.feedback;
  const fb = round.feedback;
  return (
    <>
      <StageHead item={item} round={round} />
      <div className="dla-stagegrid dla-bn__grid">
        <div className={`dla-floor dla-bn__floor${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}>
          <Sandwich sizes={item.sizes} labels="tied" />
        </div>
        {item.kind === 'number' ? (
          <Keypad value={value} onChange={setValue} onSubmit={() => { if (value !== '') round.submit(Number(value)); }} disabled={!live} active={live} label={item.prompt} unit={item.unit} />
        ) : (
          <div className="dla-bn__side">
            <Choice choices={item.choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={1} label={item.prompt} />
          </div>
        )}
      </div>
      <Lines lines={TIE.drawer} extra={<TieRows sizes={item.sizes} />} />
    </>
  );
}

/* ── which W? ────────────────────────────────────────────────────────── */
export function IndexStage({ item, round }) {
  const live = round.state === 'play' && !round.feedback;
  const fb = round.feedback;
  const sizes = useMemo(() => sandwich(INDEX.picture[item.N]), [item.N]);
  const choices = useMemo(() => item.choices.map((c) => ({ ...c, aria: item.format ? item.format(c.value) : String(c.label), label: <Why text={c.label} /> })), [item]);
  return (
    <>
      <StageHead item={item} round={round} />
      <div className="dla-stagegrid dla-bn__grid">
        <div className={`dla-floor dla-bn__floor${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}>
          <Sandwich sizes={sizes} labels={item.ask} layer={item.layer ?? null} reveal={!!fb} />
        </div>
        <div className="dla-bn__side">
          <Choice choices={choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={1} label={item.prompt} />
        </div>
      </div>
      <Lines lines={TIE.drawer.slice(0, 2)} />
    </>
  );
}
