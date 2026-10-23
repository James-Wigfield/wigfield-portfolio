import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { rng } from '../../core/rng';
import { makeItems, fill } from '../../maths/overfitClinic';
import { INTRO, UI } from '../../content/overfit-clinic';
import { ChartView } from './charts.jsx';
import './overfit-clinic.css';

/* ============================================================================
   OVERFIT CLINIC (Lectures 1–8) — the hub's exam boss
   ----------------------------------------------------------------------------
   A patient (a sick model) arrives with a chart, a model summary or a sample
   strip drawn from its own data. Level 1: name the failure mode the slides
   name (Dx). Level 2: then prescribe the slides' fix (Rx). Level 3: then a
   follow-up read off the same case (an epoch, a rate, an ordering, a set).
   The patient's card stays on screen across its steps (keyed by the case);
   the answer panel resets per step (keyed by the item).

   Items: maths/overfitClinic.js (seeded). Words, fixes, slide receipts:
   content/overfit-clinic.js. Charts: ./charts.jsx.
   ========================================================================== */

const fmtAns = (a, it) => {
  if (typeof it?.format === 'function') return it.format(a);
  return it?.choices?.find((c) => c.value === a)?.label ?? String(a);
};

export default function OverfitClinic({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-oc">
      {item && <Patient key={item.caseKey} item={item} round={round} />}
    </RoundShell>
  );
}

