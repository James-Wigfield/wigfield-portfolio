import { useState } from 'react';
import Icon from '../icons';
import { RUNS } from './training-runs/runs';

/* ============================================================================
   TRAINING RUNS  —  Mamba_PSMA  (University)
   ----------------------------------------------------------------------------
   The results shelf: one analysis page per training run. This file is only
   the shell — an index of run cards (newest first) and a back-button detail
   view. It never changes when a run is added.

   Everything run-specific lives in ./training-runs/ :
     runs.js       the run registry — HOW TO ADD A RUN is documented there
     kit.jsx       the shared analysis components every run page is built from
     runs/*.jsx    one self-contained page per run (Run00Sample is the template)

   Scoped `.trn-*` styles; run pages bring their own `.trx-*` kit styles.
   ========================================================================== */

const STATUS_LABEL = { complete: 'complete', 'in-progress': 'in progress', aborted: 'aborted' };
const VERDICT_LABEL = { good: 'good', mixed: 'mixed', bad: 'poor' };

export default function TrainingRuns() {
  const [activeId, setActiveId] = useState(null);
  const runs = [...RUNS].sort((a, b) => b.n - a.n);
  const active = runs.find((r) => r.id === activeId);

  if (active) {
    const Page = active.component;
    return (
      <div className="pt-module trn">
        <style>{CSS}</style>
        <button type="button" className="trn-back" onClick={() => setActiveId(null)}>
          <Icon name="arrowLeft" size={14} /> All runs
        </button>
        <Page run={active} />
      </div>
    );
  }

  return (
    <div className="pt-module trn">
      <style>{CSS}</style>

      <header className="pt-card trn-head">
        <p className="trn-kicker">CITS4010 · Mamba_PSMA</p>
        <h3 className="trn-title">Training runs</h3>
        <p className="trn-sub">
          One analysis page per run — the takeaway, the curves, how it compares, and what the next
          run changes because of it. Newest on top.
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="trn-empty">
          No runs analysed yet. The first entry lands in <code>training-runs/runs.js</code> after
          the first full training run.
        </div>
      ) : (
        <div className="trn-list">
          {runs.map((r) => (
            <button type="button" key={r.id} className="pt-card trn-run" onClick={() => setActiveId(r.id)}>
              <div className="trn-run__main">
                <div className="trn-run__top">
                  <span className="trn-run__no">RUN {String(r.n).padStart(2, '0')}</span>
                  <span className="trn-run__title">{r.title}</span>
                  {r.sample && <span className="trn-run__flag">sample</span>}
                  <span className="trn-run__status">{STATUS_LABEL[r.status] || r.status}</span>
                  {VERDICT_LABEL[r.verdict] && (
                    <span className="trn-run__verdict" data-v={r.verdict}>
                      <span className="trn-run__vdot" />{VERDICT_LABEL[r.verdict]}
                    </span>
                  )}
                </div>
                <p className="trn-run__sum">{r.summary}</p>
                <p className="trn-run__meta">{r.date} · {r.machine} · {r.config}</p>
              </div>
              <div className="trn-run__side">
                {(r.headline || []).slice(0, 3).map((h) => (
                  <span key={h.k} className="trn-run__stat"><b>{h.v}</b>{h.k}</span>
                ))}
              </div>
              <Icon name="chevron" size={14} className="trn-run__chev" />
            </button>
          ))}
        </div>
      )}

      <div className="trn-howto">
        <span className="trn-howto__k">Adding a run</span>
        <span>
          Copy <code>training-runs/runs/Run00Sample.jsx</code>, fill in the real numbers, add one
          entry to <code>training-runs/runs.js</code> — the full convention is documented at the
          top of that file. This shell never changes.
        </span>
      </div>
    </div>
  );
}

const CSS = `
.trn code { font-size: 0.82em; color: var(--ink-2); background: var(--surface-hi); padding: 0.05em 0.35em; border-radius: 3px; }

.trn-head { padding: 1.2rem 1.35rem; }
.trn-kicker { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin: 0 0 0.45rem; }
.trn-title { font-size: 1.4rem; line-height: 1.2; margin: 0 0 0.5rem; color: var(--ink); }
.trn-sub { font-size: 0.95rem; line-height: 1.6; color: var(--ink-2); margin: 0; max-width: 62ch; }

.trn-back { align-self: flex-start; display: inline-flex; align-items: center; gap: 0.4rem;
  border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-3); font: inherit;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer; border-radius: 4px; padding: 0.4rem 0.75rem; transition: all 0.15s; }
.trn-back:hover { color: var(--accent-ink); border-color: var(--accent); }
.trn-back svg { transform: none; }

.trn-list { display: flex; flex-direction: column; gap: 0.7rem; }
.trn-run { display: flex; align-items: center; gap: 1rem; width: 100%; text-align: left; font: inherit;
  color: inherit; cursor: pointer; padding: 0.9rem 1.05rem; transition: all 0.15s; }
.trn-run:hover { border-color: var(--accent); }
.trn-run:hover .trn-run__chev { color: var(--accent-ink); transform: translateX(2px); }

/* verdict — a labelled dot, tone never carried by colour alone */
.trn-run__verdict { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.62rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-3); }
.trn-run__vdot { width: 8px; height: 8px; border-radius: 99px; background: var(--signal); }
.trn-run__verdict[data-v="mixed"] .trn-run__vdot { background: #E0A82E; }
.trn-run__verdict[data-v="bad"] .trn-run__vdot { background: #D9605A; }

.trn-run__main { flex: 1 1 auto; min-width: 0; }
.trn-run__top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
.trn-run__no { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.68rem; font-weight: 800;
  color: #fff; background: var(--signal); border-radius: 99px; padding: 0.12rem 0.55rem; letter-spacing: 0.04em; }
.trn-run__title { font-weight: 700; color: var(--ink); font-size: 0.95rem; }
.trn-run__flag { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: #E0A82E; border: 1px dashed #E0A82E; border-radius: 99px; padding: 0.08rem 0.45rem; }
.trn-run__status { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--ink-3); border: 1px solid var(--line-2); border-radius: 99px; padding: 0.08rem 0.45rem; }
.trn-run__sum { font-size: 0.85rem; line-height: 1.5; color: var(--ink-2); margin: 0 0 0.3rem; }
.trn-run__meta { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.7rem; color: var(--text-faint); margin: 0; }

.trn-run__side { flex: none; display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-end; }
.trn-run__stat { font-size: 0.68rem; color: var(--text-faint); display: flex; align-items: baseline; gap: 0.35rem; }
.trn-run__stat b { font-size: 0.95rem; font-weight: 800; color: var(--accent-ink); font-variant-numeric: tabular-nums; }

.trn-run__chev { flex: none; color: var(--text-faint); transition: all 0.15s; }

.trn-empty { border: 1px dashed var(--line-2); border-radius: 8px; padding: 1.6rem 1.2rem; text-align: center;
  font-size: 0.88rem; color: var(--ink-3); }

.trn-howto { display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: baseline;
  padding: 0.7rem 0.9rem; border-radius: 8px; background: var(--surface-hi); border: 1px dashed var(--line-2); }
.trn-howto__k { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--accent-ink); }
.trn-howto span:last-child { font-size: 0.83rem; line-height: 1.6; color: var(--ink-2); flex: 1 1 300px; }

@media (max-width: 620px) {
  .trn-run { flex-wrap: wrap; }
  .trn-run__side { flex-direction: row; gap: 0.8rem; align-items: baseline; }
}
`;
