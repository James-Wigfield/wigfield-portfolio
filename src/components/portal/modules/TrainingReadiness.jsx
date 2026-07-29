import { useState } from 'react';

/* ============================================================================
   TRAINING READINESS  —  Mamba_PSMA  (University)
   ----------------------------------------------------------------------------
   A run book, meant to be followed top to bottom on the day. Phase A sets up a
   fresh Linux box, Phase B proves it works in ~5 min, Phase C trains. Reference
   numbers live at the bottom so the instructions stay readable.

   Every command in B and C was run for real on the dev PC (RTX 5070 Ti, WSL) on
   28 Jul 2026. Phase A is the tested dev recipe from
   documentation/memory/env-setup-recipe.md, minus the WSL-only parts and adapted
   for the hospital 4090s — the one substantive change being
   TORCH_CUDA_ARCH_LIST 12.0 -> 8.9, because Blackwell kernels will not run on Ada.

   Self-contained (scoped `.tr-*` styles + theme tokens from portal.css).
   ========================================================================== */

const UPDATED = '28 Jul 2026';

const STATS = [
  { v: '~7 h', k: 'full run · 250,000 steps' },
  { v: '95 ms', k: 'per train step · batch 2' },
  { v: 'bf16', k: 'required · fp16 diverges' },
  { v: '2.6 / 24 GB', k: 'peak VRAM on a 4090' },
];

/* Phase A — one-time setup on a fresh Linux machine. */
const SETUP = [
  {
    n: 'A1', title: 'Get the code', time: '1 min',
    cmd: 'git clone <your-repo-url> Mamba_PSMA && cd Mamba_PSMA',
    does: 'Already cloned? Just git pull.',
    expect: 'Then check configs/baseline.yaml contains "amp_dtype: bfloat16". If it does not, you are on pre-28-Jul code and the run will silently die — pull again.',
  },
  {
    n: 'A2', title: 'Conda env + PyTorch', time: '5 min',
    cmd: 'conda create -n mamba python=3.11 -y && conda activate mamba\npip install torch torchvision --index-url https://download.pytorch.org/whl/cu128',
    does: 'Python 3.11 plus the CUDA 12.8 PyTorch build.',
    expect: 'python -c "import torch; print(torch.__version__, torch.cuda.is_available())" prints 2.11.0+cu128 and True.',
  },
  {
    n: 'A3', title: 'Build tools', time: '5 min',
    cmd: 'conda install -c nvidia cuda-toolkit=12.8 -y\nconda install -c conda-forge gcc_linux-64=13 gxx_linux-64=13 -y\nconda deactivate && conda activate mamba',
    does: 'mamba-ssm compiles CUDA from source, so it needs nvcc and a compiler CUDA will accept. CUDA 12.8 rejects GCC 14+, hence pinning 13.',
    expect: 'nvcc --version says 12.8. The re-activate matters — it puts the new toolchain on PATH.',
  },
  {
    n: 'A4', title: 'Compile mamba-ssm for the 4090', time: '10-20 min', tag: 'arch differs from dev PC',
    cmd: 'export CUDA_HOME=$(dirname $(dirname $(which nvcc)))\nexport TORCH_CUDA_ARCH_LIST="8.9+PTX"\nexport CAUSAL_CONV1D_FORCE_BUILD=TRUE\nexport MAMBA_FORCE_BUILD=TRUE\nexport MAX_JOBS=4\npip install causal-conv1d mamba-ssm --no-build-isolation --no-deps --force-reinstall --no-cache-dir --no-binary :all:',
    does: 'Compiles the Mamba CUDA kernels for this card. Several minutes of nvcc output is normal.',
    expect: '8.9 is Ada (4090). The dev PC uses 12.0 for Blackwell — using 12.0 here compiles fine, then fails at the first Mamba call with "no kernel image is available for execution on the device". --no-deps is not optional: without it pip silently swaps your working torch.',
  },
  {
    n: 'A5', title: 'Project dependencies', time: '2 min',
    cmd: 'pip install monai SimpleITK nibabel scipy pyyaml wandb',
    does: 'Installed by name deliberately — do NOT use pip install -r requirements.txt, which re-lists torch and can trigger the swap.',
    expect: 'No mention of torch being downloaded or uninstalled.',
  },
  {
    n: 'A6', title: 'Check the environment', time: '30 s', tag: 'the gate',
    cmd: 'python check_env.py',
    does: 'Checks CUDA, bfloat16 support, a real mamba-ssm forward pass on the GPU, and every dependency including wandb.',
    expect: '"ALL CHECKS PASSED". Do not continue past a [FAIL] — each one becomes a confusing error later.',
  },
];

