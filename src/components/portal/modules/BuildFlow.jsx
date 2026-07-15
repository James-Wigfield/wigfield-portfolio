import { useState } from 'react';

/* ============================================================================
   BUILD FLOW  —  Mamba_PSMA, end to end
   ----------------------------------------------------------------------------
   A single-glance map of everything built for the honours project: raw scans →
   preprocessing → patches → model (encoder+decoder) → training → GUI, plus what
   comes next. Self-contained (scoped `.bf-*` styles + theme tokens from
   portal.css); a Plain ⇄ Technical toggle swaps every description in place.
   Updated 15 Jul 2026 — the day the model + training loop were built & verified.
   ========================================================================== */

const UPDATED = '15 Jul 2026';

const STATUS = {
  verified: { label: 'Verified', color: 'var(--signal)' },
  today:    { label: 'Built today', color: 'var(--accent)' },
  next:     { label: 'Next', color: 'var(--text-faint)' },
};

const STATS = [
  { v: '39.7M', k: 'model params' },
  { v: '0.97', k: 'overfit Dice' },
  { v: '597', k: 'PSMA studies' },
  { v: '1.8 GB', k: 'VRAM / patch' },
];

// The end-to-end pipeline, top → bottom. `io` = [in, out] shown as a badge.
const STAGES = [
  {
    n: 1, key: 'data', title: 'Raw data', files: 'AutoPET III · PSMA', status: 'verified',
    io: ['DICOM / NIfTI', '597 studies'],
    plain: 'The dataset: 597 whole-body PET/CT studies from 378 patients, already in the standard format with lesion masks.',
    tech: 'PSMA-PET-CT-Lesions_v3 (nnU-Net raw): psma_<patient>_<date>_0000 (CT) / _0001 (PET) + labelsTr. Plugs into discover_nifti_pairs with zero renaming.',
  },
  {
    n: 2, key: 'prep', title: 'Preprocess', files: 'preprocess · registration · resampling · normalisation', status: 'verified',
    io: ['CT + PET', '(2, Z, Y, X)'],
    plain: 'Turn each raw pair into one clean, standardised tensor: line the CT up to the PET, resize to ~4 mm, and level out the brightness.',
    tech: 'load → resample_ct_to_pet → resample_to_spacing [4.0,4.07,4.07] → CTNormalization (both channels) → stack. ~1 s/case; verified CT[-2.94,3.74] PET[-0.72,5.47].',
  },
  {
    n: 3, key: 'patch', title: 'Patch sampling', files: 'patch_sampling · dataset', status: 'today', tag: 'bug fixed today',
    io: ['(2, Z, Y, X)', '(2, 64,128,64)'],
    plain: 'Cut small lesion-centred 3D windows (a tumour is tiny next to a whole body) and randomly flip/rotate them for variety.',
    tech: 'MONAI RandCropByPosNegLabeld (pos:neg 1:2) + flips/rot90/intensity. Fixed a shape-collate crash: rot90 now only spans equal-sized axes.',
  },
  {
    n: 4, key: 'encoder', title: 'Encoder', files: 'encoder.py · mamba_block_3d.py', status: 'verified',
    io: ['(2,64,128,64)', '5 skip maps'],
    plain: 'A CNN reads the patch at full resolution, then shrinks it over 5 stages — adding Mamba long-range context at the deep stages.',
    tech: 'Full-res stem + 4 strided stages; MambaBlock3D at the deepest 3 (6-direction scan). Returns per-stage skips, deepest = bottleneck (320 ch @ 4×8×4).',
  },
  {
    n: 5, key: 'decoder', title: 'Decoder → logits', files: 'decoder.py', status: 'today', tag: 'built today',
    io: ['5 skip maps', '(1,64,128,64)'],
    plain: 'Grows the features back to full resolution, re-joining each encoder skip, and outputs one lesion probability per voxel.',
    tech: 'Mirrors the encoder via its strides: ConvTranspose upsample → concat skip → ConvBlock, ×4, then a 1×1×1 head → binary logits.',
  },
  {
    n: 6, key: 'model', title: 'PSMAMamba — the full model', files: 'psma_mamba.py', status: 'today', tag: 'built today',
    io: ['(B,2,D,H,W)', '(B,1,D,H,W)'],
    plain: 'Encoder + decoder wired into one network — the thing that actually learns to find lesions. 39.7 million parameters.',
    tech: 'PSMAMamba.from_config(config); GPU-verified forward/backward, output dims match input, ~1.8 GB VRAM per patch.',
  },
  {
    n: 7, key: 'train', title: 'Training loop', files: 'loss.py · scheduler.py · train.py', status: 'today', tag: 'built today',
    io: ['patches', 'checkpoint'],
    plain: 'Feeds patches to the model, scores predictions with a loss that punishes missed lesions, and updates the weights — then saves the best model.',
    tech: 'Tversky(0.3/0.7)+BCE, AdamW, warmup→cosine LR, torch.amp. Overfit sanity: fixed-patch Dice 0.46 → 0.97, proving the stack is wired correctly.',
  },
  {
    n: 8, key: 'gui', title: 'GUI viewer', files: 'gui/app.py · viz.py', status: 'today', tag: 'built today',
    io: ['any case', 'browser'],
    plain: 'A local web page to scroll through any scan with the lesion mask overlaid — the visual test harness (and future one-click model runner).',
    tech: 'Streamlit: case picker, axial/coronal/sagittal slider, CT/PET/GT overlays. The "Run model" button is a placeholder for the nnU-Net ↔ mamba toggle.',
  },
];

