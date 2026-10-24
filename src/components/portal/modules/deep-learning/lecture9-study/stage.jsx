import { useState } from 'react';
import Icon from '../../../icons';
import { Tex } from '../kit';
import { useStudy } from './context';
import { Rich } from './Rich';
import { texText } from './texText';

/* ============================================================================
   LECTURE 9 STUDY — THE LAB FRAME
   ----------------------------------------------------------------------------
   Stage-first: the picture is the lab. Around it, as little as possible:
     Stage        title · slide receipt · one-line "Try this" (predict →
                  change → notice) · the stage floor · an optional story
                  bar · at most one or two caption sentences · a quiet
                  challenge · the "this page's own" dot · the maths drawer
     StoryBar     ▶ replay + the named beats (keyboard: ← →), and the one
                  sentence that belongs to the current beat
     Maths        "Show the maths": closed on screen, open in print. It walks
                  through the slide's equation with the lab's current values
     MLine        one line of that walk-through: KaTeX + plain words
     Challenge    "Make … happen" with a quiet check when it's met
   Styles: ./stage.css.
   ========================================================================== */

export function Stage({ title, slides, tryThis, story, caption, challenge, own = 'toy numbers · this page’s own', maths, children, className = '' }) {
  return (
    <div className={`dl9s-stage ${className}`}>
      <header className="dl9s-stage__head">
        <h4 className="dl9s-stage__title">{title}</h4>
        {slides && <span className="dl9s-stage__slides">{slides}</span>}
      </header>
      {tryThis && (
        <p className="dl9s-stage__try">
          <span className="dl9s-stage__tryk">Try this</span>
          <span><Rich text={tryThis} /></span>
        </p>
      )}
      {story}
      <div className="dl9s-stage__floor">{children}</div>
      {caption && <p className="dl9s-stage__cap"><Rich text={caption} /></p>}
      {(challenge || own) && (
        <div className="dl9s-stage__foot">
          {challenge ? <Challenge {...challenge} /> : <span />}
          {own && <span className="dl9s-own">{own}</span>}
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
    <div className="dl9s-story">
      <div className="dl9s-story__row" role="group" aria-label="Story: step through the beats (arrow keys move between them)" onKeyDown={onKey}>
        <button
          type="button"
          className="dl9s-story__play"
          onClick={playing ? stop : play}
          aria-label={playing ? 'Pause the story' : 'Play the story from the first beat'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        {beats.map((b, i) => (
          <button
            key={`${i}-${b.label}`}
            type="button"
            className={`dl9s-story__beat${i === beat ? ' dl9s-story__beat--on' : i < beat ? ' dl9s-story__beat--past' : ''}`}
            aria-current={i === beat ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <b>{i + 1}</b>{b.label}
          </button>
        ))}
      </div>
      <p className="dl9s-story__say" aria-live="polite"><Rich text={beats[beat]?.say ?? ''} /></p>
    </div>
  );
}

export function Maths({ children, label = 'Show the maths' }) {
  const { printing } = useStudy();
  const [open, setOpen] = useState(false);
  const shown = open || printing;
  return (
    <div className="dl9s-maths">
      <button type="button" className="dl9s-maths__btn dl9s-noprint" aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        {label} <span className={`dl9s-maths__chev${shown ? ' dl9s-maths__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      <p className="dl9s-printonly dl9s-maths__printk">The maths, with this lab’s values:</p>
      {shown && <div className="dl9s-maths__body">{children}</div>}
    </div>
  );
}

// One line of the walk-through, in Rich markup ($…$ maths prints as text too).
export function MLine({ text, children }) {
  return (
    <p className="dl9s-mline">
      {text && <Rich text={text} />}
      {children}
    </p>
  );
}

// A display equation inside the drawer, with its print twin.
export function MEq({ tex }) {
  return (
    <div className="dl9s-meq">
      <Tex block src={tex} />
      <p className="dl9s-texalt dl9s-texalt--block">{texText(tex)}</p>
    </div>
  );
}

export function Challenge({ text, done }) {
  return (
    <p className={`dl9s-chal${done ? ' dl9s-chal--done' : ''}`}>
      <span className="dl9s-chal__k">Challenge</span>
      <span className="dl9s-chal__text"><Rich text={text} /></span>
      {done && <span className="dl9s-chal__ok"><Icon name="check" size={12} strokeWidth={2.4} /> done</span>}
    </p>
  );
}
