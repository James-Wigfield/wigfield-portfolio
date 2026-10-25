import { useState } from 'react';
import Icon from '../../../icons';
import { Tex } from '../kit';
import { useStudy } from './context';
import { Rich } from './Rich';
import { texText } from './texText';

/* ============================================================================
   TRICKY TOPICS — THE LAB FRAME
   ----------------------------------------------------------------------------
   Stage-first: the picture is the lab. Around it, as little as possible:
     Stage        title · provenance labels · one-line "Try this" (predict →
                  change → notice) · the stage floor · an optional story
                  bar · at most two caption sentences · a quiet challenge ·
                  the maths drawer
     StoryBar     ▶ replay + the named beats (keyboard: ← →), and the one
                  sentence that belongs to the current beat
     Maths        "Show the maths": closed on screen, open in print. It walks
                  through the rule with the lab's current values
     MLine        one line of that walk-through: KaTeX + plain words
     MEq          a display equation in the drawer, with its print twin
     Challenge    "Make … happen" with a quiet check when it's met
   `prov` is Rich markup holding provenance labels: '{s|L1 · slide 36}',
   '{own}', '{beyond}' (see Provenance.jsx). Styles: ./stage.css.
   ========================================================================== */

export function Stage({ title, prov, tryThis, story, caption, challenge, maths, children, className = '' }) {
  return (
    <div className={`dltt-stage ${className}`}>
      <header className="dltt-stage__head">
        <h4 className="dltt-stage__title">{title}</h4>
        {prov && <span className="dltt-stage__prov"><Rich text={prov} /></span>}
      </header>
      {tryThis && (
        <p className="dltt-stage__try">
          <span className="dltt-stage__tryk">Try this</span>
          <span><Rich text={tryThis} /></span>
        </p>
      )}
      {story}
      <div className="dltt-stage__floor">{children}</div>
      {caption && <p className="dltt-stage__cap"><Rich text={caption} /></p>}
      {challenge && (
        <div className="dltt-stage__foot">
          <Challenge {...challenge} />
        </div>
      )}
      {maths && <Maths>{maths}</Maths>}
    </div>
  );
}

export function StoryBar({ story, beats }) {
  const { beat, go, play, stop, playing } = story;
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(beat + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(beat - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(beats.length - 1); }
  };
  return (
    <div className="dltt-story">
      <div className="dltt-story__row" role="group" aria-label="Story: step through the beats (arrow keys move between them)" onKeyDown={onKey}>
        <button
          type="button"
          className="dltt-story__play"
          onClick={playing ? stop : play}
          aria-label={playing ? 'Pause the story' : 'Play the story from the first beat'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        {beats.map((b, i) => (
          <button
            key={`${i}-${b.label}`}
            type="button"
            className={`dltt-story__beat${i === beat ? ' dltt-story__beat--on' : i < beat ? ' dltt-story__beat--past' : ''}`}
            aria-current={i === beat ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <b>{i + 1}</b>{b.label}
          </button>
        ))}
      </div>
      <p className="dltt-story__say" aria-live="polite"><Rich text={beats[beat]?.say ?? ''} /></p>
    </div>
  );
}

export function Maths({ children, label = 'Show the maths' }) {
  const { printing } = useStudy();
  const [open, setOpen] = useState(false);
  const shown = open || printing;
  return (
    <div className="dltt-maths">
      <button type="button" className="dltt-maths__btn dltt-noprint" aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        {label} <span className={`dltt-maths__chev${shown ? ' dltt-maths__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      <p className="dltt-printonly dltt-maths__printk">The maths, with this lab’s values:</p>
      {shown && <div className="dltt-maths__body">{children}</div>}
    </div>
  );
}

// One line of the walk-through, in Rich markup ($…$ maths prints as text too).
export function MLine({ text, children }) {
  return (
    <p className="dltt-mline">
      {text && <Rich text={text} />}
      {children}
    </p>
  );
}

// A display equation inside the drawer, with its print twin.
export function MEq({ tex }) {
  return (
    <div className="dltt-meq">
      <Tex block src={tex} />
      <p className="dltt-texalt dltt-texalt--block">{texText(tex)}</p>
    </div>
  );
}

export function Challenge({ text, done }) {
  return (
    <p className={`dltt-chal${done ? ' dltt-chal--done' : ''}`}>
      <span className="dltt-chal__k">Challenge</span>
      <span className="dltt-chal__text"><Rich text={text} /></span>
      {done && <span className="dltt-chal__ok"><Icon name="check" size={12} strokeWidth={2.4} /> done</span>}
    </p>
  );
}

// A quiet ruled switch: two or three options, the underline marks the one on.
export function Switch({ options, value, onChange, label }) {
  const onKey = (e) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(options[(i + 1) % options.length].value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(options[(i - 1 + options.length) % options.length].value); }
  };
  return (
    <div className="dltt-switch" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={`dltt-switch__opt${o.value === value ? ' dltt-switch__opt--on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
