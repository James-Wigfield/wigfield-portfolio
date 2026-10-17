import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../icons';
import { STEPS } from '../content';
import { deepStore, logStore, useStore, completeDeepClean, addMonths, todayISO, monthName, fmtDate } from '../careLog';
import { useTimerList, useNow, elapsedMs, stopTimer, isRunning } from '../timers';
import { fmtMinutes } from '../schedule';
import { Lines, Dot, Receipt, Unfold, VideoLink, TipMark, Rich } from '../ui';
import { FollowAlong, RoundsRunner } from '../FollowAlong';
import StepScene from '../scenes/StepScene';
import ButtonHold from '../scenes/ButtonHold';

/* ============================================================================
   BARISTA · STEP PLAYER — one deep-clean step per view
   ----------------------------------------------------------------------------
   Mono step rail (done / current), the step's scene on top, ≤7 instruction
   lines with steel chips, safety as labelled dots, the why folded away,
   receipts + Breville video, follow-along timers, branches. Prev / Mark
   done / Next live in the bottom dock (thumb reach). Progress persists in
   bxi:deep-clean:v1; finishing the last step writes the care log.
   ========================================================================== */

const byId = Object.fromEntries(STEPS.map((s) => [s.id, s]));

const TONES = { power: 'power', hot: 'hot', sharp: 'sharp', water: 'water', care: 'care' };

