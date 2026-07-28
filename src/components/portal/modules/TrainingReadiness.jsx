import { useState } from 'react';

/* ============================================================================
   TRAINING READINESS  —  Mamba_PSMA  (University)
   ----------------------------------------------------------------------------
   A one-glance run book: the exact commands to test training, what each does,
   what to expect, and the short list of things still to add before an
   unattended full run on the hospital PCs. Self-contained (scoped `.tr-*`
   styles + theme tokens from portal.css), so it re-skins with the portal theme.

   Grounded in a real verified run on 24 Jul 2026 (overfit path, exit 0).
   Re-checked against the repo 28 Jul 2026 and the cost figures replaced with
   measured ones (see MEASURED) — the old "hours -> days" guess was wrong by an
   order of magnitude, and the bottleneck turned out to be the dataloader, not
   the GPU. Every number in MEASURED / PREFLIGHT came off the dev PC; if the
   model, patch size or batch size changes, re-measure rather than edit.
   ========================================================================== */

const UPDATED = '28 Jul 2026';

const STATS = [
  { v: '95 ms', k: 'GPU train step · batch 2' },
  { v: '~7 h', k: 'full run · 250,000 steps' },
  { v: 'bf16', k: 'required · fp16 diverges' },
  { v: '2.6 / 16 GB', k: 'peak VRAM · lots spare' },
];

// The commands to run, in order. status: ready | caution.
const STEPS = [
  {
    n: 1, title: 'Check the environment', status: 'ready',
    cmd: 'python check_env.py',
    does: 'Confirms torch sees the GPU and runs a real mamba-ssm forward pass on it.',
    expect: 'Prints the GPU name and passes with no CUDA / mamba-ssm import errors.',
    time: '~10 s',
  },
  {
    n: 2, title: 'Does training start?', status: 'ready', tag: 'verified · exit 0',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --overfit 2 --max-iters 12',
    does: 'Runs the whole chain on 2 lesion cases for 12 steps: discover, preprocess + cache, patch, model, Tversky+BCE, AMP backward, validate, save.',
    expect: 'One "iter 10/12" line, then "final val-Dice ... saved checkpoints/checkpoint_last.pth", exit 0. Dice is still noise here — this only proves it runs.',
    time: '~1-2 min (first run caches 2 cases)',
  },
  {
    n: 3, title: 'Does it actually learn?', status: 'ready',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --overfit 2 --max-iters 150',
    does: 'Same path, run long enough to overfit the 2 cases — the definitive "the stack is wired right" test.',
    expect: 'train-Dice climbs from ~0.03 toward ~0.95+. If it stalls, something upstream is wrong (labels, channel order, or gradients).',
    time: '~3-5 min',
  },
  {
    n: 4, title: 'Full training run', status: 'ready', tag: 'cleared to launch',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --wandb',
    does: 'The real thing: the persisted 430/57/110 patient-level split, 1000 epochs of 250 iters = 250,000 steps, validating and checkpointing every 25 epochs.',
    expect: 'About 7 h. Validation Dice every 25 epochs, checkpoint_best.pth kept, and the run aborts loudly if the loss goes non-finite instead of burning hours on dead gradients. The .npz cache for all 430 train cases is already built.',
    time: '~7 h',
  },
  {
    n: 5, title: 'If it dies overnight', status: 'ready',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml --wandb --resume checkpoints/checkpoint_last.pth',
    does: 'Restores model, optimiser, scheduler, iteration count, best-Dice and the W&B run id, and carries on.',
    expect: 'An "[resume] ... at iter N" line, then the LR continues its cosine decay rather than restarting warmup. Verified end-to-end.',
    time: 'seconds to restart',
  },
];

// Measured on the dev PC 28 Jul 2026 — RTX 5070 Ti, batch 2, patch 64x128x64, AMP on.
// These replace the earlier estimates; the full schedule is a single overnight run, not days.
const MEASURED = [
  { v: '95 ms', k: 'GPU train step', n: '10.6 it/s for forward + backward + optimiser step. 250,000 steps = 6.6 GPU-hours.' },
  { v: '2.6 GB', k: 'peak VRAM, batch 2', n: 'Of 16 GB. ~13 GB spare — batch size or patch size has real room to grow.' },
  { v: '119 ms', k: 'cached sample load', n: 'npz read + lesion-biased crop. At batch 2 that is 237 ms serial, i.e. 2.5x the GPU step.' },
  { v: 'built', k: 'preprocessing cache', n: 'All 430 train cases cached, 2.0 GB of .npz. Cost 1.1 s/case; tomorrow pays none of it.' },
];

