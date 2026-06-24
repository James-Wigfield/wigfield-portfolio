import { useEffect, useMemo, useState } from 'react';

/* ============================================================================
   HONOURS PROJECT TRACKER  —  Mamba_PSMA
   ----------------------------------------------------------------------------
   A visual, interactive progress dashboard for the CITS4010 honours project,
   populated from documentation/progress-tracking/index.html (the standalone
   gap-analysis site). Self-contained: the content below is the source of truth
   for this view, styled with the portal's "Reading Room" tokens (portal.css,
   .htk-* classes). Animated rings/bars/count-ups + an interactive preprocessing
   pipeline, a baseline "scan viewport", a filterable comparison table and flags.
   ========================================================================== */

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

const PROJECT = {
  code: 'CITS4010 · Honours',
  title: 'Optimising PSMA PET Segmentation with Mamba',
  blurb:
    'A 3D hybrid CNN–Mamba architecture with an asymmetric Tversky loss, benchmarked ' +
    'against the nnU-Net cascade baseline on whole-body ⁶⁸Ga-PSMA-11 PET/CT.',
  supervisor: 'Dr. Jake Kendrick',
  updated: '24 Jun 2026',
  stage: 'Implementation · preprocessing pipeline done',
};

// area → modules with executable code / total
const MODULES = [
  { area: 'Pre-processing', done: 9, total: 9 },
  { area: 'Models', done: 0, total: 4 },
  { area: 'Training', done: 0, total: 3 },
  { area: 'Evaluation', done: 0, total: 3 },
  { area: 'Scripts', done: 0, total: 3 },
  { area: 'Configs', done: 1, total: 3 },
];

const ROADMAP = [
  { label: 'Lit review', state: 'done' },
  { label: 'Proposal', state: 'done' },
  { label: 'Preprocessing', state: 'done' },
  { label: 'Model', state: 'next' },
  { label: 'Experiments', state: 'todo' },
  { label: 'Thesis', state: 'todo' },
];

// The preprocessing pipeline as an interactive flow.
const PIPELINE = [
  { key: 'load', name: 'Load', file: 'dataloader.py', io: 'CT + PET', status: 'done',
    detail: 'Discovers & loads _0000 (CT) / _0001 (PET) pairs by case ID via SimpleITK.' },
  { key: 'register', name: 'Register', file: 'registration.py', io: 'CT → PET grid', status: 'done',
    detail: 'resample_ct_to_pet aligns the CT onto the PET grid (skips if already aligned). Mirrors the PSMASegmentator reference.' },
  { key: 'resample', name: 'Resample', file: 'resampling.py', io: '→ ~4 mm', status: 'done', tag: 'new',
    detail: 'resample_to_spacing brings both modalities to ~4 mm near-isotropic spacing — the step nnU-Net otherwise hides internally.' },
  { key: 'normalise', name: 'Normalise', file: 'normalisation.py', io: 'CTNorm', status: 'done',
    detail: 'Per-channel clip + z-score using the plans.json stats. Verified: CT → [−2.94, 3.74], PET → [−0.72, 5.47] on real data.' },
  { key: 'patch', name: 'Patch', file: 'patch_sampling.py', io: '~33% fg crop', status: 'hpc',
    detail: 'MONAI RandCropByPosNegLabeld (lesion-biased, ~33% foreground) + flips / rotations / intensity jitter. Runs on the HPC.' },
  { key: 'tensor', name: 'Tensor', file: 'dataset.py', io: '(B,2,64,128,64)', status: 'hpc', tag: 'new',
    detail: 'PSMADataset + build_dataloaders yield batched tensors, with an optional on-disk cache of the deterministic core.' },
];

const BASELINE = {
  source: 'nnU-Net 3D U-Net cascade · Kendrick et al. 2022 · held-out test (n = 128)',
  metrics: [
    { label: 'Lesion sensitivity', value: 73.0, gap: true, note: '◂ the gap' },
    { label: 'Lesion PPV', value: 88.2 },
    { label: 'Lesion F1', value: 79.9 },
    { label: 'Patient accuracy', value: 94.5 },
  ],
};

