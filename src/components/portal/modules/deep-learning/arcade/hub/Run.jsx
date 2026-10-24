import { useCallback, useEffect, useMemo, useState } from 'react';
import { GAMES, gameById } from '../core/games';
import { CONCEPTS, LECTURES } from '../core/concepts';
import { planMix, planExam, gradeByLecture } from '../core/scheduler';
import { getBoxes, getProfile, getMix, setMix, getExam, setExam } from '../core/storage';
import { maxLevelUnlocked } from '../core/progress';
import { rng, daySeed, hashSeed, todayISO } from '../core/rng';
import { GamePlayer } from '../GamePlayer';
import './hub.css';

/* ============================================================================
   GRADIENT ARCADE — A RUN (the Daily Mix and the Exam)
   ----------------------------------------------------------------------------
   A planned sequence of rounds across the games (core/scheduler.js
   planMix / planExam), each played through GamePlayer in mode 'mix' or
   'exam'. The plan and the rounds done persist (dla:mix / dla:exam) so a
   run survives a reload. Ends on a summary: total score, concepts moved,
   and for the exam a grade per lecture.
     mix    4 rounds · 60 s each · seeded by the day (the same mix all day)
     exam   max(6, games) rounds · 75 s each · seeded by the start time
   ========================================================================== */
const CFG = {
  mix: { rounds: 4, durationMs: 60000, title: 'Daily Mix', get: getMix, set: setMix },
  exam: { rounds: null, durationMs: 75000, title: 'Exam', get: getExam, set: setExam },
};

function makeRun(kind, today) {
  const boxes = getBoxes();
  const profile = getProfile();
  if (kind === 'mix') {
    const plan = planMix(GAMES, boxes, today, rng(daySeed(today)));
    return { kind, date: today, seedBase: `mix:${today}`, plan, done: [], results: [] };
  }
  const at = new Date().toISOString();
  const plan = planExam(GAMES, boxes, today, rng(hashSeed(`exam:${at}`)));
  return { kind, date: today, at, seedBase: `exam:${at}`, plan, done: [], results: [], unlocked: Object.fromEntries(GAMES.map((g) => [g.id, maxLevelUnlocked(g.id, profile.bests, g.levels ?? 3)])) };
}