/* Phase B — prove it works before committing 7 hours. */
const VERIFY = [
  {
    n: 'B1', title: 'Point at the data', time: '1 min',
    cmd: 'export PSMA=/path/to/PSMA-PET-CT-Lesions_v3\nls $PSMA/imagesTr | head -3 && ls $PSMA/imagesTr | wc -l',
    does: 'Sets a variable every later command reuses.',
    expect: 'Filenames like psma_<hash>_<date>_0000.nii.gz, and 1194 files (597 studies x CT + PET). train.py hardcodes the dev PC path, so --data and --labels below are required here.',
  },
  {
    n: 'B2', title: 'Does training start?', time: '~2 min', tag: 'verified',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --data $PSMA/imagesTr --labels $PSMA/labelsTr --overfit 2 --max-iters 12',
    does: 'Runs the whole chain on 2 lesion cases for 12 steps: discover, preprocess, patch, model, Tversky+BCE, bf16 backward, validate, checkpoint.',
    expect: 'A header line reading "amp=True/bfloat16 | lr=0.001", one "iter 10/12" line, a saved checkpoint, exit 0. Dice is noise here — this only proves it runs.',
  },
  {
    n: 'B3', title: 'Does it actually learn?', time: '~4 min', tag: 'verified',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --data $PSMA/imagesTr --labels $PSMA/labelsTr --overfit 2 --max-iters 150',
    does: 'Same path, run long enough to overfit 2 cases — the definitive "the stack is wired right" test.',
    expect: 'train-Dice climbs from ~0.03 toward ~0.95+. If it stalls, something upstream is wrong (labels, channel order, gradients) and the full run is pointless.',
  },
];

/* Phase C — the real thing. */
const RUN = [
  {
    n: 'C1', title: 'Start the full run', time: '~7 h', tag: 'cleared to launch',
    cmd: 'nohup python scripts/run_training.py --config configs/baseline.yaml --data $PSMA/imagesTr --labels $PSMA/labelsTr --wandb > train.log 2>&1 &',
    does: 'The real thing: patient-level 70/10/20 split, 1000 epochs of 250 iters = 250,000 steps, validating and checkpointing every 25 epochs. The nohup and trailing & mean it survives closing the terminal.',
    expect: 'First run writes the split and prints "split written to splits/ (430/57/110 cases)". The first epoch also spends ~8 min building the .npz cache.',
  },
  {
    n: 'C2', title: 'Check on it', time: 'anytime',
    cmd: 'tail -f train.log\nnvidia-smi',
    does: 'Loss and train-Dice print every 10 iters; val-Dice every 25 epochs.',
    expect: 'Loss falling from ~1.1 and GPU utilisation high. If utilisation sits low, data loading is the bottleneck rather than compute. Any "[N non-finite skipped]" is a warning sign — the run aborts itself at 25 in a row.',
  },
  {
    n: 'C3', title: 'If it dies overnight', time: 'seconds',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --data $PSMA/imagesTr --labels $PSMA/labelsTr --wandb --resume checkpoints/checkpoint_last.pth',
    does: 'Restores model, optimiser, scheduler, iteration count, best-Dice and the W&B run id.',
    expect: 'A "[resume] ... at iter N" line, then the LR continues its cosine decay instead of restarting warmup.',
  },
  {
    n: 'C4', title: 'When it finishes', time: '—',
    cmd: 'ls -la checkpoints/\nwandb sync wandb/offline-run-*',
    does: 'checkpoint_best.pth is the one worth keeping. The sync is optional — it uploads the run so you can see the curves in a browser.',
    expect: 'Scalar curves are fine to upload. Do NOT enable logging.wandb.log_images without Dr Kendrick signing off first — those are patient PET/CT slices going to a third-party cloud.',
  },
];