// Landed 28 Jul, each verified by running it rather than by reading the diff.
const PREFLIGHT = [
  {
    t: 'num_workers raised to 4', f: 'configs/baseline.yaml', act: 'done',
    why: 'Measured 194 ms/batch at 0 workers vs 25 ms at 4 — under the 95 ms GPU step, so data loading now hides behind compute. persistent_workers keeps them alive across the 250-iter epochs. This is the ~23 h to ~7 h change.',
  },
  {
    t: 'Split persisted to splits/', f: 'training/train.py', act: 'done',
    why: 'Written once by the run that creates it and reloaded verbatim after — 430/57/110 studies from 264/37/77 patients, verified zero patient overlap across all three pairs. Evaluation can now score the exact patients the model never saw.',
  },
  {
    t: 'W&B, periodic validation, resume', f: 'training/train.py', act: 'done',
    why: 'Config-gated W&B (offline by default), val_interval now actually fires, checkpoint_best.pth is kept, and --resume restores optimiser + scheduler + iter + run id. All four exercised on the real data path.',
  },
];

// The one that would have silently wasted the run. Kept as its own callout.
const NAN_FINDING = {
  title: 'fp16 was quietly killing the run — switched to bf16',
  rows: [
    { k: 'fp16 @ lr 1e-3 (the old config)', v: 'first NaN loss at iter 249; 252 of 500 iters NaN; GradScaler halved its scale to 0.0', bad: true },
    { k: 'bf16 @ lr 1e-3 (now)', v: '0 of 500 NaN, loss 0.99 -> 0.72 — the best curve of the four combinations tried', bad: false },
  ],
};

// Real captured output from the 28 Jul bf16 verification run (600 iters on the real split).
const CONSOLE = [
  { t: '$ python scripts/run_training.py --config configs/baseline.yaml --wandb', c: 'cmd' },
  { t: 'split loaded from splits/ (430/57/110 cases)', c: 'dim' },
  { t: '[wandb] mode=offline run=ffki96u6', c: 'dim' },
  { t: 'train cases=430 val=57 | loss=tversky_bce | amp=True/bfloat16 | lr=0.001 | total_iters=600', c: 'dim' },
  { t: '  iter   600/600  loss 0.6964  train-Dice 0.295  lr 0.00e+00', c: 'ok' },
  { t: 'epoch    3  val-Dice 0.193  -> new best, saved checkpoint_best.pth', c: 'ok' },
  { t: '=== EXIT CODE: 0 ===', c: 'good' },
];

const BUILT = [
  'Preprocessing — register, resample (~4 mm), normalise, stack to (2,Z,Y,X)',
  'Model — PSMAMamba encoder + decoder, ~39.7M params, fwd/bwd GPU-verified',
  'Loss — Tversky(0.3/0.7) + BCE, checked term-by-term vs the paper',
  'Scheduler — linear warmup into cosine decay',
  'Data — 4 workers + persistent, lesion-biased patches, all 430 cases cached',
  'Training loop — bf16 AMP, AdamW, non-finite guard; runs end-to-end (exit 0)',
  'W&B — config-gated, offline default, scalars + Tversky/BCE split + val overlays',
  'Validation — fires every val_interval, keeps checkpoint_best.pth',
  'Resume — optimiser + scheduler + iter + W&B run id, verified',
  'Split — persisted to splits/, patient-disjointness verified',
];

const FIX = [
  { t: 'Sliding-window inference', f: 'evaluation/inference.py', why: 'Comment-only stub, and the last real gap. Validation currently forwards whole volumes: it works — measured 7.4 GB peak on a real case, so it fits 16 GB — but that is 46% of the card versus 2.6 GB for the patch path, so val_max_cases is capped at 20 to bound it. Tiled inference is needed for the reportable numbers regardless.' },
  { t: 'Lesion F1 / PPV / Sensitivity', f: 'evaluation/metrics.py', why: 'Comment-only stub. Voxel Dice is what training reports; the thesis metric is lesion-level F1 at IoU 0.1, which needs connected-component matching. Nothing downstream can be reported without it.' },
  { t: 'Results table vs nnU-Net', f: 'evaluation/evaluate.py', why: 'Comment-only stub. Scores the held-out test split (110 studies / 77 patients) against the baseline. Good work to do while the 7 h run is going.' },
];

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

