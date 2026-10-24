import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { rng } from '../../core/rng';
import { makeItems, routeOf, stationOut, lstmMaths, gruMaths, fadeMaths, zeroLevers, fmtGates, f2, aligned, GATES, SCALE } from '../../maths/longLine';
import { COPY, SCENE } from '../../content/long-line';
import { EQUATIONS } from '../../content/lecture4';
import { TrainScene, RouteStrip, UnrolledScene, PairScene, StepScene, SignalScene, Lever } from './scene.jsx';
import './long-line.css';

/* ============================================================================
   THE LONG SHORT-TERM LINE (Lecture 4)
   ----------------------------------------------------------------------------
   You are the memory cell running a train: each station is a time step t,
   the cargo car is the state, the platform crate is x(t) and the levers are
   the gates. A card says what must happen at the station; you set the gates
   and depart, and the car's cargo and the readout are computed with the
   slides' equations (maths/longLine.js → lecture4-study/rnn.js).

     level 1  SimpleRNN: the unrolled picture, the fade, and the slides'
              statements about it (choice items) + one step of slide 9
     level 2  LSTM: f, i, o levers at every station; signal-stop questions
     level 3  GRU: z and r levers (the slides' convention: z keeps h(t−1))

   Each station is a round item (kind 'custom'): answer = the gate setting,
   check = every gate that matters at that station matches. The cargo on
   board is always the dispatcher's (every earlier station played as its
   card says), so a miss costs that station only.
   ========================================================================== */
export default function LongLine({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={{ line: COPY.intro, controls: COPY.controls }} stageClass="dla-ll">
      {item && (item.type === 'station'
        ? <StationStage key={item.id} item={item} round={round} />
        : <QuizStage key={item.id} item={item} round={round} />)}
    </RoundShell>
  );
}

function useResults(round) {
  return useMemo(() => Object.fromEntries(round.outcomes.map((o) => [o.id, o.correct])), [round.outcomes]);
}

