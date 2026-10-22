import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { Tex } from '../kit';
import { Rich } from './Rich';
import { Diagram } from './diagrams';
import { BIG_KEY, asideKey, asideTicks, figKey, itemKeys, sheetKeys } from './sheets/keys';

/* ============================================================================
   LECTURES 6–7 STUDY — THE NOTEBOOK PAGE
   ----------------------------------------------------------------------------
   The Write beat: a section's notes laid out by idea, in four pens
   (sheet.css), in the page's own typefaces, on quiet ruled paper —

     title        blue, slide range written small top right, and optionally
                  one plain "big idea" sentence under it
     blocks       a blue sub-heading, red-marked lines, and right there the
                  diagram (green = the part being discussed), boxed formula,
                  worked number, table or numbered steps that belong to it
     margin       the occasional "remember" note, Q: self-tests (click to
                  reveal) and slide-check pointers; folds under its block on
                  narrow pages
     skip         one quiet closing line naming what was deliberately left
                  for the Read beat

   Every copyable unit ticks (□ → ✓ in the left margin; keys from
   sheets/keys.js). Ticks are owned by the shell (dl67s:sheetTicks); this
   component renders them and reports clicks. Content: ./sheets/sNN.js.
   ========================================================================== */

const TickCtx = createContext({ done: new Set(), toggle: () => {} });

function Box({ on }) {
  return <span className="dl67s-sh__box" aria-hidden="true">{on && <Icon name="check" size={11} strokeWidth={2.6} />}</span>;
}

// One tickable unit of text: the whole line is the button, its tick box sits
// in the page's left margin.
function Unit({ k, kind, mark, children }) {
  const { done, toggle } = useContext(TickCtx);
  const on = done.has(k);
  return (
    <button type="button" className={`dl67s-sh__u dl67s-sh__u--${kind} dl67s-sh__snap${on ? ' dl67s-sh__u--on' : ''}`} aria-pressed={on} onClick={() => toggle(k)}>
      <Box on={on} />
      {mark != null && <span className="dl67s-sh__mark" aria-hidden="true">{mark}</span>}
      <span className="dl67s-sh__t">{children}</span>
    </button>
  );
}

