import { useMemo, useRef, useState } from 'react';
import { Lab, Chips, Range, Stat } from '../ui';
import { gradientThroughTime, normStats, DACT, mulberry32, fmtSigned, signClass } from '../rnn';
import { svgPoint } from '../hooks';
import './labsLong.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §12 (HANDLING LONG SEQUENCES, SLIDES 40–41)
     GradientLab   slide 40 made visible with one recurrent unit of this
                   page's own, h(t) = φ(w·h(t−1) + u·x(t)): plot A is
                   |∂h(t)/∂h(0)| on a log scale (vanishing / exploding), plot B
                   is h(t) itself (tanh stays inside ±1, ReLU with w > 1
                   explodes); a shared cursor reads both at one time step
     NormAxisLab   slide 41: batch norm vs layer norm as an axis highlighter
                   over a [batch × features] grid; "perturb instance 1" shows
                   which normalised values depend on the rest of the batch
   Every number is computed live from this page's own toy values — the two
   slides give none.
   ========================================================================== */

/* ── §12 · gradients through time (slide 40) ─────────────────────────────── */
const T_MAX = 100;
const NOISE = (() => {
  const rnd = mulberry32(4040);
  return Array.from({ length: T_MAX }, () => Math.round((rnd() * 2 - 1) * 0.5 * 100) / 100);
})();
const INPUTS = {
  noise: { l: 'seeded random, −0.5…+0.5', xs: NOISE },
  const: { l: 'constant 0.5', xs: Array.from({ length: T_MAX }, () => 0.5) },
  pulse: { l: 'one pulse: 1 at t = 1, then 0', xs: Array.from({ length: T_MAX }, (_, k) => (k === 0 ? 1 : 0)) },
};
const PRESETS = [
  { v: 'vanish', l: 'vanishing · tanh, w = 0.9', phi: 'tanh', w: 0.9, input: 'noise' },
  { v: 'sat', l: 'saturating · tanh, w = 1.2', phi: 'tanh', w: 1.2, input: 'const' },
  { v: 'explode', l: 'exploding outputs · ReLU, w = 1.2', phi: 'relu', w: 1.2, input: 'const' },
];
const PHI_NAME = { tanh: 'tanh', relu: 'ReLU' };

// plot geometry, shared by both panels
const PW = 360;
const PH = 226;
const PL = 46;
const PR = 14;
const PT = 28;
const PB = 36;
const IW = PW - PL - PR;
const IH = PH - PT - PB;
const DEC = 16; // plot A spans 10^−16 … 10^16
const DEC_TICKS = [16, 12, 8, 4, 0, -4, -8, -12, -16];

