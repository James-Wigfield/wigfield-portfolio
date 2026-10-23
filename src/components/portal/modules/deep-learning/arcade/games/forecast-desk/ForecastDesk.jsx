import { useEffect, useMemo, useRef, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad, ShapePad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { fmtAnswer } from '../../kit/why';
import { rng } from '../../core/rng';
import { useWidth } from '../../../lecture8-study/useWidth';
import { makeItems, COPY } from '../../maths/forecastDesk';
import { EQUATIONS } from '../../content/lecture4';
import { CalendarScene, BaselineScene, ToyScene, WindowScene, AheadScene, BoardScene, Table30Scene, StrategyScene, StackScene, TimelineScene, Tape } from './scene.jsx';
import './forecast-desk.css';

/* ============================================================================
   FORECAST DESK (Lecture 4, slides 15–39)
   ----------------------------------------------------------------------------
   A forecasting desk on the Chicago rail series. The bar to beat is the
   slides' 7-days' shift baseline (rail MAE 42,143, slide 18); every model
   number on the desk is the one the slides print. Each call is a round item:

     level 1  the naive baseline: tap the day the 7-day forecast copies,
              diff_7 by hand, MAE and MAPE of a tiny example (slide 18's
              definitions), the printed baseline numbers
     level 2  windowing (slide 19's toy through the timeseries_dataset_from_
              array port, the 56-day windows, minibatch shapes, the split)
              and linear vs SimpleRNN vs deep RNN on the leaderboard
     level 3  multivariate inputs (slide 30's 5 columns), multiple outputs,
              multi-step strategies and ahead_model's shapes; beat the
              baseline

   Items: maths/forecastDesk.js (seeded). Words and receipts:
   content/forecast-desk.js. Pictures: scene.jsx.
   ========================================================================== */
export default function ForecastDesk({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  return (
    <RoundShell game={manifest} round={round} host={host} intro={{ line: COPY.intro, controls: COPY.controls }} stageClass="dla-fd">
      {round.current && <DeskStage key={round.current.id} item={round.current} round={round} />}
    </RoundShell>
  );
}

const fmt = (a, it) => fmtAnswer(it, a);

function DeskStage({ item, round }) {
  const floorRef = useRef(null);
  const width = useWidth(floorRef, 640);
  const fb = round.feedback && round.feedback.item.id === item.id ? round.feedback : null;
  const live = round.state === 'play' && !round.feedback;
  const [value, setValue] = useState('');
  const [shape, setShape] = useState(() => (item.kind === 'shape' ? item.answer.map(() => '') : []));
  const pickCells = useMemo(() => (item.scene.type === 'calendar' && item.scene.pick
    ? item.scene.rows.flatMap((r) => r.cells).filter((c) => !c.future && c.role !== 'target').map((c) => c.iso)
    : []), [item]);
  const [cursor, setCursor] = useState(() => pickCells[0] ?? null);

  // the calendar: arrows move the cursor (a row is 7 cells), Enter picks
  useEffect(() => {
    if (!live || !pickCells.length) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      const i = Math.max(0, pickCells.indexOf(cursor));
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step) {
        e.preventDefault();
        setCursor(pickCells[Math.max(0, Math.min(pickCells.length - 1, i + step))]);
      } else if (e.key === 'Enter') {
        if (/^button$/i.test(tag) && !e.target.closest?.('.dla-fd-cal')) return;
        e.preventDefault();
        round.submit(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, pickCells, cursor, round]);

  const submitNumber = () => {
    const v = Number(value);
    if (value !== '' && Number.isFinite(v)) round.submit(v);
  };
  const submitShape = () => {
    if (shape.every((v) => v !== '')) round.submit(shape.map(Number));
  };
  const picked = fb ? fb.given : null;
  const k = `call ${round.index + 1} / ${round.total} · ${COPY.levelNames[item.level - 1]}`;
  const choices = item.kind === 'choice' ? item.choices : null;
  const oneCol = choices && choices.some((c) => c.label.length > 34);

  return (
    <>
      <div className={`dla-floor dla-fd__floor${fb ? (fb.correct ? ' dla-fd--right' : ' dla-fd--wrong') : ''}`} ref={floorRef}>
        <div className="dla-fd__head">
          <Tape total={round.total} index={round.index} outcomes={round.outcomes} />
        </div>
        <Scene item={item} width={Math.max(280, width - 28)} fb={fb} cursor={cursor} live={live} onPick={(iso) => { setCursor(iso); round.submit(iso); }} picked={picked} />
      </div>
      <div className={item.kind === 'number' || item.kind === 'shape' ? 'dla-stagegrid' : 'dla-fd__deck'}>
        <div className="dla-fd__ask">
          <Prompt k={k} sub={item.sub ?? null}>{item.prompt}</Prompt>
          <Feedback feedback={fb} format={fmt} />
          {choices && (
            <Choice choices={choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={oneCol ? 1 : 2} label="Answers" />
          )}
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} decimal={!!item.decimal} negative={!!item.negative} disabled={!live} active={live} label="Your forecast call" unit={item.unit ?? ''} />
        )}
        {item.kind === 'shape' && (
          <ShapePad value={shape} onChange={setShape} onSubmit={submitShape} labels={item.labels} disabled={!live} active={live} ariaLabel="Shape" />
        )}
      </div>
      {item.maths && (
        <Maths label={COPY.drawer}>
          {item.maths.lines?.map((l, i) => <MLine key={i} text={l} />)}
          {item.maths.eq?.flatMap((id) => EQUATIONS[id].tex.map((t, j) => <MEq key={`${id}-${j}`} tex={t} />))}
          {item.maths.code && <pre className="dla-fd-code">{item.maths.code.join('\n')}</pre>}
        </Maths>
      )}
    </>
  );
}

function Scene({ item, width, fb, cursor, live, onPick, picked }) {
  const s = item.scene;
  const reveal = !!fb;
  switch (s.type) {
    case 'calendar': return <CalendarScene scene={s} cursor={cursor} onPick={onPick} picked={picked} reveal={reveal} live={live} />;
    case 'baseline': return <BaselineScene width={width} />;
    case 'toy': return <ToyScene scene={s} width={width} reveal={reveal} />;
    case 'window': return <WindowScene scene={s} width={width} reveal={reveal} />;
    case 'ahead': return <AheadScene scene={s} width={width} />;
    case 'board': return <BoardScene scene={s} width={width} reveal={reveal} correct={fb?.correct} />;
    case 'table30': return <Table30Scene scene={s} />;
    case 'strategy': return <StrategyScene scene={s} width={width} />;
    case 'stack': return <StackScene scene={s} width={width} />;
    case 'timeline': return <TimelineScene width={width} reveal={reveal} />;
    default: return null;
  }
}