// A diagram: its own tick button (keyboard) and a click anywhere on it (mouse).
// In the left margin like every other tick; beside the bullets (side) it
// starts the caption line instead.
function Fig({ k, fig, side = false }) {
  const { done, toggle } = useContext(TickCtx);
  const on = done.has(k);
  const tick = (
    <button
      type="button"
      className="dl67s-sh__figtick"
      aria-pressed={on}
      aria-label={on ? 'Diagram drawn — untick' : 'Tick when the diagram is drawn'}
      onClick={(e) => { e.stopPropagation(); toggle(k); }}
    >
      <Box on={on} />
    </button>
  );
  return (
    <div className={`dl67s-sh__figu dl67s-sh__snap${side ? ' dl67s-sh__figu--side' : ''}${on ? ' dl67s-sh__u--on' : ''}`}>
      {!side && tick}
      <figure className="dl67s-sh__fig" onClick={() => toggle(k)}>
        <div className="dl67s-sh__figscroll dl67s-sh__scrollx">
          <Diagram fig={fig.key ?? fig.fig} sheet hl={fig.hl} />
        </div>
        {(fig.cap || side) && (
          <figcaption className="dl67s-sh__cap">
            {side && tick}
            {fig.cap && <Rich text={fig.cap} />}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function Formula({ item }) {
  return (
    <>
      {item.formula ? (
        <span className="dl67s-sh__fbox dl67s-sh__scrollx"><Tex block src={item.formula} /></span>
      ) : (
        <span className="dl67s-sh__fbox dl67s-sh__fbox--code dl67s-sh__scrollx"><code>{item.code}</code></span>
      )}
      {(item.read || item.tag) && (
        <span className="dl67s-sh__read">
          {item.read && <><span className="dl67s-sh__ie">i.e.</span> <Rich text={item.read} /></>}
          {item.tag && <span className="dl67s-sh__tag"> ({item.tag})</span>}
        </span>
      )}
    </>
  );
}

function Table({ item, keys }) {
  const { done, toggle } = useContext(TickCtx);
  const { head, rows, cols } = item.table;
  // every column sized to its content, wrapping between words but never inside one
  const tracks = cols || `repeat(${head.length}, minmax(min-content, max-content))`;
  return (
    <div className="dl67s-sh__table dl67s-sh__snap" role="group" aria-label={`Table: ${head.join(', ')}`} style={{ '--sh-cols': tracks }}>
      <div className="dl67s-sh__tr dl67s-sh__tr--head" aria-hidden="true">
        <span />
        {head.map((h, c) => <span key={c} className="dl67s-sh__th"><Rich text={h} /></span>)}
      </div>
      {rows.map((r, j) => {
        const k = keys[j];
        const on = done.has(k);
        return (
          <button key={k} type="button" className={`dl67s-sh__tr${on ? ' dl67s-sh__u--on' : ''}`} aria-pressed={on} onClick={() => toggle(k)}>
            <Box on={on} />
            {r.map((cell, c) => <span key={c} className="dl67s-sh__td"><Rich text={cell} /></span>)}
          </button>
        );
      })}
    </div>
  );
}

function Item({ blockId, item, i }) {
  const keys = itemKeys(blockId, item, i);
  if (typeof item === 'string') return <Unit k={keys[0]} kind="bullet" mark="•"><Rich text={item} /></Unit>;
  if (item.sub) return <h5 className="dl67s-sh__sub dl67s-sh__snap"><Rich text={item.sub} /></h5>;
  if (item.line) return <Unit k={keys[0]} kind="line"><Rich text={item.line} /></Unit>;
  if (item.steps) {
    return (
      <ol className="dl67s-sh__steps">
        {item.steps.map((s, j) => (
          <li key={keys[j]}><Unit k={keys[j]} kind="step" mark={`${j + 1}.`}><Rich text={s} /></Unit></li>
        ))}
      </ol>
    );
  }
  if (item.formula || item.code) return <Unit k={keys[0]} kind="formula"><Formula item={item} /></Unit>;
  if (item.worked) {
    const lines = [...(item.title ? [item.title] : []), ...item.worked];
    return (
      <div className="dl67s-sh__worked">
        {lines.map((l, j) => (
          <Unit key={keys[j]} k={keys[j]} kind={item.title && j === 0 ? 'wtitle' : 'wline'} mark={item.title && j === 0 ? 'e.g.' : null}>
            <Rich text={l} />
          </Unit>
        ))}
      </div>
    );
  }
  if (item.table) return <Table item={item} keys={keys} />;
  if (item.arrow) {
    return (
      <Unit k={keys[0]} kind="arrow">
        <span className="dl67s-sh__cause"><Rich text={item.arrow[0]} /></span>{' '}
        {/* the word joiner keeps the arrow on the line with its effect */}
        <svg className="dl67s-sh__arr" viewBox="0 0 40 12" aria-hidden="true"><path d="M1 6 H37 M31 1.5 L37.5 6 L31 10.5" /></svg>{'⁠'}
        <span className="dl67s-sh__effect"><Rich text={item.arrow[1]} /></span>
      </Unit>
    );
  }
  if (item.fig) return <Fig k={keys[0]} fig={item} />;
  return null;
}

function Aside({ a, k }) {
  const [open, setOpen] = useState(false);
  if (asideTicks(a)) {
    return (
      <Unit k={k} kind="aside dl67s-sh__u--nb">
        <span className="dl67s-sh__mark">remember</span><Rich text={a.nb} />
      </Unit>
    );
  }
  if (a.q) {
    return (
      <div className="dl67s-sh__q dl67s-sh__snap">
        <p className="dl67s-sh__qline">
          <span className="dl67s-sh__mark" aria-hidden="true">Q</span>
          <span className="dl67s-sh__qtext"><Rich text={a.q} /></span>{' '}
          <button type="button" className="dl67s-sh__reveal" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'hide' : 'answer'}
          </button>
        </p>
        {open && <p className="dl67s-sh__a"><Rich text={a.a} /></p>}
      </div>
    );
  }
  if (a.sc) {
    return (
      <p className="dl67s-sh__sc dl67s-sh__snap">
        <span className="dl67s-sh__mark" aria-hidden="true">slide check</span> <Rich text={a.sc} />
      </p>
    );
  }
  return null;
}

// A block: heading, items and their diagram in the main column, asides in
// the margin column. A side diagram takes the right of the block instead
// (reaching into the margin), so its asides stay under the bullets they test.
function Block({ b }) {
  const place = b.fig?.place ?? 'below';
  const side = place === 'side';
  const fig = b.fig ? <Fig k={figKey(b.id)} fig={b.fig} side={side} /> : null;
  const margin = b.margin?.length > 0 && (
    <aside className="dl67s-sh__margin" aria-label="Margin notes">
      {b.margin.map((a, k) => <Aside key={k} a={a} k={asideKey(b.id, k)} />)}
    </aside>
  );
  return (
    <div className={`dl67s-sh__block${margin && !side ? ' dl67s-sh__block--margin' : ''}${side ? ' dl67s-sh__block--side' : ''}`}>
      <div className="dl67s-sh__main">
        {b.h && (
          <h4 className="dl67s-sh__h dl67s-sh__snap">
            <span className="dl67s-sh__htext"><Rich text={b.h} /></span>
            {b.at && <span className="dl67s-sh__at">{/[–,]/.test(b.at) ? 'slides' : 'slide'} {b.at}</span>}
          </h4>
        )}
        <div className={`dl67s-sh__split${side ? ' dl67s-sh__split--side' : ''}`}>
          <div className="dl67s-sh__items">
            {place === 'above' && fig}
            {b.items.map((it, i) => <Item key={i} blockId={b.id} item={it} i={i} />)}
            {place === 'below' && fig}
            {side && margin}
          </div>
          {side && fig}
        </div>
      </div>
      {!side && margin}
    </div>
  );
}

// A box or diagram wider than its column scrolls inside its own frame; while
// there is more to the right, its edge fades (data-more) so it doesn't look
// complete.
function useScrollCues(ref) {
  useEffect(() => {
    const page = ref.current;
    if (!page || typeof ResizeObserver === 'undefined') return undefined;
    const mark = (el) => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
      if (more) el.setAttribute('data-more', '');
      else el.removeAttribute('data-more');
    };
    const els = [...page.querySelectorAll('.dl67s-sh__scrollx')];
    const ro = new ResizeObserver((entries) => entries.forEach((e) => mark(e.target)));
    const onScroll = (e) => mark(e.currentTarget);
    els.forEach((el) => {
      ro.observe(el);
      el.addEventListener('scroll', onScroll, { passive: true });
    });
    document.fonts?.ready?.then(() => els.forEach(mark)).catch(() => {});
    return () => {
      ro.disconnect();
      els.forEach((el) => el.removeEventListener('scroll', onScroll));
    };
  }, [ref]);
}

// Keep every written line on a ruled line: each unit, heading and figure is
// padded up to a whole number of rules (all reads, then all writes).
function useRuleSnap(ref) {
  useEffect(() => {
    const page = ref.current;
    if (!page || typeof ResizeObserver === 'undefined') return undefined;
    const probe = page.querySelector('.dl67s-sh__probe');
    const snapAll = (els) => {
      const step = probe?.getBoundingClientRect().height;
      if (!step) return;
      els.forEach((el) => { el.style.paddingBottom = '0px'; });
      const hs = els.map((el) => el.getBoundingClientRect().height);
      els.forEach((el, i) => {
        const extra = Math.ceil(hs[i] / step - 0.02) * step - hs[i];
        el.style.paddingBottom = `${Math.max(0, extra)}px`;
      });
    };
    const ro = new ResizeObserver((entries) => snapAll(entries.map((e) => e.target)));
    const observe = () => page.querySelectorAll('.dl67s-sh__snap').forEach((el) => ro.observe(el));
    observe();
    // answers open and close inside the page: watch for new snap targets
    const mo = new MutationObserver(observe);
    mo.observe(page, { childList: true, subtree: true });
    const all = () => snapAll([...page.querySelectorAll('.dl67s-sh__snap')]);
    window.addEventListener('resize', all);
    document.addEventListener('fullscreenchange', all);
    document.fonts?.ready?.then(all).catch(() => {});
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', all);
      document.removeEventListener('fullscreenchange', all);
    };
  }, [ref]);
}

export default function SheetPage({ section, sheet, ticked, onToggle, onSetAll }) {
  const { id, no, title, slides } = section;
  const pageRef = useRef(null);
  useRuleSnap(pageRef);
  useScrollCues(pageRef);
  const keys = sheetKeys(sheet);
  const done = new Set(ticked);
  const count = keys.filter((k) => done.has(k)).length;
  const total = keys.length;
  const complete = total > 0 && count === total;
  const headId = `dl67s-${id}-shtitle`;
  const ctx = { done, toggle: onToggle };

  return (
    <TickCtx.Provider value={ctx}>
      <div className="dl67s-shwrap">
      <section ref={pageRef} className={`dl67s-sh${complete ? ' dl67s-sh--done' : ''}`} id={`dl67s-${id}-nb`} aria-labelledby={headId}>
        <span className="dl67s-sh__probe" aria-hidden="true" />
        <header className="dl67s-sh__head dl67s-sh__snap">
          <h3 className="dl67s-sh__title" id={headId} tabIndex={-1}>
            <span className="dl67s-sh__no">§{no}</span> {title}
          </h3>
          <p className="dl67s-sh__date">
            <span className="dl67s-sh__slides">{/[–,]/.test(slides) ? 'slides' : 'slide'} {slides}</span>
            <span className="dl67s-sh__count" aria-live="polite">
              {complete ? <><Icon name="check" size={12} /> page copied</> : `${count}/${total} copied`}
            </span>
          </p>
        </header>
        {sheet.big && (
          <div className="dl67s-sh__bigrow">
            <Unit k={BIG_KEY} kind="big"><Rich text={sheet.big} /></Unit>
          </div>
        )}
        {sheet.blocks.map((b) => <Block key={b.id} b={b} />)}
        {sheet.skip && (
          <p className="dl67s-sh__skip dl67s-sh__snap">
            <span className="dl67s-sh__skipk">Not in these notes (see Read):</span> <Rich text={sheet.skip} />
          </p>
        )}
        <div className="dl67s-sh__tools dl67s-sh__snap">
          <button type="button" className="dl67s-sh__tool" onClick={() => onSetAll(keys, true)} disabled={complete}>tick every line</button>
          <button type="button" className="dl67s-sh__tool" onClick={() => onSetAll(keys, false)} disabled={count === 0}>clear ticks</button>
        </div>
      </section>
      </div>
    </TickCtx.Provider>
  );
}
