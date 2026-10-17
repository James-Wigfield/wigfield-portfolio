import { useEffect, useState } from 'react';
import Icon from '../../icons';
import { prefsStore, deepStore, useStore } from './careLog';
import {
  useTimerList, useNow, startTimer, pauseTimer, resumeTimer, stopTimer, markDone,
  remainingMs, elapsedMs, isRunning, clock, seeLine, chime, setWakeLock,
} from './timers';
import { DESCALE_LEGS } from './content';
import { Rich, TipMark } from './ui';

/* ============================================================================
   BARISTA · FOLLOW ALONG — real-time timers for the timed steps
   ----------------------------------------------------------------------------
   TimerEngine  mounted once: marks count-downs done (at their exact computed
                end, so backgrounded tabs come back right), chimes if sound is
                on, holds a Screen Wake Lock while anything runs
   MiniBar      background timers (soaks) as a persistent bottom bar
   FollowAlong  one timed step: big mono countdown, ring, "what you should
                see now", pause / stop, done state
   RoundsRunner the descale's 25 s / 13 s / 8 s legs with a round counter
   ========================================================================== */

export function TimerEngine() {
  const list = useTimerList();
  const anyRunning = list.some(isRunning);
  const now = useNow(anyRunning);
  const [prefs] = useStore(prefsStore);

  useEffect(() => {
    list.forEach((t) => {
      if (t.kind === 'count' && isRunning(t) && remainingMs(t, now) <= 0) {
        markDone(t.id, t.startedAt + t.pausedMs + t.sec * 1000);
        if (prefs.sound) chime();
      }
    });
  }, [list, now, prefs.sound]);

  useEffect(() => {
    setWakeLock(anyRunning);
    return () => setWakeLock(false);
  }, [anyRunning]);

  return null;
}

function Ring({ p, size = 120 }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <svg className="bxi-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle className="bxi-ring__track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="bxi-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, p)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function SoundToggle() {
  const [prefs, setPrefs] = useStore(prefsStore);
  return (
    <button
      type="button"
      className="bxi-quiet bxi-sound"
      aria-pressed={prefs.sound}
      onClick={() => setPrefs((p) => ({ ...p, sound: !p.sound }))}
    >
      Sound {prefs.sound ? 'on' : 'off'}
    </button>
  );
}

/** One timed step. `spec` comes from content.js; `step` is the step id. */
export function FollowAlong({ spec, step }) {
  const list = useTimerList();
  const t = list.find((x) => x.id === spec.id) || null;
  const now = useNow(isRunning(t));
  const elapsed = elapsedMs(t, now);
  const counting = spec.kind !== 'elapsed';
  const remaining = counting ? remainingMs(t, now) : 0;
  const p = t && counting ? elapsed / (spec.sec * 1000) : 0;
  const done = !!t?.doneAt;
  const minuteMark = t ? Math.floor((counting ? remaining : elapsed) / 60000) : null;

  if (!t) {
    return (
      <div className="bxi-follow bxi-follow--idle">
        <button type="button" className="bxi-btn bxi-btn--solid bxi-follow__start" onClick={() => startTimer(spec, step)}>
          <Icon name="play" size={14} />
          {counting ? `Follow along · ${clock(spec.sec * 1000)}` : `Start ${spec.label.toLowerCase()} clock`}
        </button>
        <span className="bxi-follow__meta">
          {spec.label}
          {spec.tip && <TipMark />}
          {spec.bg && <span> · keeps running in the bar below</span>}
        </span>
      </div>
    );
  }

  return (
    <div className={`bxi-follow${done ? ' bxi-follow--done' : ''}`}>
      <div className="bxi-follow__clock">
        {counting && <Ring p={done ? 1 : p} />}
        <div className="bxi-follow__digits" aria-hidden="true">
          {done ? <Icon name="check" size={34} /> : clock(counting ? remaining : elapsed, { ceil: counting })}
        </div>
      </div>
      <div className="bxi-follow__side">
        <p className="bxi-label bxi-label--accent">
          {spec.label}
          {spec.tip && <TipMark />}
          {t.pausedAt && ' · paused'}
        </p>
        <p className="bxi-follow__see" aria-live="polite">
          {done ? `Done — ${clock(spec.sec * 1000)} up.` : seeLine(spec.see, elapsed) || 'Running.'}
        </p>
        <span className="bxi-sr" aria-live="polite">
          {done ? '' : minuteMark != null && `${minuteMark} minute${minuteMark === 1 ? '' : 's'} ${counting ? 'left' : 'elapsed'}`}
        </span>
        <div className="bxi-follow__ctl">
          {!done && (t.pausedAt ? (
            <button type="button" className="bxi-btn" onClick={() => resumeTimer(t.id)}>Resume</button>
          ) : (
            <button type="button" className="bxi-btn" onClick={() => pauseTimer(t.id)}>Pause</button>
          ))}
          {done && counting && (
            <button type="button" className="bxi-btn" onClick={() => startTimer(spec, step)}>Again</button>
          )}
          <button type="button" className="bxi-quiet" onClick={() => stopTimer(t.id)}>
            {done ? 'Clear' : counting ? 'Stop' : 'Stop clock'}
          </button>
          <SoundToggle />
        </div>
      </div>
    </div>
  );
}

