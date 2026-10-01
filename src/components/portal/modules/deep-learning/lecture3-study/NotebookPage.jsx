import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { Tex } from '../kit';
import { Rich, FilterMatrices } from './Rich';
import { Diagram } from './diagrams';

/* ============================================================================
   LECTURE 3 STUDY — THE NOTEBOOK PAGE
   ----------------------------------------------------------------------------
   The "Write" beat: one sheet of ruled paper per section, holding exactly what
   goes into the paper notebook, always in the same order —

     Notes            2–4 sub-headings, each line tickable (□ → ✓, persisted)
     Draw this        monochrome line-art you can copy in ~2 minutes
     Formulas to copy each with a one-line plain-English reading
     Worked number    a tiny calculation to copy
     Check yourself   one-line questions, answers behind a click

   Ticks are owned by the shell (persisted under dl3s:ticks); this component
   only renders them and reports clicks.
   ========================================================================== */

function CheckItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="dl3s-nb__q">
      <p className="dl3s-nb__qtext"><Rich text={q} /></p>
      <button type="button" className="dl3s-nb__reveal" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide answer' : 'Show answer'}
      </button>
      {open && <p className="dl3s-nb__a"><Rich text={a} /></p>}
    </li>
  );
}

// Keep every written line on a ruled line: blocks of irregular height (the
// header, figures, typeset maths) are padded up to a whole number of rules.
function useRuleSnap(ref) {
  useEffect(() => {
    const page = ref.current;
    if (!page || typeof ResizeObserver === 'undefined') return undefined;
    const els = [...page.querySelectorAll('.dl3s-nb__snap')];
    const probe = page.querySelector('.dl3s-nb__label') || page;
    const snap = (el) => {
      const step = parseFloat(getComputedStyle(probe).lineHeight);
      if (!step) return;
      el.style.paddingBottom = '0px';
      const h = el.getBoundingClientRect().height;
      const extra = Math.ceil(h / step - 0.02) * step - h;
      el.style.paddingBottom = `${Math.max(0, extra)}px`;
    };
    const all = () => els.forEach(snap);
    const ro = new ResizeObserver((entries) => entries.forEach((e) => snap(e.target)));
    els.forEach((el) => ro.observe(el));
    window.addEventListener('resize', all);
    document.addEventListener('fullscreenchange', all);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', all);
      document.removeEventListener('fullscreenchange', all);
    };
  }, [ref]);
}

export default function NotebookPage({ section, ticked, onToggle, onSetAll }) {
  const { id, no, title, slides, notes, draw, formulas, worked, check } = section;
  const pageRef = useRef(null);
  useRuleSnap(pageRef);
  const done = new Set(ticked);
  const total = notes.reduce((a, g) => a + g.lines.length, 0);
  const count = notes.reduce((a, g, gi) => a + g.lines.filter((_, li) => done.has(offset(notes, gi) + li)).length, 0);
  const complete = total > 0 && count === total;
  const headId = `dl3s-${id}-nbtitle`;

  return (
    <section ref={pageRef} className={`dl3s-nb${complete ? ' dl3s-nb--done' : ''}`} id={`dl3s-${id}-nb`} aria-labelledby={headId}>
      <header className="dl3s-nb__head dl3s-nb__snap">
        <p className="dl3s-nb__kicker">
          <Icon name="edit" size={14} /> Notebook page
        </p>
        <h3 className="dl3s-nb__title" id={headId} tabIndex={-1}>
          §{no} · {title}
        </h3>
        <p className="dl3s-nb__meta">
          <span>slides {slides}</span>
          <span className="dl3s-nb__count" aria-live="polite">
            {complete ? <><Icon name="check" size={13} /> page copied</> : `${count}/${total} lines copied`}
          </span>
        </p>
      </header>

      <div className="dl3s-nb__block">
        <h4 className="dl3s-nb__label">Notes</h4>
        {notes.map((g, gi) => (
          <div key={gi} className="dl3s-nb__group">
            <h5 className="dl3s-nb__sub">{g.h}</h5>
            <ul className="dl3s-nb__lines">
              {g.lines.map((line, li) => {
                const idx = offset(notes, gi) + li;
                const on = done.has(idx);
                return (
                  <li key={li}>
                    <button
                      type="button"
                      className={`dl3s-nb__line${on ? ' dl3s-nb__line--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => onToggle(idx)}
                    >
                      <span className="dl3s-nb__box" aria-hidden="true">{on && <Icon name="check" size={12} strokeWidth={2.4} />}</span>
                      <span className="dl3s-nb__text"><Rich text={line} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="dl3s-nb__tools">
          <button type="button" className="dl3s-nb__tool" onClick={() => onSetAll(total, true)} disabled={complete}>
            tick every line
          </button>
          <button type="button" className="dl3s-nb__tool" onClick={() => onSetAll(total, false)} disabled={count === 0}>
            clear ticks
          </button>
        </div>
      </div>

      {draw && draw.length > 0 && (
        <div className="dl3s-nb__block">
          <h4 className="dl3s-nb__label">Draw this</h4>
          <div className="dl3s-nb__draws dl3s-nb__snap">
            {draw.map((d) => (
              <figure key={d.fig} className="dl3s-nb__draw">
                <Diagram fig={d.fig} />
                <figcaption className="dl3s-nb__cap"><Rich text={d.caption} /></figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {formulas && formulas.length > 0 && (
        <div className="dl3s-nb__block">
          <h4 className="dl3s-nb__label">Formulas to copy</h4>
          <ul className="dl3s-nb__formulas">
            {formulas.map((f, i) => (
              <li key={i} className="dl3s-nb__formula">
                {f.tex && <div className="dl3s-nb__snap"><Tex block src={f.tex} /></div>}
                {f.code && <pre className="dl3s-nb__code dl3s-nb__snap"><code>{f.code}</code></pre>}
                {f.filters && <div className="dl3s-nb__snap"><FilterMatrices compact /></div>}
                <p className="dl3s-nb__read">
                  {f.tag && <span className="dl3s-nb__tag">{f.tag}</span>}
                  <Rich text={f.read} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {worked && (
        <div className="dl3s-nb__block">
          <h4 className="dl3s-nb__label">Worked number</h4>
          <div className="dl3s-nb__worked">
            <p className="dl3s-nb__wtitle"><Rich text={worked.title} /></p>
            {worked.lines.map((l, i) => (
              <p key={i} className="dl3s-nb__wline"><Rich text={l} /></p>
            ))}
          </div>
        </div>
      )}

      {check && check.length > 0 && (
        <div className="dl3s-nb__block">
          <h4 className="dl3s-nb__label">Check yourself</h4>
          <ol className="dl3s-nb__qs">
            {check.map((c, i) => <CheckItem key={i} q={c.q} a={c.a} />)}
          </ol>
        </div>
      )}
    </section>
  );
}

// Lines are numbered straight through the page (group 1, then group 2, …).
function offset(notes, gi) {
  let n = 0;
  for (let g = 0; g < gi; g++) n += notes[g].lines.length;
  return n;
}
