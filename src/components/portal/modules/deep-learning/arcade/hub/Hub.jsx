import { useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { GAMES } from '../core/games';
import { CONCEPTS, LECTURES } from '../core/concepts';
import { dueConcepts, mastery } from '../core/scheduler';
import { getBoxes, getProfile, getMix, getExam, resetAll } from '../core/storage';
import { levelProgress, maxLevelUnlocked, examUnlocked, EXAM_GAMES_NEEDED } from '../core/progress';
import { todayISO } from '../core/rng';
import { Cabinet, Ring } from './Cabinet';
import './hub.css';

/* ============================================================================
   GRADIENT ARCADE — THE HUB
   ----------------------------------------------------------------------------
   marquee + profile strip · the two big cabinets (Daily Mix, Exam) · one
   cabinet per game · the mastery panel (a ring per lecture, concepts behind
   a toggle). A grid of cabinets and panels, never an article.
   ========================================================================== */
// only the concepts some game drills can be reviewed, so due counts and mastery are over those
const DRILLED = [...new Set(GAMES.flatMap((g) => g.concepts ?? []))].filter((id) => CONCEPTS[id]);
const drilledIn = (n) => DRILLED.filter((id) => CONCEPTS[id].lecture === n);

export function Hub({ onOpen }) {
  const today = todayISO();
  const [tick, setTick] = useState(0);
  const profile = useMemo(() => getProfile(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const boxes = useMemo(() => getBoxes(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueConcepts(boxes, DRILLED, today), [boxes, today]);
  const lp = levelProgress(profile.xp);
  const mix = getMix();
  const mixLive = mix && mix.date === today && mix.done.length < mix.plan.length;
  const mixDone = mix && mix.date === today && mix.done.length >= mix.plan.length;
  const exam = getExam();
  const examOk = examUnlocked(profile);
  const [showConcepts, setShowConcepts] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const overall = mastery(boxes, DRILLED);

  return (
    <div className="dla-hub">
      <header className="dla-hub__head">
        <div className="dla-marquee" aria-label="Gradient Arcade">
          <span className="dla-marquee__lights" aria-hidden="true" />
          <h2 className="dla-marquee__title">Gradient Arcade</h2>
          <p className="dla-marquee__sub">CITS5017 · exam drills · {GAMES.length} games · {DRILLED.length} concepts</p>
        </div>
        <div className="dla-strip" role="group" aria-label="Your progress">
          <div className="dla-strip__cell">
            <span className="dla-k">level</span>
            <span className="dla-strip__v">{lp.level}</span>
            <span className="dla-strip__bar" aria-label={`${profile.xp} xp, ${Math.round(lp.t * 100)} % to level ${lp.level + 1}`}><span style={{ transform: `scaleX(${lp.t})` }} /></span>
            <span className="dla-strip__xp">{profile.xp.toLocaleString('en-AU')} xp</span>
          </div>
          <div className="dla-strip__cell">
            <span className="dla-k">streak</span>
            <span className="dla-strip__v">{profile.streak.count}<span className="dla-strip__unit">d</span></span>
            <span className="dla-strip__sub">{profile.streak.last === today ? 'played today' : profile.streak.count ? 'play today to keep it' : 'start one today'}</span>
          </div>
          <div className="dla-strip__cell">
            <span className="dla-k">due today</span>
            <span className="dla-strip__v">{due.length}</span>
            <span className="dla-strip__sub">of {DRILLED.length} drilled concepts</span>
          </div>
          <div className="dla-strip__cell dla-strip__cell--ring">
            <Ring t={overall} size={44} stroke={5} label={`${Math.round(overall * 100)} % overall mastery`} />
            <span className="dla-k">mastery {Math.round(overall * 100)}%</span>
          </div>
        </div>
      </header>

      <section className="dla-hub__big" aria-label="Modes">
        <button type="button" className="dla-bigcab dla-bigcab--mix" onClick={() => onOpen('mix')}>
          <span className="dla-bigcab__k"><span className="dla-dot" />daily mix · about 5 minutes</span>
          <span className="dla-bigcab__title">{mixLive ? `Resume today’s mix · round ${mix.done.length + 1} of ${mix.plan.length}` : mixDone ? 'Today’s mix is done · play it again' : 'Play today’s mix'}</span>
          <span className="dla-bigcab__sub">{due.length ? `${due.length} concepts due, weighted to the weak ones` : 'nothing due · a warm-up round across the games'}</span>
          <span className="dla-bigcab__go"><Icon name="play" size={18} /></span>
        </button>
        <button type="button" className="dla-bigcab dla-bigcab--exam" onClick={() => examOk && onOpen('exam')} disabled={!examOk} aria-disabled={!examOk}>
          <span className="dla-bigcab__k"><span className="dla-dot dla-dot--exam" />exam mode · {Math.max(6, GAMES.length)} rounds</span>
          <span className="dla-bigcab__title">{examOk ? (exam && exam.done.length < exam.plan.length ? `Resume the exam · round ${exam.done.length + 1} of ${exam.plan.length}` : 'Sit a mixed exam') : `Locked · play ${EXAM_GAMES_NEEDED} different games first`}</span>
          <span className="dla-bigcab__sub">every game, weighted to weak concepts, graded per lecture</span>
          <span className="dla-bigcab__go"><Icon name="flask" size={18} /></span>
        </button>
      </section>

      <section className="dla-hub__grid" aria-label="Games">
        {GAMES.map((g, i) => (
          <Cabinet
            key={g.id}
            i={i}
            game={g}
            best={bestOf(profile.bests, g.id)}
            unlocked={maxLevelUnlocked(g.id, profile.bests, g.levels ?? 3)}
            mastery={mastery(boxes, g.concepts)}
            due={g.concepts.filter((c) => due.includes(c)).length}
            onOpen={onOpen}
          />
        ))}
      </section>

      <section className="dla-hub__mastery" aria-label="Mastery by lecture">
        <div className="dla-hub__masteryhead">
          <span className="dla-k"><span className="dla-dot" />mastery by lecture</span>
          <button type="button" className="dla-btn dla-btn--quiet" onClick={() => setShowConcepts((s) => !s)} aria-expanded={showConcepts}>{showConcepts ? 'hide concepts' : 'show concepts'}</button>
        </div>
        <div className="dla-lecs">
          {LECTURES.map((L) => {
            const ids = drilledIn(L.n);
            const m = mastery(boxes, ids);
            const d = ids.filter((id) => due.includes(id)).length;
            return (
              <div key={L.n} className="dla-lec">
                <Ring t={m} size={54} stroke={6} label={`${L.short} ${L.title}: ${Math.round(m * 100)} % mastery`} />
                <span className="dla-lec__k">{L.short}</span>
                <span className="dla-lec__t">{L.title}</span>
                <span className="dla-lec__sub">{ids.length} concepts{d ? ` · ${d} due` : ''}</span>
              </div>
            );
          })}
        </div>
        {showConcepts && (
          <ul className="dla-concepts">
            {DRILLED.slice().sort((a, b) => CONCEPTS[a].lecture - CONCEPTS[b].lecture || a.localeCompare(b)).map((id) => {
              const c = CONCEPTS[id];
              const b = boxes[id]?.box ?? 0;
              return (
                <li key={id} className={`dla-concept${due.includes(id) ? ' dla-concept--due' : ''}`} title={`${c.title} · ${c.lecture === 6 ? 'Lectures 6–7' : `Lecture ${c.lecture}`} · slides ${(c.slides ?? []).join(', ')}`}>
                  <span className="dla-concept__boxes" aria-label={`box ${b} of 5`}>
                    {[1, 2, 3, 4, 5].map((k) => <span key={k} className={`dla-concept__box${k <= b ? ' dla-concept__box--on' : ''}`} />)}
                  </span>
                  <span className="dla-concept__t">{c.title}</span>
                  <span className="dla-concept__l">L{c.lecture === 6 ? '6–7' : c.lecture}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="dla-hub__foot">
          <span className="dla-own">progress is stored in this browser (dla:* keys)</span>
          <button type="button" className="dla-btn dla-btn--quiet" onClick={() => { if (confirmReset) { resetAll(); setConfirmReset(false); setTick((t) => t + 1); } else setConfirmReset(true); }} onBlur={() => setConfirmReset(false)}>
            {confirmReset ? 'click again to wipe all progress' : 'reset progress'}
          </button>
        </div>
      </section>
    </div>
  );
}

// the highest-level best a player holds for a game
function bestOf(bests, gameId) {
  const g = bests?.[gameId];
  if (!g) return null;
  const levels = Object.keys(g).map(Number).sort((a, b) => b - a);
  return levels.length ? g[levels[0]] : null;
}