const NEXT = [
  { title: 'Sliding-window inference', file: 'evaluation/inference.py', why: 'run the model on whole volumes, not just patches' },
  { title: 'Volume Dice / lesion-F1', file: 'evaluation/metrics.py', why: 'real validation, measured against the baseline' },
  { title: 'Full training run', file: 'scripts/run_training.py', why: 'the real patient-level split, not a 2-case overfit' },
  { title: '“Mamba mode” toggle', file: 'PSMASegmentator · segmentate()', why: 'swap nnU-Net ↔ mamba at inference time' },
];

// U-Net ladder: encoder (verified) descends, decoder (built today) mirrors up.
const ENC = [
  { ch: 32, mamba: 0 }, { ch: 64, mamba: 0 }, { ch: 128, mamba: 2 }, { ch: 256, mamba: 2 }, { ch: 320, mamba: 4 },
];

// Fixed-patch overfit: the definitive "it learns" curve (iter, Dice).
const DICE = [
  [0, 0.03], [20, 0.464], [40, 0.683], [60, 0.777], [80, 0.842], [100, 0.885],
  [120, 0.908], [140, 0.921], [160, 0.946], [180, 0.948], [200, 0.966], [220, 0.971], [240, 0.974],
];

// ── U-Net diagram ────────────────────────────────────────────────────────────
function UNet() {
  const W = 760, H = 320, colW = 76, x0 = 40, y0 = 26, step = 58, bw = 60, bh = 40;
  const x = (slot) => x0 + slot * colW;
  const y = (lvl) => y0 + lvl * step;
  const cx = (px) => px + bw / 2;
  const cy = (py) => py + bh / 2;

  const enc = ENC.map((d, lvl) => ({ ...d, lvl, px: x(lvl), py: y(lvl), role: lvl === 4 ? 'bottleneck' : 'enc' }));
  const dec = [3, 2, 1, 0].map((lvl) => ({ ch: ENC[lvl].ch, lvl, px: x(8 - lvl), py: y(lvl), role: 'dec' }));

  const blockFill = (role) => role === 'bottleneck' ? 'var(--accent)' : role === 'dec' ? 'var(--accent-soft)' : 'var(--accent-soft)';
  const blockStroke = (role) => role === 'dec' ? 'var(--accent)' : 'var(--signal)';

  const Block = (b, i) => (
    <g key={`${b.role}-${b.lvl}-${i}`}>
      <rect x={b.px} y={b.py} width={bw} height={bh} rx="4"
            fill={blockFill(b.role)} stroke={blockStroke(b.role)} strokeWidth={b.role === 'bottleneck' ? 2 : 1.4} />
      <text x={cx(b.px)} y={cy(b.py) + 4} textAnchor="middle"
            fontSize="13" fontWeight="700" fill={b.role === 'bottleneck' ? '#fff' : 'var(--ink)'}>{b.ch}</text>
      {b.mamba > 0 && (
        <text x={cx(b.px)} y={b.py - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--accent-ink)">
          Mamba ×{b.mamba}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bf-svg" role="img"
         aria-label="U-Net: a green encoder path descending on the left, a bottleneck at the bottom, and an accent decoder path (built today) mirroring back up on the right, joined by dashed skip connections.">
      <defs>
        <marker id="bfArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-3)" />
        </marker>
      </defs>

      {/* skip connections (dashed, horizontal) */}
      {[0, 1, 2, 3].map((lvl) => {
        const e = enc[lvl], d = dec.find((n) => n.lvl === lvl);
        return <line key={`skip${lvl}`} x1={e.px + bw} y1={cy(e.py)} x2={d.px} y2={cy(d.py)}
                     stroke="var(--accent)" strokeWidth="1.3" strokeDasharray="4 4" opacity="0.6" markerEnd="url(#bfArrow)" />;
      })}

      {/* encoder down arrows */}
      {[0, 1, 2, 3].map((lvl) => (
        <line key={`down${lvl}`} x1={cx(enc[lvl].px)} y1={enc[lvl].py + bh} x2={cx(enc[lvl + 1].px)} y2={enc[lvl + 1].py}
              stroke="var(--ink-3)" strokeWidth="1.4" markerEnd="url(#bfArrow)" />
      ))}

      {/* bottleneck → first decoder, then decoder up arrows */}
      <line x1={enc[4].px + bw} y1={cy(enc[4].py)} x2={dec.find((n) => n.lvl === 3).px} y2={cy(dec.find((n) => n.lvl === 3).py)}
            stroke="var(--ink-3)" strokeWidth="1.4" markerEnd="url(#bfArrow)" />
      {[3, 2, 1].map((lvl) => {
        const a = dec.find((n) => n.lvl === lvl), b = dec.find((n) => n.lvl === lvl - 1);
        return <line key={`up${lvl}`} x1={cx(a.px)} y1={a.py} x2={cx(b.px)} y2={b.py + bh}
                     stroke="var(--ink-3)" strokeWidth="1.4" markerEnd="url(#bfArrow)" />;
      })}

      {/* input + head labels */}
      <text x={enc[0].px - 6} y={cy(enc[0].py) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">in ›</text>
      <text x={dec.find((n) => n.lvl === 0).px + bw + 8} y={cy(y(0)) + 4} fontSize="11" fontWeight="700" fill="var(--accent-ink)">→ 1 (head)</text>

      {enc.map(Block)}
      {dec.map(Block)}

      {/* column captions */}
      <text x={x(0)} y={H - 8} fontSize="10.5" fill="var(--signal)" fontWeight="700">encoder ↓ (verified)</text>
      <text x={x(6)} y={H - 8} fontSize="10.5" fill="var(--accent)" fontWeight="700">decoder ↑ (built today)</text>
    </svg>
  );
}

// ── Overfit Dice curve ───────────────────────────────────────────────────────
function DiceChart() {
  const W = 340, H = 150, pad = { l: 34, r: 12, t: 14, b: 24 };
  const xmax = 240, ylo = 0, yhi = 1;
  const px = (it) => pad.l + (it / xmax) * (W - pad.l - pad.r);
  const py = (d) => pad.t + (1 - (d - ylo) / (yhi - ylo)) * (H - pad.t - pad.b);
  const line = DICE.map(([it, d]) => `${px(it).toFixed(1)},${py(d).toFixed(1)}`).join(' ');
  const area = `${px(0)},${py(0)} ${line} ${px(xmax)},${py(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bf-svg" role="img"
         aria-label="Overfit Dice curve climbing from 0.46 at 20 iterations to 0.97 at 240 iterations.">
      {[0.5, 1.0].map((g) => (
        <g key={g}>
          <line x1={pad.l} y1={py(g)} x2={W - pad.r} y2={py(g)} stroke="var(--line)" strokeWidth="1"
                strokeDasharray={g === 1 ? '3 3' : undefined} />
          <text x={pad.l - 6} y={py(g) + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)">{g.toFixed(1)}</text>
        </g>
      ))}
      <polygon points={area} fill="var(--accent-soft)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {DICE.filter((_, i) => i === 1 || i === DICE.length - 1).map(([it, d]) => (
        <g key={it}>
          <circle cx={px(it)} cy={py(d)} r="3.2" fill="var(--accent)" />
          <text x={px(it)} y={py(d) - 8} textAnchor={it === 240 ? 'end' : 'start'} fontSize="10" fontWeight="700" fill="var(--accent-ink)">{d.toFixed(2)}</text>
        </g>
      ))}
      <text x={(W) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-faint)">training iterations →</text>
    </svg>
  );
}

export default function BuildFlow() {
  const [mode, setMode] = useState('plain');

  return (
    <div className="pt-module bf">
      <style>{CSS}</style>

      {/* header */}
      <header className="pt-card bf-head">
        <div className="bf-head__meta">
          <p className="bf-kicker">CITS4010 · Mamba_PSMA · updated {UPDATED}</p>
          <h3 className="bf-title">What’s been built — start to end</h3>
          <p className="bf-sub">
            The whole pipeline at a glance: a raw PET/CT scan flows down through preprocessing and the
            model to a lesion segmentation, trained end-to-end. <strong>Green = verified earlier,
            accent = built today.</strong>
          </p>
        </div>
        <div className="bf-stats">
          {STATS.map((s) => (
            <div key={s.k} className="bf-stat"><span className="bf-stat__v">{s.v}</span><span className="bf-stat__k">{s.k}</span></div>
          ))}
        </div>
      </header>

      {/* legend + plain/tech toggle */}
      <div className="bf-controls">
        <div className="bf-legend">
          {Object.entries(STATUS).map(([k, s]) => (
            <span key={k} className="bf-leg"><span className="bf-leg__dot" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
        <div className="bf-toggle" role="tablist" aria-label="Description detail">
          {['plain', 'tech'].map((m) => (
            <button key={m} role="tab" aria-selected={mode === m}
                    className={`bf-toggle__btn${mode === m ? ' is-active' : ''}`} onClick={() => setMode(m)}>
              {m === 'plain' ? 'Plain English' : 'Technical'}
            </button>
          ))}
        </div>
      </div>

      {/* the flow spine */}
      <div className="bf-flow">
        {STAGES.map((s) => (
          <div key={s.key} className={`bf-stage bf-stage--${s.status}`} style={{ '--sc': STATUS[s.status].color }}>
            <div className="bf-rail"><span className="bf-rail__dot">{s.n}</span></div>
            <div className="pt-card bf-card">
              <div className="bf-card__top">
                <h4 className="bf-card__title">{s.title}</h4>
                <span className="bf-pill">{STATUS[s.status].label}</span>
                {s.tag && <span className="bf-tag">{s.tag}</span>}
              </div>
              <p className="bf-files"><code>{s.files}</code></p>
              <p className="bf-desc">{mode === 'plain' ? s.plain : s.tech}</p>
              <div className="bf-io">
                <span className="bf-io__x">{s.io[0]}</span>
                <span className="bf-io__arr">→</span>
                <span className="bf-io__x bf-io__x--out">{s.io[1]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* model close-up */}
      <div className="pt-card bf-feature">
        <p className="bf-feature__label">Inside the model — a U-Net shape</p>
        <p className="bf-feature__lead">
          The encoder squeezes the patch down to a dense <strong>bottleneck</strong> (320 channels), then the
          decoder mirrors it back up, re-using the encoder’s <strong>skip connections</strong> so fine detail
          survives. Numbers are channels; Mamba blocks sit only at the deep, low-resolution stages.
        </p>
        <UNet />
      </div>

      {/* training close-up */}
      <div className="pt-card bf-feature">
        <p className="bf-feature__label">Does it actually learn? — the proof</p>
        <div className="bf-proof">
          <DiceChart />
          <div className="bf-proof__note">
            <p>
              The decisive sanity check: train on a <strong>single fixed patch</strong> and watch the overlap
              score (Dice) climb. It rises <strong>0.46 → 0.97</strong> in 240 steps.
            </p>
            <p className="bf-proof__sub">
              A network that fits one patch to ~0.97 has its whole chain wired correctly — labels aligned,
              channels ordered right, gradients flowing. The plumbing works; next comes real training.
            </p>
          </div>
        </div>
      </div>

      {/* what's next */}
      <div className="bf-next">
        <p className="bf-next__label">What’s next</p>
        <div className="bf-next__grid">
          {NEXT.map((n, i) => (
            <div key={n.title} className="pt-card bf-nextcard">
              <span className="bf-nextcard__n">{i + 1}</span>
              <div>
                <p className="bf-nextcard__title">{n.title}</p>
                <p className="bf-nextcard__file"><code>{n.file}</code></p>
                <p className="bf-nextcard__why">{n.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.bf { --sp: 1rem; }
.bf code { font-size: 0.82em; color: var(--ink-2); background: var(--surface-hi); padding: 0.05em 0.35em; border-radius: 3px; }

.bf-head { display: flex; flex-wrap: wrap; gap: 1.2rem 1.6rem; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.4rem; }
.bf-head__meta { flex: 1 1 340px; min-width: 260px; }
.bf-kicker { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin: 0 0 0.45rem; }
.bf-title { font-size: 1.4rem; line-height: 1.2; margin: 0 0 0.5rem; color: var(--ink); }
.bf-sub { font-size: 0.95rem; line-height: 1.6; color: var(--ink-2); margin: 0; max-width: 54ch; }
.bf-sub strong { color: var(--ink); }
.bf-stats { display: grid; grid-template-columns: repeat(2, minmax(80px, 1fr)); gap: 0.5rem; }
.bf-stat { background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 4px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.1rem; }
.bf-stat__v { font-size: 1.15rem; font-weight: 800; color: var(--accent-ink); line-height: 1; }
.bf-stat__k { font-size: 0.68rem; color: var(--text-faint); }

.bf-controls { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; justify-content: space-between; }
.bf-legend { display: flex; flex-wrap: wrap; gap: 0.9rem; }
.bf-leg { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--ink-2); }
.bf-leg__dot { width: 9px; height: 9px; border-radius: 99px; display: inline-block; }
.bf-toggle { display: inline-flex; background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 99px; padding: 2px; }
.bf-toggle__btn { border: 0; background: none; cursor: pointer; font: inherit; font-size: 0.78rem; color: var(--ink-3); padding: 0.28rem 0.8rem; border-radius: 99px; transition: all 0.18s; }
.bf-toggle__btn.is-active { background: var(--accent); color: #fff; font-weight: 600; }

.bf-flow { position: relative; display: flex; flex-direction: column; gap: 0.7rem; }
.bf-flow::before { content: ''; position: absolute; left: 15px; top: 12px; bottom: 12px; width: 2px;
  background: linear-gradient(var(--signal), var(--accent) 45%, var(--text-faint)); opacity: 0.4; }
.bf-stage { position: relative; display: grid; grid-template-columns: 32px 1fr; gap: 0.7rem; align-items: start; }
.bf-rail { position: relative; z-index: 1; display: flex; justify-content: center; padding-top: 0.9rem; }
.bf-rail__dot { width: 32px; height: 32px; border-radius: 99px; display: grid; place-items: center;
  font-size: 0.85rem; font-weight: 800; color: #fff; background: var(--sc);
  box-shadow: 0 0 0 4px var(--c-bg, var(--surface)); }
.bf-card { padding: 0.8rem 1rem; border-left: 3px solid var(--sc); }
.bf-card__top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
.bf-card__title { font-size: 1rem; margin: 0; color: var(--ink); font-weight: 700; }
.bf-pill { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;
  color: var(--sc); border: 1px solid var(--sc); border-radius: 99px; padding: 0.1rem 0.5rem; }
.bf-tag { font-size: 0.64rem; font-weight: 700; color: var(--accent-ink); background: var(--accent-soft); border-radius: 99px; padding: 0.1rem 0.5rem; }
.bf-files { margin: 0 0 0.4rem; }
.bf-desc { font-size: 0.9rem; line-height: 1.55; color: var(--ink-2); margin: 0 0 0.55rem; }
.bf-io { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; flex-wrap: wrap; }
.bf-io__x { font-family: ui-monospace, monospace; background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 3px; padding: 0.12rem 0.4rem; color: var(--ink-2); }
.bf-io__x--out { color: var(--accent-ink); border-color: var(--accent); }
.bf-io__arr { color: var(--text-faint); font-weight: 700; }

.bf-feature { padding: 1.1rem 1.3rem; }
.bf-feature__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent-ink); font-weight: 700; margin: 0 0 0.5rem; }
.bf-feature__lead { font-size: 0.92rem; line-height: 1.6; color: var(--ink-2); margin: 0 0 0.9rem; max-width: 60ch; }
.bf-feature__lead strong { color: var(--ink); }
.bf-svg { width: 100%; height: auto; display: block; }
.bf-proof { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: center; }
.bf-proof > .bf-svg { flex: 1 1 300px; max-width: 380px; }
.bf-proof__note { flex: 1 1 240px; }
.bf-proof__note p { font-size: 0.92rem; line-height: 1.6; color: var(--ink-2); margin: 0 0 0.6rem; }
.bf-proof__note strong { color: var(--accent-ink); }
.bf-proof__sub { font-size: 0.84rem !important; color: var(--ink-3) !important; }

.bf-next__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); font-weight: 700; margin: 0 0 0.6rem; }
.bf-next__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.7rem; }
.bf-nextcard { display: flex; gap: 0.7rem; padding: 0.8rem 0.9rem; border-style: dashed; }
.bf-nextcard__n { flex: none; width: 24px; height: 24px; border-radius: 99px; display: grid; place-items: center;
  font-size: 0.75rem; font-weight: 800; color: var(--text-faint); border: 1.5px dashed var(--text-faint); }
.bf-nextcard__title { font-size: 0.9rem; font-weight: 700; color: var(--ink); margin: 0 0 0.15rem; }
.bf-nextcard__file { margin: 0 0 0.3rem; }
.bf-nextcard__why { font-size: 0.8rem; line-height: 1.45; color: var(--ink-3); margin: 0; }

@media (max-width: 620px) {
  .bf-head { padding: 1rem; }
  .bf-title { font-size: 1.2rem; }
  .bf-proof { flex-direction: column; align-items: stretch; }
}
`;
