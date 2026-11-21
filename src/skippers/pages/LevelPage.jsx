import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LEVELS, hrefFor } from '../content/levels';
import { FACTS } from '../content/facts';
import { CARDS } from '../content/cards';
import { Facts, Cards, Icon } from '../kit/kit';
import { markStep, recordCheck, recordAnswers, useStored } from '../kit/storage';
import { pickCheckIn } from '../content/bank';
import { LABS, VIEWS } from '../labs';
import Quiz, { Review } from './Quiz';

/* One study level: header + hook, then its steps as an underlined strip
   (one view at a time; /skippers/<level>/<step> deep-links each). */

export default function LevelPage({ level, sub }) {
  const nav = useNavigate();
  const [progress] = useStored('progress', {});
  const stepIdx = Math.max(0, level.steps.findIndex((s) => s.id === sub));
  const step = level.steps[stepIdx];
  const lp = progress[level.id] ?? {};
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const nextLevel = LEVELS[idx + 1];

  useEffect(() => {
    if (step && step.kind !== 'check') markStep(level.id, step.id);
  }, [level.id, step]);

  const goStep = (i) => nav(hrefFor(level, level.steps[i].id));

  return (
    <article>
      <header className="sk-lhead">
        <span className="sk-lhead__n">{String(level.n).padStart(2, '0')}</span>
        <h1 className="sk-lhead__title">{level.title}</h1>
        <div className="sk-lhead__meta">
          <span className="sk-receipt">{level.receipt}</span>
          {lp.check !== undefined && (
            <span className={`sk-dot ${lp.check >= 4 ? 'sk-dot--ok' : 'sk-dot--warn'}`}>check-in best {lp.check}/5</span>
          )}
        </div>
      </header>
      {level.hook && <p className="sk-hook">{level.hook}</p>}

      <nav className="sk-steps" aria-label={`${level.title}: steps`}>
        {level.steps.map((s, i) => {
          const done = s.kind === 'check' ? (lp.check ?? 0) >= 4 : lp.steps?.[s.id];
          return (
            <button key={s.id} type="button" className={`sk-step${i === stepIdx ? ' sk-step--on' : ''}${done ? ' sk-step--done' : ''}`} onClick={() => goStep(i)} aria-current={i === stepIdx ? 'step' : undefined}>
              <span className="sk-step__n">{done ? '✓' : String(i + 1).padStart(2, '0')}</span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <StepBody key={`${level.id}-${step?.id}`} level={level} step={step} />

      <div className="sk-next">
        {stepIdx > 0 ? (
          <button type="button" className="sk-btn sk-btn--small" onClick={() => goStep(stepIdx - 1)}><Icon name="back" size={13} /> {level.steps[stepIdx - 1].label}</button>
        ) : <span />}
        {stepIdx < level.steps.length - 1 ? (
          <button type="button" className="sk-btn sk-btn--primary" onClick={() => goStep(stepIdx + 1)}>{level.steps[stepIdx + 1].label} <Icon name="arrow" size={14} /></button>
        ) : nextLevel ? (
          <Link className="sk-btn sk-btn--primary" to={hrefFor(nextLevel)}>Next: {nextLevel.short} <Icon name="arrow" size={14} /></Link>
        ) : null}
      </div>
    </article>
  );
}

function StepBody({ level, step }) {
  if (!step) return null;
  if (step.kind === 'lab') {
    const Lab = LABS[step.lab];
    return Lab ? <Lab /> : <p className="sk-stage__cap">This lab is still being built.</p>;
  }
  if (step.kind === 'custom') {
    const View = VIEWS[step.view];
    return View ? <View /> : null;
  }
  if (step.kind === 'facts') return <Facts facts={FACTS[level.id] ?? []} />;
  if (step.kind === 'cards') return <Cards cards={CARDS[step.cards] ?? []} />;
  if (step.kind === 'check') return <CheckIn level={level} />;
  return null;
}

function CheckIn({ level }) {
  const [round, setRound] = useState(0);
  const [qs, setQs] = useState(() => pickCheckIn(level.topics));
  const [results, setResults] = useState(null);
  if (!qs.length) return <p className="sk-stage__cap">The question bank is loading in a later build.</p>;
  if (results) {
    const score = results.filter((r) => r.correct).length;
    return (
      <div className="sk-quiz">
        <div className="sk-score">
          <span className="sk-score__big">{score}<small>/5</small></span>
          <div>
            <p className={`sk-dot ${score >= 4 ? 'sk-dot--ok' : 'sk-dot--warn'}`}>{score >= 4 ? 'Level passed — ticked off.' : 'Pass is 4 / 5. Misses are now in your weak-spots deck.'}</p>
          </div>
        </div>
        <div style={{ margin: '1rem 0' }}>
          <Review results={results} questions={qs} />
        </div>
        <button type="button" className="sk-btn" onClick={() => { setQs(pickCheckIn(level.topics)); setResults(null); setRound(round + 1); }}>
          <Icon name="reset" size={13} /> Another five
        </button>
      </div>
    );
  }
  return (
    <Quiz
      key={round}
      questions={qs}
      mode="check"
      title={`Check-in · ${level.short}`}
      onDone={(r) => {
        recordAnswers(r.map(({ id, correct }) => ({ id, correct })));
        recordCheck(level.id, r.filter((x) => x.correct).length);
        setResults(r);
      }}
    />
  );
}
