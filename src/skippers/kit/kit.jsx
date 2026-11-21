import { Fragment, useState } from 'react';
import { pg } from './pg';

/* ============================================================================
   SKIPPERS — THE KIT (lab frame + teaching primitives)
   ----------------------------------------------------------------------------
   A re-tokened copy of the portal's lecture8-study stage kit (no portal
   imports): the picture is the lab, and around it as little as possible.
     Stage      title · workbook receipt · one-line "Try this" · the floor
                (the picture) · optional story bar · ≤ 2 caption sentences ·
                a quiet challenge · an optional "details" drawer
     StoryBar   ▶ + named beats (← → keys) + the beat's one sentence
     Drawer     closed-by-default extra detail
     Facts      "Numbers to know": ruled rows, big mono figure, one line,
                a `Workbook p.NN` receipt on every row
     Cards      rule cards: small picture, the rule, an unfold for detail
     Rich       **bold** markup in short strings
   ========================================================================== */

export function Rich({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>,
  );
}


export function Icon({ name, size = 16, stroke = 1.8 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'play': return <svg {...common}><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" /></svg>;
    case 'pause': return <svg {...common}><path d="M8 5v14M16 5v14" /></svg>;
    case 'check': return <svg {...common}><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case 'moon': return <svg {...common}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
    case 'auto': return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></svg>;
    case 'arrow': return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'back': return <svg {...common}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
    case 'sound': return <svg {...common}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>;
    case 'print': return <svg {...common}><path d="M7 9V3h10v6M7 17H4v-6h16v6h-3" /><path d="M7 14h10v7H7z" /></svg>;
    case 'reset': return <svg {...common}><path d="M4 4v6h6" /><path d="M20 12a8 8 0 1 1-2.3-5.7L4 10" /></svg>;
    case 'video': return <svg {...common}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>;
    case 'anchor': return <svg {...common}><circle cx="12" cy="5" r="2" /><path d="M12 7v14M5 12H3a9 9 0 0 0 18 0h-2M8 10h8" /></svg>;
    default: return null;
  }
}

export function Stage({ title, receipt, tryThis, story, caption, challenge, drawer, sea = false, children, foot }) {
  return (
    <section className="sk-stage">
      <header className="sk-stage__head">
        <h3 className="sk-stage__title">{title}</h3>
        {receipt && <span className="sk-receipt">{receipt}</span>}
      </header>
      {tryThis && (
        <p className="sk-stage__try">
          <span className="sk-stage__tryk">Try this</span>
          <span><Rich text={tryThis} /></span>
        </p>
      )}
      {story}
      <div className={`sk-stage__floor${sea ? ' sk-stage__floor--sea' : ''}`}>{children}</div>
      {caption && <p className="sk-stage__cap"><Rich text={caption} /></p>}
      {(challenge || foot) && (
        <div className="sk-stage__foot">
          {challenge ? <Challenge {...challenge} /> : <span />}
          {foot}
        </div>
      )}
      {drawer && <Drawer label={drawer.label}>{drawer.body}</Drawer>}
    </section>
  );
}

export function StoryBar({ story, beats }) {
  const { beat, go, play, stop, playing } = story;
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(beat + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(beat - 1); }
  };
  return (
    <div className="sk-story">
      <div className="sk-story__row" role="group" aria-label="Story beats (arrow keys move between them)" onKeyDown={onKey}>
        <button type="button" className="sk-story__play" onClick={playing ? stop : play} aria-label={playing ? 'Pause' : 'Play from the start'}>
          <Icon name={playing ? 'pause' : 'play'} size={13} />
        </button>
        {beats.map((b, i) => (
          <button
            key={b.label}
            type="button"
            className={`sk-story__beat${i === beat ? ' sk-story__beat--on' : i < beat ? ' sk-story__beat--past' : ''}`}
            aria-current={i === beat ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <b>{i + 1}</b>{b.label}
          </button>
        ))}
      </div>
      <p className="sk-story__say" aria-live="polite"><Rich text={beats[Math.max(0, beat)]?.say ?? ''} /></p>
    </div>
  );
}

export function Challenge({ text, done }) {
  return (
    <p className={`sk-chal${done ? ' sk-chal--done' : ''}`}>
      <span className="sk-chal__k">Challenge</span>
      <span className="sk-chal__t"><Rich text={text} /></span>
      {done && <span className="sk-chal__ok">✓ done</span>}
    </p>
  );
}

export function Drawer({ label = 'Show the detail', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sk-drawer">
      <button type="button" className="sk-drawer__btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} {open ? '▴' : '▾'}
      </button>
      {open && <div className="sk-drawer__body">{children}</div>}
    </div>
  );
}

// facts: [{ big, unit?, text, page }]
export function Facts({ title = 'Numbers to know', facts }) {
  return (
    <section>
      <div className="sk-facts__head">
        <h3>{title}</h3>
        <span className="sk-micro">{String(facts.length).padStart(2, '0')} facts · tap a page to check it</span>
      </div>
      <div className="sk-facts">
        {facts.map((f) => (
          <div className="sk-fact" key={f.big + f.text}>
            <span className="sk-fact__big">{f.big}{f.unit && <small> {f.unit}</small>}</span>
            <span className="sk-fact__txt"><Rich text={f.text} /></span>
            <span className="sk-fact__pg">{pg(f.page)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// cards: [{ title, text, page, art?: ReactNode, more?: [string] }]
export function Cards({ cards }) {
  return (
    <div className="sk-cards">
      {cards.map((c) => (
        <article className="sk-card" key={c.title}>
          <div className="sk-card__art" aria-hidden="true">{c.art}</div>
          <h4 className="sk-card__t">{c.title}</h4>
          <p className="sk-card__s"><Rich text={c.text} /></p>
          <div className="sk-card__foot">
            <span className="sk-receipt">{pg(c.page)}</span>
            {c.more && (
              <details className="sk-unfold">
                <summary>more ▾</summary>
                <ul>{c.more.map((m) => <li key={m}><Rich text={m} /></li>)}</ul>
              </details>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="sk-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
