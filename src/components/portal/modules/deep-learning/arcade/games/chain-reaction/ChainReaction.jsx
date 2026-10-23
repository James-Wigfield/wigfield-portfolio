import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { fmtAnswer } from '../../kit/why';
import { rng } from '../../core/rng';
import { makeItems, fuseMs } from '../../maths/chainReaction.js';
import { INTRO, LABELS } from '../../content/chain-reaction.js';
import { NetGraph, ActInset, CollapseScene, CurveScene, CardScene, Ledger } from './Scenes.jsx';
import { OrderPad, HeadBuilder } from './Inputs.jsx';
import './chain-reaction.css';

/* ============================================================================
   CHAIN REACTION (Lecture 1, slides 4–31)
   ----------------------------------------------------------------------------
   A tiny MLP (2 → 2 → 1) drawn as a computation graph.
     level 1  the forward pass lights it node by node: z, h, z, ŷ on the
              keypad; then name a Figure 10-8 curve and collapse a stack with
              its activation removed (slide 23)
     level 2  backprop: the gradients fill backwards node by node, each item
              under a burning fuse (the round clock still rules)
     level 3  task cards (slides 24–31's tables), Figure 10-8's derivative
              panel, a three-layer collapse, one beyond-the-slides step
   Items, numbers and text: maths/chainReaction.js + content/chain-reaction.js.
   ========================================================================== */

export default function ChainReaction({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const lvl = Math.max(1, Math.min(3, Number(level) || 1));
  const items = useMemo(() => makeItems(rng(seed), lvl), [seed, lvl]);
  const round = useRound({ gameId: manifest.id, seed, level: lvl, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO[lvl]} stageClass="dla-cr">
      {item && <ItemStage key={item.id} item={item} round={round} fuse={item.fuse ? fuseMs(durationMs) : null} />}
    </RoundShell>
  );
}

const fbFormat = (answer, it) => fmtAnswer(it, answer);

// One item; remounted per item (the key), so its inputs and fuse reset.
function ItemStage({ item, round, fuse }) {
  const [value, setValue] = useState('');
  const [pick, setPick] = useState({ neurons: null, act: null, loss: null });
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const live = !round.feedback && round.state === 'play';
  useEffect(() => {
    if (!fuse || !live) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [fuse, live]);
  const left = fuse ? Math.max(0, fuse - (now - start)) : null;
  useEffect(() => {
    if (fuse && live && left <= 0) round.skip();
  }, [fuse, live, left, round]);

  const fb = round.feedback;
  const reveal = fb && typeof item.answer === 'number' ? item.answer : null;
  const st = item.stage;
  const submitNumber = () => {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) round.submit(n);
  };

  let scene = null;
  if (st.type === 'graph') {
    scene = (
      <div className="dla-cr__graphwrap">
        <NetGraph stage={st} reveal={reveal} />
        {st.inset && <ActInset inset={st.inset} />}
      </div>
    );
  } else if (st.type === 'collapse') scene = <CollapseScene stage={st} reveal={reveal} />;
  else if (st.type === 'curve') scene = <CurveScene stage={st} />;
  else if (st.type === 'card') scene = <CardScene stage={st} pick={pick} />;

  const sub = (
    <span className="dla-cr__sub">
      {item.beyond && <span className="dla-cr__bdot" aria-hidden="true" />}
      {item.sub}
    </span>
  );

  return (
    <>
      <div className={`dla-floor dla-cr__floor${fb ? (fb.correct ? ' dla-cr__floor--right' : ' dla-cr__floor--wrong') : ''}`}>
        {fuse && <Fuse left={left} total={fuse} />}
        {scene}
        {st.ledger?.length > 0 && <Ledger items={st.ledger} reveal={reveal} />}
      </div>
      <div className="dla-stagegrid">
        <div className="dla-cr__side">
          <Prompt k={`${round.index + 1} / ${round.total}`} sub={sub}><Why text={item.prompt} /></Prompt>
          <Feedback feedback={fb} format={fbFormat} />
          {item.kind === 'choice' && (
            <Choice choices={item.choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} disabled={!live} active={live} columns={2} label="Answer choices" />
          )}
          {item.input === 'order' && <OrderPad cards={st.cards} onSubmit={(seq) => round.submit(seq)} disabled={!live} active={live} />}
          {item.input === 'head' && <HeadBuilder head={item.head} pick={pick} onPick={setPick} onSubmit={() => round.submit({ ...pick })} disabled={!live} active={live} />}
          {item.maths?.length > 0 && (
            <Maths>
              {item.maths.map((m, i) => (m.tex ? <MEq key={i} tex={m.tex} /> : <MLine key={i} text={m.text} />))}
            </Maths>
          )}
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} decimal={item.pad?.decimal ?? true} negative={item.pad?.negative ?? true} disabled={!live} active={live} label={item.padLabel ?? 'Your answer'} />
        )}
      </div>
    </>
  );
}

// level 2's fuse: a burning cord along the top of the stage
function Fuse({ left, total }) {
  const f = Math.max(0, Math.min(1, left / total));
  const secs = Math.ceil(left / 1000);
  return (
    <div className="dla-cr__fuse" data-low={secs <= 3 ? 'true' : undefined} role="timer" aria-label={`${LABELS.fuse}: ${secs} seconds left for this item`}>
      <span className="dla-k">{LABELS.fuse}</span>
      <span className="dla-cr__fusetrack" aria-hidden="true">
        <span className="dla-cr__fusefill" style={{ transform: `scaleX(${f})` }} />
        <span className="dla-cr__fusespark" style={{ left: `${f * 100}%` }} />
      </span>
      <span className="dla-cr__fusesecs">{secs}s</span>
    </div>
  );
}