export function Run({ kind, onExit }) {
  const cfg = CFG[kind];
  const today = todayISO();
  const [run, setRunState] = useState(() => {
    const saved = cfg.get();
    const live = saved && saved.plan?.length && saved.done?.length < saved.plan.length && (kind !== 'mix' || saved.date === today);
    return live ? saved : makeRun(kind, today);
  });
  const setRun = useCallback((next) => { setRunState(next); cfg.set(next); }, [cfg]);
  // persist a freshly planned run at once, so a reload (or the headless check) sees its plan
  useEffect(() => { cfg.set(run); }, [cfg, run]);
  const i = run.done.length;
  const finished = i >= run.plan.length;
  const gameId = run.plan[i];
  const game = gameById(gameId);
  const profile = useMemo(() => getProfile(), [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const level = game ? Math.max(1, Math.min(maxLevelUnlocked(game.id, profile.bests, game.levels ?? 3), kind === 'exam' ? 3 : 2)) : 1;
  const seed = hashSeed(`${run.seedBase}:${i}:${gameId}`);

  // a finished round waits on its results screen; Continue advances the run
  const [pending, setPending] = useState(null);
  const onDone = useCallback((result, summary) => {
    setPending({ gameId, level, score: result.score, maxScore: result.maxScore, outcomes: result.outcomes, boxesUp: summary?.boxesUp ?? [], boxesDown: summary?.boxesDown ?? [], xp: summary?.xpGained ?? 0 });
  }, [gameId, level]);
  const advance = useCallback(() => {
    if (!pending) { onExit(); return; }
    setRun({ ...run, done: [...run.done, pending.gameId], results: [...run.results, pending] });
    setPending(null);
  }, [pending, run, setRun, onExit]);

  const restart = () => setRun(makeRun(kind, today));

  if (finished || !game) {
    const results = run.results;
    const score = results.reduce((a, r) => a + r.score, 0);
    const max = results.reduce((a, r) => a + r.maxScore, 0);
    const outcomes = results.flatMap((r) => r.outcomes ?? []);
    const up = [...new Set(results.flatMap((r) => r.boxesUp))];
    const down = [...new Set(results.flatMap((r) => r.boxesDown))];
    const xp = results.reduce((a, r) => a + r.xp, 0);
    const grade = kind === 'exam' ? gradeByLecture(outcomes, CONCEPTS) : null;
    return (
      <section className="dla-runsum" aria-label={`${cfg.title} summary`}>
        <p className="dla-k"><span className="dla-dot" />{cfg.title} · {results.length} rounds</p>
        <h3 className="dla-runsum__title">{kind === 'exam' ? `Grade: ${grade.grade}` : max && score / max >= 0.7 ? 'Mix done. Strong.' : 'Mix done.'}</h3>
        <div className="dla-res__score">
          <span className="dla-res__big">{score.toLocaleString('en-AU')}</span>
          <span className="dla-res__of">/ {max.toLocaleString('en-AU')}</span>
          <span className="dla-res__pct">{max ? Math.round((100 * score) / max) : 0}%</span>
          <span className="dla-res__of">+{xp} xp</span>
        </div>
        <ul className="dla-runsum__rounds">
          {results.map((r, k) => (
            <li key={k}><span className="dla-runsum__n">{k + 1}</span><span className="dla-runsum__g">{gameById(r.gameId)?.title ?? r.gameId}</span><span className="dla-runsum__s">{r.score} / {r.maxScore}</span></li>
          ))}
        </ul>
        {grade && (
          <div className="dla-grade" role="table" aria-label="Grade per lecture">
            {LECTURES.filter((L) => grade.per[L.n]).map((L) => {
              const g = grade.per[L.n];
              return (
                <div key={L.n} className="dla-grade__row" role="row">
                  <span className="dla-grade__l" role="cell">{L.short} {L.title}</span>
                  <span className="dla-grade__bar" role="cell" aria-label={`${Math.round(g.pct * 100)} %`}><span style={{ transform: `scaleX(${g.pct})` }} /></span>
                  <span className="dla-grade__p" role="cell">{g.right} / {g.total}</span>
                </div>
              );
            })}
          </div>
        )}
        {(up.length > 0 || down.length > 0) && (
          <p className="dla-res__boxes">
            {up.length > 0 && <span className="dla-res__up">▲ {up.map((id) => CONCEPTS[id]?.title ?? id).join(', ')}</span>}
            {down.length > 0 && <span className="dla-res__down">▼ {down.map((id) => CONCEPTS[id]?.title ?? id).join(', ')}</span>}
          </p>
        )}
        <div className="dla-res__actions">
          <button type="button" className="dla-btn dla-btn--primary" onClick={onExit}>Back to the arcade</button>
          <button type="button" className="dla-btn" onClick={restart}>{kind === 'exam' ? 'Sit another' : 'Play the mix again'}</button>
        </div>
      </section>
    );
  }

  return (
    <div className="dla-run">
      <div className="dla-run__bar" role="group" aria-label={`${cfg.title}: round ${i + 1} of ${run.plan.length}`}>
        <span className="dla-k"><span className="dla-dot" />{cfg.title}</span>
        <span className="dla-run__dots" aria-hidden="true">
          {run.plan.map((g, k) => <span key={k} className={`dla-run__dot${k < i ? ' dla-run__dot--done' : k === i ? ' dla-run__dot--on' : ''}`} />)}
        </span>
        <span className="dla-run__pos">round {i + 1} / {run.plan.length}</span>
        <button type="button" className="dla-btn dla-btn--quiet" onClick={onExit}>pause · back to arcade</button>
      </div>
      <GamePlayer
        key={`${run.seedBase}:${i}`}
        game={game}
        mode={kind}
        seed={seed}
        level={level}
        durationMs={cfg.durationMs}
        onDone={onDone}
        onExit={onExit}
        onContinue={advance}
        exitLabel={i + 1 < run.plan.length ? `Next round · ${gameById(run.plan[i + 1])?.title ?? ''}` : 'See the summary'}
        continueOnExit
      />
    </div>
  );
}
