import { useMemo, useState } from 'react';
import Figure from '../art/Figure';
import { Rich, Icon } from '../kit/kit';
import { pg } from '../kit/pg';
import { topicLabel } from '../content/bank';

/* ============================================================================
   Quiz — one question per view.
     mode 'check' | 'drill' | 'deck'   instant feedback + explanation
     mode 'mock'                       no feedback until the end (exam style)
   onDone(results) gets [{ id, picked, correct }] in question order.
   ========================================================================== */

const KEYS = ['A', 'B', 'C', 'D'];

export default function Quiz({ questions, mode = 'check', title, onDone, onQuit }) {
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState(() => questions.map(() => null));
  const [revealed, setRevealed] = useState(() => questions.map(() => false));
  const exam = mode === 'mock';
  const q = questions[i];
  const picked = picks[i];
  const shown = revealed[i];
  const answered = picks.filter((p) => p !== null).length;

  const choose = (k) => {
    if (!exam && shown) return;
    setPicks((p) => p.map((v, j) => (j === i ? k : v)));
    if (!exam) setRevealed((r) => r.map((v, j) => (j === i ? true : v)));
  };
  const finish = () => {
    onDone?.(questions.map((qq, j) => ({ id: qq.id, picked: picks[j], correct: picks[j] === qq.answer })));
  };
  const last = i === questions.length - 1;

  const pips = useMemo(
    () => questions.map((qq, j) => {
      let cls = 'sk-quiz__pip';
      if (j === i) cls += ' sk-quiz__pip--on';
      else if (!exam && revealed[j]) cls += picks[j] === qq.answer ? ' sk-quiz__pip--ok' : ' sk-quiz__pip--bad';
      else if (exam && picks[j] !== null) cls += ' sk-quiz__pip--on';
      return cls;
    }),
    [questions, i, picks, revealed, exam],
  );

  if (!q) return <p className="sk-stage__cap">No questions here yet.</p>;

  return (
    <div className="sk-quiz">
      <div className="sk-quiz__bar">
        <span className="sk-micro">{title ?? 'Quiz'} · {String(i + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span>
        <span className="sk-quiz__prog" aria-hidden="true">{pips.map((c, j) => <span key={j} className={c} />)}</span>
      </div>
      <p className="sk-q__stem">{q.q}</p>
      {q.figure && <div className="sk-q__fig"><Figure spec={q.figure} /></div>}
      <div className="sk-opts" role="radiogroup" aria-label="Answers">
        {q.options.map((o, k) => {
          let cls = 'sk-opt';
          let mark = '';
          if (exam && picked === k) cls += ' sk-opt--picked';
          if (!exam && shown) {
            if (k === q.answer) { cls += ' sk-opt--right'; mark = picked === k ? '✓ your answer' : '✓ answer'; }
            else if (k === picked) { cls += ' sk-opt--wrong'; mark = '✗ your answer'; }
          }
          return (
            <button
              type="button"
              role="radio"
              aria-checked={picked === k}
              key={k}
              className={cls}
              disabled={!exam && shown}
              onClick={() => choose(k)}
            >
              <span className="sk-opt__k">{KEYS[k]}</span>
              <span>{o}</span>
              <span className="sk-opt__mark" style={{ color: k === q.answer ? 'var(--ok)' : 'var(--bad)' }}>{mark}</span>
            </button>
          );
        })}
      </div>
      {!exam && shown && (
        <div className="sk-why" aria-live="polite">
          <span className={`sk-dot ${picked === q.answer ? 'sk-dot--ok' : 'sk-dot--bad'}`}>{picked === q.answer ? 'Correct' : 'Not quite'} · {topicLabel(q.topic)} · {pg(q.page)}</span>
          <p><Rich text={q.why} /></p>
        </div>
      )}
      <div className="sk-quiz__nav">
        <span>
          {i > 0 && <button type="button" className="sk-btn sk-btn--small" onClick={() => setI(i - 1)}><Icon name="back" size={13} /> Back</button>}
          {onQuit && <button type="button" className="sk-btn sk-btn--small" style={{ marginLeft: '0.4rem' }} onClick={onQuit}>Quit</button>}
        </span>
        {exam && <span className="sk-micro">{answered} answered</span>}
        {last ? (
          <button type="button" className="sk-btn sk-btn--primary" onClick={finish} disabled={exam ? false : !shown}>
            {exam ? 'Hand in' : 'Finish'} <Icon name="arrow" size={14} />
          </button>
        ) : (
          <button type="button" className="sk-btn sk-btn--primary" onClick={() => setI(i + 1)} disabled={!exam && !shown}>
            Next <Icon name="arrow" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// A ruled review of answered questions (misses first)
export function Review({ results, questions, onlyMisses = false }) {
  const rows = results
    .map((r, j) => ({ ...r, q: questions[j], n: j + 1 }))
    .filter((r) => (onlyMisses ? !r.correct : true))
    .sort((a, b) => Number(a.correct) - Number(b.correct));
  if (!rows.length) return <p className="sk-dot sk-dot--ok">Nothing missed.</p>;
  return (
    <div className="sk-review">
      {rows.map((r) => (
        <div key={r.id} className="sk-review__row">
          <span className="sk-review__n">{String(r.n).padStart(2, '0')}</span>
          <div>
            <p className="sk-review__q">{r.q.q}</p>
            {r.q.figure && <div className="sk-q__fig" style={{ maxWidth: 300, marginTop: '0.5rem' }}><Figure spec={r.q.figure} /></div>}
            <div className="sk-review__a">
              {!r.correct && <span className="sk-dot sk-dot--bad">You: {r.picked === null ? 'no answer' : r.q.options[r.picked]}</span>}
              <span className="sk-dot sk-dot--ok">Answer: {r.q.options[r.q.answer]}</span>
              <span><Rich text={r.q.why} /> <span className="sk-receipt">{pg(r.q.page)}</span></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
