import { useRef, useState } from 'react';
import NotebookPage from './NotebookPage';
import SheetPage from './SheetPage';

/* ============================================================================
   LECTURE 4 STUDY — THE WRITE BEAT'S TWO PAGES
   ----------------------------------------------------------------------------
   Divider tabs over the notebook page:
     Student notes   (default) the section re-laid out by idea — SheetPage
     Legacy          the original fixed-order page — NotebookPage, untouched
   A proper tablist: arrow keys / Home / End move between the tabs, only the
   chosen page is mounted, and the choice isn't remembered (every page opens
   on Student notes). Whichever page is showing carries the section's
   `dl4s-<id>-nb` jump anchor.
   ========================================================================== */

const TABS = [
  { key: 'sheet', label: 'Student notes' },
  { key: 'legacy', label: 'Legacy' },
];

export default function NotebookTabs({ section, sheet, ticked, onToggle, onSetAll, sheetTicked, onSheetToggle, onSheetSetAll }) {
  const tabs = sheet ? TABS : TABS.slice(1);
  const [tab, setTab] = useState(tabs[0].key);
  const btns = useRef({});
  const base = `dl4s-${section.id}-nbt`;

  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.key === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    setTab(t.key);
    btns.current[t.key]?.focus();
  };

  return (
    <div className="dl4s-nbt">
      <div className="dl4s-nbt__tabs" role="tablist" aria-label={`§${section.no} notebook page`} onKeyDown={onKey}>
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              ref={(el) => { btns.current[t.key] = el; }}
              type="button"
              role="tab"
              id={`${base}-${t.key}`}
              aria-selected={on}
              aria-controls={`${base}-${t.key}-panel`}
              tabIndex={on ? 0 : -1}
              className={`dl4s-nbt__tab${on ? ' dl4s-nbt__tab--on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${base}-${t.key}-panel`}
          aria-labelledby={`${base}-${t.key}`}
          hidden={t.key !== tab}
          className="dl4s-nbt__panel"
        >
          {t.key === tab && t.key === 'sheet' && (
            <SheetPage section={section} sheet={sheet} ticked={sheetTicked} onToggle={onSheetToggle} onSetAll={onSheetSetAll} />
          )}
          {t.key === tab && t.key === 'legacy' && (
            <NotebookPage section={section} ticked={ticked} onToggle={onToggle} onSetAll={onSetAll} />
          )}
        </div>
      ))}
    </div>
  );
}
