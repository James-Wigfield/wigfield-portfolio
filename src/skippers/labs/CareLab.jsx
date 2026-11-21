import { useMemo, useState } from 'react';
import { Stage, Icon } from '../kit/kit';
import { shuffle } from '../content/bank';

/* LAB for level 05 — when does each job happen? Sort the job into its
   bucket. Only jobs whose timing the workbook states in plain words. */

const BUCKETS = [
  { id: 'before', t: 'Every trip, before' },
  { id: 'after', t: 'Every trip, after' },
  { id: 'months', t: 'Monthly – 6-monthly' },
  { id: 'year', t: 'Yearly' },
];
const JOBS = [
  { t: 'Sniff for fuel fumes each time you board', b: 'before', p: 44 },
  { t: 'Check the navigation lights work — even for a day trip', b: 'before', p: 43 },
  { t: 'Check the bungs are in and the bilge is clean and dry', b: 'before', p: 45 },
  { t: 'Test the EPIRB / PLB with its test switch', b: 'before', p: 59 },
  { t: 'Flush the outboard with fresh water', b: 'after', p: 47 },
  { t: 'Take the bungs out once the boat is out of the water', b: 'after', p: 45 },
  { t: 'Check lifejackets for cuts, frayed straps and buckles', b: 'months', p: 53 },
  { t: 'Inspect fire extinguishers (gauge in the green)', b: 'months', p: 66 },
  { t: 'Gearbox oil, if you work the motor hard (every 3 months)', b: 'months', p: 43 },
  { t: 'Motor serviced by a workshop', b: 'year', p: 43 },
  { t: 'Change the water-pump impeller', b: 'year', p: 44 },
  { t: 'Clean out portable fuel tanks', b: 'year', p: 44 },
  { t: 'Service inflatable lifejackets (if the maker gives no rule)', b: 'year', p: 53 },
];

export default function ScheduleLab() {
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffle(JOBS), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState([]); // [{ job, ok }]
  const [miss, setMiss] = useState(null);
  const job = order[i];
  const done = i >= order.length;
  const score = placed.filter((p) => p.ok).length;

  const drop = (b) => {
    if (!job) return;
    const ok = b === job.b;
    setPlaced((p) => [...p, { job, ok }]);
    setMiss(ok ? null : `“${job.t}” is ${BUCKETS.find((x) => x.id === job.b).t.toLowerCase()} (p.${job.p}).`);
    setI(i + 1);
  };

  return (
    <Stage
      title="When does it get done?"
      receipt="Workbook p.43–47, 53, 59, 66"
      tryThis="Tap the bucket each job belongs in."
      challenge={{ text: `Sort all ${JOBS.length} with at most one miss.`, done: done && placed.length - score <= 1 }}
    >
      {!done ? (
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          <span className="sk-micro">Job {String(i + 1).padStart(2, '0')} / {String(order.length).padStart(2, '0')}</span>
          <p style={{ fontFamily: 'var(--f-display)', fontSize: '1.3rem', lineHeight: 1.3 }}>{job.t}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span className={`sk-dot ${placed.length - score <= 1 ? 'sk-dot--ok' : 'sk-dot--warn'}`}>{score}/{placed.length} sorted right</span>
          <button type="button" className="sk-btn sk-btn--small" onClick={() => { setRound(round + 1); setI(0); setPlaced([]); setMiss(null); }}><Icon name="reset" size={12} /> Again</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '0 1.2rem' }}>
        {BUCKETS.map((b) => (
          <div key={b.id} style={{ borderTop: '2px solid var(--rule-strong)', paddingTop: '0.4rem', minHeight: 90 }}>
            <button type="button" className="sk-btn sk-btn--small" disabled={done} onClick={() => drop(b.id)} style={{ width: '100%', justifyContent: 'space-between' }}>
              {b.t} <Icon name="arrow" size={12} />
            </button>
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.3rem' }}>
              {placed.filter((p) => p.job.b === b.id).map((p) => (
                <li key={p.job.t} className={`sk-dot ${p.ok ? 'sk-dot--ok' : 'sk-dot--bad'}`} style={{ fontFamily: 'var(--f-body)', fontSize: '0.8rem', lineHeight: 1.35 }}>{p.job.t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {miss && <p className="sk-dot sk-dot--bad" style={{ marginTop: '0.6rem' }} aria-live="polite">{miss}</p>}
    </Stage>
  );
}