export default function StepPlayer({ schedule, index, onIndex, dock }) {
  const order = schedule.steps.map((s) => byId[s.id]).filter(Boolean);
  const total = order.length;
  const i = Math.min(Math.max(0, index), total - 1);
  const step = order[i];
  const slot = schedule.steps[i];
  const [deep, setDeep] = useStore(deepStore);
  const [log, setLog] = useStore(logStore);
  const [roundsLive, setRoundsLive] = useState(null);
  const timers = useTimerList();
  const done = deep.done || {};
  const doneCount = order.filter((s) => done[s.id]).length;
  const allDone = doneCount === total;
  const branch = deep.branch || {};
  const filterMonth = monthName(addMonths(todayISO(), 3));

  // The scene follows the step's first count-down (or the one it names).
  const liveSpec = step.timers?.find((t) => t.kind !== 'elapsed' && t.kind !== 'rounds');
  const liveId = step.liveFrom || liveSpec?.id;
  const liveTimer = timers.find((t) => t.id === liveId && !t.doneAt);
  const now = useNow(isRunning(liveTimer));
  const live = liveTimer ? Math.min(1, elapsedMs(liveTimer, now) / (liveTimer.sec * 1000)) : null;
  const sceneLive = step.timers?.some((t) => t.kind === 'rounds') ? roundsLive : live;

  const touch = useRef(null);
  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? i + 1 : i - 1);
  };

  const go = (n) => {
    if (n < 0 || n >= total) return;
    setRoundsLive(null);
    onIndex(n);
  };

  const toggleBranch = (key) => setDeep((d) => ({ ...d, branch: { ...(d.branch || {}), [key]: !d.branch?.[key] } }));

  const markDone = () => {
    const isDone = !!done[step.id];
    const nextDone = { ...done };
    if (isDone) delete nextDone[step.id];
    else nextDone[step.id] = new Date().toISOString();
    setDeep((d) => ({ ...d, done: nextDone }));
    if (step.stopsTimer && !isDone) stopTimer(step.stopsTimer);
    if (isDone) return;
    const finished = order.every((s) => nextDone[s.id]);
    if (finished) {
      const skipped = branch['descale-rinse:no-filter'] || branch['filter:no-filter'];
      setLog((l) => completeDeepClean(l, { filterFitted: !skipped }));
      setDeep((d) => ({ ...d, loggedAt: todayISO() }));
      return;
    }
    const nextIdx = order.findIndex((s, k) => k > i && !nextDone[s.id]);
    if (nextIdx >= 0) go(nextIdx);
  };

  const clearTicks = () => {
    setDeep({ done: {}, branch: {}, rounds: {} });
    go(0);
  };

  const vars = { MONTH: filterMonth };

  const thumb = (
    <div className="bxi-thumb">
      <button type="button" className="bxi-thumb__nav" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step">
        <Icon name="arrowLeft" size={18} />
      </button>
      <button
        type="button"
        className={`bxi-thumb__main${done[step.id] ? ' bxi-thumb__main--done' : ''}`}
        onClick={markDone}
        aria-pressed={!!done[step.id]}
      >
        {done[step.id] ? (
          <>
            <Icon name="check" size={16} /> Done · {String(i + 1).padStart(2, '0')}
          </>
        ) : i === total - 1 ? (
          'Finish & log'
        ) : (
          'Mark done'
        )}
      </button>
      <button type="button" className="bxi-thumb__nav" onClick={() => go(i + 1)} disabled={i === total - 1} aria-label="Next step">
        <Icon name="arrowRight" size={18} />
      </button>
    </div>
  );

  return (
    <div className="bxi-player" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="bxi-rail" role="tablist" aria-label="Deep-clean steps">
        {order.map((s, k) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={k === i}
            className={`bxi-rail__n${k === i ? ' bxi-rail__n--on' : ''}${done[s.id] ? ' bxi-rail__n--done' : ''}`}
            onClick={() => go(k)}
            title={s.title}
          >
            {String(k + 1).padStart(2, '0')}
          </button>
        ))}
      </div>
      <p className="bxi-player__count">
        <span className="bxi-num">{String(doneCount).padStart(2, '0')}</span> of {total} done
        {allDone && <span className="bxi-player__complete"> · deep clean complete{deep.loggedAt ? `, logged ${fmtDate(deep.loggedAt)}` : ''}</span>}
      </p>

      <article className="bxi-step" key={step.id}>
        <div className="bxi-step__scene">
          <StepScene scene={step.scene} live={sceneLive} vars={vars} complete={allDone} />
        </div>
        <div className="bxi-step__body">
          <p className="bxi-label">
            Step {String(i + 1).padStart(2, '0')} / {total} · {step.kicker} · min {slot.start}–{slot.end}
          </p>
          <h3 className="bxi-step__title">{step.title}</h3>
          <Lines lines={step.lines} vars={vars} />

          {step.hold && <ButtonHold keys={step.hold.keys} sec={step.hold.sec} after={step.hold.after} />}

          {step.branches?.map((b) => {
            const key = `${step.id}:${b.id}`;
            const on = !!branch[key];
            return (
              <div key={key} className={`bxi-branch${on ? ' bxi-branch--on' : ''}`}>
                <button type="button" className="bxi-branch__q" aria-expanded={on} onClick={() => toggleBranch(key)}>
                  <span className="bxi-branch__box" aria-hidden="true">{on && <Icon name="check" size={12} />}</span>
                  <span>
                    <Rich text={b.q} />
                    {b.tip && <TipMark />}
                  </span>
                </button>
                {on && (
                  <div className="bxi-branch__a">
                    <Lines lines={b.a} />
                    {b.none && <p className="bxi-small"><Rich text={b.none} /></p>}
                    {b.to && (
                      <button
                        type="button"
                        className="bxi-btn"
                        onClick={() => {
                          setDeep((d) => {
                            const nd = { ...(d.done || {}) };
                            delete nd[b.to];
                            return { ...d, done: nd };
                          });
                          go(order.findIndex((s) => s.id === b.to));
                        }}
                      >
                        Back to the cycle <Icon name="arrowLeft" size={14} />
                      </button>
                    )}
                    <Receipt src={b.src} />
                  </div>
                )}
              </div>
            );
          })}

          {step.safety?.length > 0 && (
            <ul className="bxi-ruled bxi-safety">
              {step.safety.map((sf) => (
                <li key={sf.label}>
                  <Dot tone={TONES[sf.tone] || 'care'} label={sf.label} />
                  <span className="bxi-ruled__body">
                    <span className="bxi-ruled__t">
                      {sf.t}
                      {sf.tip && <TipMark />}
                    </span>
                  </span>
                  {sf.src && <Receipt src={sf.src} />}
                </li>
              ))}
            </ul>
          )}

          {step.timers?.map((t) =>
            t.kind === 'rounds' ? (
              <RoundsRunner key={t.id} spec={t} step={step.id} startLitres={t.id === 'rounds' ? 1 : 2} onLive={setRoundsLive} />
            ) : (
              <FollowAlong key={t.id} spec={t} step={step.id} />
            ),
          )}

          {step.why && (
            <Unfold label="Why this step">
              {step.why.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </Unfold>
          )}

          <div className="bxi-step__src">
            <Receipt src={step.src} />
            {step.video && <VideoLink k={step.video} />}
          </div>

          {i === total - 1 && allDone && (
            <p className="bxi-done-line">
              <Dot tone="good" label="Logged" />
              Deep clean, cleaning cycle and descale set to {fmtDate(log.lastDeepClean)}. Next deep clean around{' '}
              {fmtDate(addMonths(log.lastDeepClean || todayISO(), 6))} — {fmtMinutes(schedule.total)} next time too.
            </p>
          )}
          <button type="button" className="bxi-quiet bxi-clear" onClick={clearTicks}>Clear ticks</button>
        </div>
      </article>
      {dock && createPortal(thumb, dock)}
    </div>
  );
}