const PHASES = [
  { key: 'A', label: 'Phase A — set up the machine', note: 'Once per box. ~30-45 min, mostly compiling.', steps: SETUP },
  { key: 'B', label: 'Phase B — prove it works', note: 'About 5 minutes. Do not skip ahead to Phase C.', steps: VERIFY },
  { key: 'C', label: 'Phase C — train', note: 'The 7-hour run.', steps: RUN },
];

/* Real captured output from the 28 Jul bf16 verification run (600 iters, real split). */
const CONSOLE = [
  { t: '$ python scripts/run_training.py --config configs/baseline.yaml --wandb', c: 'cmd' },
  { t: 'split loaded from splits/ (430/57/110 cases)', c: 'dim' },
  { t: '[wandb] mode=offline run=ffki96u6', c: 'dim' },
  { t: 'train cases=430 val=57 | loss=tversky_bce | amp=True/bfloat16 | lr=0.001 | total_iters=600', c: 'dim' },
  { t: '  iter   600/600  loss 0.6964  train-Dice 0.295  lr 0.00e+00', c: 'ok' },
  { t: 'epoch    3  val-Dice 0.193  -> new best, saved checkpoint_best.pth', c: 'ok' },
  { t: '=== EXIT CODE: 0 ===', c: 'good' },
];

const GOTCHAS = [
  {
    t: 'Old code means silent death, not a crash',
    why: 'If configs/baseline.yaml lacks "amp_dtype: bfloat16" you are on pre-28-Jul code. fp16 at lr 1e-3 goes non-finite around iter 249, the GradScaler collapses its scale to zero, and from then on every gradient is zero — while the log keeps printing plausible per-batch Dice. It will not crash. Confirm the header line says bfloat16.',
  },
  {
    t: 'Wrong arch list compiles fine, then fails',
    why: 'Step A4 uses 8.9 for the 4090s. The dev recipe says 12.0 for Blackwell. Build with the wrong one and it succeeds, then dies at the first Mamba call with "no kernel image is available for execution on the device".',
  },
  {
    t: 'The default data path is the dev PC',
    why: 'train.py hardcodes a /mnt/c/... WSL path, so always pass --data and --labels on the hospital boxes or it will not find a single case.',
  },
  {
    t: 'Only one of the four GPUs is used',
    why: 'The training loop is single-GPU by design, which is fine for a pipeline test. For 5-fold cross-validation later, run one fold per card with CUDA_VISIBLE_DEVICES=0..3 rather than reaching for DDP — all five folds then finish in roughly two sequential runs.',
  },
];

const MEASURED = [
  { v: '95 ms', k: 'GPU train step', n: '10.6 it/s for forward + backward + optimiser. 250,000 steps = 6.6 GPU-hours.' },
  { v: '2.6 GB', k: 'peak VRAM, batch 2', n: 'Measured on a 16 GB card; a 4090 has 24. Plenty of headroom for the bigger-patch ablation later.' },
  { v: '25 ms', k: 'data per batch', n: 'With num_workers: 4. It was 194 ms at 0 workers, which left the card only ~29% busy.' },
  { v: '1.1 s', k: 'per case to preprocess', n: 'One-off. About 8 min for the 430 train cases, then cached as ~2 GB of .npz.' },
];