/* ── a station: set the gates, depart ─────────────────────────────────── */
function StationStage({ item, round }) {
  const [levers, setLevers] = useState(() => zeroLevers(item.model));
  const fb = round.feedback && round.feedback.item.id === item.id ? round.feedback : null;
  const live = round.state === 'play' && !round.feedback;
  const shown = fb && fb.given && typeof fb.given === 'object' ? fb.given : levers;
  const result = useMemo(() => (fb ? stationOut(item.model, item.prev, item.x, shown) : null), [fb, item, shown]);
  const route = useMemo(() => routeOf(round.items), [round.items]);
  const results = useResults(round);
  const gates = GATES[item.model];
  const lines = item.model === 'lstm' ? lstmMaths(item.prev, item.x, shown) : gruMaths(item.prev, item.x, shown);
  const eq = item.model === 'lstm' ? EQUATIONS['lstm.all'] : EQUATIONS['gru.all'];

  const flip = (k) => { if (live) setLevers((v) => ({ ...v, [k]: v[k] ? 0 : 1 })); };
  const depart = () => { if (live) round.submit({ ...levers }); };

  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      if (e.key === 'Enter') {
        // Enter departs, unless focus is on a control outside the deck (exit, mute, drawer)
        if (/^button$/i.test(tag) && !e.target.closest?.('.dla-ll__deck')) return;
        e.preventDefault();
        round.submit({ ...levers });
        return;
      }
      const g = gates.find((x) => x.kbd.toLowerCase() === e.key.toLowerCase());
      if (g) {
        e.preventDefault();
        setLevers((v) => ({ ...v, [g.key]: v[g.key] ? 0 : 1 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, levers, gates, round]);

  return (
    <>
      <div className={`dla-floor dla-ll__floor${fb ? (fb.correct ? ' dla-ll--go' : ' dla-ll--miss') : ''}`}>
        <RouteStrip route={route} current={item.t} results={results} scale={SCALE[item.model]} />
        {[false, true].map((narrow) => (
          <TrainScene key={narrow ? 'n' : 'w'} narrow={narrow} model={item.model} prev={item.prev} x={item.x} levers={shown} result={result} target={fb && !fb.correct ? item.target : null} scale={SCALE[item.model]} t={item.t} due={item.due} uid={item.id} />
        ))}
      </div>
      <div className="dla-ll__deck">
        <div className="dla-ll__card">
          <Prompt k={`station t = ${item.t} of ${item.total} · ${COPY.model[item.model].name}`} sub={item.hint ? item.sub : null}>{item.line}</Prompt>
          <p className={`dla-feedback${fb ? (fb.correct ? ' dla-feedback--right' : ' dla-feedback--wrong') : ' dla-feedback--idle'}`} aria-live="polite">
            {fb && <span className="dla-feedback__dot" aria-hidden="true" />}
            {fb && (fb.correct ? `right · ${COPY.model[item.model].state} = ${f2(result.c)}` : `wanted ${fmtGates(item.model, item.answer, item.care)}`)}
          </p>
        </div>
        <div className="dla-ll__levers" role="group" aria-label="Gates" style={{ '--n': gates.length }}>
          {gates.map((g) => <Lever key={g.key} gate={g} on={!!shown[g.key]} onFlip={() => flip(g.key)} disabled={!live} />)}
          <button type="button" className="dla-btn dla-btn--primary dla-btn--big dla-ll__go" onClick={depart} disabled={!live}>
            Depart <span className="dla-btn__key">Enter</span>
          </button>
        </div>
      </div>
      <Maths>
        <MLine text={item.model === 'lstm' ? COPY.drawer.lstmEq : COPY.drawer.gruEq} />
        <MEq tex={aligned(eq.tex)} />
        <MLine><span className="dla-own">{COPY.drawer.toy}</span></MLine>
        <MEq tex={aligned(lines)} />
        {item.model === 'gru' && <MLine text={COPY.drawer.gruOrder} />}
      </Maths>
    </>
  );
}

/* ── a question: level 1's statements, or a signal stop on levels 2–3 ── */
function QuizStage({ item, round }) {
  const fb = round.feedback && round.feedback.item.id === item.id ? round.feedback : null;
  const live = round.state === 'play' && !round.feedback;
  const route = useMemo(() => (item.model ? routeOf(round.items) : null), [item.model, round.items]);
  const results = useResults(round);
  const choices = useMemo(() => item.choices.map((c) => ({ value: c.value, aria: c.aria, label: <Why text={c.label} /> })), [item.choices]);
  const twoCol = item.choices.every((c) => c.aria.length < 34);
  const k = item.model ? `${COPY.signal} · ${COPY.model[item.model].name}` : `${round.index + 1} / ${round.total} · ${COPY.model.rnn.name}`;
  return (
    <>
      <div className="dla-floor dla-ll__floor">
        {route && <RouteStrip route={route} current={item.t} results={results} scale={SCALE[item.model]} />}
        {item.picture === 'pair' && <PairScene side={item.unrolledSide} />}
        {item.picture === 'step' && <StepScene step={item.step} reveal={!!fb} />}
        {item.picture === 'fade' && <UnrolledScene run={item.run} />}
        {item.picture === 'fade' && <p className="dla-ll-caption">{SCENE.unrolled.caption}</p>}
        {item.model && <SignalScene model={item.model} state={fb ? (fb.correct ? 'right' : 'wrong') : 'wait'} />}
      </div>
      <Prompt k={k}>{item.prompt}</Prompt>
      <Feedback feedback={fb} format={(a, it) => it.format(a)} />
      <Choice choices={choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={twoCol ? 2 : 1} label="Answers" />
      {item.drawer && item.run && (
        <Maths>
          <MLine text={COPY.drawer.rnnEq} />
          <MEq tex={aligned(EQUATIONS['rnn.layer'].tex)} />
          <MLine><span className="dla-own">{COPY.drawer.fade}</span></MLine>
          <MEq tex={aligned(fadeMaths(item.run))} />
        </Maths>
      )}
    </>
  );
}