export function GradientLab() {
  const [w, setW] = useState(0.9);
  const [phi, setPhi] = useState('tanh');
  const [input, setInput] = useState('noise');
  const [T, setT] = useState(50);
  const [cur, setCur] = useState(null); // null → the last step

  const rows = useMemo(
    () => gradientThroughTime({ w, u: 1, b: 0, phi, xs: INPUTS[input].xs.slice(0, T) }),
    [w, phi, input, T],
  );
  const preset = PRESETS.find((p) => p.phi === phi && p.input === input && Math.abs(p.w - w) < 1e-9)?.v ?? null;
  const applyPreset = (v) => {
    const p = PRESETS.find((q) => q.v === v);
    setPhi(p.phi);
    setW(p.w);
    setInput(p.input);
  };

  const ct = cur == null ? T : Math.min(cur, T);
  const last = rows[T];
  const kT = log10Abs(last.g);
  const zeroAt = rows.findIndex((r) => r.g === 0);
  const perStep = zeroAt >= 0 ? 0 : 10 ** (kT / T); // geometric mean of |w·φ′(a)|
  const hs = rows.map((r) => r.h);
  const hMax = Math.max(...hs.map(Math.abs));
  const outAt = rows.findIndex((r) => Math.abs(r.h) > 1);
  const verdict = zeroAt >= 0 ? 'zero' : kT < -1 ? 'vanish' : kT > 1 ? 'explode' : 'flat';

  // ── shared x scale + cursor
  const px = (t) => PL + (t / T) * IW;
  const xTicks = niceTicks(0, T, 5);
  const moveCursor = (e) => {
    const p = svgPoint(e, e.currentTarget);
    if (!p) return;
    setCur(Math.max(0, Math.min(T, Math.round(((p.x - PL) / IW) * T))));
  };
  const keyCursor = (e) => {
    const next = { ArrowLeft: ct - 1, ArrowRight: ct + 1, Home: 0, End: T, PageDown: ct - 10, PageUp: ct + 10 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setCur(Math.max(0, Math.min(T, next)));
  };
  const plotProps = {
    tabIndex: 0,
    onPointerMove: moveCursor,
    onPointerDown: moveCursor,
    onPointerLeave: () => setCur(null),
    onKeyDown: keyCursor,
  };

  // ── plot A: log10 |∂h(t)/∂h(0)|, clamped to ±16 decades
  const pyA = (k) => PT + ((DEC - clampDec(k)) / (2 * DEC)) * IH;
  const pathA = rows.map((r, i) => `${i ? 'L' : 'M'}${px(r.t).toFixed(1)} ${pyA(log10Abs(r.g)).toFixed(1)}`).join(' ');
  const offTop = rows.findIndex((r) => log10Abs(r.g) > DEC);
  const offBottom = rows.findIndex((r) => r.g !== 0 && log10Abs(r.g) < -DEC);

  // ── plot B: h(t), auto-fitted but never tighter than −1.5…+1.5
  const lo0 = Math.min(-1.5, ...hs);
  const hi0 = Math.max(1.5, ...hs);
  const pad = (hi0 - lo0) * 0.04;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const pyB = (v) => PT + ((hi - v) / (hi - lo)) * IH;
  const pathB = rows.map((r, i) => `${i ? 'L' : 'M'}${px(r.t).toFixed(1)} ${pyB(r.h).toFixed(1)}`).join(' ');
  const yTicksB = niceTicks(lo, hi, 5);
  const bandThin = pyB(-1) - pyB(1) < 14;

  const c = rows[ct];
  const factor = ct > 0 ? w * DACT[phi](c.a) : null;

  return (
    <Lab
      title={<>Slide 40 live · one unit, the same <Nc>w</Nc> at every step</>}
      slides="slide 40"
      tryThis="pick “exploding outputs · ReLU, w = 1.2” after predicting what h(t) does over 50 steps — it explodes, while tanh stays inside ±1. Then drag w below 1 and watch plot A sink under the dashed line."
    >
      <div className="dl-lab__controls">
        <Chips label="presets" value={preset} options={PRESETS} onChange={applyPreset} />
        <Chips label="activation φ" code value={phi} options={[{ v: 'tanh', l: 'tanh (the default)' }, { v: 'relu', l: 'ReLU' }]} onChange={setPhi} />
        <Chips label="input u·x(t)" code value={input} options={Object.entries(INPUTS).map(([v, o]) => ({ v, l: o.l }))} onChange={setInput} />
        <div className="dl-sliders">
          <Range label="w (recurrent weight)" value={w} min={-2} max={2} step={0.05} onChange={setW} fmt={(v) => fmtSigned(v, 2)} />
          <Range label="T (time steps)" value={T} min={10} max={T_MAX} step={5} onChange={setT} />
        </div>
      </div>

      <p className="dl4s-mono dl4s-grad-eq">
        h(t) = {PHI_NAME[phi]}(w·h(t−1) + u·x(t)), h(0) = 0 &nbsp;·&nbsp; ∂h(t)/∂h(0) = w·φ′(a(1)) × w·φ′(a(2)) × … × w·φ′(a(t))
      </p>

      <div className="dl4s-grad-plots">
        {/* ── A · the gradient, log scale */}
        <svg
          viewBox={`0 0 ${PW} ${PH}`}
          className="dl4s-svg dl4s-grad-plot"
          role="img"
          aria-label={`Plot A: the size of ∂h(t)/∂h(0) on a log scale over ${T} steps. It ends ${verdict === 'zero' ? `at exactly 0 from step ${zeroAt}` : `near 10 to the power ${kT.toFixed(1)}`}. Arrow keys move the cursor.`}
          {...plotProps}
        >
          <text x={8} y={14} className="dl4s-svg__label dl4s-svg__label--ink">A · |∂h(t)/∂h(0)|, log scale</text>
          <text x={PW - PR} y={14} textAnchor="end" className="dl4s-tick dl4s-grad-head">t = {ct}: {c.g === 0 ? '0' : fmtVal(Math.abs(c.g))}</text>
          {DEC_TICKS.map((k) => (
            <g key={k}>
              <line x1={PL} y1={pyA(k)} x2={PL + IW} y2={pyA(k)} className={k === 0 ? 'dl4s-grad-one' : 'dl4s-gridline'} />
              <text x={PL - 5} y={pyA(k) + 3} textAnchor="end" className="dl4s-tick">{k === 0 ? '1' : `10${sup(k)}`}</text>
            </g>
          ))}
          <text x={PL + 6} y={PT + 11} className="dl4s-svg__label dl4s-grad-halo">↑ grows (exploding)</text>
          <text x={PL + 6} y={PT + IH - 5} className="dl4s-svg__label dl4s-grad-halo">↓ shrinks (vanishing)</text>
          <XAxis ticks={xTicks} px={px} />
          <line x1={px(ct)} y1={PT} x2={px(ct)} y2={PT + IH} className="dl4s-grad-cursor" />
          <path d={pathA} className="dl4s-curve dl4s-grad-curve--g" />
          {offTop >= 0 && (
            <text x={PL + IW - 4} y={PT + 11} textAnchor="end" className="dl4s-tick dl4s-grad-halo">off the scale from t = {offTop}</text>
          )}
          {(offBottom >= 0 || zeroAt >= 0) && (
            <text x={PL + IW - 4} y={PT + IH - 5} textAnchor="end" className="dl4s-tick dl4s-grad-halo">
              {zeroAt >= 0 && (offBottom < 0 || zeroAt <= offBottom) ? `exactly 0 from t = ${zeroAt} (φ′ = 0)` : `off the scale from t = ${offBottom}`}
            </text>
          )}
          <circle cx={px(T)} cy={pyA(kT)} r={3.4} className="dl4s-grad-dot dl4s-grad-dot--g" />
          <circle cx={px(ct)} cy={pyA(log10Abs(c.g))} r={3} className="dl4s-grad-dot" />
        </svg>

        {/* ── B · the output h(t) */}
        <svg
          viewBox={`0 0 ${PW} ${PH}`}
          className="dl4s-svg dl4s-grad-plot"
          role="img"
          aria-label={`Plot B: the output h(t) over ${T} steps, with the band from −1 to +1 shaded. h(${T}) = ${fmtVal(last.h)}. Arrow keys move the cursor.`}
          {...plotProps}
        >
          <text x={8} y={14} className="dl4s-svg__label dl4s-svg__label--ink">B · the output h(t)</text>
          <text x={PW - PR} y={14} textAnchor="end" className="dl4s-tick dl4s-grad-head">t = {ct}: h = {fmtVal(c.h)}</text>
          <rect x={PL} y={pyB(1)} width={IW} height={Math.max(1, pyB(-1) - pyB(1))} className="dl4s-grad-band" />
          {yTicksB.map((v) => (
            <g key={v}>
              <line x1={PL} y1={pyB(v)} x2={PL + IW} y2={pyB(v)} className="dl4s-gridline" />
              <text x={PL - 5} y={pyB(v) + 3} textAnchor="end" className="dl4s-tick">{fmtTick(v)}</text>
            </g>
          ))}
          {bandThin ? (
            <text x={PL + 6} y={PT + 11} className="dl4s-svg__label dl4s-grad-halo">the −1…+1 band (tanh’s range) is the sliver at 0</text>
          ) : (
            <text x={PL + IW - 4} y={pyB(1) - 5} textAnchor="end" className="dl4s-svg__label dl4s-grad-halo">−1…+1 band (tanh’s range)</text>
          )}
          <XAxis ticks={xTicks} px={px} />
          <line x1={px(ct)} y1={PT} x2={px(ct)} y2={PT + IH} className="dl4s-grad-cursor" />
          <path d={pathB} className="dl4s-curve dl4s-grad-curve--h" />
          {outAt >= 0 && (
            <g>
              <circle cx={px(outAt)} cy={pyB(rows[outAt].h)} r={3.2} className="dl4s-grad-dot dl4s-grad-dot--h" />
              <text x={px(outAt) + 6} y={pyB(rows[outAt].h) - 8} className="dl4s-tick dl4s-grad-halo">leaves ±1 at t = {outAt}</text>
            </g>
          )}
          <circle cx={px(T)} cy={pyB(last.h)} r={3.4} className="dl4s-grad-dot dl4s-grad-dot--h" />
          <circle cx={px(ct)} cy={pyB(c.h)} r={3} className="dl4s-grad-dot" />
        </svg>
      </div>

      <p className="dl4s-readout dl4s-mono dl4s-grad-cur" aria-live="polite">
        {ct === 0 ? (
          <>cursor t = 0: h(0) = 0, the initial state · ∂h(0)/∂h(0) = 1</>
        ) : (
          <>
            cursor t = {ct}: a = w·h({ct - 1}) + u·x({ct}) = {fmtSigned(w, 2)} × {fmtVal(rows[ct - 1].h)} {plusTerm(INPUTS[input].xs[ct - 1])} = {fmtVal(c.a)} · h({ct}) = {PHI_NAME[phi]}(a) = {fmtVal(c.h)} · this step’s factor w·φ′(a) = <b>{fmtSigned(factor, 3)}</b> · ∂h({ct})/∂h(0) = <b><Sci v={c.g} /></b>
          </>
        )}
      </p>
      <p className="dl4s-cap">Hover, drag or focus a plot and use the arrow keys to move the cursor through time.</p>

      <p className="dl4s-readout" aria-live="polite">
        After {T} steps the gradient has been multiplied by w·φ′(a) {T} times →{' '}
        {verdict === 'zero' ? (
          <b>exactly 0</b>
        ) : (
          <b>×10<sup>{fmtSigned(kT, 1)}</sup></b>
        )}
        .{' '}
        {verdict === 'vanish' && <>It <b>vanishes</b>: each step multiplies it by about {perStep.toFixed(2)} (below 1), so h({T}) has almost no dependence on h(0) — the start of the sequence is gradually forgotten.</>}
        {verdict === 'explode' && <>It <b>explodes</b>: each step multiplies it by about {perStep.toFixed(2)} (above 1), and it is the same w every time.</>}
        {verdict === 'flat' && <>Each step multiplies it by about {perStep.toFixed(2)}, close to 1, so it neither vanishes nor explodes over these {T} steps.</>}
        {verdict === 'zero' && <>At t = {zeroAt} the ReLU’s input a was not positive, so φ′(a) = 0 and the product is 0 from then on: h({T}) no longer depends on h(0) at all.</>}
        {' '}
        {phi === 'tanh'
          ? <>The output h(t) stays inside −1…+1 (tanh saturates); its largest size here is {fmtVal(hMax)}.</>
          : outAt >= 0
            ? <>The output h(t) has no ceiling with ReLU: it leaves ±1 at t = {outAt} and reaches h({T}) = {fmtVal(last.h)}{w > 1 && hMax > 10 ? ' — exploding outputs' : ''}.</>
            : <>The output h(t) stays inside ±1 here (largest size {fmtVal(hMax)}), but nothing in ReLU would stop it growing.</>}
      </p>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat
          k={<Nc>|∂h({T})/∂h(0)|</Nc>}
          v={verdict === 'zero' ? '0' : <>×10<sup>{fmtSigned(kT, 1)}</sup></>}
          sub={`${T} factors of w·φ′(a) multiplied together`}
          tone="accent"
        />
        <Stat k="typical factor per step" v={verdict === 'zero' ? '0' : `|w·φ′| ≈ ${perStep.toFixed(3)}`} sub="geometric mean over the steps — below 1 shrinks, above 1 grows" />
        <Stat k={<><Nc>h({T})</Nc>, the last output</>} v={fmtVal(last.h)} sub={phi === 'tanh' ? 'tanh keeps every h(t) inside −1…+1' : 'ReLU has no ceiling on h(t)'} />
      </div>

      <p className="dl4s-cap">
        This page’s own one-unit toy, not a trained network: u = 1, no bias, h(0) = 0, and the inputs above. Every number is computed live from it — slide 40
        gives no numbers. The vertical scale of plot A is clamped at 10<sup>±16</sup>; plot B rescales to fit h(t).
      </p>
    </Lab>
  );
}

function XAxis({ ticks, px }) {
  return (
    <g>
      <line x1={PL} y1={PT + IH} x2={PL + IW} y2={PT + IH} className="dl4s-axis" />
      {ticks.map((t) => (
        <text key={t} x={px(t)} y={PT + IH + 13} textAnchor="middle" className="dl4s-tick">{t}</text>
      ))}
      <text x={PL + IW} y={PH - 4} textAnchor="end" className="dl4s-svg__label">time step t</text>
    </g>
  );
}

// maths inside an uppercase label keeps its case (h is not H, σ is not Σ)
function Nc({ children }) {
  return <span className="dl4s-grad-nocase">{children}</span>;
}

// a value as 4.8 × 10⁻⁴ when it is very small or very large, plain otherwise
function Sci({ v }) {
  if (v === 0 || !Number.isFinite(v)) return <>{v === 0 ? '0' : '—'}</>;
  const { m, e } = sciParts(v);
  if (e >= -2 && e <= 3) return <>{fmtVal(v)}</>;
  return <>{fmtSigned(m, 1)} × 10<sup>{fmtSigned(e, 0)}</sup></>;
}

/* ── §12 · batch norm vs layer norm (slide 41) ──────────────────────────── */
// 4 instances × 5 features, each feature on its own scale (this page's own)
const NORM_FEATS = [
  { mu: 0.5, sd: 0.15, dp: 2 },
  { mu: 12, sd: 3, dp: 1 },
  { mu: -3, sd: 0.8, dp: 2 },
  { mu: 30, sd: 6, dp: 1 },
  { mu: 4, sd: 1.5, dp: 1 },
];
const N_INST = 4;
const N_FEAT = NORM_FEATS.length;
const NORM_BASE = (() => {
  const rnd = mulberry32(4146);
  return Array.from({ length: N_INST }, () =>
    NORM_FEATS.map((f) => {
      const v = f.mu + f.sd * (rnd() * 2 - 1) * 1.5;
      return Number(v.toFixed(f.dp));
    }),
  );
})();
// "perturb instance 1": raise its feature 2 and lower its feature 4, each by
// three of that feature's spreads (chosen so every changed cell visibly moves)
const PERTURB_ROW = 0;
const PERTURB_ADD = NORM_FEATS.map((f, j) => (j === 1 ? 3 * f.sd : j === 3 ? -3 * f.sd : 0));
const NORM_PERTURBED = NORM_BASE.map((r, i) => (i === PERTURB_ROW ? r.map((v, j) => Number((v + PERTURB_ADD[j]).toFixed(NORM_FEATS[j].dp))) : r));
const AXES = [
  { v: 'batch', l: 'batch normalisation (across the batch)' },
  { v: 'features', l: 'layer normalization (across the features)' },
];

export function NormAxisLab() {
  const [axis, setAxis] = useState('batch');
  const [pick, setPick] = useState(0);
  const [perturbed, setPerturbed] = useState(false);
  const headRefs = useRef([]);

  const bn = axis === 'batch';
  const nGroups = bn ? N_FEAT : N_INST;
  const sel = Math.min(pick, nGroups - 1);
  const grid = perturbed ? NORM_PERTURBED : NORM_BASE;

  const run = useMemo(() => normRun(grid, axis), [grid, axis]);
  const changed = useMemo(() => changedCells(run.baseOut, run.out), [run]);
  const nChanged = changed.flat().filter(Boolean).length;
  // both normalisations, for the side-by-side count after perturbing
  const counts = useMemo(() => ({
    batch: changedCells(normRun(NORM_BASE, 'batch').out, normRun(NORM_PERTURBED, 'batch').out).flat().filter(Boolean).length,
    features: changedCells(normRun(NORM_BASE, 'features').out, normRun(NORM_PERTURBED, 'features').out).flat().filter(Boolean).length,
  }), []);
  const inChanged = grid.map((r, i) => r.map((v, j) => v !== NORM_BASE[i][j]));

  const pickHead = (g) => {
    setPick(g);
    headRefs.current[g]?.focus();
  };
  const onHeadKey = (e, g) => {
    const next = { ArrowLeft: g - 1, ArrowUp: g - 1, ArrowRight: g + 1, ArrowDown: g + 1, Home: 0, End: nGroups - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pickHead(Math.max(0, Math.min(nGroups - 1, next)));
  };

  const st = run.stats[sel];
  const members = bn ? NORM_BASE.map((_, i) => ({ name: `instance ${i + 1}`, x: grid[i][sel], z: run.out[i][sel] })) : NORM_FEATS.map((_, j) => ({ name: `feature ${j + 1}`, x: grid[sel][j], z: run.out[sel][j] }));
  const ex = members[0];

  return (
    <Lab
      title="Slide 41 live · batch norm vs layer norm, axis by axis"
      slides="slide 41"
      tryThis="predict which normalised cells change when instance 1 is perturbed under each normalisation — then press perturb, and switch between the two chips."
    >
      <div className="dl-lab__controls">
        <Chips label="normalise" value={axis} options={AXES} onChange={setAxis} />
        <div className="dl4s-norm-act">
          <button type="button" className="dl-btn" aria-pressed={perturbed} onClick={() => setPerturbed((p) => !p)}>
            {perturbed ? 'undo the perturbation' : 'perturb instance 1'}
          </button>
          <span className="dl4s-mini">
            {perturbed
              ? `instance 1’s feature 2 is raised by ${fmtFeat(PERTURB_ADD[1], 1)} and its feature 4 lowered by ${fmtFeat(-PERTURB_ADD[3], 3)}`
              : 'raises instance 1’s feature 2 and lowers its feature 4; nothing else in the batch changes'}
          </span>
        </div>
      </div>

      <div className="dl4s-norm-pair">
        <NormTable
          title="the batch x — this page’s own values"
          axis={axis}
          sel={sel}
          onHover={setPick}
          cell={(i, j) => fmtFeat(grid[i][j], j)}
          margin={run.stats}
          marginFmt={fmtVal}
          changed={inChanged}
          was={(i, j) => fmtFeat(NORM_BASE[i][j], j)}
          heads={{ refs: headRefs, onKey: onHeadKey, onPick: setPick }}
        />
        <NormTable
          title="normalised, (x − μ) / s"
          axis={axis}
          sel={sel}
          onHover={setPick}
          cell={(i, j) => fmtZ(run.out[i][j])}
          tint={(i, j) => run.out[i][j]}
          margin={run.after}
          marginFmt={fmtZ}
          changed={perturbed ? changed : null}
          was={(i, j) => fmtZ(run.baseOut[i][j])}
        />
      </div>

      <p className="dl4s-readout dl4s-mono" aria-live="polite">
        {bn ? `feature ${sel + 1} — one column: mean μ and standard deviation s over the ${N_INST} instances in the batch` : `instance ${sel + 1} — one row: mean μ and standard deviation s over its ${N_FEAT} features`}
        {' · '}μ = <b>{fmtVal(st.mu)}</b>, s = <b>{fmtVal(st.sd)}</b> · e.g. {ex.name}: ({fmtVal(ex.x)} − {fmtVal(st.mu)}) / {fmtVal(st.sd)} = <b className={signClass(ex.z)}>{fmtZ(ex.z)}</b>
        {' · '}(x − μ)/s for the whole {bn ? 'column' : 'row'}: {members.map((m) => fmtZ(m.z)).join(', ')}
      </p>

      <p className="dl4s-readout" aria-live="polite">
        {!perturbed && <>Press <b>perturb instance 1</b> to change two of instance 1’s values and see which normalised cells move.</>}
        {perturbed && bn && <>Batch normalisation: <b>{nChanged} of {N_INST * N_FEAT}</b> normalised values changed — every instance in features 2 and 4, because each column’s μ and s come from the whole batch. Instances 2–4 did not change, yet their outputs did.</>}
        {perturbed && !bn && <>Layer normalization: <b>{nChanged} of {N_INST * N_FEAT}</b> normalised values changed — all in instance 1’s own row. Each instance is normalised on its own, so instances 2–4 are untouched.</>}
      </p>

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k={<>groups (one <Nc>μ</Nc>, one <Nc>s</Nc> each)</>} v={bn ? `${N_FEAT} columns` : `${N_INST} rows`} sub={bn ? `one per feature, each over the ${N_INST} instances` : `one per instance, each over its ${N_FEAT} features`} tone="accent" />
        <Stat k="cells changed by the perturbation" v={perturbed ? `BN ${counts.batch} · LN ${counts.features}` : '—'} sub={perturbed ? `of ${N_INST * N_FEAT}: batch norm reaches across the batch, layer norm stays in instance 1’s row` : 'press perturb instance 1'} />
      </div>

      <p className="dl4s-cap">
        This page’s own seeded values. s is the standard deviation (not the logistic σ), dividing by the group size; only the normalising step is shown.
      </p>
    </Lab>
  );
}

function NormTable({ title, axis, sel, onHover, cell, tint, margin, marginFmt, changed, was, heads }) {
  const bn = axis === 'batch';
  const groupOf = (i, j) => (bn ? j : i);
  const cls = (i, j) => {
    const g = groupOf(i, j);
    let c = 'dl4s-norm-cell';
    if (g % 2) c += ' dl4s-norm-cell--alt';
    if (g === sel) c += ' dl4s-norm-cell--on';
    if (changed?.[i][j]) c += ' dl4s-norm-cell--chg';
    return c;
  };
  const head = (g, text, isCol) => {
    const active = heads && (bn ? isCol : !isCol);
    if (!active) return <span className={g === sel && (bn ? isCol : !isCol) ? 'dl4s-norm-head dl4s-norm-head--on' : 'dl4s-norm-head'}>{text}</span>;
    return (
      <button
        type="button"
        ref={(el) => { heads.refs.current[g] = el; }}
        className={`dl4s-norm-head dl4s-norm-head--btn${g === sel ? ' dl4s-norm-head--on' : ''}`}
        aria-pressed={g === sel}
        tabIndex={g === sel ? 0 : -1}
        onClick={() => heads.onPick(g)}
        onKeyDown={(e) => heads.onKey(e, g)}
      >
        {text}
      </button>
    );
  };
  const mCls = (g) => `dl4s-norm-m${g === sel ? ' dl4s-norm-m--on' : ''}`;

  return (
    <figure className="dl4s-norm-side">
      <figcaption className="dl4s-stagehead">{title}</figcaption>
      <div className="dl4s-norm-frame">
        <span className="dl4s-norm-xlab">features dimension → features</span>
        <span className="dl4s-norm-ylab">batch dimension <span className="dl4s-norm-up">↓</span> instances</span>
        <div className="dl4s-norm-scroll">
          <table className="dl4s-norm-table">
            <thead>
              <tr>
                <th scope="col"><span className="dl4s-norm-sr">instance</span></th>
                {NORM_FEATS.map((_, j) => <th key={j} scope="col">{head(j, `f${j + 1}`, true)}</th>)}
                {!bn && <><th scope="col" className="dl4s-norm-mh">μ</th><th scope="col" className="dl4s-norm-mh">s</th></>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: N_INST }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{head(i, `i${i + 1}`, false)}</th>
                  {NORM_FEATS.map((_, j) => (
                    <td
                      key={j}
                      className={cls(i, j)}
                      style={tint ? { '--v': Math.max(-1, Math.min(1, tint(i, j) / 2)) } : undefined}
                      onMouseEnter={() => onHover(groupOf(i, j))}
                      onClick={() => onHover(groupOf(i, j))}
                    >
                      {cell(i, j)}
                      {changed?.[i][j] && <small>was {was(i, j)}</small>}
                    </td>
                  ))}
                  {!bn && <><td className={mCls(i)}>{marginFmt(margin[i].mu)}</td><td className={mCls(i)}>{marginFmt(margin[i].sd)}</td></>}
                </tr>
              ))}
              {bn && ['mu', 'sd'].map((k) => (
                <tr key={k} className="dl4s-norm-mrow">
                  <th scope="row" className="dl4s-norm-mh">{k === 'mu' ? 'μ' : 's'}</th>
                  {NORM_FEATS.map((_, j) => <td key={j} className={mCls(j)}>{marginFmt(margin[j][k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  );
}

// ── maths (to move into rnn.js) ─────────────────────────────────────────────
// log10 of |g|; −Infinity for an exact 0 (a ReLU step with φ′ = 0)
function log10Abs(g) {
  return g === 0 ? -Infinity : Math.log10(Math.abs(g));
}
// a decade value clamped to plot A's ±16 range (−Infinity → the bottom edge)
function clampDec(k) {
  return Math.max(-DEC, Math.min(DEC, k));
}
// 1–2–2.5–5 ticks covering [lo, hi], at most about n of them
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const mag = 10 ** Math.floor(Math.log10(span / n));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}
// mantissa and exponent: v = m × 10^e with 1 ≤ |m| < 10 (after rounding to 1 dp)
function sciParts(v) {
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** e;
  if (Math.abs(Number(m.toFixed(1))) >= 10) {
    m /= 10;
    e += 1;
  }
  return { m, e };
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sup(n) {
  return String(n).split('').map((ch) => SUP[ch] ?? ch).join('');
}
// a readable value: 3 significant-ish digits, thousands grouped, huge ones as m×10ⁿ
function fmtVal(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) {
    const { m, e } = sciParts(v);
    return `${fmtSigned(m, 2)}×10${sup(e)}`;
  }
  if (a >= 1000) return `${v < 0 ? '−' : ''}${Math.round(a).toLocaleString('en-AU')}`;
  if (a >= 100) return fmtSigned(v, 0);
  if (a >= 10) return fmtSigned(v, 1);
  if (a > 0 && a < 0.001) {
    const { m, e } = sciParts(v);
    return `${fmtSigned(m, 1)}×10${sup(e)}`;
  }
  return fmtSigned(v, a < 0.01 ? 4 : 3);
}
// tick labels for plot B
function fmtTick(v) {
  const a = Math.abs(v);
  if (a >= 1e5) {
    const { m, e } = sciParts(v);
    const m1 = Number(m.toFixed(1));
    return `${fmtSigned(m1, Number.isInteger(m1) ? 0 : 1)}×10${sup(e)}`;
  }
  if (a >= 1000) return `${v < 0 ? '−' : ''}${a.toLocaleString('en-AU')}`;
  return `${v < 0 ? '−' : ''}${Number(a.toPrecision(6))}`;
}
// "+ 0.14" / "− 0.38" for the next term of a written-out sum
const plusTerm = (v) => `${v < 0 ? '−' : '+'} ${Math.abs(v).toFixed(2)}`;
// a normalised value: 2 dp, with −0.00 shown as 0.00
const fmtZ = (z) => fmtSigned(Math.abs(z) < 0.005 ? 0 : z, 2);
const fmtFeat = (v, j) => fmtSigned(v, NORM_FEATS[j].dp);

// Normalise a [batch × features] grid along one axis with normStats, and
// lay the result back out as a grid; `after` re-measures μ and σ of the
// normalised groups (0 and 1), and baseOut is the unperturbed batch's output.
function normRun(grid, axis) {
  const stats = normStats(grid, axis);
  const out = grid.map((r, i) => r.map((_, j) => (axis === 'batch' ? stats[j].norm[i] : stats[i].norm[j])));
  const baseStats = normStats(NORM_BASE, axis);
  const baseOut = NORM_BASE.map((r, i) => r.map((_, j) => (axis === 'batch' ? baseStats[j].norm[i] : baseStats[i].norm[j])));
  return { stats, out, baseOut, after: normStats(out, axis) };
}
// which cells of two equally shaped grids differ
function changedCells(a, b) {
  return a.map((r, i) => r.map((v, j) => Math.abs(v - b[i][j]) > 1e-9));
}