const REMAINING = [
  { t: 'Sliding-window inference', f: 'evaluation/inference.py' },
  { t: 'Lesion F1 / PPV / Sensitivity', f: 'evaluation/metrics.py' },
  { t: 'Results table vs nnU-Net', f: 'evaluation/evaluate.py' },
];

/* ---- PDF export ------------------------------------------------------------
   Builds a standalone print-styled document from the same data arrays and opens
   the browser print dialog — "Save as PDF" there gives a clean, selectable-text
   PDF with no extra dependencies. */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildPrintHtml() {
  const step = (s) => `
    <div class="step">
      <div class="step-top"><span class="n">${esc(s.n)}</span><strong>${esc(s.title)}</strong>${s.tag ? `<span class="tag">${esc(s.tag)}</span>` : ''}<span class="time">${esc(s.time)}</span></div>
      <pre class="cmd">${esc(s.cmd)}</pre>
      <p class="kv"><span>Does</span>${esc(s.does)}</p>
      <p class="kv"><span>Expect</span>${esc(s.expect)}</p>
    </div>`;

  const phases = PHASES.map((ph) => `
    <section>
      <h2>${esc(ph.label)}<span class="note">${esc(ph.note)}</span></h2>
      ${ph.steps.map(step).join('')}
    </section>`).join('');

  const gotchas = GOTCHAS.map((g) => `
    <div class="gotcha"><strong>${esc(g.t)}</strong><p>${esc(g.why)}</p></div>`).join('');

  const checks = [
    'Header says bfloat16 — if not, stop and pull.',
    'Loss falling from ~1.1, train-Dice rising from ~0.03.',
    'No "[N non-finite skipped]" anywhere in the log.',
    'The val-Dice 0.193 above is a 600-iter smoke number, not a result.',
  ].map((c) => `<li>${esc(c)}</li>`).join('');

  const measured = MEASURED.map((m) => `
    <div class="meas"><span class="v">${esc(m.v)}</span><strong>${esc(m.k)}</strong><p>${esc(m.n)}</p></div>`).join('');

  const remaining = REMAINING.map((r) => `${esc(r.t)} (${esc(r.f)})`).join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mamba_PSMA — Training run book</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 10.5pt/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1d21; margin: 0; }
  .kicker { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 0 0 5pt; }
  h1 { font-size: 19pt; margin: 0 0 5pt; }
  .sub { color: #3f4650; margin: 0 0 10pt; max-width: 68ch; }
  .stats { display: flex; flex-wrap: wrap; gap: 6pt; margin: 0 0 12pt; }
  .stat { border: 1pt solid #d5d9df; border-radius: 4pt; padding: 4pt 9pt; font-size: 8pt; color: #6b7280; }
  .stat b { display: block; font-size: 11pt; color: #111; }
  .verdict { border: 1pt solid #d5d9df; border-left: 3pt solid #2f7d4f; border-radius: 4pt; padding: 8pt 10pt; margin: 0 0 6pt; break-inside: avoid; }
  .verdict strong { display: block; margin-bottom: 2pt; }
  .verdict p { margin: 0; font-size: 9.5pt; color: #3f4650; }
  h2 { font-size: 12pt; border-bottom: 1pt solid #d5d9df; padding-bottom: 3pt; margin: 16pt 0 8pt; }
  h2 .note { font-weight: 400; font-size: 9pt; color: #6b7280; margin-left: 7pt; }
  .step { border: 1pt solid #d5d9df; border-left: 3pt solid #2f7d4f; border-radius: 4pt; padding: 7pt 9pt; margin: 0 0 7pt; break-inside: avoid; }
  .step-top { display: flex; align-items: baseline; gap: 6pt; margin-bottom: 4pt; }
  .n { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; font-size: 8pt; background: #2f7d4f; color: #fff; border-radius: 8pt; padding: 1pt 6pt; }
  .tag { font-size: 7.5pt; font-weight: 700; color: #2f7d4f; border: 1pt solid #2f7d4f; border-radius: 8pt; padding: 0.5pt 5pt; }
  .time { margin-left: auto; color: #6b7280; font-size: 8pt; font-family: ui-monospace, Menlo, Consolas, monospace; }
  pre.cmd { background: #f3f4f6; border: 1pt solid #e2e5e9; border-radius: 3pt; padding: 6pt 8pt; margin: 0 0 5pt;
    font: 8.5pt/1.6 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word; }
  .kv { margin: 0 0 2pt; font-size: 9.5pt; color: #3f4650; }
  .kv span { display: inline-block; min-width: 46pt; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #6b7280; }
  .gotcha { border-left: 3pt solid #b8860b; padding: 2pt 0 2pt 9pt; margin: 0 0 9pt; break-inside: avoid; }
  .gotcha p { margin: 2pt 0 0; font-size: 9.5pt; color: #3f4650; }
  ul.checks { margin: 6pt 0 0; padding-left: 14pt; font-size: 9.5pt; color: #3f4650; }
  ul.checks li { margin-bottom: 3pt; }
  .measgrid { display: flex; flex-wrap: wrap; gap: 7pt; }
  .meas { flex: 1 1 44%; border: 1pt solid #d5d9df; border-top: 3pt solid #2f7d4f; border-radius: 4pt; padding: 6pt 9pt; break-inside: avoid; }
  .meas .v { font-size: 13pt; font-weight: 800; margin-right: 6pt; }
  .meas strong { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .meas p { margin: 2pt 0 0; font-size: 9pt; color: #3f4650; }
  .remaining { margin-top: 10pt; font-size: 9pt; color: #3f4650; border: 1pt dashed #d5d9df; border-radius: 4pt; padding: 6pt 9pt; break-inside: avoid; }
</style>
</head>
<body>
  <p class="kicker">CITS4010 · Mamba_PSMA · updated ${esc(UPDATED)}</p>
  <h1>Training run book</h1>
  <p class="sub">Follow it top to bottom. Phase A sets up a fresh Linux box, Phase B proves it works in five minutes, Phase C is the run itself. Every command in B and C was run for real on 28 Jul.</p>
  <div class="stats">${STATS.map((s) => `<div class="stat"><b>${esc(s.v)}</b>${esc(s.k)}</div>`).join('')}</div>
  <div class="verdict">
    <strong>This run is a pipeline test, not a result.</strong>
    <p>The goal is one clean end-to-end run on the hospital hardware. The split is a random 70/10/20, not one of the dataset's official 5 folds, so the number it produces is a sanity check rather than something to quote. Cross-validation comes after.</p>
  </div>
  ${phases}
  <section>
    <h2>Things that will bite you</h2>
    ${gotchas}
  </section>
  <section>
    <h2>What a healthy run looks like<span class="note">Real captured output from the verified 28 Jul run.</span></h2>
    <pre class="cmd">${CONSOLE.map((l) => esc(l.t)).join('\n')}</pre>
    <ul class="checks">${checks}</ul>
  </section>
  <section>
    <h2>Reference — measured on the dev PC, ${esc(UPDATED)}</h2>
    <div class="measgrid">${measured}</div>
    <div class="remaining"><strong>Still to write:</strong> ${remaining} — all three are comment-only stubs. None of it blocks training; it is what turns a checkpoint into a result, so it is the natural thing to write while the run is going.</div>
  </section>
  <script>window.onload = function () { window.print(); };${'</'}script>
</body>
</html>`;
}

function ExportPdfBtn() {
  return (
    <button
      type="button"
      className="tr-export"
      title="Opens the print dialog — choose 'Save as PDF' as the destination"
      onClick={() => {
        const w = window.open('', '_blank');
        if (!w) return; // popup blocked
        w.document.write(buildPrintHtml());
        w.document.close();
      }}
    >
      Export PDF
    </button>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={`tr-copy${ok ? ' is-ok' : ''}`}
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
  );
}

function Step({ s }) {
  return (
    <div className="pt-card tr-step">
      <div className="tr-step__top">
        <span className="tr-step__n">{s.n}</span>
        <h4 className="tr-step__title">{s.title}</h4>
        {s.tag && <span className="tr-tag">{s.tag}</span>}
        <span className="tr-time">{s.time}</span>
      </div>
      <div className="tr-cmd">
        <pre>{s.cmd}</pre>
        <CopyBtn text={s.cmd} />
      </div>
      <div className="tr-kv">
        <p><span className="tr-kv__k">Does</span>{s.does}</p>
        <p><span className="tr-kv__k">Expect</span>{s.expect}</p>
      </div>
    </div>
  );
}

export default function TrainingReadiness() {
  return (
    <div className="pt-module tr">
      <style>{CSS}</style>

      <header className="pt-card tr-head">
        <div className="tr-head__meta">
          <p className="tr-kicker">CITS4010 · Mamba_PSMA · updated {UPDATED}</p>
          <h3 className="tr-title">Training run book</h3>
          <p className="tr-sub">
            Follow it top to bottom. Phase A sets up a fresh Linux box, Phase B proves it works in five
            minutes, Phase C is the run itself. Every command in B and C was run for real on 28 Jul.
          </p>
        </div>
        <div className="tr-head__side">
          <div className="tr-stats">
            {STATS.map((s) => (
              <div key={s.k} className="tr-stat"><span className="tr-stat__v">{s.v}</span><span className="tr-stat__k">{s.k}</span></div>
            ))}
          </div>
          <ExportPdfBtn />
        </div>
      </header>

      <div className="tr-verdict">
        <span className="tr-verdict__dot" />
        <div>
          <p className="tr-verdict__lead">This run is a pipeline test, not a result.</p>
          <p className="tr-verdict__sub">
            The goal is one clean end-to-end run on the hospital hardware. The split is a random 70/10/20,
            <strong> not</strong> one of the dataset&rsquo;s official 5 folds, so the number it produces is a
            sanity check rather than something to quote. Cross-validation comes after.
          </p>
        </div>
      </div>

      {PHASES.map((ph) => (
        <section className="tr-sec" key={ph.key}>
          <p className="tr-sec__label">{ph.label}<span className="tr-sec__note">{ph.note}</span></p>
          <div className="tr-steps">
            {ph.steps.map((s) => <Step key={s.n} s={s} />)}
          </div>
        </section>
      ))}

      <section className="tr-sec">
        <p className="tr-sec__label">Things that will bite you</p>
        <div className="tr-pre">
          {GOTCHAS.map((g) => (
            <div key={g.t} className="pt-card tr-pre__item">
              <span className="tr-item__t">{g.t}</span>
              <span className="tr-item__w">{g.why}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tr-sec">
        <p className="tr-sec__label">What a healthy run looks like</p>
        <div className="tr-expect">
          <div className="tr-term" role="img" aria-label="Terminal output of the verified 28 July run, ending in exit code 0.">
            <div className="tr-term__bar"><span /><span /><span /></div>
            <pre className="tr-term__body">
              {CONSOLE.map((l, i) => (
                <div key={i} className={`tr-line tr-line--${l.c}`}>{l.t}</div>
              ))}
            </pre>
          </div>
          <ul className="tr-checks">
            <li><span className="tr-dot tr-dot--ok" />Header says <code>bfloat16</code> — if not, stop and pull.</li>
            <li><span className="tr-dot tr-dot--ok" />Loss falling from ~1.1, train-Dice rising from ~0.03.</li>
            <li><span className="tr-dot tr-dot--ok" />No <code>[N non-finite skipped]</code> anywhere in the log.</li>
            <li><span className="tr-dot tr-dot--warn" />The val-Dice 0.193 above is a 600-iter smoke number, not a result.</li>
          </ul>
        </div>
      </section>

      <section className="tr-sec">
        <p className="tr-sec__label">Reference — measured on the dev PC, {UPDATED}</p>
        <div className="tr-meas">
          {MEASURED.map((m) => (
            <div key={m.k} className="pt-card tr-meas__item">
              <span className="tr-meas__v">{m.v}</span>
              <span className="tr-meas__k">{m.k}</span>
              <span className="tr-meas__n">{m.n}</span>
            </div>
          ))}
        </div>
        <div className="tr-env">
          <span className="tr-env__k">Still to write</span>
          <span>
            {REMAINING.map((r, i) => (
              <span key={r.t}>{i > 0 && ' · '}{r.t} <code>{r.f}</code></span>
            ))}
            {' '}— all three are comment-only stubs. None of it blocks training; it is what turns a
            checkpoint into a result, so it is the natural thing to write while the run is going.
          </span>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.tr code { font-size: 0.82em; color: var(--ink-2); background: var(--surface-hi); padding: 0.05em 0.35em; border-radius: 3px; }

/* header */
.tr-head { display: flex; flex-wrap: wrap; gap: 1.2rem 1.6rem; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.4rem; }
.tr-head__meta { flex: 1 1 340px; min-width: 260px; }
.tr-kicker { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin: 0 0 0.45rem; }
.tr-title { font-size: 1.4rem; line-height: 1.2; margin: 0 0 0.5rem; color: var(--ink); }
.tr-sub { font-size: 0.95rem; line-height: 1.6; color: var(--ink-2); margin: 0; max-width: 58ch; }
.tr-head__side { display: flex; flex-direction: column; gap: 0.5rem; }
.tr-stats { display: grid; grid-template-columns: repeat(2, minmax(96px, 1fr)); gap: 0.5rem; }
.tr-export { border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-3);
  font: inherit; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer; border-radius: 4px; padding: 0.45rem 0.8rem; transition: all 0.15s; }
.tr-export:hover { color: var(--accent-ink); border-color: var(--accent); }
.tr-stat { background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 4px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.1rem; }
.tr-stat__v { font-size: 1.05rem; font-weight: 800; color: var(--accent-ink); line-height: 1.1; }
.tr-stat__k { font-size: 0.68rem; color: var(--text-faint); }

/* verdict banner */
.tr-verdict { display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.9rem 1.1rem; border-radius: 8px;
  background: var(--surface-hi); border: 1px solid var(--line-2); border-left: 3px solid var(--signal); }
.tr-verdict__dot { flex: none; width: 11px; height: 11px; border-radius: 99px; margin-top: 0.28rem; background: var(--signal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal) 22%, transparent); }
.tr-verdict__lead { font-size: 0.98rem; font-weight: 700; color: var(--ink); margin: 0 0 0.2rem; }
.tr-verdict__sub { font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); margin: 0; max-width: 78ch; }
.tr-verdict__sub strong { color: var(--ink); }

/* section scaffold */
.tr-sec__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); font-weight: 700; margin: 0 0 0.7rem; }
.tr-sec__note { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--ink-3); margin-left: 0.6rem; }

/* steps */
.tr-steps { display: flex; flex-direction: column; gap: 0.7rem; }
.tr-step { padding: 0.85rem 1rem; border-left: 3px solid var(--signal); }
.tr-step__top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.tr-step__n { flex: none; min-width: 30px; height: 24px; padding: 0 0.4rem; border-radius: 99px; display: grid; place-items: center;
  font-size: 0.72rem; font-weight: 800; color: #fff; background: var(--signal); font-family: ui-monospace, monospace; }
.tr-step__title { font-size: 1rem; margin: 0; color: var(--ink); font-weight: 700; }
.tr-tag { font-size: 0.62rem; font-weight: 700; color: var(--accent-ink); background: var(--accent-soft); border-radius: 99px; padding: 0.1rem 0.5rem; }
.tr-time { margin-left: auto; font-size: 0.72rem; color: var(--text-faint); font-family: ui-monospace, monospace; }

.tr-cmd { display: flex; align-items: flex-start; gap: 0.5rem; background: var(--surface-hi); border: 1px solid var(--line-2);
  border-radius: 6px; padding: 0.55rem 0.65rem; margin-bottom: 0.6rem; }
.tr-cmd pre { margin: 0; flex: 1 1 auto; min-width: 0; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem; line-height: 1.7; color: var(--ink); white-space: pre; }
.tr-copy { flex: none; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-3);
  font: inherit; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer;
  border-radius: 4px; padding: 0.2rem 0.5rem; transition: all 0.15s; }
.tr-copy:hover { color: var(--ink); border-color: var(--accent); }
.tr-copy.is-ok { color: var(--signal); border-color: var(--signal); }

.tr-kv { display: flex; flex-direction: column; gap: 0.3rem; }
.tr-kv p { font-size: 0.86rem; line-height: 1.5; color: var(--ink-2); margin: 0; }
.tr-kv__k { display: inline-block; min-width: 62px; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
  font-weight: 700; color: var(--text-faint); margin-right: 0.5rem; }

/* gotchas */
.tr-pre { display: flex; flex-direction: column; gap: 0.6rem; }
.tr-pre__item { padding: 0.8rem 0.95rem; display: flex; flex-direction: column; gap: 0.25rem; border-left: 3px solid #E0A82E; }
.tr-item__t { font-weight: 700; color: var(--ink); font-size: 0.88rem; }
.tr-item__w { font-size: 0.83rem; line-height: 1.55; color: var(--ink-2); }

/* healthy run */
.tr-expect { display: flex; flex-wrap: wrap; gap: 1rem; align-items: stretch; }
.tr-term { flex: 1 1 440px; min-width: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2); background: #0e1117; }
.tr-term__bar { display: flex; gap: 0.4rem; padding: 0.5rem 0.7rem; background: #171b22; border-bottom: 1px solid #23282f; }
.tr-term__bar span { width: 10px; height: 10px; border-radius: 99px; background: #3a4048; }
.tr-term__bar span:first-child { background: #e0625a; } .tr-term__bar span:nth-child(2) { background: #e0a82e; } .tr-term__bar span:nth-child(3) { background: #4caf68; }
.tr-term__body { margin: 0; padding: 0.8rem 0.9rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.tr-line--cmd { color: #cbd2dc; } .tr-line--dim { color: #7d8593; } .tr-line--ok { color: #9fd0ff; } .tr-line--good { color: #7fe0a0; font-weight: 700; }
.tr-checks { flex: 1 1 280px; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; align-self: center; }
.tr-checks li { display: flex; gap: 0.55rem; align-items: flex-start; font-size: 0.86rem; line-height: 1.45; color: var(--ink-2); }
.tr-dot { flex: none; width: 9px; height: 9px; border-radius: 99px; margin-top: 0.35rem; }
.tr-dot--ok { background: var(--signal); } .tr-dot--warn { background: #E0A82E; }

/* reference */
.tr-meas { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.7rem; }
.tr-meas__item { padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; border-top: 3px solid var(--accent); }
.tr-meas__v { font-size: 1.4rem; font-weight: 800; line-height: 1.05; color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.tr-meas__k { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--ink); }
.tr-meas__n { font-size: 0.78rem; line-height: 1.5; color: var(--ink-3); margin-top: 0.15rem; }

.tr-env { display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: baseline; margin-top: 0.7rem;
  padding: 0.7rem 0.9rem; border-radius: 8px; background: var(--surface-hi); border: 1px dashed var(--line-2); }
.tr-env__k { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--accent-ink); }
.tr-env span:last-child { font-size: 0.83rem; line-height: 1.6; color: var(--ink-2); flex: 1 1 300px; }

@media (max-width: 620px) {
  .tr-head { padding: 1rem; }
  .tr-title { font-size: 1.2rem; }
  .tr-time { margin-left: 0; }
}
`;
