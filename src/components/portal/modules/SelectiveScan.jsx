import { useState, useEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Icon from '../icons';
import './SelectiveScan.css';

/* ============================================================================
   SELECTIVE SCAN — interactive Mamba playground  (University)
   ----------------------------------------------------------------------------
   The one concept the whole Mamba_PSMA architecture hinges on: the SELECTIVE
   state-space scan. This page lets you *drive* a scalar selective SSM over a
   1-D toy sequence and watch the state recurrence unroll token by token.

   The toy signal is framed as a PSMA-PET intensity profile: a low, noisy
   background (healthy tissue) with a couple of bright spikes (lesion uptake).
   The whole point of Mamba's selectivity is that the state locks onto the
   lesion and coasts through the background — exactly the behaviour we want in
   the segmentation encoder.

   Everything is a pure function of the controls; nothing is fetched. Styled
   with the portal Reading-Room tokens via the .ss-* block in SelectiveScan.css
   so it re-skins with the active theme.
   ========================================================================== */

// ── KaTeX renderer (same pattern as the CITS modules) ───────────────────────
function Tex({ src, block = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) katex.render(src, ref.current, { throwOnError: false, displayMode: block });
  }, [src, block]);
  return <span ref={ref} className={block ? 'ss-tex-block' : 'ss-tex-inline'} />;
}

// ── The model: a scalar selective SSM ────────────────────────────────────────
// Faithful (scalar) version of Mamba-1's per-channel recurrence:
//   Δ_t = softplus(bias + gain·x_t)     ← input-dependent step size (the "select")
//   Ā_t = exp(Δ_t · A)                  ← ZOH discretisation, A<0 ⇒ Ā∈(0,1)
//   B̄_t = Δ_t · B                       ← simplified input gate (B=1 here)
//   h_t = Ā_t·h_{t-1} + B̄_t·x_t          ← the scan (recurrence)
//   y_t = C·h_t                          ← readout (C=1 here)
// With `selective:false` the gain term is dropped, so Δ is constant — that is
// exactly a classic time-invariant SSM (S4), the thing Mamba improved on.
const softplus = (z) => Math.log1p(Math.exp(-Math.abs(z))) + Math.max(z, 0); // stable

function runScan(seq, { A, dtBias, dtGain, selective }) {
  const steps = [];
  let hPrev = 0;
  for (let t = 0; t < seq.length; t++) {
    const x = seq[t];
    const dt = softplus(dtBias + (selective ? dtGain * x : 0));
    const aBar = Math.exp(dt * A);   // A < 0  ⇒  0 < aBar < 1
    const bBar = dt;                 // B = 1
    const retain = aBar * hPrev;     // how much of the past state survives
    const write = bBar * x;          // how much of this token is written in
    const h = retain + write;
    steps.push({ t, x, dt, aBar, bBar, hPrev, retain, write, h, y: h });
    hPrev = h;
  }
  return steps;
}

// ── Toy input sequences (PSMA-PET intensity profiles) ─────────────────────────
const N = 22;
const PRESETS = [
  {
    id: 'one-lesion',
    label: 'One lesion',
    hint: 'A single bright uptake spike buried in low background tissue.',
    data: [0.10, 0.08, 0.12, 0.09, 0.11, 0.10, 0.09, 1.00, 0.96, 0.12,
           0.10, 0.09, 0.11, 0.08, 0.10, 0.12, 0.09, 0.11, 0.10, 0.08, 0.11, 0.09],
  },
  {
    id: 'two-lesions',
    label: 'Two lesions',
    hint: 'Two separate lesions — the state must fire twice and reset between.',
    data: [0.10, 0.09, 0.92, 0.88, 0.11, 0.09, 0.10, 0.12, 0.09, 0.10,
           0.11, 0.98, 1.00, 0.90, 0.10, 0.09, 0.11, 0.08, 0.10, 0.09, 0.11, 0.08],
  },
  {
    id: 'ramp',
    label: 'Rising uptake',
    hint: 'A gradual ramp — no sharp edge, so selectivity has little to grab.',
    data: Array.from({ length: N }, (_, i) => +(0.06 + (0.95 * i) / (N - 1)).toFixed(2)),
  },
  {
    id: 'flat',
    label: 'Flat tissue',
    hint: 'Background only, no lesion — the control case. State should stay quiet.',
    data: [0.11, 0.09, 0.10, 0.12, 0.08, 0.10, 0.11, 0.09, 0.10, 0.12,
           0.08, 0.10, 0.11, 0.09, 0.10, 0.12, 0.08, 0.10, 0.11, 0.09, 0.10, 0.12],
  },
];

