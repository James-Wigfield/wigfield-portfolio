import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../kit/kit';
import { pg } from '../kit/pg';
import { useStored, recordAnswers, readKey } from '../kit/storage';
import { QUESTIONS, TOPICS, byId, buildMock, shuffle } from '../content/bank';
import Quiz, { Review } from './Quiz';

/* ============================================================================
   EXAM ROOM — /skippers/exam[/mock|/drill|/deck]
     mock   40 questions weighted like the real paper, no feedback until you
            hand in; scored /40 against 34 (pass) with the 30–33 resit band
     drill  10 from one topic, instant feedback
     deck   the Leitner weak-spots deck: every miss anywhere lands in box 1;
            each right answer moves it up a box and makes it wait longer
   Mocks are saved (sk:mocks); readiness = the last three against 36 / 40.
   ========================================================================== */

export default function ExamRoom({ sub }) {
  const nav = useNavigate();
  const [mocks, setMocks] = useStored('mocks', []);
  const [deck] = useStored('deck', {});
  const [run, setRun] = useState(null); // { mode, questions, title, topic }
  const [result, setResult] = useState(null); // { mode, questions, results }

  const [now, setNow] = useState(Date.now);
  const due = useMemo(() => Object.entries(deck).filter(([id, c]) => byId.has(id) && c.due <= now), [deck, now]);
  const mode = sub ?? 'hub';

  const start = (m, topic) => {
    let questions;
    let title;
    if (m === 'mock') { questions = buildMock(); title = 'Mock exam'; }
    else if (m === 'drill') { questions = shuffle(QUESTIONS.filter((q) => q.topic === topic)).slice(0, 10); title = `Drill · ${TOPICS.find((t) => t.id === topic)?.label}`; }
    else {
      const d = readKey('deck', {});
      const ids = Object.entries(d).filter(([id, c]) => byId.has(id) && c.due <= Date.now()).sort((a, b) => a[1].box - b[1].box).slice(0, 15).map(([id]) => id);
      questions = shuffle(ids.map((id) => byId.get(id)));
      title = 'Weak spots';
    }
    setResult(null);
    setRun({ mode: m, questions, title, topic });
    if (sub !== m) nav(`/skippers/exam/${m}`);
  };

  const finish = (results) => {
    recordAnswers(results.map(({ id, correct }) => ({ id, correct })));
    if (run.mode === 'mock') {
      const score = results.filter((r) => r.correct).length;
      setMocks([...mocks, { at: Date.now(), score, wrong: results.filter((r) => !r.correct).map((r) => r.id) }].slice(-30));
    }
    setNow(Date.now());
    setResult({ ...run, results });
    setRun(null);
    window.scrollTo(0, 0);
  };

  if (!QUESTIONS.length) return <p className="sk-stage__cap">The question bank hasn’t loaded.</p>;

  const header = (
    <header className="sk-lhead" style={{ marginBottom: '1.4rem' }}>
      <span className="sk-lhead__n">10</span>
      <h1 className="sk-lhead__title">Exam room</h1>
      <div className="sk-lhead__meta">
        <span className="sk-receipt">{QUESTIONS.length} original questions · every one traced to a workbook page</span>
        {mode !== 'hub' && <Link to="/skippers/exam" className="sk-receipt" onClick={() => { setRun(null); setResult(null); }}>← exam room</Link>}
      </div>
    </header>
  );

  if (run) {
    return (
      <div>
        {header}
        <Quiz key={run.title + run.questions[0]?.id} questions={run.questions} mode={run.mode === 'mock' ? 'mock' : 'check'} title={run.title} onDone={finish} onQuit={() => { setRun(null); nav('/skippers/exam'); }} />
      </div>
    );
  }

  if (result) {
    const score = result.results.filter((r) => r.correct).length;
    const n = result.questions.length;
    const isMock = result.mode === 'mock';
    let verdict = null;
    if (isMock) {
      if (score >= 36) verdict = ['sk-dot--ok', 'Pass, with margin — that’s exam-ready territory.'];
      else if (score >= 34) verdict = ['sk-dot--ok', 'Pass. Aim for 36+ so a bad day still passes.'];
      else if (score >= 30) verdict = ['sk-dot--warn', 'Resit band: on the day you’d get one more go with different questions.'];
      else verdict = ['sk-dot--bad', 'Under 30: on the day you’d rebook. Work the weak-spots deck, then try again.'];
    }
    return (
      <div>
        {header}
        <div className="sk-score">
          <span className="sk-score__big">{score}<small>/{n}</small></span>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <span className="sk-micro">{result.title}</span>
            {verdict && <span className={`sk-dot ${verdict[0]}`}>{verdict[1]}</span>}
            {!isMock && <span className="sk-dot">Misses are in your weak-spots deck.</span>}
          </div>
        </div>
        {isMock && <Meter score={score} />}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', margin: '1rem 0 1.4rem' }}>
          <button type="button" className="sk-btn sk-btn--primary" onClick={() => start(result.mode, result.topic)}><Icon name="reset" size={13} /> {isMock ? 'Another mock' : 'Again'}</button>
          <Link className="sk-btn" to="/skippers/exam" onClick={() => setResult(null)}>Exam room</Link>
        </div>
        <div className="sk-facts__head"><h3>{isMock ? 'Every miss, explained' : 'Review'}</h3><span className="sk-micro">{n - score} missed</span></div>
        <Review results={result.results} questions={result.questions} onlyMisses={isMock} />
      </div>
    );
  }

  if (mode === 'mock' || mode === 'deck') {
    // arriving by link: show a start screen
    const isMock = mode === 'mock';
    return (
      <div>
        {header}
        <div className="sk-quiz">
          <p className="sk-q__stem">{isMock ? '40 questions, weighted like the real paper. No answers shown until you hand in.' : `${due.length} weak-spot question${due.length === 1 ? '' : 's'} due now.`}</p>
          <p className="sk-stage__cap" style={{ marginBottom: '1rem' }}>{isMock ? 'Pass is 34. 30–33 is the resit band. You want 36+ three times in a row.' : 'Misses from check-ins, drills and mocks land here and come back until you get them right a few times.'}</p>
          <button type="button" className="sk-btn sk-btn--primary" disabled={!isMock && !due.length} onClick={() => start(mode)}>{isMock ? 'Start the mock' : 'Start'} <Icon name="arrow" size={14} /></button>
        </div>
      </div>
    );
  }

  if (mode === 'drill') {
    return (
      <div>
        {header}
        <div className="sk-facts__head"><h3>Topic drills</h3><span className="sk-micro">10 questions · instant feedback</span></div>
        <DrillGrid onPick={(t) => start('drill', t)} />
      </div>
    );
  }

  // hub
  const last3 = mocks.slice(-3);
  const boxes = [1, 2, 3, 4, 5].map((b) => Object.values(deck).filter((c) => c.box === b).length);
  return (
    <div>
      {header}
      <section>
        <div className="sk-facts__head"><h3>Readiness</h3><span className="sk-micro">last 3 mocks vs the 36 / 40 target</span></div>
        <div className="sk-mocks" style={{ borderTop: '2px solid var(--rule-strong)', paddingTop: '0.8rem' }}>
          {[0, 1, 2].map((i) => {
            const m = last3[i];
            return (
              <div key={i} style={{ minWidth: 90 }}>
                <div className="sk-mono" style={{ fontSize: '2rem', letterSpacing: '-0.04em', color: m ? (m.score >= 36 ? 'var(--ok)' : m.score >= 34 ? 'var(--ink)' : 'var(--bad)') : 'var(--ink-3)' }}>{m ? m.score : '—'}<span style={{ fontSize: '0.5em', color: 'var(--ink-3)' }}>/40</span></div>
                <span className="sk-micro">{m ? new Date(m.at).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : `mock ${i + 1}`}</span>
              </div>
            );
          })}
          <span className={`sk-dot ${last3.length === 3 && last3.every((m) => m.score >= 36) ? 'sk-dot--ok' : 'sk-dot--warn'}`}>
            {last3.length === 3 && last3.every((m) => m.score >= 36) ? 'Ready: three in a row at 36+' : `${last3.filter((m) => m.score >= 36).length} of the last 3 at 36+`}
          </span>
        </div>
        {last3.length > 0 && <Meter score={last3[last3.length - 1].score} />}
      </section>

      <section className="sk-sec" style={{ marginTop: '1.8rem' }}>
        <div className="sk-modes">
          <button type="button" className="sk-mode" onClick={() => start('mock')}>
            <span className="sk-micro">01 · the real thing</span>
            <span className="sk-mode__t">Full mock exam →</span>
            <span className="sk-mode__s">40 questions weighted like the paper. Marked at the end against 34.</span>
          </button>
          <button type="button" className="sk-mode" onClick={() => nav('/skippers/exam/drill')}>
            <span className="sk-micro">02 · one topic</span>
            <span className="sk-mode__t">Topic drills →</span>
            <span className="sk-mode__s">Ten from a single chapter, with the answer and page after each.</span>
          </button>
          <button type="button" className="sk-mode" onClick={() => (due.length ? start('deck') : nav('/skippers/exam/deck'))}>
            <span className="sk-micro">03 · {due.length} due now</span>
            <span className="sk-mode__t">Weak-spots deck →</span>
            <span className="sk-mode__s">Every miss comes back sooner; right answers move up a box.</span>
          </button>
        </div>
      </section>

      <section className="sk-sec" style={{ marginTop: '1.8rem' }}>
        <div className="sk-facts__head"><h3>Your deck</h3><span className="sk-micro">box 1 = comes back now · box 5 = learnt</span></div>
        <div className="sk-boxes">
          {boxes.map((n, i) => (
            <div key={i} className="sk-box"><div className="sk-box__n">{n}</div><div className="sk-box__l">box {i + 1}</div></div>
          ))}
        </div>
        {mocks.length > 0 && (
          <p className="sk-stage__cap">{mocks.length} mock{mocks.length === 1 ? '' : 's'} taken · best {Math.max(...mocks.map((m) => m.score))}/40 · questions follow the workbook — {pg(6)} for the rules of the test.</p>
        )}
      </section>
    </div>
  );
}

