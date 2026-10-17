import { useState } from 'react';
import Icon from '../../icons';
import { IB_URL, VIDEOS } from './content';

/* ============================================================================
   BARISTA · UI PRIMITIVES (.bxi-*)
   ----------------------------------------------------------------------------
   Rich       instruction markup: [1 CUP] → steel chip, {25 s} → mono value
   Lines      a step's instruction list with plain mono counters (01 02 03)
   Hook       the one big line that opens a tab
   Fact       small stat card
   Unfold     collapsible "why" row
   Dot        a labelled tone dot (the house way to show status — no callouts)
   Receipt    mono source line; IB pages link straight into the PDF page
   VideoLink  "Breville video" link for a hub guide
   Seg        mono segmented switch for in-tab views
   ========================================================================== */

const TOKEN = /(\[[^\]]+\]|\{[^}]+\})/g;

export function Rich({ text, vars }) {
  const parts = String(text).split(TOKEN).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('[')) return <kbd key={i} className="bxi-key">{p.slice(1, -1)}</kbd>;
    if (p.startsWith('{')) {
      const raw = p.slice(1, -1);
      const v = vars?.[raw] ?? raw;
      // "25 s" → mono 25 + a proportional unit, so mono spacing doesn't gape.
      const m = /^([\d.,–-]+)\s+(.+)$/.exec(v);
      return m ? (
        <span key={i} className="bxi-num">
          {m[1]}
          <span className="bxi-unit">{' '}{m[2]}</span>
        </span>
      ) : (
        <span key={i} className="bxi-num">{v}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

const lineText = (l) => (typeof l === 'string' ? l : l.t);

export function Lines({ lines, vars, start = 1 }) {
  return (
    <ol className="bxi-lines">
      {lines.map((l, i) => {
        const tip = typeof l === 'object' && l.tip;
        return (
          <li key={i} className={`bxi-line${tip ? ' bxi-line--tip' : ''}`}>
            <span className="bxi-line__n">{String(i + start).padStart(2, '0')}</span>
            <span className="bxi-line__t">
              <Rich text={lineText(l)} vars={vars} />
              {tip && <TipMark />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TipMark() {
  return (
    <span className="bxi-tipmark" title="General espresso practice, not from Breville’s manual">
      <span className="bxi-dot bxi-dot--tip" aria-hidden="true" />
      tip
    </span>
  );
}

export function Hook({ children, sub }) {
  return (
    <div className="bxi-hook">
      <p className="bxi-hook__line">{children}</p>
      {sub && <p className="bxi-hook__sub">{sub}</p>}
    </div>
  );
}

export function Fact({ k, v, children }) {
  return (
    <div className="bxi-fact">
      {k && <p className="bxi-fact__k">{k}</p>}
      {v !== undefined && <p className="bxi-fact__v">{v}</p>}
      {children && <div className="bxi-fact__sub">{children}</div>}
    </div>
  );
}

export function Unfold({ label = 'Why', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bxi-unfold${open ? ' bxi-unfold--open' : ''}`}>
      <button type="button" className="bxi-unfold__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="bxi-unfold__plus" aria-hidden="true" />
        {label}
      </button>
      <div className="bxi-unfold__body">
        <div className="bxi-unfold__inner">{children}</div>
      </div>
    </div>
  );
}

export function Dot({ tone = 'ink', label, children }) {
  return (
    <span className={`bxi-tone bxi-tone--${tone}`}>
      <span className={`bxi-dot bxi-dot--${tone}`} aria-hidden="true" />
      {label && <span className="bxi-tone__label">{label}</span>}
      {children}
    </span>
  );
}

const IB_PAGE = /IB p\.(\d+)/;

export function Receipt({ src }) {
  const list = Array.isArray(src) ? src : [src];
  return (
    <span className="bxi-receipt">
      {list.map((s, i) => {
        const m = IB_PAGE.exec(s);
        return (
          <span key={s + i} className="bxi-receipt__item">
            {m ? (
              <a href={`${IB_URL}#page=${m[1]}`} target="_blank" rel="noreferrer" title="Open Breville’s instruction book at this page">
                {s}
              </a>
            ) : (
              s
            )}
          </span>
        );
      })}
    </span>
  );
}

export function VideoLink({ k, short }) {
  const v = VIDEOS[k];
  if (!v) return null;
  return (
    <a className="bxi-video" href={v.url} target="_blank" rel="noreferrer">
      <Icon name="play" size={13} />
      <span>{short ? 'Breville video' : `Breville video · ${v.title}`}</span>
      {v.runtime && <span className="bxi-video__rt">{v.runtime}</span>}
    </a>
  );
}

export function Seg({ items, value, onChange, label }) {
  return (
    <div className="bxi-seg" role="tablist" aria-label={label}>
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={`bxi-seg__btn${value === it.id ? ' bxi-seg__btn--on' : ''}`}
          onClick={() => onChange(it.id)}
        >
          <span className="bxi-seg__n">{String(i + 1).padStart(2, '0')}</span>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Label({ children, tone }) {
  return <p className={`bxi-label${tone ? ` bxi-label--${tone}` : ''}`}>{children}</p>;
}