const EDIT_LEVELS = [0.10, 0.40, 0.70, 1.00]; // click a bar to cycle through these
const nextLevel = (v) => {
  const i = EDIT_LEVELS.findIndex((l) => Math.abs(l - v) < 0.06);
  return EDIT_LEVELS[(i + 1) % EDIT_LEVELS.length];
};

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// ── Trajectory chart (SVG) ────────────────────────────────────────────────────
function Trajectory({ active, ghost, seq, step, domainMax, showGhost, selective }) {
  const W = 760, H = 230, padL = 40, padR = 14, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const L = seq.length;
  const xAt = (i) => padL + (L <= 1 ? 0 : (i / (L - 1)) * innerW);
  const yAt = (v) => padT + innerH - (Math.max(0, v) / domainMax) * innerH;
  const barW = Math.max(3, (innerW / L) * 0.46);

  const linePath = (steps, upTo) =>
    steps
      .slice(0, upTo + 1)
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(s.t).toFixed(1)} ${yAt(s.h).toFixed(1)}`)
      .join(' ');

  const cur = active[step];
  const gridVals = [0, domainMax / 2, domainMax];

  return (
    <svg className="ss-chart" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label="State trajectory over the input sequence">
      {/* gridlines + y labels */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line className="ss-grid" x1={padL} y1={yAt(v)} x2={W - padR} y2={yAt(v)} />
          <text className="ss-axis-lbl" x={padL - 6} y={yAt(v) + 3} textAnchor="end">{fmt(v, 1)}</text>
        </g>
      ))}
      <text className="ss-axis-title" x={12} y={padT + innerH / 2} transform={`rotate(-90 12 ${padT + innerH / 2})`}>
        state hₜ
      </text>

      {/* input bars (the signal) */}
      {seq.map((v, i) => (
        <rect key={i} className={`ss-bar${i === step ? ' ss-bar--cur' : ''}`}
              x={xAt(i) - barW / 2} y={yAt(v)} width={barW} height={Math.max(0, yAt(0) - yAt(v))} rx={1.5} />
      ))}

      {/* ghost trajectory (the OTHER mode) for comparison */}
      {showGhost && (
        <path className="ss-line ss-line--ghost" d={linePath(ghost, step)} fill="none" />
      )}

      {/* active trajectory */}
      <path className={`ss-line${selective ? ' ss-line--sel' : ' ss-line--lti'}`}
            d={linePath(active, step)} fill="none" />

      {/* current-step marker */}
      {cur && (
        <>
          <line className="ss-cursor" x1={xAt(step)} y1={padT} x2={xAt(step)} y2={yAt(0)} />
          <circle className="ss-dot" cx={xAt(step)} cy={yAt(cur.h)} r={4.5} />
        </>
      )}
    </svg>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────
export default function SelectiveScan() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [seq, setSeq] = useState(PRESETS[0].data);
  const [A, setA] = useState(-0.6);
  const [dtBias, setDtBias] = useState(-1.0);
  const [dtGain, setDtGain] = useState(3.0);
  const [selective, setSelective] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(520); // ms per token

  const L = seq.length;

  // Both trajectories, always — so the axis is stable and the ghost is free.
  const stepsSel = useMemo(() => runScan(seq, { A, dtBias, dtGain, selective: true }), [seq, A, dtBias, dtGain]);
  const stepsLTI = useMemo(() => runScan(seq, { A, dtBias, dtGain, selective: false }), [seq, A, dtBias, dtGain]);
  const active = selective ? stepsSel : stepsLTI;
  const ghost = selective ? stepsLTI : stepsSel;

  const domainMax = useMemo(() => {
    const hi = Math.max(1, ...stepsSel.map((s) => s.h), ...stepsLTI.map((s) => s.h), ...seq);
    return hi * 1.08;
  }, [stepsSel, stepsLTI, seq]);

  const dtMax = useMemo(() => Math.max(...active.map((s) => s.dt), 1e-6), [active]);

  // Animation loop (wraps at the end so it reads as an ambient demo).
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % L), speed);
    return () => clearInterval(id);
  }, [playing, speed, L]);

  // Clamp the read index defensively (all presets are length N, so this is a
  // no-op today, but it keeps indexing safe if a future preset differs).
  const idx = Math.min(step, L - 1);
  const cur = active[idx] ?? active[active.length - 1];

  const applyPreset = (p) => {
    setPresetId(p.id);
    setSeq(p.data);
    setStep(0);
    setPlaying(false);
  };
  const bumpCell = (i) => {
    setSeq((prev) => prev.map((v, j) => (j === i ? nextLevel(v) : v)));
    setPresetId('custom');
    setPlaying(false);
  };

  // Contrast metric: peak state vs. background floor, for the active mode.
  const contrast = useMemo(() => {
    const hs = active.map((s) => s.h);
    const peak = Math.max(...hs);
    const sorted = [...hs].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.4)] || 1e-6; // ~median of the low band
    return { peak, floor, ratio: peak / Math.max(floor, 1e-6) };
  }, [active]);

  const retainPct = Math.round((cur?.aBar ?? 0) * 100);
  const gateVerdict =
    (cur?.aBar ?? 0) > 0.7 ? { k: 'coast', t: 'Coasting — mostly remembering the running state, barely writing this token.' }
    : (cur?.aBar ?? 0) < 0.4 ? { k: 'write', t: 'Writing — the state largely resets and this token is stamped in.' }
    : { k: 'mix', t: 'Mixing — partly keeping the past, partly absorbing this token.' };

  const activePreset = PRESETS.find((p) => p.id === presetId);

  return (
    <div className="pt-module ss">
      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <div>
        <p className="ss-kicker">University · Mamba_PSMA · Interactive</p>
        <h2 className="ss-title">The Selective Scan</h2>
        <p className="pt-module__intro">
          Everything the Mamba encoder does rests on one idea: a state-space model whose <em>step size</em>{' '}
          <Tex src="\Delta" /> is chosen <strong>per token from the input itself</strong>. Big{' '}
          <Tex src="\Delta" /> → forget the past and write this token in; small <Tex src="\Delta" /> → ignore this
          token and coast on the state you already have. Drive it below and watch the state lock onto the “lesion”
          spikes while it slides over the background.
        </p>
      </div>

      {/* ── Theory card ──────────────────────────────────────────────────── */}
      <section className="pt-card ss-theory">
        <p className="ss-card-label">The recurrence, in four lines</p>
        <div className="ss-eqrow">
          <div className="ss-eq">
            <span className="ss-eq-tag">continuous SSM</span>
            <Tex block src="h'(t) = A\,h(t) + B\,x(t), \qquad y(t) = C\,h(t)" />
          </div>
          <div className="ss-eq">
            <span className="ss-eq-tag">discretise (step Δ)</span>
            <Tex block src="\bar A = \exp(\Delta A), \qquad \bar B = \Delta B" />
          </div>
          <div className="ss-eq">
            <span className="ss-eq-tag">the scan</span>
            <Tex block src="h_t = \bar A_t\,h_{t-1} + \bar B_t\,x_t, \qquad y_t = C_t\,h_t" />
          </div>
          <div className="ss-eq">
            <span className="ss-eq-tag">the “selective” part</span>
            <Tex block src="\Delta_t = \mathrm{softplus}\!\big(\text{bias} + \text{gain}\cdot x_t\big)" />
          </div>
        </div>
        <p className="ss-theory-note">
          In real Mamba, <Tex src="\Delta_t, B_t, C_t" /> are all projected from the input (here we vary{' '}
          <Tex src="\Delta_t" /> and hold <Tex src="B=C=1" /> to keep the story on the step size). Because{' '}
          <Tex src="A<0" />, the retain gate <Tex src="\bar A_t = e^{\Delta_t A}" /> sits in{' '}
          <Tex src="(0,1)" />: <Tex src="\Delta_t\!\to\!0 \Rightarrow \bar A_t\!\to\!1" /> (remember), and large{' '}
          <Tex src="\Delta_t \Rightarrow \bar A_t\!\to\!0" /> (forget + write).
        </p>
      </section>

      {/* ── The lab ──────────────────────────────────────────────────────── */}
      <section className="pt-card ss-lab">
        {/* mode + transport */}
        <div className="ss-toolbar">
          <div className="ss-mode">
            <button
              className={`ss-toggle${selective ? ' ss-toggle--on' : ''}`}
              onClick={() => setSelective((v) => !v)}
              aria-pressed={selective}
            >
              <span className="ss-toggle-track"><span className="ss-toggle-knob" /></span>
              <span className="ss-toggle-lbl">
                {selective ? 'Selective (Mamba)' : 'Time-invariant (S4)'}
              </span>
            </button>
            <label className="ss-check">
              <input type="checkbox" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} />
              <span>Ghost the other mode</span>
            </label>
          </div>

          <div className="ss-transport">
            <button className="ss-btn" onClick={() => { setStep(0); setPlaying(false); }} title="Reset">
              <Icon name="arrowLeft" size={14} /> Reset
            </button>
            <button className="ss-btn ss-btn--primary" onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="ss-btn" onClick={() => { setPlaying(false); setStep((s) => (s + 1) % L); }} title="Step">
              Step <Icon name="arrowRight" size={14} />
            </button>
            <label className="ss-speed">
              <span>slow</span>
              <input type="range" min="140" max="900" step="20" value={940 - speed}
                     onChange={(e) => setSpeed(940 - Number(e.target.value))} />
              <span>fast</span>
            </label>
          </div>
        </div>

        {/* trajectory */}
        <Trajectory
          active={active} ghost={ghost} seq={seq} step={idx}
          domainMax={domainMax} showGhost={showGhost} selective={selective}
        />
        <div className="ss-legend">
          <span className={`ss-legend-item ss-legend-item--${selective ? 'sel' : 'lti'}`}>
            <span className="ss-swatch" /> state hₜ ({selective ? 'selective' : 'time-invariant'})
          </span>
          {showGhost && (
            <span className="ss-legend-item ss-legend-item--ghost">
              <span className="ss-swatch" /> {selective ? 'time-invariant' : 'selective'} (ghost)
            </span>
          )}
          <span className="ss-legend-item ss-legend-item--bar">
            <span className="ss-swatch" /> input xₜ (PET intensity)
          </span>
        </div>

        {/* input tape */}
        <div className="ss-tape-wrap">
          <div className="ss-tape" role="group" aria-label="Input sequence (click a bar to edit)">
            {seq.map((v, i) => {
              const tint = active[i] ? active[i].dt / dtMax : 0;
              return (
                <button
                  key={i}
                  className={`ss-cell${i === idx ? ' ss-cell--cur' : ''}`}
                  style={{ '--tint': tint.toFixed(3) }}
                  onClick={() => bumpCell(i)}
                  title={`token ${i}:  x=${fmt(v)}   Δ=${fmt(active[i]?.dt)}   (click to change)`}
                >
                  <span className="ss-cell-bar" style={{ height: `${Math.max(6, v * 100)}%` }} />
                </button>
              );
            })}
          </div>
          <p className="ss-tape-cap">
            input token <Tex src="x_t" /> — <strong>click a bar</strong> to change its value. Fill = intensity;
            tint = <Tex src="\Delta_t" /> (write strength) in the current mode.
          </p>
        </div>

        {/* presets */}
        <div className="ss-presets">
          <span className="ss-presets-lbl">Signal</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`ss-chip${presetId === p.id ? ' ss-chip--on' : ''}`}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
          {presetId === 'custom' && <span className="ss-chip ss-chip--on ss-chip--custom">Custom</span>}
        </div>
        {activePreset && <p className="ss-preset-hint">{activePreset.hint}</p>}
      </section>

      {/* ── Controls + step detail ───────────────────────────────────────── */}
      <div className="ss-grid2">
        <section className="pt-card ss-controls">
          <p className="ss-card-label">Parameters</p>

          <div className="ss-slider">
            <div className="ss-slider-head">
              <span><Tex src="A" /> · state decay</span>
              <code>{fmt(A)}</code>
            </div>
            <input type="range" min="-1.4" max="-0.05" step="0.05" value={A}
                   onChange={(e) => setA(Number(e.target.value))} />
            <p className="ss-slider-note">More negative ⇒ the state forgets faster (shorter memory).</p>
          </div>

          <div className="ss-slider">
            <div className="ss-slider-head">
              <span><Tex src="\Delta" /> bias · baseline step</span>
              <code>{fmt(dtBias)}</code>
            </div>
            <input type="range" min="-3" max="1" step="0.1" value={dtBias}
                   onChange={(e) => setDtBias(Number(e.target.value))} />
            <p className="ss-slider-note">The resting step size when the input is quiet.</p>
          </div>

          <div className={`ss-slider${selective ? '' : ' ss-slider--off'}`}>
            <div className="ss-slider-head">
              <span><Tex src="\Delta" /> gain · input sensitivity</span>
              <code>{selective ? fmt(dtGain) : 'off'}</code>
            </div>
            <input type="range" min="0" max="5" step="0.1" value={dtGain} disabled={!selective}
                   onChange={(e) => setDtGain(Number(e.target.value))} />
            <p className="ss-slider-note">
              How strongly a bright token opens the step. <strong>This is the selectivity.</strong> Set it to 0
              (or flip the toggle) and you’re back to a plain S4.
            </p>
          </div>
        </section>

        <section className="pt-card ss-step">
          <p className="ss-card-label">Token {idx} · the recurrence, evaluated</p>
          <div className="ss-step-eq">
            <Tex block src={`h_{${idx}} = \\bar A_{${idx}}\\,h_{${idx - 1 < 0 ? '{-1}' : idx - 1}} + \\bar B_{${idx}}\\,x_{${idx}}`} />
          </div>
          <div className="ss-step-nums">
            <Tex block src={`= ${fmt(cur?.aBar)}\\cdot ${fmt(cur?.hPrev)} \\; + \\; ${fmt(cur?.bBar)}\\cdot ${fmt(cur?.x)} = \\underbrace{${fmt(cur?.retain)}}_{\\text{retain}} + \\underbrace{${fmt(cur?.write)}}_{\\text{write}} = \\mathbf{${fmt(cur?.h)}}`} />
          </div>

          <div className="ss-gauges">
            <div className="ss-gauge">
              <div className="ss-gauge-head"><span>retain gate <Tex src="\bar A_t" /></span><code>{retainPct}%</code></div>
              <div className="ss-gauge-track"><span className="ss-gauge-fill ss-gauge-fill--retain" style={{ width: `${retainPct}%` }} /></div>
            </div>
            <div className="ss-gauge">
              <div className="ss-gauge-head"><span>step <Tex src="\Delta_t" /></span><code>{fmt(cur?.dt)}</code></div>
              <div className="ss-gauge-track"><span className="ss-gauge-fill ss-gauge-fill--dt" style={{ width: `${Math.min(100, (cur?.dt / dtMax) * 100)}%` }} /></div>
            </div>
          </div>

          <p className={`ss-verdict ss-verdict--${gateVerdict.k}`}>{gateVerdict.t}</p>
        </section>
      </div>

      {/* ── What just happened / PSMA framing ────────────────────────────── */}
      <section className="pt-card ss-takeaway">
        <p className="ss-card-label">Why this is the whole game for PSMA</p>
        <div className="ss-takeaway-grid">
          <div className="ss-take">
            <span className="ss-take-n">01</span>
            <p>
              <strong>Selective ≠ time-invariant.</strong> Flip the toggle on the “One lesion” signal. The
              time-invariant scan (S4) smears every token through the same fixed filter — the lesion barely rises
              above a raised background floor. The selective scan fires sharply on the lesion and stays quiet
              elsewhere. Peak-to-background contrast right now:{' '}
              <strong>{fmt(contrast.ratio, 1)}×</strong>.
            </p>
          </div>
          <div className="ss-take">
            <span className="ss-take-n">02</span>
            <p>
              <strong>Background suppression is content-based.</strong> The gate <Tex src="\bar A_t" /> isn’t a
              fixed schedule — it’s computed from <Tex src="x_t" /> every step. That is precisely what lets the
              encoder “decide” a stretch of healthy tissue doesn’t deserve state, while a bright uptake voxel
              does. It is soft, learned attention with an <Tex src="O(L)" /> price tag.
            </p>
          </div>
          <div className="ss-take">
            <span className="ss-take-n">03</span>
            <p>
              <strong>This scans a line; the encoder scans a volume.</strong> In{' '}
              <code>mamba_block_3d.py</code> the 3-D feature map is flattened{' '}
              <Tex src="(B,C,d,h,w)\to(B,L,C)" /> and this exact recurrence runs along <Tex src="L" />, then it’s
              reshaped back. Same maths — just <Tex src="L" /> is now a whole patch of voxels, not 22 toy tokens.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
