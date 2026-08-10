import { createContext, useContext, useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useReveal } from './useReveal';
import './kit.css';

/* ============================================================================
   DEEP LEARNING — LECTURE KIT
   ----------------------------------------------------------------------------
   The building blocks every interactive lecture page is composed from. The
   design brief: minimal reading, maximum signal —

     Tex        KaTeX renderer (inline or display).
     Hook       the big opening line of a tab — one sentence, display type.
     Fact       a small stat/definition card: big value, small label, one line.
     Unfold     a collapsible detail row (grid-rows animation) — long slide
                text lives here so it never reads as a wall.
     Section    a numbered pane shell: index, title, slide-range chip, reveal
                on scroll.
     Note       a labelled editorial aside (ruled, marker dot — never a
                coloured callout box).

   The NOTETAKING SPINE (so a tab transcribes straight into a notebook):
     Outline    the "notes skeleton" under a Hook — the tab's numbered subs
                as clickable jump links; copy it down as your heading list.
     Sub        a numbered subsection ruler (2.1, 2.2 …) segmenting a tab
                into notebook-sized ideas, each with its slide receipt.
     Eq         a named + numbered display equation (EQ 2.1) with an italic
                plain-words "read" line underneath — built to be copied.
     Jot        the end-of-tab "Note it down" recap: ruled, tickable lines
                (□ → ✓) holding exactly what belongs in your notes.
     Code       a VS-Code-style editor block: dark chrome, traffic dots,
                filename tab, line numbers, real Python syntax colours
                (Dark+ palette), per-line highlight/dim for steppers.
     RefsProvider / Fnote
                footnote markers that open an in-place citation popover
                (hover or click) — no jumping across tabs.

   All classes `dlk-*`, themed off portal tokens (the editor block is
   deliberately always-dark, like a real editor).
   ========================================================================== */

export function Tex({ src, block = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) katex.render(src, ref.current, { throwOnError: false, displayMode: block });
  }, [src, block]);
  return <span ref={ref} className={block ? 'dlk-tex-block' : 'dlk-tex-inline'} />;
}

/* ── The big line that opens a tab ───────────────────────────────────────── */
export function Hook({ children, sub }) {
  return (
    <div className="dlk-hook">
      <p className="dlk-hook__line">{children}</p>
      {sub && <p className="dlk-hook__sub">{sub}</p>}
    </div>
  );
}

/* ── Stat / definition card ──────────────────────────────────────────────── */
export function Fact({ k, v, children, tone }) {
  return (
    <div className="dlk-fact" data-tone={tone}>
      {k && <p className="dlk-fact__k">{k}</p>}
      {v !== undefined && <p className="dlk-fact__v">{v}</p>}
      {children && <div className="dlk-fact__sub">{children}</div>}
    </div>
  );
}

/* ── Collapsible detail row ──────────────────────────────────────────────── */
export function Unfold({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`dlk-unfold${open ? ' dlk-unfold--open' : ''}`}>
      <button type="button" className="dlk-unfold__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dlk-unfold__plus" aria-hidden="true" />
        {label}
      </button>
      <div className="dlk-unfold__body">
        <div className="dlk-unfold__inner">{children}</div>
      </div>
    </div>
  );
}

/* ── Pane shell ──────────────────────────────────────────────────────────── */
export function Section({ n, title, slides, lead, children, id }) {
  const [ref, seen] = useReveal();
  return (
    <section id={id} ref={ref} className={`pt-card dlk-section${seen ? ' dlk-in' : ''}`}>
      <header className="dlk-section__head">
        <span className="dlk-section__no">{String(n).padStart(2, '0')}</span>
        <div className="dlk-section__heading">
          <h4 className="dlk-section__title">{title}</h4>
          {slides && <span className="dlk-section__slides">Slides {slides}</span>}
        </div>
      </header>
      {lead && <p className="dlk-section__lead">{lead}</p>}
      {children}
    </section>
  );
}

/* ── Notes skeleton: the tab's numbered subs as jump links ───────────────── */
const subId = (no) => `dl-sub-${String(no).replace(/\./g, '-')}`;

