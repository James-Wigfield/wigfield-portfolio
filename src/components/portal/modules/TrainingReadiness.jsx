import { useState } from 'react';

/* ============================================================================
   TRAINING READINESS  —  Mamba_PSMA  (University)
   ----------------------------------------------------------------------------
   A one-glance run book: the exact commands to test training, what each does,
   what to expect, and the short list of things still to add before an
   unattended full run on the hospital PCs. Self-contained (scoped `.tr-*`
   styles + theme tokens from portal.css), so it re-skins with the portal theme.
   Grounded in a real verified run on 24 Jul 2026 (overfit path, exit 0).
   ========================================================================== */

const UPDATED = '24 Jul 2026';

const STATS = [
  { v: 'exit 0', k: 'overfit run verified' },
  { v: '39.7M', k: 'model params' },
  { v: 'RTX 5070 Ti', k: '16 GB · dev PC' },
  { v: '~1.8 GB', k: 'VRAM / patch' },
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
    n: 4, title: 'Full training run', status: 'caution', tag: 'do the fixes first',
    cmd: 'python scripts/run_training.py --config configs/baseline.yaml',
    does: 'The real thing: patient-level 70/10/20 split, 1000 epochs of 250 iters, checkpoint saved at the end.',
    expect: 'Runs for hours to days. It works, but land the three "add first" items below before leaving it unattended.',
    time: 'hours -> days',
  },
];

// The real captured console output from the 24 Jul 2026 verification run.
const CONSOLE = [
  { t: '$ python scripts/run_training.py --config configs/baseline.yaml --overfit 2 --max-iters 12', c: 'cmd' },
  { t: 'train cases=2 val=2 | loss=tversky_bce | amp=True | total_iters=12', c: 'dim' },
  { t: '  iter    10/12  loss 1.1685  train-Dice 0.038  lr 2.20e-04', c: 'ok' },
  { t: 'final val-Dice 0.067  ->  saved checkpoints/checkpoint_last.pth', c: 'ok' },
  { t: '=== EXIT CODE: 0 ===', c: 'good' },
];

const BUILT = [
  'Preprocessing — register, resample (~4 mm), normalise, stack to (2,Z,Y,X)',
  'Model — PSMAMamba encoder + decoder, ~39.7M params, fwd/bwd GPU-verified',
  'Loss — Tversky(0.3/0.7) + BCE, checked term-by-term vs the paper',
  'Scheduler — linear warmup into cosine decay',
  'Data — MONAI lesion-biased patch sampling + .npz cache',
  'Training loop — AMP, AdamW, checkpoint; overfit runs end-to-end (exit 0)',
];

const FIX = [
  { t: 'Sliding-window validation', f: 'evaluation/inference.py', why: 'validation currently forwards the whole volume, once, at the very end — OOM risk on big cases, no best-checkpoint, ignores val_interval.' },
  { t: 'Resumable checkpoints', f: 'training/train.py', why: 'save optimiser + scheduler + iter and add --resume, so a preempted / rebooted hospital job survives.' },
  { t: 'Run logging', f: 'training/train.py', why: 'TensorBoard / W&B + a loss CSV; print-only across 1000 epochs is flying blind.' },
];

const RESULTS = [
  { t: 'Sliding-window inference', f: 'evaluation/inference.py' },
  { t: 'Lesion F1 / PPV / Sensitivity', f: 'evaluation/metrics.py' },
  { t: 'Results table vs nnU-Net', f: 'evaluation/evaluate.py' },
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
          <p className="tr-verdict__lead">The pipeline runs end-to-end — verified {UPDATED} (exit 0).</p>
          <p className="tr-verdict__sub">
            Ready to sanity-check right now. It <strong>runs and saves a checkpoint</strong>; a few additions
            (below) are needed before leaving a full run unattended.
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
        <p className="tr-sec__label">What you will see — the verified sanity run</p>
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
            <li><span className="tr-dot tr-dot--ok" />It reaches real training iterations (not just imports).</li>
            <li><span className="tr-dot tr-dot--ok" />A checkpoint is written to <code>checkpoints/</code>.</li>
            <li><span className="tr-dot tr-dot--ok" />Validation completed without OOM on 16 GB (this run).</li>
            <li><span className="tr-dot tr-dot--warn" />Low Dice here is expected — 12 steps is not learning, only proof it runs.</li>
          </ul>
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
            <p className="tr-col__head"><span className="tr-dot tr-dot--warn" />Add first — for a safe full run</p>
            <ul className="tr-list tr-list--rich">
              {FIX.map((f) => (
                <li key={f.t}>
                  <span className="tr-item__t">{f.t}</span>
                  <code className="tr-item__f">{f.f}</code>
                  <span className="tr-item__w">{f.why}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-card tr-col tr-col--later">
            <p className="tr-col__head"><span className="tr-dot tr-dot--faint" />For results (after training)</p>
            <ul className="tr-list tr-list--rich">
              {RESULTS.map((r) => (
                <li key={r.t}>
                  <span className="tr-item__t">{r.t}</span>
                  <code className="tr-item__f">{r.f}</code>
                </li>
              ))}
            </ul>
            <p className="tr-note">
              These measure the model against the nnU-Net baseline (73% lesion sensitivity) — needed to
              report results, not to train.
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