const DONE = [
  { title: 'Data pipeline core', files: 'registration · resampling · normalisation · preprocess',
    note: 'The deterministic core (numpy + SimpleITK). Verified on 3 local autoPET cases.', tag: 'verified' },
  { title: 'Patch sampling + DataLoader', files: 'patch_sampling · dataset',
    note: 'MONAI lesion-biased crops + augments → batched tensors. Runs on the HPC.', tag: 'runs on hpc' },
  { title: 'Splits, stats & config', files: 'utils.py · configs/baseline.yaml',
    note: 'Patient-level leakage-free splits, foreground-stats fingerprint, grid checks; plans-matched normalisation.', tag: 'done' },
  { title: 'Smoke test', files: 'test_pipeline.py',
    note: 'Asserts shapes, channel order, value ranges, label path & split integrity. All checks pass.', tag: 'passing' },
  { title: 'DICOM → NIfTI conversion', files: 'dicom_to_nifti.py · 441 lines',
    note: 'CT HU stacking, PET LPS + SUV-BW scaling, tag validation. Near-verbatim of the reference.', tag: 'done' },
  { title: 'NIfTI pair discovery', files: 'dataloader.py · 102 lines',
    note: 'Groups _0000 (CT) / _0001 (PET) by case ID via SimpleITK.', tag: 'done' },
];

const CAVEATS = [
  { title: 'Parity replicated, not yet bit-identical',
    body: 'baseline.yaml reproduces the plans.json stats/spacing/patch, but nnU-Net resamples in transposed axes — confirm axis order for exact parity, and recompute the CTNormalization stats on the real training set.' },
  { title: 'Verified scope = the deterministic core',
    body: 'The numpy + SimpleITK path is verified on real data; the MONAI DataLoader layer is syntax-checked only locally (torch / monai / scipy are not on the dev machine).' },
];

const TODO = [
  { group: 'Data & labels', count: 'blocks training', hot: true, items: [
    'Acquire labelled data — local autoPET cases are inference-only (full autoPET-PSMA ships labels, or SCGH).',
    'RTSTRUCT → GT mask generation for SCGH labels.',
    'Recompute normalisation stats on the real training set.' ] },
  { group: 'Model', count: '0 / 4', items: [
    'mamba_block_3d.py — 3D→1D flatten, multi-directional scan.',
    'encoder.py — CNN + Mamba stages.', 'decoder.py — upsampling + skips + head.',
    'psma_mamba.py — top-level wiring (fix the channel-0 comment).' ] },
  { group: 'Training', count: '0 / 3', items: [
    'loss.py — Tversky (α=0.3, β=0.7) + BCE.', 'train.py — AMP loop, checkpoints, DDP.',
    'scheduler.py — cosine + warmup.' ] },
  { group: 'Evaluation', count: '0 / 3', items: [
    'metrics.py — lesion-F1 (CCA, 25 mm³, 10% overlap).',
    'inference.py — overlap-tile sliding window.', 'evaluate.py — results vs baseline.' ] },
  { group: 'Entrypoints', count: '0 / 3', items: [
    'run_preprocessing.py', 'run_training.py', 'run_eval.py' ] },
  { group: 'Configs', count: '1 / 3', items: [
    'baseline.yaml — done.', 'experiments/mamba1_tversky.yaml — stub.',
    'experiments/mamba2_tversky.yaml — stub.' ] },
];

const COMPARISON = [
  { c: 'CT/PET DICOM→NIfTI', repo: 'dicom_to_nifti.py', verdict: 'aligned', v: 'Aligned' },
  { c: 'NIfTI pair discovery', repo: 'dataloader.py', verdict: 'new', v: 'New' },
  { c: 'CT→PET grid resample', repo: 'registration.py', verdict: 'aligned', v: 'Aligned' },
  { c: 'Resample to spacing', repo: 'resampling.py', verdict: 'aligned', v: 'Now explicit' },
  { c: 'Intensity normalisation', repo: 'normalisation.py + baseline.yaml', verdict: 'aligned', v: 'Aligned' },
  { c: 'Patch sampling', repo: 'patch_sampling.py', verdict: 'aligned', v: 'Parity default' },
  { c: 'Patient-level splits', repo: 'utils.py', verdict: 'new', v: 'New' },
  { c: 'RTSTRUCT → GT masks', repo: '— (not handled)', verdict: 'missing', v: 'Missing' },
  { c: 'Overall framework', repo: 'Standalone PyTorch + MONAI', verdict: 'diverges', v: 'Diverges' },
];