function DrillGrid({ onPick }) {
  return (
    <div className="sk-drillgrid">
      {TOPICS.map((t) => (
        <button key={t.id} type="button" className="sk-drill" onClick={() => onPick(t.id)}>
          <span>{t.label}</span>
          <span className="sk-micro">{QUESTIONS.filter((q) => q.topic === t.id).length} q</span>
        </button>
      ))}
    </div>
  );
}

function Meter({ score }) {
  const pct = (v) => `${(v / 40) * 100}%`;
  return (
    <div className="sk-meter" aria-label={`${score} out of 40`} role="img">
      <div className="sk-meter__track" />
      <div className="sk-meter__fill" style={{ width: pct(score), background: score >= 34 ? 'var(--ok)' : score >= 30 ? 'var(--warn)' : 'var(--bad)' }} />
      <div style={{ position: 'absolute', left: pct(30), width: `${(4 / 40) * 100}%`, top: 12, height: 10, background: 'repeating-linear-gradient(45deg, var(--warn) 0 2px, transparent 2px 5px)', opacity: 0.45 }} />
      {[30, 34, 36].map((v) => (
        <span key={v}>
          <span className="sk-meter__tick" style={{ left: pct(v) }} />
          <span className="sk-meter__lbl" style={{ left: pct(v) }}>{v === 34 ? 'pass 34' : v === 36 ? '36' : '30'}</span>
        </span>
      ))}
    </div>
  );
}