export default function TrainingReadiness() {
  return (
    <div className="pt-module tr">
      <style>{CSS}</style>

      {/* header */}
      <header className="pt-card tr-head">
        <div className="tr-head__meta">
          <p className="tr-kicker">CITS4010 · Mamba_PSMA · updated {UPDATED}</p>
          <h3 className="tr-title">Training — what to run &amp; what to expect</h3>
          <p className="tr-sub">
            The commands to test the training pipeline, what each one does, and what you should see —
            plus the short list of things to add before a full unattended run on the hospital PCs.
          </p>
        </div>
        <div className="tr-stats">
          {STATS.map((s) => (
            <div key={s.k} className="tr-stat"><span className="tr-stat__v">{s.v}</span><span className="tr-stat__k">{s.k}</span></div>
          ))}
        </div>
      </header>

      {/* verdict banner */}
      <div className="tr-verdict">
        <span className="tr-verdict__dot" />
        <div>
          <p className="tr-verdict__lead">Cleared to launch. The full run is a ~7 h overnight job, and it is now instrumented.</p>
          <p className="tr-verdict__sub">
            W&amp;B logging, periodic validation with a best-checkpoint, <code>--resume</code>, a persisted split and
            4-worker loading all landed {UPDATED} and were verified by running them on the real data path.
            The find that mattered most: <strong>fp16 was silently destroying the run</strong> — see below.
            One real gap remains, <code>evaluation/</code>, and it does not block training.
          </p>
        </div>
      </div>

      {/* commands */}
      <section className="tr-sec">
        <p className="tr-sec__label">Run it — top to bottom</p>
        <div className="tr-steps">
          {STEPS.map((s) => (
            <div key={s.n} className={`pt-card tr-step tr-step--${s.status}`}>
              <div className="tr-step__top">
                <span className="tr-step__n">{s.n}</span>
                <h4 className="tr-step__title">{s.title}</h4>
                <span className={`tr-pill tr-pill--${s.status}`}>{s.status === 'ready' ? 'ready' : 'after fixes'}</span>
                {s.tag && <span className="tr-tag">{s.tag}</span>}
                <span className="tr-time">{s.time}</span>
              </div>
              <div className="tr-cmd">
                <code>{s.cmd}</code>
                <CopyBtn text={s.cmd} />
              </div>
              <div className="tr-kv">
                <p><span className="tr-kv__k">Does</span>{s.does}</p>
                <p><span className="tr-kv__k">Expect</span>{s.expect}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* what you'll see */}
      <section className="tr-sec">
        <p className="tr-sec__label">What you will see — the verified run, 28 Jul</p>
        <div className="tr-expect">
          <div className="tr-term" role="img" aria-label="Terminal output of the verified overfit run, ending in exit code 0.">
            <div className="tr-term__bar"><span /><span /><span /></div>
            <pre className="tr-term__body">
              {CONSOLE.map((l, i) => (
                <div key={i} className={`tr-line tr-line--${l.c}`}>{l.t}</div>
              ))}
            </pre>
          </div>
          <ul className="tr-checks">
            <li><span className="tr-dot tr-dot--ok" />The split is <em>loaded</em>, not regenerated — same patients every run.</li>
            <li><span className="tr-dot tr-dot--ok" />Loss fell 1.13 to 0.70 and train-Dice rose 0.03 to 0.30 over 600 iters.</li>
            <li><span className="tr-dot tr-dot--ok" />Zero non-finite iterations — the old fp16 config had 252 of 500.</li>
            <li><span className="tr-dot tr-dot--warn" />val-Dice 0.193 is still a 600-iter smoke number, not a result.</li>
          </ul>
        </div>
        <p className="tr-note tr-note--wide">
          <span className="tr-dot tr-dot--ok tr-dot--inline" />
          <code>checkpoints/</code> is deliberately empty. Everything in it was a short sanity artifact — the last
          one stored a <code>val_dice</code> of 0.0033 — so it was cleared rather than left around to be mistaken
          for a result. The first number worth quoting will come from the real run.
        </p>
      </section>

      {/* measured cost */}
      <section className="tr-sec">
        <p className="tr-sec__label">What it actually costs — measured on the dev PC, {UPDATED}</p>
        <div className="tr-meas">
          {MEASURED.map((m) => (
            <div key={m.k} className="pt-card tr-meas__item">
              <span className="tr-meas__v">{m.v}</span>
              <span className="tr-meas__k">{m.k}</span>
              <span className="tr-meas__n">{m.n}</span>
            </div>
          ))}
        </div>
        <p className="tr-note tr-note--wide">
          The headline: <strong>the GPU was never the bottleneck — the dataloader was.</strong> Compute for the
          whole 1000-epoch schedule is 6.6 GPU-hours, but at <code>num_workers: 0</code> every step waited 237 ms
          for data against 95 ms of compute, leaving the card about 29% busy. Now at 4 persistent workers
          (25 ms/batch) the loading hides behind compute and the run is an overnight job.
        </p>
      </section>

      {/* the nan finding */}
      <section className="tr-sec">
        <p className="tr-sec__label">The bug that would have wasted the run</p>
        <div className="pt-card tr-nan">
          <p className="tr-nan__title">{NAN_FINDING.title}</p>
          <p className="tr-nan__lead">
            The failure is nasty because it looks like training. A diverging fp16 loss goes non-finite, the
            GradScaler halves its scale on every overflow, and once the scale underflows to <code>0.0</code> every
            gradient is exactly zero — so the run keeps printing plausible per-batch Dice for hours while learning
            nothing. It was found by running 500 real iterations at each setting, not by reading the code.
          </p>
          <div className="tr-nan__rows">
            {NAN_FINDING.rows.map((r) => (
              <div key={r.k} className={`tr-nan__row tr-nan__row--${r.bad ? 'bad' : 'good'}`}>
                <span className="tr-nan__k">{r.k}</span>
                <span className="tr-nan__v">{r.v}</span>
              </div>
            ))}
          </div>
          <p className="tr-note tr-note--wide">
            bf16 carries fp32&rsquo;s exponent range, so the overflow cannot happen and no GradScaler is needed;
            Blackwell runs it at the same speed (~206 vs 211 ms/iter). Lowering the LR to 3e-4 also removed the NaNs,
            but bf16 at 1e-3 trained fastest, so the config keeps the LR and changes the dtype. A
            <code> nonfinite_patience</code> guard now aborts loudly rather than letting it happen quietly again.
          </p>
        </div>
      </section>

      {/* landed today */}
      <section className="tr-sec">
        <p className="tr-sec__label">Landed {UPDATED} — each verified by running it</p>
        <div className="tr-pre">
          {PREFLIGHT.map((p) => (
            <div key={p.t} className="pt-card tr-pre__item tr-pre__item--done">
              <div className="tr-pre__top">
                <span className="tr-item__t">{p.t}</span>
                <code className="tr-item__f">{p.f}</code>
                <span className="tr-pre__act">{p.act}</span>
              </div>
              <span className="tr-item__w">{p.why}</span>
            </div>
          ))}
        </div>
      </section>

      {/* before the hospital PCs */}
      <section className="tr-sec">
        <p className="tr-sec__label">Before the hospital PCs</p>
        <div className="tr-grid">
          <div className="pt-card tr-col tr-col--built">
            <p className="tr-col__head"><span className="tr-dot tr-dot--ok" />Built &amp; verified</p>
            <ul className="tr-list">
              {BUILT.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>

          <div className="pt-card tr-col tr-col--fix">
            <p className="tr-col__head"><span className="tr-dot tr-dot--warn" />Still to write — all of it in evaluation/</p>
            <ul className="tr-list tr-list--rich">
              {FIX.map((f) => (
                <li key={f.t}>
                  <span className="tr-item__t">{f.t}</span>
                  <code className="tr-item__f">{f.f}</code>
                  <span className="tr-item__w">{f.why}</span>
                </li>
              ))}
            </ul>
            <p className="tr-note">
              None of this blocks training — it is what turns a checkpoint into a result, measured against the
              nnU-Net baseline (F1 79.9%, PPV 88.2%, 73% lesion sensitivity). Natural work to do during the run.
            </p>
          </div>
        </div>

        <div className="tr-env">
          <span className="tr-env__k">Hospital PC prerequisite</span>
          <span>
            A CUDA GPU with <code>mamba-ssm</code> + <code>causal-conv1d</code> installed (they compile against the
            box&rsquo;s CUDA, so they are not in <code>requirements.txt</code>). Run <code>check_env.py</code> there first.
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
.tr-stats { display: grid; grid-template-columns: repeat(2, minmax(96px, 1fr)); gap: 0.5rem; }
.tr-stat { background: var(--surface-hi); border: 1px solid var(--line-2); border-radius: 4px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.1rem; }
.tr-stat__v { font-size: 1.05rem; font-weight: 800; color: var(--accent-ink); line-height: 1.1; }
.tr-stat__k { font-size: 0.68rem; color: var(--text-faint); }

/* verdict banner */
.tr-verdict { display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.9rem 1.1rem; border-radius: 8px;
  background: var(--surface-hi); border: 1px solid var(--line-2); border-left: 3px solid var(--signal); }
.tr-verdict__dot { flex: none; width: 11px; height: 11px; border-radius: 99px; margin-top: 0.28rem; background: var(--signal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal) 22%, transparent); }
.tr-verdict__lead { font-size: 0.98rem; font-weight: 700; color: var(--ink); margin: 0 0 0.2rem; }
.tr-verdict__sub { font-size: 0.86rem; line-height: 1.55; color: var(--ink-2); margin: 0; max-width: 72ch; }
.tr-verdict__sub strong { color: var(--ink); }

/* section scaffold */
.tr-sec__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); font-weight: 700; margin: 0 0 0.7rem; }

/* command steps */
.tr-steps { display: flex; flex-direction: column; gap: 0.7rem; }
.tr-step { padding: 0.85rem 1rem; border-left: 3px solid var(--tr-sc, var(--signal)); }
.tr-step--ready { --tr-sc: var(--signal); }
.tr-step--caution { --tr-sc: #E0A82E; }
.tr-step__top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.tr-step__n { flex: none; width: 24px; height: 24px; border-radius: 99px; display: grid; place-items: center;
  font-size: 0.78rem; font-weight: 800; color: #fff; background: var(--tr-sc); }
.tr-step__title { font-size: 1rem; margin: 0; color: var(--ink); font-weight: 700; }
.tr-pill { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;
  border-radius: 99px; padding: 0.1rem 0.5rem; border: 1px solid var(--tr-sc); color: var(--tr-sc); }
.tr-tag { font-size: 0.62rem; font-weight: 700; color: var(--accent-ink); background: var(--accent-soft); border-radius: 99px; padding: 0.1rem 0.5rem; }
.tr-time { margin-left: auto; font-size: 0.72rem; color: var(--text-faint); font-family: ui-monospace, monospace; }

.tr-cmd { display: flex; align-items: center; gap: 0.5rem; background: var(--surface-hi); border: 1px solid var(--line-2);
  border-radius: 6px; padding: 0.5rem 0.6rem; margin-bottom: 0.6rem; overflow-x: auto; }
.tr-cmd code { background: none; padding: 0; color: var(--ink); font-size: 0.82rem; white-space: pre; }
.tr-cmd code::before { content: '$ '; color: var(--text-faint); }
.tr-copy { flex: none; margin-left: auto; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-3);
  font: inherit; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer;
  border-radius: 4px; padding: 0.2rem 0.5rem; transition: all 0.15s; }
.tr-copy:hover { color: var(--ink); border-color: var(--accent); }
.tr-copy.is-ok { color: var(--signal); border-color: var(--signal); }

.tr-kv { display: flex; flex-direction: column; gap: 0.3rem; }
.tr-kv p { font-size: 0.86rem; line-height: 1.5; color: var(--ink-2); margin: 0; }
.tr-kv__k { display: inline-block; min-width: 62px; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
  font-weight: 700; color: var(--text-faint); margin-right: 0.5rem; }

/* what you'll see */
.tr-expect { display: flex; flex-wrap: wrap; gap: 1rem; align-items: stretch; }
.tr-term { flex: 1 1 420px; min-width: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2);
  background: #0e1117; }
.tr-term__bar { display: flex; gap: 0.4rem; padding: 0.5rem 0.7rem; background: #171b22; border-bottom: 1px solid #23282f; }
.tr-term__bar span { width: 10px; height: 10px; border-radius: 99px; background: #3a4048; }
.tr-term__bar span:first-child { background: #e0625a; } .tr-term__bar span:nth-child(2) { background: #e0a82e; } .tr-term__bar span:nth-child(3) { background: #4caf68; }
.tr-term__body { margin: 0; padding: 0.8rem 0.9rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.tr-line--cmd { color: #cbd2dc; } .tr-line--dim { color: #7d8593; } .tr-line--ok { color: #9fd0ff; } .tr-line--good { color: #7fe0a0; font-weight: 700; }
.tr-checks { flex: 1 1 260px; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; align-self: center; }
.tr-checks li { display: flex; gap: 0.55rem; align-items: flex-start; font-size: 0.86rem; line-height: 1.45; color: var(--ink-2); }

/* measured cost */
.tr-meas { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.7rem; }
.tr-meas__item { padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; border-top: 3px solid var(--accent); }
.tr-meas__v { font-size: 1.5rem; font-weight: 800; line-height: 1.05; color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.tr-meas__k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--ink); }
.tr-meas__n { font-size: 0.78rem; line-height: 1.5; color: var(--ink-3); margin-top: 0.15rem; }
.tr-note--wide { max-width: 92ch; }
.tr-note--wide strong { color: var(--ink); }
.tr-dot--inline { display: inline-block; margin: 0 0.4rem 0 0; vertical-align: baseline; }

/* the nan finding */
.tr-nan { padding: 1rem 1.15rem; border-left: 3px solid #E0625A; }
.tr-nan__title { font-size: 1rem; font-weight: 700; color: var(--ink); margin: 0 0 0.4rem; }
.tr-nan__lead { font-size: 0.86rem; line-height: 1.6; color: var(--ink-2); margin: 0 0 0.8rem; max-width: 92ch; }
.tr-nan__rows { display: flex; flex-direction: column; gap: 0.4rem; }
.tr-nan__row { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; padding: 0.5rem 0.7rem; border-radius: 6px;
  background: var(--surface-hi); border: 1px solid var(--line-2); }
.tr-nan__row--bad { border-left: 3px solid #E0625A; }
.tr-nan__row--good { border-left: 3px solid var(--signal); }
.tr-nan__k { flex: 0 0 15rem; font-size: 0.78rem; font-weight: 700; color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tr-nan__v { flex: 1 1 18rem; font-size: 0.8rem; line-height: 1.45; color: var(--ink-2); }

/* pre-flight */
.tr-pre { display: flex; flex-direction: column; gap: 0.6rem; }
.tr-pre__item { padding: 0.8rem 0.95rem; display: flex; flex-direction: column; gap: 0.3rem; border-left: 3px solid #E0A82E; }
.tr-pre__item--done { border-left-color: var(--signal); }
.tr-pre__top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
/* theme tokens, not literals — the arcade theme is dark and inverts --ink / --surface */
.tr-pre__act { margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem;
  font-weight: 700; color: var(--accent-ink); background: var(--accent-soft);
  border-radius: 99px; padding: 0.12rem 0.55rem; white-space: nowrap; }

/* dots */
.tr-dot { flex: none; width: 9px; height: 9px; border-radius: 99px; margin-top: 0.35rem; }
.tr-dot--ok { background: var(--signal); } .tr-dot--warn { background: #E0A82E; } .tr-dot--faint { background: var(--text-faint); }

/* before-hospital grid */
.tr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.7rem; align-items: start; }
.tr-col { padding: 0.9rem 1rem; }
.tr-col--built { border-top: 3px solid var(--signal); }
.tr-col--fix { border-top: 3px solid #E0A82E; }
.tr-col--later { border-top: 3px solid var(--text-faint); border-style: solid; }
.tr-col__head { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 700; color: var(--ink); margin: 0 0 0.7rem; }
.tr-col__head .tr-dot { margin-top: 0; }
.tr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.tr-list li { font-size: 0.83rem; line-height: 1.45; color: var(--ink-2); }
.tr-list--rich li { display: flex; flex-direction: column; gap: 0.15rem; padding-bottom: 0.5rem; border-bottom: 1px dashed var(--line); }
.tr-list--rich li:last-child { border-bottom: 0; padding-bottom: 0; }
.tr-item__t { font-weight: 700; color: var(--ink); font-size: 0.86rem; }
.tr-item__f { align-self: flex-start; font-size: 0.72rem !important; }
.tr-item__w { font-size: 0.78rem; line-height: 1.45; color: var(--ink-3); }
.tr-note { font-size: 0.76rem; line-height: 1.5; color: var(--ink-3); margin: 0.7rem 0 0; }

.tr-env { display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: baseline; margin-top: 0.7rem;
  padding: 0.7rem 0.9rem; border-radius: 8px; background: var(--surface-hi); border: 1px dashed var(--line-2); }
.tr-env__k { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--accent-ink); }
.tr-env span:last-child { font-size: 0.83rem; line-height: 1.5; color: var(--ink-2); flex: 1 1 300px; }

@media (max-width: 620px) {
  .tr-head { padding: 1rem; }
  .tr-title { font-size: 1.2rem; }
  .tr-time { margin-left: 0; }
}
`;
