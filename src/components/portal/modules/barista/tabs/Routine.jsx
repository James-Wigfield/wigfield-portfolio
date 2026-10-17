import { HABITS, RHYTHM } from '../content';
import { Hook, Seg, Lines, Receipt, VideoLink, Dot, TipMark, Rich } from '../ui';
import { SceneHabitWand, SceneHabitFlush } from '../scenes/SceneHabits';
import Weekly from './Weekly';
import Sequencer from './Sequencer';

/* ============================================================================
   BARISTA · TAB 04 — EVERY DAY & WEEK
   ----------------------------------------------------------------------------
   Four views behind a switch (/routine/<view>): the per-drink habits (the
   two that would have prevented the dried milk), the rhythm ladder, the
   weekly ritual checklist, and the six-month sequencer.
   ========================================================================== */

const VIEWS = [
  { id: 'habits', label: 'Habits' },
  { id: 'rhythm', label: 'Rhythm' },
  { id: 'weekly', label: 'Weekly ritual' },
  { id: 'sequencer', label: 'Sequencer' },
];

const HABIT_SCENES = { wand: SceneHabitWand, flush: SceneHabitFlush };

export default function Routine({ nav }) {
  const view = VIEWS.some((v) => v.id === nav.rest) ? nav.rest : 'habits';

  return (
    <>
      <Hook sub="Seconds per drink, ten minutes a week. These are what keep the deep clean an every-six-months job.">
        Small habits, every day.
      </Hook>
      <Seg label="Routine view" items={VIEWS} value={view} onChange={(v) => nav.setRest(v === 'habits' ? '' : v)} />

      {view === 'habits' && (
        <div className="bxi-habits">
          {HABITS.map((h) => {
            const Scene = HABIT_SCENES[h.id];
            return (
              <section key={h.id} className="bxi-habit">
                <Scene />
                <p className="bxi-label bxi-label--accent">{h.name}</p>
                <Lines lines={h.lines} />
                <p className="bxi-small"><Dot tone="good" /> {h.note}</p>
                <div className="bxi-step__src">
                  <Receipt src={h.src} />
                  <VideoLink k={h.video} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'rhythm' && (
        <ol className="bxi-rhythm">
          {RHYTHM.map((r, i) => (
            <li key={r.id} className={`bxi-rhythm__row${r.hot ? ' bxi-rhythm__row--hot' : ''}`}>
              <div className="bxi-rhythm__freq">
                <span className="bxi-rhythm__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="bxi-rhythm__label">{r.freq}</span>
                <span className="bxi-rhythm__bar" style={{ '--w': `${100 - i * 11}%` }} aria-hidden="true" />
              </div>
              <div className="bxi-rhythm__body">
                <ul className="bxi-rhythm__lines">
                  {r.lines.map((l) => {
                    const t = typeof l === 'string' ? l : l.t;
                    return (
                      <li key={t}>
                        <Rich text={t} />
                        {typeof l === 'object' && l.tip && <TipMark />}
                      </li>
                    );
                  })}
                </ul>
                {r.video && (
                  <p className="bxi-small">
                    {r.video.t} <VideoLink k={r.video.key} short />
                  </p>
                )}
                <Receipt src={r.src} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {view === 'weekly' && <Weekly />}
      {view === 'sequencer' && <Sequencer />}
    </>
  );
}