const FLAGS = {
  resolved:
    'Channel order confirmed CT = 0 / PET = 1 (plans.json channel-0 stats are CT Hounsfield units); ' +
    'nnU-Net preprocessing parity now replicated in baseline.yaml.',
  open: [
    { title: 'No ground-truth masks yet',
      body: 'Local autoPET cases are inference-only and RTSTRUCT→GT generation is not implemented — training is blocked until labelled data is in place.' },
    { title: 'MONAI layer unverified on the dev machine',
      body: 'torch / monai / scipy aren’t installed locally, so dataset.py and patch_sampling.py are syntax-checked only. Exercise them on the HPC.' },
    { title: 'Follow-up: fix the channel-0 comment',
      body: 'models/psma_mamba.py still says “channel 0: PET” — now confirmed wrong (CT = 0). Fix when the model is built.' },
    { title: 'Obsidian vault not found',
      body: 'The project-memory vault referenced in CLAUDE.md (james-claude-brain) does not exist on disk. Confirm whether it moved.' },
  ],
};

const VIEWS = ['Pipeline', 'Status', 'Baseline', 'Comparison', 'Flags'];

// ── easeOut count-up hook (rAF timestamp; reruns when `run` toggles) ──────────
function useCountUp(target, { duration = 850, decimals = 0, run = true } = {}) {
  const [val, setVal] = useState(run && !REDUCED ? 0 : target);
  useEffect(() => {
    if (!run || REDUCED) { setVal(target); return; }
    let raf, start;
    const tick = (t) => {
      start ??= t;
      const p = Math.min(1, (t - start) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, run]);
  return decimals ? Number(val).toFixed(decimals) : Math.round(val);
}

function Num({ value, decimals = 0, run }) {
  return <>{useCountUp(value, { decimals, run })}</>;
}

export default function HonoursTracker() {
  const [view, setView] = useState('Pipeline');
  const [stage, setStage] = useState(PIPELINE[0].key);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState({ done: true, caveats: false, todo: true });

  const totals = useMemo(() => {
    const done = MODULES.reduce((a, m) => a + m.done, 0);
    const total = MODULES.reduce((a, m) => a + m.total, 0);
    return { done, total, pct: Math.round((done / total) * 100) };
  }, []);
  const ringPct = useCountUp(totals.pct, { duration: 1000 });

  const activeStage = PIPELINE.find((s) => s.key === stage) ?? PIPELINE[0];
  const filtered = filter === 'all' ? COMPARISON : COMPARISON.filter((r) => r.verdict === filter);

  return (
    <div className="pt-module htk">

      {/* ── Header: project + overall ring ─────────────────────────────── */}
      <header className="pt-card htk-head">
        <div className="htk-head__meta">
          <p className="htk-head__code">{PROJECT.code} · updated {PROJECT.updated}</p>
          <h3 className="htk-head__title">{PROJECT.title}</h3>
          <p className="htk-head__blurb">{PROJECT.blurb}</p>
          <p className="htk-head__sub">
            supervisor {PROJECT.supervisor} &nbsp;·&nbsp; {PROJECT.stage}
          </p>
        </div>
        <div className="htk-head__progress">
          <div className="pt-ring htk-ring" style={{ '--pct': ringPct }} role="img"
               aria-label={`${totals.pct}% of code modules implemented`}>
            <span className="pt-ring__num">{ringPct}<small>%</small></span>
          </div>
          <p className="htk-head__rsub">{totals.done} / {totals.total} modules</p>
        </div>
      </header>

      {/* ── Key finding ────────────────────────────────────────────────── */}
      <div className="pt-card htk-finding">
        <span className="htk-label htk-label--accent">Key finding</span>
        <p>
          Standalone <strong>PyTorch + MONAI</strong> pipeline — the proposal called for training
          <em> inside</em> the nnU-Net framework, so its rule-based preprocessing had to be rebuilt by hand.
          It now is: the recipe (CTNormalization, ~4 mm spacing, 64×128×64, ~33% foreground) was lifted from
          the deployed <code>plans.json</code> into <code>baseline.yaml</code>, keeping the baseline comparison fair.
        </p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="htk-seg" role="tablist" aria-label="Project views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`htk-seg__tab${v === view ? ' htk-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── PIPELINE ───────────────────────────────────────────────────── */}
      {view === 'Pipeline' && (
        <div className="htk-panel" role="tabpanel">
          <div className="pt-card htk-pipe">
            <div className="htk-pipe__track">
              <span className="htk-pipe__flow" aria-hidden="true" />
              {PIPELINE.map((s) => (
                <button
                  key={s.key}
                  className={`htk-stage htk-stage--${s.status}${s.key === stage ? ' htk-stage--active' : ''}`}
                  onClick={() => setStage(s.key)}
                  aria-pressed={s.key === stage}
                >
                  <span className="htk-stage__dot" />
                  <span className="htk-stage__name">{s.name}{s.tag && <span className="htk-stage__tag">new</span>}</span>
                  <span className="htk-stage__io">{s.io}</span>
                </button>
              ))}
            </div>
            <div className="htk-detail" key={activeStage.key}>
              <p className="htk-detail__head">
                <code>{activeStage.file}</code>
                <span className={`htk-pill htk-pill--${activeStage.status}`}>
                  {activeStage.status === 'hpc' ? 'runs on HPC' : 'verified'}
                </span>
              </p>
              <p className="htk-detail__body">{activeStage.detail}</p>
            </div>
          </div>

          {/* module-count tiles */}
          <div className="htk-tiles">
            {MODULES.map((m) => {
              const pct = Math.round((m.done / m.total) * 100);
              return (
                <div key={m.area} className={`pt-card htk-tile${m.done ? ' htk-tile--accent' : ''}`}>
                  <span className="htk-tile__name">{m.area}</span>
                  <span className="htk-tile__num">{m.done}<small> / {m.total}</small></span>
                  <span className="pt-bar htk-tile__bar"><span className="pt-bar__fill" style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
          </div>

          {/* phase roadmap */}
          <div className="htk-road" aria-label="Project roadmap">
            {ROADMAP.map((r, i) => (
              <div key={r.label} className={`htk-road__step htk-road__step--${r.state}`}>
                <span className="htk-road__dot">{r.state === 'done' ? '✓' : i + 1}</span>
                <span className="htk-road__label">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATUS ─────────────────────────────────────────────────────── */}
      {view === 'Status' && (
        <div className="htk-panel" role="tabpanel">
          <Accordion id="done" label="Done — implemented & verified" count={DONE.length}
                     open={open.done} onToggle={() => setOpen((o) => ({ ...o, done: !o.done }))}>
            <div className="htk-cards">
              {DONE.map((d) => (
                <div key={d.title} className="htk-item htk-item--done">
                  <div className="htk-item__top">
                    <span className="htk-chip htk-chip--done">{d.tag}</span>
                    <h5 className="htk-item__title">{d.title}</h5>
                  </div>
                  <p className="htk-item__files"><code>{d.files}</code></p>
                  <p className="htk-item__note">{d.note}</p>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion id="caveats" label="Caveats on the new code" count={CAVEATS.length}
                     open={open.caveats} onToggle={() => setOpen((o) => ({ ...o, caveats: !o.caveats }))}>
            <div className="htk-cards">
              {CAVEATS.map((c) => (
                <div key={c.title} className="htk-item htk-item--warn">
                  <h5 className="htk-item__title">{c.title}</h5>
                  <p className="htk-item__note">{c.body}</p>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion id="todo" label="To do — not started" count={TODO.length + ' groups'}
                     open={open.todo} onToggle={() => setOpen((o) => ({ ...o, todo: !o.todo }))}>
            <div className="htk-todo">
              {TODO.map((g) => (
                <div key={g.group} className={`htk-todo__group${g.hot ? ' htk-todo__group--hot' : ''}`}>
                  <p className="htk-todo__head">{g.group}<span className="htk-todo__count">{g.count}</span></p>
                  <ul className="htk-todo__list">
                    {g.items.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Accordion>
        </div>
      )}

      {/* ── BASELINE (scan viewport) ───────────────────────────────────── */}
      {view === 'Baseline' && (
        <div className="htk-panel" role="tabpanel">
          <div className="htk-scan">
            <p className="htk-scan__head"><span className="htk-scan__dot" />{BASELINE.source}</p>
            <div className="htk-readouts">
              {BASELINE.metrics.map((m) => (
                <div key={m.label} className={`htk-readout${m.gap ? ' htk-readout--gap' : ''}`}>
                  <span className="htk-readout__k">{m.label}{m.note && <em> {m.note}</em>}</span>
                  <span className="htk-readout__v"><Num value={m.value} decimals={1} run />%</span>
                </div>
              ))}
            </div>
            <p className="htk-scan__foot">
              <b>TARGET</b> &rsaquo; +~5 pp lesion sensitivity without losing the 88.2% PPV · halve per-scan inference time.<br />
              <b>INTERVENTION</b> &rsaquo; 3D hybrid CNN–Mamba + asymmetric Tversky loss (β &gt; α, penalises missed lesions).
            </p>
          </div>
        </div>
      )}

      {/* ── COMPARISON ─────────────────────────────────────────────────── */}
      {view === 'Comparison' && (
        <div className="htk-panel" role="tabpanel">
          <p className="htk-cmp__intro">Pre-processing vs the <code>PSMASegmentator</code> reference / nnU-Net.</p>
          <div className="htk-cmp__filters">
            {['all', 'aligned', 'new', 'diverges', 'missing'].map((f) => (
              <button key={f} className={`htk-cmp__chip${filter === f ? ' htk-cmp__chip--active' : ''}`}
                      onClick={() => setFilter(f)}>
                {f}{f !== 'all' && ` · ${COMPARISON.filter((r) => r.verdict === f).length}`}
              </button>
            ))}
          </div>
          <div className="pt-card htk-cmp">
            <table className="htk-table">
              <thead>
                <tr><th>Component</th><th>This repo</th><th>Verdict</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.c}>
                    <td>{r.c}</td>
                    <td><code>{r.repo}</code></td>
                    <td><span className={`htk-verdict htk-verdict--${r.verdict}`}>{r.v}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={3} className="htk-table__empty">No rows.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FLAGS ──────────────────────────────────────────────────────── */}
      {view === 'Flags' && (
        <div className="htk-panel" role="tabpanel">
          <div className="pt-card htk-resolved">
            <span className="htk-label htk-label--ok">Resolved this update</span>
            <p>{FLAGS.resolved}</p>
          </div>
          <div className="htk-flags">
            {FLAGS.open.map((f, i) => (
              <div key={f.title} className="pt-card htk-flag">
                <span className="htk-flag__n">{i + 1}</span>
                <div>
                  <h5 className="htk-flag__title">{f.title}</h5>
                  <p className="htk-flag__body">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible section used by the Status view.
function Accordion({ id, label, count, open, onToggle, children }) {
  return (
    <section className="htk-acc">
      <button className="htk-acc__head" aria-expanded={open} aria-controls={`acc-${id}`} onClick={onToggle}>
        <span className={`htk-acc__caret${open ? ' htk-acc__caret--open' : ''}`}>▸</span>
        <span className="htk-acc__label">{label}</span>
        <span className="htk-acc__count">{count}</span>
      </button>
      {open && <div className="htk-acc__body" id={`acc-${id}`}>{children}</div>}
    </section>
  );
}
