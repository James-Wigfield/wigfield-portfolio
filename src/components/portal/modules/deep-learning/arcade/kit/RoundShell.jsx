import { useEffect, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Results } from './Results';
import { sfx } from './sfx';
import './kit.css';

/* ============================================================================
   GRADIENT ARCADE — THE ROUND SHELL (the frame every game sits in)
   ----------------------------------------------------------------------------
   <RoundShell game={manifest} round={useRound(...)} host={props} intro={{ line, controls }}>
     …the game's stage (shown while round.state === 'play')…
   </RoundShell>

     bar       exit · title · level switcher (intro only) · timer · score · combo · mute
     intro     one line + the controls + Play (Enter); auto-skips in mix /
               exam once seen
     play      the children, with a shake on a wrong answer and a flash on
               a right one (none under reduced motion)
     results   kit/Results.jsx with a why card per mistake
   `host` = the props the host handed the game ({ onExit, onLevelChange,
   levels, levelNames, onReplay }).
   ========================================================================== */
export function RoundShell({ game, round, host = {}, intro, children, stageClass = '', hud = null }) {
  const { state, feedback, msLeft, durationMs, score, combo } = round;
  const [muted, setMuted] = useState(() => sfx.muted);
  const autoStarted = useRef(false);
  // feedback juice: the class is on only while the engine shows feedback
  // (FEEDBACK_MS), and the animations are shorter than that
  const pulse = feedback ? (feedback.correct ? 'dla-flash' : 'dla-shake') : '';

  // Enter starts the round from the intro; mix / exam skip a seen intro
  useEffect(() => {
    if (state !== 'intro') return undefined;
    if ((round.mode === 'mix' || round.mode === 'exam') && round.introSeen && !autoStarted.current) {
      autoStarted.current = true;
      round.start();
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Enter' && !(e.target && /^(input|textarea|select|button)$/i.test(e.target.tagName))) { e.preventDefault(); round.start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, round]);

  const secs = msLeft === null ? null : Math.ceil(msLeft / 1000);
  const frac = durationMs ? Math.max(0, Math.min(1, (msLeft ?? 0) / durationMs)) : 1;
  const levels = host.levels ?? game.levels ?? 3;
  const unlocked = host.unlocked ?? levels;
  const levelNames = host.levelNames ?? game.levelNames ?? [];

  return (
    <div className={`dla-round dla-round--${state}`} data-game={game.id}>
      <header className="dla-round__bar">
        <button type="button" className="dla-round__exit" onClick={() => host.onExit?.()} aria-label="Leave this game">
          <Icon name="arrowLeft" size={14} /> <span className="dla-round__exitk">arcade</span>
        </button>
        <span className="dla-round__title">{game.title}</span>
        <span className="dla-round__lvl">L{round.level}{round.mode !== 'free' ? ` · ${round.mode}` : ''}</span>
        {state === 'play' && durationMs && (
          <span className="dla-round__timer" role="timer" aria-label={`${secs} seconds left`} data-low={secs <= 5 ? 'true' : undefined}>
            <span className="dla-round__timerbar"><span className="dla-round__timerfill" style={{ transform: `scaleX(${frac})` }} /></span>
            <span className="dla-round__secs">{secs}s</span>
          </span>
        )}
        {state === 'play' && !durationMs && <span className="dla-round__count">{round.index + 1} / {round.total}</span>}
        {state === 'play' && (
          <span className="dla-round__score" aria-live="polite">
            <span key={score} className={`dla-round__scoren${score ? ' dla-pop' : ''}`}>{score}</span>
            {combo >= 2 && <span className="dla-round__combo dla-pop" key={combo}>×{combo}</span>}
          </span>
        )}
        <button type="button" className="dla-round__mute" onClick={() => setMuted(sfx.toggle())} aria-pressed={muted} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}>
          {muted ? 'muted' : 'sound'}
        </button>
      </header>

      {state === 'intro' && (
        <section className="dla-intro" aria-label={`${game.title}: how to play`}>
          <p className="dla-intro__kicker">{game.blurb}</p>
          <h3 className="dla-intro__line">{intro?.line ?? game.title}</h3>
          {intro?.controls && (
            <ul className="dla-intro__controls">
              {intro.controls.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
          {levels > 1 && (
            <div className="dla-intro__levels" role="group" aria-label="Level">
              <span className="dla-intro__levelk">level</span>
              {Array.from({ length: levels }, (_, i) => i + 1).map((L) => (
                <button
                  key={L}
                  type="button"
                  className={`dla-lvl${L === round.level ? ' dla-lvl--on' : ''}`}
                  disabled={L > unlocked}
                  aria-pressed={L === round.level}
                  aria-label={`Level ${L}${levelNames[L - 1] ? `: ${levelNames[L - 1]}` : ''}${L > unlocked ? ' (locked)' : ''}`}
                  onClick={() => host.onLevelChange?.(L)}
                >
                  <b>{L}</b>{levelNames[L - 1] && <span>{levelNames[L - 1]}</span>}{L > unlocked && <span className="dla-lvl__lock" aria-hidden="true">locked</span>}
                </button>
              ))}
            </div>
          )}
          <div className="dla-intro__actions">
            <button type="button" className="dla-btn dla-btn--primary dla-btn--big" onClick={round.start} autoFocus>
              Play <span className="dla-btn__key">Enter</span>
            </button>
            {durationMs && <span className="dla-intro__meta">{Math.round(durationMs / 1000)} s · {round.total} items</span>}
            {!durationMs && <span className="dla-intro__meta">{round.total} items · untimed</span>}
          </div>
        </section>
      )}

      {state === 'play' && (
        <div className={`dla-round__stage ${pulse} ${stageClass}`} data-feedback={feedback ? (feedback.correct ? 'right' : 'wrong') : undefined}>
          {children}
          {hud}
        </div>
      )}

      {state === 'results' && (
        <Results round={round} game={game} summary={round.summary} onReplay={host.onReplay} onExit={() => (host.onContinue ?? host.onExit)?.()} exitLabel={host.exitLabel} replayLabel={host.replayLabel} />
      )}
    </div>
  );
}

/* A one-line prompt strip above a game's stage, with an optional sub line. */
export function Prompt({ children, sub, k = null }) {
  return (
    <div className="dla-prompt">
      {k && <span className="dla-prompt__k">{k}</span>}
      <p className="dla-prompt__line">{children}</p>
      {sub && <p className="dla-prompt__sub">{sub}</p>}
    </div>
  );
}

/* The feedback line under a stage during the FEEDBACK_MS window. */
export function Feedback({ feedback, format }) {
  if (!feedback) return <p className="dla-feedback dla-feedback--idle" aria-live="polite" />;
  return (
    <p className={`dla-feedback dla-feedback--${feedback.correct ? 'right' : 'wrong'}`} aria-live="polite">
      <span className="dla-feedback__dot" aria-hidden="true" />
      {feedback.correct ? 'right' : `the answer was ${format ? format(feedback.item.answer, feedback.item) : feedback.item.answer}`}
    </p>
  );
}