function Patient({ item, round }) {
  const fb = round.feedback;
  const live = !fb && round.state === 'play';
  const chart = item.chart2 ?? item.chart;
  const right = !!fb?.correct;
  return (
    <div className="dla-oc__patient">
      <header className="dla-oc__head">
        <span className="dla-k"><span className="dla-dot" aria-hidden="true" />{fill(UI.patient, { n: item.caseN, total: item.caseTotal })} · {UI.lecture[item.lecture]}</span>
        {item.steps.length > 1 && <Steps item={item} fb={fb} />}
      </header>
      <div className="dla-oc__split">
        <figure className={`dla-floor dla-oc__card${right ? ' dla-oc__card--right' : ''}`}>
          <p className="dla-oc__complaint">{item.complaint}</p>
          {item.chart2 && <p className="dla-k dla-oc__second">{UI.secondChart}</p>}
          <ChartView key={`${item.caseKey}-${chart.type}`} chart={chart} />
          <figcaption className="dla-own">{chart.fromSlides ? UI.fromSlides : UI.own}</figcaption>
          <Record item={item} fb={fb} />
          {right && <span key={item.id} className="dla-oc__stamp" aria-hidden="true">{UI.stamp[item.step]}</span>}
          <Maths key={`${item.caseKey}-${chart.type}-m`} label={UI.maths}>
            {chart.drawer.map((t, i) => <MLine key={i} text={t} />)}
            {chart.tex.map((t, i) => <MEq key={`t${i}`} tex={t} />)}
          </Maths>
        </figure>
        <div className="dla-oc__answer">
          <Prompt k={`${UI.steps[item.step]} · ${round.index + 1} / ${round.total}`} sub={item.input ? fill(item.input === 'slots' ? UI.slotsHint : UI.orderHint, { n: item.cards.length }) : null}>
            <Why text={item.prompt} />
          </Prompt>
          <Feedback feedback={fb} format={fmtAns} />
          {item.kind === 'choice'
            ? <Choice key={item.id} choices={item.choices} onPick={(v) => live && round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={1} label={UI.pickAria} />
            : <OrderInput key={item.id} item={item} round={round} live={live} />}
        </div>
      </div>
    </div>
  );
}

/* diagnose · prescribe · follow-up, as labelled dots */
function Steps({ item, fb }) {
  return (
    <ol className="dla-oc__steps" aria-label={UI.stepsAria}>
      {item.steps.map((s, i) => {
        const state = i < item.stepIndex || (i === item.stepIndex && fb?.correct) ? 'done' : i === item.stepIndex ? 'now' : 'next';
        return (
          <li key={s} className={`dla-oc__step dla-oc__step--${state}`} aria-current={i === item.stepIndex ? 'step' : undefined}>
            <span className="dla-oc__stepdot" aria-hidden="true" />{UI.steps[s]}
          </li>
        );
      })}
    </ol>
  );
}

/* the case card's Dx / Rx lines, written in as the steps are passed */
function Record({ item, fb }) {
  const shownNow = fb?.correct ? fmtAns(item.answer, item) : null;
  const dx = item.record.dx ?? (item.step === 'dx' ? shownNow : null);
  const rx = item.record.rx ?? (item.step === 'rx' ? shownNow : null);
  const hasRx = item.steps.includes('rx');
  return (
    <dl className="dla-oc__record" aria-label={UI.noteAria}>
      <div className={dx ? 'dla-oc__rec--on' : ''}><dt>{UI.dx}</dt><dd>{dx ?? UI.pending}</dd></div>
      {hasRx && <div className={rx ? 'dla-oc__rec--on' : ''}><dt>{UI.rx}</dt><dd>{rx ?? UI.pending}</dd></div>}
    </dl>
  );
}

/* tap-to-order cards, or cards into labelled slots (level-3 follow-ups) */
function OrderInput({ item, round, live }) {
  const [seq, setSeq] = useState([]);
  const n = item.cards.length;
  const fb = round.feedback;
  const complete = seq.length === n;
  const place = (id) => { if (live) setSeq((s) => (s.includes(id) || s.length >= n ? s : [...s, id])); };
  const undo = () => { if (live) setSeq((s) => s.slice(0, -1)); };
  const submit = () => { if (live && complete) round.submit(seq.slice()); };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const k = Number(e.key);
      if (k >= 1 && k <= n) { e.preventDefault(); place(item.cards[k - 1].id); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'Enter' && !(e.target && /^button$/i.test(e.target.tagName))) { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const text = Object.fromEntries(item.cards.map((c) => [c.id, c.text]));
  const shown = fb && !fb.correct ? item.answer : seq;
  const slots = item.input === 'slots' ? item.slots : null;
  return (
    <div className="dla-oc__order">
      <ol className="dla-oc__slots" aria-label={slots ? UI.slotsAria : UI.orderAria}>
        {item.cards.map((_, i) => (
          <li key={i} className={`dla-oc__slot${shown[i] ? ' dla-oc__slot--on' : ''}${fb ? (fb.correct ? ' dla-oc__slot--right' : ' dla-oc__slot--answer') : ''}`}>
            <span className="dla-oc__slotk">{slots ? slots[i] : i + 1}</span>
            <span className="dla-oc__slotv">{shown[i] ? text[shown[i]] : UI.gap}</span>
          </li>
        ))}
      </ol>
      {fb && !fb.correct && <p className="dla-k">{UI.answerMeta}</p>}
      <div className="dla-oc__cards" role="group" aria-label={UI.orderAria}>
        {item.cards.map((c, i) => {
          const at = seq.indexOf(c.id);
          const last = at >= 0 && at === seq.length - 1;
          return (
            <button
              key={c.id}
              type="button"
              className={`dla-oc__cardbtn${at >= 0 ? ' dla-oc__cardbtn--on' : ''}`}
              onClick={() => (at < 0 ? place(c.id) : last ? undo() : null)}
              disabled={!live}
              aria-pressed={at >= 0}
              aria-label={`${i + 1}: ${c.text}${at >= 0 ? `, placed ${at + 1}` : ''}`}
            >
              <span className="dla-oc__cardn" aria-hidden="true">{at >= 0 ? at + 1 : ''}</span>
              <span className="dla-oc__cardt">{c.text}</span>
              <span className="dla-oc__cardkey" aria-hidden="true">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="dla-oc__btns">
        <button type="button" className="dla-btn dla-btn--quiet" onClick={undo} disabled={!live || !seq.length}>{UI.undo}</button>
        <button type="button" className="dla-btn dla-btn--primary" onClick={submit} disabled={!live || !complete}>
          {UI.submit} <span className="dla-btn__key">{UI.submitKey}</span>
        </button>
      </div>
    </div>
  );
}
