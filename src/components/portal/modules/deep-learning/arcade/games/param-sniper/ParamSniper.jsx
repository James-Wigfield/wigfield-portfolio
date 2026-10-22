import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad, ShapePad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { rng } from '../../core/rng';
import { makeItems, fmtShape } from '../../maths/paramSniper';
import './param-sniper.css';

/* ============================================================================
   PARAM SNIPER (Lectures 1–8)
   ----------------------------------------------------------------------------
   A layer spec slides in along a conveyor towards the firing line. You enter
   its parameter count (4 choices at level 1; keypad above) or its output
   shape (ShapePad) before it reaches the line. The conveyor's speed is the
   round timer: every item gets the same share of the clock, and the spec
   arriving at the line is that share running out (the item is skipped and
   counted as wrong, so the round never stalls).

   Items: maths/paramSniper.js (seeded; verified maths). Content and slide
   receipts: content/param-sniper.js.
   ========================================================================== */
const INTRO = {
  line: 'Count the parameters before the spec reaches the line.',
  controls: [
    'Type the Param # on the keypad (keys 0–9, Enter), or pick one of four at level 1 (keys 1–4).',
    'A shape question wants (None, …): fill each dimension, Tab or × moves on, Enter fires.',
    'Keras 3 defaults throughout: biases on, GRU reset_after=True, "valid" padding unless shown.',
  ],
};

const fmtNum = (a, it) => (it.kind === 'shape' ? fmtShape(a) : Number(a).toLocaleString('en-AU'));

export default function ParamSniper({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  // per-item share of the clock drives the conveyor (never under 2.5 s)
  const share = durationMs ? Math.max(2500, durationMs / round.total) : null;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-ps">
      {item && <ItemStage key={item.id} item={item} round={round} share={share} />}
    </RoundShell>
  );
}

// One item on the conveyor; remounted per item (the key), so its state resets.
function ItemStage({ item, round, share }) {
  const [value, setValue] = useState('');
  const [shape, setShape] = useState(() => (item.kind === 'shape' ? item.answer.map(() => '') : []));
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const live = !round.feedback && round.state === 'play';
  useEffect(() => {
    if (!share || !live) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [share, live]);
  const t = share && live ? Math.min(1, (now - start) / share) : share ? 1 : 0;
  useEffect(() => {
    if (share && live && now - start >= share) round.skip();
  }, [now, start, share, live, round]);

  const submitNumber = () => { if (value !== '') round.submit(Number(value)); };
  const submitShape = () => { if (shape.every((v, i) => v !== '' || item.answer[i] === null)) round.submit(shape.map((v, i) => (item.answer[i] === null ? null : Number(v)))); };
  // the ShapePad shows the batch axis as a fixed leading "None" slot
  const fixed = item.kind === 'shape' ? ['None', ...item.answer.map((d) => (d === null ? 'None' : undefined))] : [];

  return (
    <>
      <div className="dla-floor dla-ps__floor">
        <div className="dla-ps__belt" aria-hidden="true">
          <span className="dla-ps__line" />
        </div>
        <div className={`dla-ps__spec${round.feedback ? (round.feedback.correct ? ' dla-ps__spec--hit' : ' dla-ps__spec--miss') : ''}`} style={{ '--t': t }}>
          <pre className="dla-ps__code" aria-label="Layer specification">
            {item.lines.map((l, i) => <span key={i} className={`dla-ps__ln${i === item.lines.length - 1 && item.lines.length <= 3 ? ' dla-ps__ln--hot' : ''}`}>{l}</span>)}
          </pre>
          {item.title && <span className="dla-ps__model">{item.title}</span>}
        </div>
      </div>
      <div className="dla-stagegrid">
        <div>
          <Prompt k={`${round.index + 1} / ${round.total}`}>{item.question}</Prompt>
          <Feedback feedback={round.feedback} format={fmtNum} />
          {item.kind === 'choice' && (
            <Choice choices={item.choices} onPick={(v) => round.submit(v)} picked={round.feedback ? round.feedback.given : null} answer={round.feedback ? item.answer : null} active={live} />
          )}
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} disabled={!live} active={live} label="Parameter count" />
        )}
        {item.kind === 'shape' && (
          <ShapePad value={['', ...shape]} onChange={(v) => setShape(v.slice(1))} onSubmit={submitShape} fixed={fixed} labels={['batch', ...shapeLabels(item.answer.length)]} disabled={!live} active={live} ariaLabel="Output shape" />
        )}
      </div>
    </>
  );
}

function shapeLabels(n) {
  if (n === 3) return ['height', 'width', 'channels'];
  if (n === 2) return ['steps', 'features'];
  return ['features'];
}
