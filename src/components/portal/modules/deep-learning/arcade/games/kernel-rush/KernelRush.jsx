import { useEffect, useMemo, useRef, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad, ShapePad } from '../../kit/Keypad';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { fmtAnswer, receipt } from '../../kit/why';
import { rng } from '../../core/rng';
import { useWidth } from '../../../lecture8-study/useWidth';
import { makeItems, dims } from '../../maths/kernelRush';
import { INTRO, LABELS } from '../../content/kernel-rush';
import { parseSlots } from './geometry';
import { SpecCard, BlockStage, GridStage } from './Stage';
import './kernel-rush.css';

/* ============================================================================
   KERNEL RUSH (Lecture 3)
   ----------------------------------------------------------------------------
   A conv or pooling layer drops onto the input block. Size the output block
   (H × W × C on the ShapePad) before the kernel lands; the block you type
   grows on the stage as a ghost, then the real block lands (a wrong one lands
   beside it and stays there for the bonus). Bonus: the layer's Param # on the
   keypad. Level 3 adds stacks and receptive fields (slide 9's rows
   i·s_h … i·s_h + f_h − 1, answered as a first × last pair).

   One "drop" = the shape (or receptive-field) item + its bonus item; the
   stage is keyed by the drop so the picture persists across both. The fall
   time is the drop's share of the round clock (by item weight); a kernel
   that lands before you answer counts as a miss, as on Param Sniper's belt.

   Items: maths/kernelRush.js (seeded; shapes and counts from the verified
   maths/shapes.js and maths/params.js). Text: content/kernel-rush.js.
   ========================================================================== */

const MIN_FALL_MS = 6500;

export default function KernelRush({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const rootRef = useRef(null);
  const width = useWidth(rootRef, 800);
  const narrow = width < 560;
  const totalWeight = useMemo(() => items.reduce((a, it) => a + (it.weight ?? 1), 0), [items]);
  const item = round.current;
  const dropItems = useMemo(() => (item ? items.filter((it) => it.drop === item.drop) : []), [items, item]);
  const head = dropItems[0];
  const share = durationMs && head ? Math.max(MIN_FALL_MS, (durationMs * head.weight) / totalWeight) : null;
  return (
    <div ref={rootRef} className="dla-kr-root">
      <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-kr">
        {item && head && <DropStage key={item.drop} item={item} head={head} round={round} share={share} narrow={narrow} />}
      </RoundShell>
    </div>
  );
}

const fmtFeedback = (a, it) => fmtAnswer(it, a);
const parseIdx = (vals) => vals.map((v) => (v === '' || v == null ? null : Number(v)));

// One drop: the picture persists across its shape item and its bonus item.
function DropStage({ item, head, round, share, narrow }) {
  const stage = head.stage;
  const isRf = head.phase === 'rf';
  const live = !round.feedback && round.state === 'play';
  const landed = round.outcomes.some((o) => o.id === head.id);
  const mistake = round.mistakes.find((m) => m.item.id === head.id);
  const wrong = landed && !!mistake;
  const given = mistake && Array.isArray(mistake.given) ? mistake.given : null;

  const [vals, setVals] = useState(() => head.answer.map(() => ''));
  const [num, setNum] = useState('');
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const falling = !!share && live && !landed && item.id === head.id;
  useEffect(() => {
    if (!falling) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [falling]);
  useEffect(() => {
    if (falling && now - start >= share) round.skip();
  }, [falling, now, start, share, round]);
  const t = landed ? 1 : share ? Math.min(1, (now - start) / share) : 0;

  const complete = vals.every((v) => v !== '');
  const submitShape = () => { if (complete && live) round.submit(vals.map(Number)); };
  const submitNumber = () => { if (num !== '' && live) round.submit(Number(num)); };

  const preview = landed ? null : isRf ? parseIdx(vals) : parseSlots(vals);
  const [kh, kw, kc] = stage.kernel ?? [];
  const kernelLabel = stage.view !== 'block' || stage.kind === 'gap'
    ? null
    : stage.kind === 'conv' ? `${LABELS.kernel} ${kh} × ${kw} × ${kc}` : `${LABELS.window} ${kh} × ${kw}`;
  const onPad = item.phase === 'shape' || item.phase === 'rf';
  const axisWord = stage.axis === 'rows' ? 'row' : 'column';

  return (
    <div className="dla-stagegrid dla-kr__grid">
      <div className="dla-kr__left">
        <div className={`dla-floor dla-kr__floor${landed ? (wrong ? ' dla-kr__floor--miss' : ' dla-kr__floor--hit') : ''}`}>
          <SpecCard lines={stage.lines} outs={landed && stage.view === 'block' ? stage.outs : null} title={stage.title} receipt={stage.title ? receipt(head.src) : null} dims={dims} />
          {stage.view === 'grid'
            ? <GridStage stage={stage} narrow={narrow} t={t} landed={landed} wrong={wrong} given={given} preview={preview} labels={LABELS} />
            : <BlockStage stage={stage} narrow={narrow} t={t} landed={landed} wrong={wrong} given={given} preview={preview} labels={LABELS} kernelLabel={kernelLabel} />}
        </div>
        <Prompt k={`${round.index + 1} / ${round.total}${item.phase === 'params' ? ' · bonus' : ''}`} sub={item.sub}>{item.question}</Prompt>
        <Feedback feedback={round.feedback} format={fmtFeedback} />
        {item.maths?.length > 0 && (
          <Maths>
            {item.maths.map((m, i) => (m.tex ? <MEq key={i} tex={m.tex} /> : <MLine key={i} text={m.text} />))}
          </Maths>
        )}
      </div>
      {onPad && (
        <ShapePad
          key={item.id}
          value={isRf ? vals : ['', ...vals]}
          onChange={(v) => setVals(isRf ? v : v.slice(1))}
          onSubmit={submitShape}
          fixed={isRf ? [] : ['None']}
          labels={isRf ? [`first ${axisWord}`, `last ${axisWord}`] : ['batch', ...(head.answer.length === 1 ? ['channels'] : ['height', 'width', 'channels'])]}
          sep={isRf ? 'to' : '×'}
          disabled={!live}
          active={live}
          ariaLabel={isRf ? `First and last input ${axisWord}` : 'Output block shape'}
        />
      )}
      {item.phase === 'params' && (
        <Keypad key={item.id} value={num} onChange={setNum} onSubmit={submitNumber} disabled={!live} active={live} label="Parameter count" />
      )}
    </div>
  );
}
