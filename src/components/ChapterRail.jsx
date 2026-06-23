import { useState, useEffect } from 'react';
import { SECTIONS } from './sections';

/* The scan-progress spine — a fixed vertical rail (desktop only) that turns the
   page into a guided "read". A hot fill tracks overall scroll progress; each
   chapter node lights as you reach it and doubles as navigation.
   Decorative-but-functional: it's a real <nav> with buttons, hidden on narrow
   viewports via CSS where there's no room in the margin. */
export default function ChapterRail() {
  const [active, setActive] = useState(-1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);

      let current = -1;
      SECTIONS.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && window.scrollY >= el.offsetTop - 220) current = i;
      });
      setActive(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav className="hp-rail" aria-label="Section progress">
      <span className="hp-rail__track" aria-hidden="true">
        <span className="hp-rail__fill" style={{ transform: `scaleY(${progress})` }} />
      </span>
      <ul className="hp-rail__list">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={
                'hp-rail__item' +
                (i === active ? ' is-active' : '') +
                (i < active ? ' is-done' : '')
              }
              onClick={() => go(s.id)}
              aria-current={i === active ? 'step' : undefined}
            >
              <span className="hp-rail__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="hp-rail__label">{s.label}</span>
              <span className="hp-rail__tick" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
