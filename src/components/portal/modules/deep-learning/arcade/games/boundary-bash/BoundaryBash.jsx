import { useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { fmtAnswer } from '../../kit/why';
import { rng } from '../../core/rng';
import { makeItems } from '../../maths/boundaryBash.js';
import { INTRO, LABELS, NOTATION } from '../../content/boundary-bash.js';
import { Plane, Ledger, XorPlot, MlpNet } from './Scenes.jsx';
import './boundary-bash.css';

/* ============================================================================
   BOUNDARY BASH (Lecture 1, slides 4–17)
   ----------------------------------------------------------------------------
   One TLU's decision boundary on the (x₁, x₂) plane; points arrive one at a
   time and the player keeps the boundary honest with the Perceptron
   learning rule (slide 10).
     level 1  which way w moves, which formula is the rule (dashed candidate
              boundaries), what a TLU outputs, heaviside vs sign
     level 2  the update by hand on the keypad, z and ŷ at a probe, slides
              9 / 12–15 checks; later points hide ŷ
     level 3  XOR (slide 16): add the hidden layer, fill Figure 10-6b's
              blanks, run its forward pass by hand (slide 17)
   Items, numbers and text: maths/boundaryBash.js + content/boundary-bash.js.
   ========================================================================== */

export default function BoundaryBash({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const lvl = Math.max(1, Math.min(3, Number(level) || 1));
  const items = useMemo(() => makeItems(rng(seed), lvl), [seed, lvl]);
  const round = useRound({ gameId: manifest.id, seed, level: lvl, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO[lvl]} stageClass="dla-bb">
      {item && <ItemStage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}

const fbFormat = (answer, it) => fmtAnswer(it, answer);

// One item; remounted per item (the key), so its keypad value resets.
function ItemStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = !round.feedback && round.state === 'play';
  const fb = round.feedback;
  const reveal = !!fb;
  const sc = item.scene;
  const choices = useMemo(() => item.choices?.map((c) => ({ ...c, label: <Why text={c.label} />, aria: c.plain ?? c.label })), [item]);
  const submitNumber = () => {
    const n = Number(value);
    if (value !== '' && value !== '-' && Number.isFinite(n)) round.submit(n);
  };

  // the prompt + feedback line: beside the controls on wide stages, above the picture on narrow
  // ones (so the sticky keypad never hides the question); CSS shows one of the two copies
  const head = (where) => (
    <div className={`dla-bb__head dla-bb__head--${where}`}>
      <Prompt k={`${round.index + 1} / ${round.total}`} sub={item.sub ? <Why text={item.sub} /> : null}><Why text={item.prompt} /></Prompt>
      <Feedback feedback={fb} format={fbFormat} />
    </div>
  );

  return (
    <>
      {head('top')}
      <div className={`dla-floor dla-bb__floor${fb ? (fb.correct ? ' dla-bb__floor--right' : ' dla-bb__floor--wrong') : ''}`}>
        {sc.type === 'plane' && (
          <div className="dla-bb__scene">
            <div className="dla-bb__plot"><Plane scene={sc} reveal={reveal} given={fb?.given ?? null} answer={item.answer} /></div>
            <div className="dla-bb__aside">
              <Ledger scene={sc} reveal={reveal} ask={sc.ask ?? null} />
              <Legend />
            </div>
          </div>
        )}
        {sc.type === 'xor' && (
          <div className="dla-bb__scene dla-bb__scene--xor">
            <div className={`dla-bb__xorplot${sc.phase === 'flat' ? ' dla-bb__xorplot--solo' : ''}`}><XorPlot scene={sc} reveal={reveal} /></div>
            {sc.phase === 'mlp' && <div className="dla-bb__net"><MlpNet scene={sc} reveal={reveal} /></div>}
            <Legend xor />
          </div>
        )}
      </div>
      <div className="dla-stagegrid">
        <div className="dla-bb__ctl">
          {head('side')}
          {item.kind === 'choice' && (
            <Choice choices={choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} disabled={!live} active={live} columns={item.choices.length > 3 ? 2 : item.choices.length} label="Answer choices" />
          )}
          {item.maths?.length > 0 && (
            <Maths>
              {item.maths.map((m, i) => (m.tex ? <MEq key={i} tex={m.tex} /> : <MLine key={i} text={m.text} />))}
              <MLine text={sc.type === 'xor' ? NOTATION.xor : NOTATION.text} />
            </Maths>
          )}
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} decimal={item.pad?.decimal ?? true} negative={item.pad?.negative ?? true} disabled={!live} active={live} label="Your answer" />
        )}
      </div>
    </>
  );
}

function Legend({ xor = false }) {
  return (
    <p className={`dla-bb__legend${xor ? ' dla-bb__legend--xor' : ''}`}>
      <span><span className="dla-bb__chip dla-bb__chip--1" aria-hidden="true" />{LABELS.y1}</span>
      <span><span className="dla-bb__chip dla-bb__chip--0" aria-hidden="true" />{LABELS.y0}</span>
      {!xor && <span><span className="dla-bb__swatch" aria-hidden="true" />{LABELS.side1}</span>}
    </p>
  );
}