export function Outline({ items }) {
  const go = (no) => document.getElementById(subId(no))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav className="dlk-outline" aria-label="Section outline">
      <span className="dlk-outline__label">
        <span className="dlk-outline__dot" aria-hidden="true" />
        Notes skeleton
      </span>
      <ol className="dlk-outline__list">
        {items.map(([no, t]) => (
          <li key={no}>
            <button type="button" className="dlk-outline__item" onClick={() => go(no)}>
              <span className="dlk-outline__no">{no}</span>
              {t}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── Numbered subsection ruler — the notetaking spine of a tab ───────────── */
export function Sub({ no, title, slides, children }) {
  return (
    <section className="dlk-sub" id={subId(no)}>
      <header className="dlk-sub__head">
        <span className="dlk-sub__no">{no}</span>
        <h5 className="dlk-sub__title">{title}</h5>
        {slides && <span className="dlk-sub__slides">{slides}</span>}
      </header>
      {children}
    </section>
  );
}

/* ── Named, numbered equation with a plain-words reading ─────────────────── */
export function Eq({ no, name, src, read }) {
  return (
    <figure className="dlk-eq">
      <figcaption className="dlk-eq__head">
        <span className="dlk-eq__dot" aria-hidden="true" />
        <span className="dlk-eq__name">{name}</span>
        {no && <span className="dlk-eq__no">eq {no}</span>}
      </figcaption>
      <Tex block src={src} />
      {read && <p className="dlk-eq__read">read: {read}</p>}
    </figure>
  );
}

/* ── "Note it down" — the end-of-tab recap, tickable line by line ────────── */
export function Jot({ label = 'Note it down', items }) {
  const [done, setDone] = useState(() => new Set());
  const toggle = (i) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div className="dlk-jot">
      <div className="dlk-jot__bar">
        <span className="dlk-jot__label">
          <span className="dlk-jot__dot" aria-hidden="true" />
          {label}
        </span>
        <span className="dlk-jot__hint">
          {done.size}/{items.length} copied — tick a line once it’s in your notebook
        </span>
      </div>
      <ul className="dlk-jot__list">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              className={`dlk-jot__item${done.has(i) ? ' dlk-jot__item--done' : ''}`}
              onClick={() => toggle(i)}
              aria-pressed={done.has(i)}
            >
              <span className="dlk-jot__box" aria-hidden="true" />
              <span className="dlk-jot__text">{it}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Labelled aside ──────────────────────────────────────────────────────── */
export function Note({ label = 'Note', tone = 'accent', children }) {
  return (
    <div className="dlk-note" data-tone={tone}>
      <span className="dlk-note__label">
        <span className="dlk-note__dot" aria-hidden="true" />
        {label}
      </span>
      <div className="dlk-note__body">{children}</div>
    </div>
  );
}

/* ── Footnote popovers ───────────────────────────────────────────────────── */
const RefsCtx = createContext({});

export function RefsProvider({ refs, children }) {
  return <RefsCtx.Provider value={refs}>{children}</RefsCtx.Provider>;
}

export function Fnote({ n }) {
  const refs = useContext(RefsCtx);
  const [open, setOpen] = useState(false);
  const text = refs?.[n];
  return (
    <span
      className="dlk-fnote"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="dlk-fnote__btn"
        aria-label={`Reference ${n}`}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        {n}
      </button>
      {open && text && (
        <span className="dlk-fnote__pop" role="note">
          <span className="dlk-fnote__pop-n">[{n}]</span> {text}
        </span>
      )}
    </span>
  );
}

/* ── VS-Code-style code block ────────────────────────────────────────────── */
const PY_KEYWORDS = new Set([
  'import', 'from', 'as', 'for', 'in', 'if', 'elif', 'else', 'while', 'return', 'def', 'class',
  'with', 'try', 'except', 'finally', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not',
  'is', 'assert', 'yield', 'global', 'del', 'raise',
]);
const PY_CONSTS = new Set(['True', 'False', 'None', 'self']);

const TOKEN_RE = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

// One line of Python → array of { t, cls } spans (Dark+ colour classes).
function pyTokens(line) {
  const out = [];
  let rest = line;
  if (rest.startsWith('>>>')) {
    out.push({ t: '>>>', cls: 'pr' });
    rest = rest.slice(3);
    // A console *statement* gets highlighted; a printed result is plain.
  }
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(rest))) {
    if (m.index > last) out.push({ t: rest.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], cls: 'cm' });
    else if (m[2] !== undefined) out.push({ t: m[2], cls: 'st' });
    else if (m[3] !== undefined) out.push({ t: m[3], cls: 'nu' });
    else {
      const w = m[4];
      const callAhead = /^\s*\(/.test(rest.slice(TOKEN_RE.lastIndex));
      if (PY_KEYWORDS.has(w)) out.push({ t: w, cls: 'kw' });
      else if (PY_CONSTS.has(w)) out.push({ t: w, cls: 'ct' });
      else if (callAhead) out.push({ t: w, cls: 'fn' });
      else out.push({ t: w });
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < rest.length) out.push({ t: rest.slice(last) });
  return out;
}

/* label = the "filename" in the editor tab; meta = right-side chip (slide no.);
   hl = 1-indexed lines to spotlight (others dim) — used by the steppers. */
export function Code({ code, label = 'python', meta, hl }) {
  const lines = code.replace(/\n$/, '').split('\n');
  const hlSet = hl && hl.length ? new Set(hl) : null;
  return (
    <figure className="dlk-code">
      <figcaption className="dlk-code__bar">
        <span className="dlk-code__dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="dlk-code__file">{label}</span>
        {meta && <span className="dlk-code__meta">{meta}</span>}
      </figcaption>
      <pre className="dlk-code__pre">
        <code className="dlk-code__code">
          {lines.map((ln, i) => {
            const isHl = hlSet ? hlSet.has(i + 1) : false;
            const isDim = hlSet ? !hlSet.has(i + 1) : false;
            return (
              <span
                key={i}
                className={`dlk-code__line${isHl ? ' dlk-code__line--hl' : ''}${isDim ? ' dlk-code__line--dim' : ''}`}
              >
                {pyTokens(ln).map((tok, j) =>
                  tok.cls ? <span key={j} className={`tok-${tok.cls}`}>{tok.t}</span> : tok.t,
                )}
                {'\n'}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}
