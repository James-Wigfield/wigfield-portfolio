import Icon from '../../../icons';
import { STEPS } from '../content';
import { deepStore, restockStore, useStore } from '../careLog';
import { fmtMinutes } from '../schedule';
import { Hook, Fact, Seg, Dot, Unfold } from '../ui';
import Gantt from './Gantt';
import StepPlayer from './StepPlayer';

/* ============================================================================
   BARISTA · TAB 05 — SIX-MONTH DEEP CLEAN
   ----------------------------------------------------------------------------
   Two views behind a switch: Schedule (computed totals + 3-lane Gantt +
   the step list) and Steps (the player). /deep-clean/<n> opens step n.
   ========================================================================== */

const titleOf = (id) => STEPS.find((s) => s.id === id)?.title || id;

export default function DeepClean({ nav, schedule, dock }) {
  const n = parseInt(nav.rest, 10);
  const inPlayer = Number.isFinite(n) && n >= 1;
  const [deep] = useStore(deepStore);
  const [stock] = useStore(restockStore);
  const done = deep.done || {};
  const doneCount = schedule.steps.filter((s) => done[s.id]).length;
  const resume = Math.max(0, schedule.steps.findIndex((s) => !done[s.id]));
  const saved = schedule.naive - schedule.total;
  const idle = schedule.idle.reduce((sum, g) => sum + g.end - g.start, 0);

  const view = inPlayer ? 'steps' : 'plan';
  const setView = (v) => nav.setRest(v === 'steps' ? String(resume + 1) : '');

  return (
    <>
      <Hook sub="Every job in Breville’s care section, in the order that keeps your hands busy while soaks and cycles run.">
        One session. Cold jobs first, hot jobs last.
      </Hook>
      <Seg
        label="Deep clean view"
        items={[
          { id: 'plan', label: 'Schedule' },
          { id: 'steps', label: doneCount ? `Steps · ${doneCount}/${schedule.steps.length}` : 'Steps' },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'steps' ? (
        <StepPlayer schedule={schedule} index={n - 1} onIndex={(k) => nav.setRest(String(k + 1))} dock={dock} />
      ) : (
        <>
          <div className="bxi-facts">
            <Fact k="Computed total" v={fmtMinutes(schedule.total)}>
              est. · from the task graph
            </Fact>
            <Fact k="One after another" v={fmtMinutes(schedule.naive)}>
              waiting out every soak
            </Fact>
            <Fact k="Overlap saves" v={fmtMinutes(saved)}>
              soaks and cycles run while you work
            </Fact>
            <Fact k="Hands-on" v={fmtMinutes(schedule.handsOn)}>
              the floor — only {idle} min idle
            </Fact>
          </div>

          <Gantt schedule={schedule} onPick={(id) => nav.toStep(id)} />

          <div className="bxi-split">
            <div>
              <p className="bxi-label">The order</p>
              <ol className="bxi-steplist">
                {schedule.steps.map((s, k) => (
                  <li key={s.id}>
                    <button type="button" className="bxi-steplist__row" onClick={() => nav.setRest(String(k + 1))}>
                      <span className="bxi-steplist__n">{String(k + 1).padStart(2, '0')}</span>
                      <span className="bxi-steplist__t">{titleOf(s.id)}</span>
                      <span className="bxi-steplist__m">{s.start}–{s.end}</span>
                      {done[s.id] && <Icon name="check" size={14} className="bxi-steplist__ok" />}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="bxi-plan-side">
              <p className="bxi-label">What it uses</p>
              <ul className="bxi-ruled">
                <li>
                  <Dot tone={stock.tablets >= 2 ? 'good' : 'due'} />
                  <span className="bxi-ruled__body">
                    <span className="bxi-ruled__t"><span className="bxi-num">2</span> cleaning tablets · you have <span className="bxi-num">{stock.tablets}</span></span>
                    <span className="bxi-ruled__s">One for the cycle, one for the basket soak. A repeat cycle reuses its tablet.</span>
                  </span>
                </li>
                <li>
                  <Dot tone={stock.sachets >= 1 ? 'good' : 'due'} />
                  <span className="bxi-ruled__body">
                    <span className="bxi-ruled__t"><span className="bxi-num">1</span> descaling sachet · you have <span className="bxi-num">{stock.sachets}</span></span>
                  </span>
                </li>
                <li>
                  <Dot tone={stock.filters >= 1 ? 'good' : 'due'} />
                  <span className="bxi-ruled__body">
                    <span className="bxi-ruled__t"><span className="bxi-num">1</span> water filter · you have <span className="bxi-num">{stock.filters}</span> spare</span>
                    <span className="bxi-ruled__s">None spare? Step {String(nav.stepIndex('filter') + 1).padStart(2, '0')} has a skip branch.</span>
                  </span>
                </li>
              </ul>
              <Unfold label="How the order was worked out">
                <p>Each job is a task with a duration, the things it needs (your hands, the machine, a soak vessel) and what must come first.</p>
                <p>A small scheduler places them, critical chain first. Cold jobs wait for nothing; anything that heats the machine waits for every cold job.</p>
                <p>The only idle minutes are the heat-up and the tail of the cleaning cycle — nothing else can run there.</p>
              </Unfold>
              <button type="button" className="bxi-btn bxi-btn--solid bxi-plan-go" onClick={() => nav.setRest(String(resume + 1))}>
                {doneCount ? `Resume at step ${String(resume + 1).padStart(2, '0')}` : 'Start step 01'} <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