/** Descale / rinse rounds: three legs per round, a counter, an estimated tank level. */
export function RoundsRunner({ spec, step, startLitres, onLive }) {
  const [deep, setDeep] = useStore(deepStore);
  const rounds = deep.rounds?.[spec.id] ?? 0;
  const [leg, setLeg] = useState(0);
  const legId = `${spec.id}-leg`;
  const list = useTimerList();
  const t = list.find((x) => x.id === legId) || null;
  const now = useNow(isRunning(t));
  const L = DESCALE_LEGS[leg];
  const elapsed = elapsedMs(t, now);
  const remaining = remainingMs(t, now);
  const done = !!t?.doneAt;
  const running = isRunning(t);
  const p = t ? elapsed / (L.sec * 1000) : 0;
  const litres = Math.max(0, startLitres - rounds * 0.5 - (leg / 3) * 0.5);

  // The scene only follows along while a leg timer exists; otherwise it plays
  // its own animation.
  const hasLeg = !!t;
  useEffect(() => {
    onLive?.(hasLeg ? { leg: L.id, p: running ? p : done ? 1 : 0, running, litres } : null);
  }, [onLive, hasLeg, L.id, p, running, done, litres]);

  const setRounds = (n) => setDeep((d) => ({ ...d, rounds: { ...(d.rounds || {}), [spec.id]: Math.max(0, n) } }));

  const next = () => {
    stopTimer(legId);
    if (leg === DESCALE_LEGS.length - 1) {
      setRounds(rounds + 1);
      setLeg(0);
    } else setLeg(leg + 1);
  };

  return (
    <div className="bxi-rounds">
      <div className="bxi-rounds__head">
        <p className="bxi-label bxi-label--accent">{spec.label} {rounds + 1}</p>
        <p className="bxi-rounds__count">
          <span className="bxi-num">{String(rounds).padStart(2, '0')}</span> rounds done
          <span className="bxi-rounds__tank"> · tank ≈ <span className="bxi-num">{litres.toFixed(1)} L</span></span>
        </p>
      </div>
      <ol className="bxi-rounds__legs">
        {DESCALE_LEGS.map((l, i) => (
          <li key={l.id} className={`bxi-leg${i === leg ? ' bxi-leg--on' : ''}${i < leg ? ' bxi-leg--past' : ''}`}>
            <span className="bxi-leg__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="bxi-leg__t">{l.label}</span>
            <span className="bxi-num">{l.sec} s</span>
          </li>
        ))}
      </ol>
      <div className={`bxi-follow${done ? ' bxi-follow--done' : ''}`}>
        <div className="bxi-follow__clock">
          <Ring p={done ? 1 : p} size={104} />
          <div className="bxi-follow__digits" aria-hidden="true">
            {done ? <Icon name="check" size={30} /> : clock(t ? remaining : L.sec * 1000)}
          </div>
        </div>
        <div className="bxi-follow__side">
          <p className="bxi-follow__where">
            <Rich text={L.chip ? `${L.where} Press [${L.chip}].` : L.where} />
          </p>
          <p className="bxi-follow__see" aria-live="polite">
            {done ? `${L.label} leg done.` : running ? L.see : 'Start the timer as the flow starts.'}
          </p>
          <div className="bxi-follow__ctl">
            {!t && (
              <button type="button" className="bxi-btn bxi-btn--solid" onClick={() => startTimer({ id: legId, label: `${spec.label} ${rounds + 1} · ${L.label}`, sec: L.sec }, step)}>
                <Icon name="play" size={14} /> Start {L.label.toLowerCase()} · {L.sec} s
              </button>
            )}
            {t && !done && (
              <button type="button" className="bxi-btn" onClick={() => stopTimer(legId)}>Reset</button>
            )}
            {(done || t) && (
              <button type="button" className={`bxi-btn${done ? ' bxi-btn--solid' : ''}`} onClick={next}>
                {leg === DESCALE_LEGS.length - 1 ? 'Round done' : 'Next leg'} <Icon name="arrowRight" size={14} />
              </button>
            )}
            <SoundToggle />
          </div>
        </div>
      </div>
      <div className="bxi-rounds__adjust">
        <span className="bxi-small">Counter off?</span>
        <button type="button" className="bxi-quiet" onClick={() => setRounds(rounds - 1)} aria-label="One fewer round">− round</button>
        <button type="button" className="bxi-quiet" onClick={() => setRounds(rounds + 1)} aria-label="One more round">+ round</button>
      </div>
    </div>
  );
}

/** Background timers, docked at the bottom of every tab. */
export function MiniBar({ onJump }) {
  const list = useTimerList().filter((t) => t.bg);
  const now = useNow(list.some(isRunning));
  if (!list.length) return null;
  return (
    <div className="bxi-minibar" role="region" aria-label="Running timers">
      {list.map((t) => {
        const counting = t.kind === 'count';
        const ms = counting ? remainingMs(t, now) : elapsedMs(t, now);
        const p = counting ? 1 - ms / (t.sec * 1000) : 0;
        return (
          <div key={t.id} className={`bxi-minibar__item${t.doneAt ? ' bxi-minibar__item--done' : ''}`}>
            {counting && <span className="bxi-minibar__bar" style={{ transform: `scaleX(${Math.min(1, p)})` }} aria-hidden="true" />}
            <button type="button" className="bxi-minibar__jump" onClick={() => onJump?.(t.step)}>
              <span className="bxi-minibar__label">{t.label}{t.pausedAt ? ' · paused' : ''}</span>
              <span className="bxi-minibar__time">{t.doneAt ? 'Done' : clock(ms, { ceil: counting })}</span>
            </button>
            {!t.doneAt && (t.pausedAt ? (
              <button type="button" className="bxi-minibar__ctl" onClick={() => resumeTimer(t.id)} aria-label={`Resume ${t.label}`}>
                <Icon name="play" size={14} />
              </button>
            ) : (
              <button type="button" className="bxi-minibar__ctl" onClick={() => pauseTimer(t.id)} aria-label={`Pause ${t.label}`}>
                <Icon name="pause" size={14} />
              </button>
            ))}
            <button type="button" className="bxi-minibar__ctl" onClick={() => stopTimer(t.id)} aria-label={`Clear ${t.label}`}>
              <span aria-hidden="true" className="bxi-minibar__x" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
