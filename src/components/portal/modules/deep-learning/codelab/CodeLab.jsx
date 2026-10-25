import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePortalRoute } from '../../../portalRoute';
import { SECTIONS, SECTION_BY_ID } from './sections';
import { CARDS, cardsOf, fullLabel, sourceText } from './cards';
import { LAB_PANELS } from './labsProjects';
import { Card, LabPanel } from './Card';
import ExportPdf from './ExportPdf';
import { PRINT_CSS, preparePrint } from './print';
import { load, save } from './storage';
import '../common.css';
import './codelab.css';

/* ============================================================================
   CITS5017 · CODE LAB — the exam's code on one page
   ----------------------------------------------------------------------------
   The one place to learn how the unit's key models are written in Keras:
   only the code likely to be examined (L1–L9, Lab Sheets 2–4, both
   projects), one top tab per model or concept, every card trained on the
   exam's move — read the code, then draw it, count it, give the shapes, say
   what each key line does and what the model is for.

     tabs        sticky under the portal topbar; /portal/dl-code-lab/<tab>
                 deep links; a select at phone width; each tab opens on a
                 ruled index of its cards
     search      "/" focuses it from anywhere, Esc clears, every term must
                 match; results come from every tab, each showing its tab
     core only   hides the `useful` cards for a fast pass
     export      Export PDF prints every tab and card (./print.js): the code
                 panels as Dark+ images with real text under them; the
                 NotebookLM prompts sit under the button (./exportPrompt.js)
     storage     dlc:tab, dlc:coreOnly (./storage.js)

   Content is data: ./sections.js (tabs), ./cards/* (cards), ./specs.js
   (layer specs), ./labsProjects.js (tab 1's panels).
   ========================================================================== */

const norm = (s) => String(s || '').toLowerCase();

// Every term must hit somewhere; the strongest field it hits sets its score.
// A whole name in the code (a layer, an argument: "concatenate",
// "return_sequences") outranks the same word in another card's prose.
function scoreCard(c, terms) {
  const has = (text) => (t) => text.includes(t);
  const names = new Set(norm(c.code).match(/[a-z_][a-z0-9_]*/g));
  const fields = [
    [4, has(norm(`${c.label} ${c.title}`))],
    [3.5, (t) => names.has(t)],
    [3, has(norm(`${c.why} ${c.marks.map((m) => m.say).join(' ')} ${c.sources.map(sourceText).join(' ')} ${SECTION_BY_ID[c.section].title}`))],
    [2, has(norm(`${c.moves?.forWhat || ''} ${c.moves?.say || ''} ${c.slideCheck || ''}`))],
    [1, has(norm(c.code))],
  ];
  let score = 0;
  for (const t of terms) {
    const hit = fields.find(([, test]) => test(t));
    if (!hit) return 0;
    score += hit[0];
  }
  return score;
}

const LECTURES = new Set(CARDS.flatMap((c) => c.sources.filter((s) => s.kind === 'lecture').flatMap((s) => (s.lec === 6 ? [6, 7] : [s.lec]))));

export default function CodeLab() {
  const { sub, setSub } = usePortalRoute();
  const [stored, setStored] = useState(() => {
    const t = load('tab', null);
    return SECTION_BY_ID[t] ? t : SECTIONS[0].id;
  });
  const tab = SECTION_BY_ID[sub.split('/')[0]] ? sub.split('/')[0] : stored;
  const [coreOnly, setCoreOnly] = useState(() => load('coreOnly', false) === true);
  const [query, setQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState(null);
  const [stick, setStick] = useState(0);
  const [barH, setBarH] = useState(0);
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const tabRefs = useRef({});

  const goTab = useCallback((id, { focus = false } = {}) => {
    setStored(id);
    save('tab', id);
    setSub(id);
    if (focus) window.requestAnimationFrame(() => tabRefs.current[id]?.focus());
  }, [setSub]);

  const toggleCore = () => {
    setCoreOnly((v) => {
      save('coreOnly', !v);
      return !v;
    });
  };

  // "/" focuses the search from anywhere; Esc (in the search) clears it
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName ?? '';
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
      if (e.key === '/' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the sticky bar sits just under the portal's own sticky topbar; a card
  // scrolled to (index, cross-link) stops just under both
  useEffect(() => {
    const topbar = rootRef.current?.closest('.portal')?.querySelector('.portal__topbar');
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (topbar) setStick(topbar.offsetHeight);
      if (barRef.current) setBarH(barRef.current.offsetHeight);
    });
    if (topbar) ro.observe(topbar);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => document.documentElement.classList.remove('dlc-printing'), []);

  const terms = useMemo(() => norm(query).split(/\s+/).filter(Boolean), [query]);
  const keep = useCallback((c) => !coreOnly || c.rating === 'core', [coreOnly]);

  const results = useMemo(() => {
    if (!terms.length) return [];
    return CARDS.filter(keep)
      .map((c) => ({ c, s: scoreCard(c, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || CARDS.indexOf(a.c) - CARDS.indexOf(b.c))
      .map((r) => r.c);
  }, [terms, keep]);

  // jump to a card (cross-links): open its tab, then scroll to it
  const jumpTo = useCallback((id) => {
    const c = CARDS.find((x) => x.id === id);
    if (!c) return;
    setQuery('');
    goTab(c.section);
    window.setTimeout(() => {
      const el = document.getElementById(`dlc-${id}`);
      // 'instant', not 'auto': the portal's CSS scroll-behavior would smooth 'auto'
      el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }, 60);
  }, [goTab]);

  // ── Export PDF ───────────────────────────────────────────────────────────
  // html.dlc-printing scopes every print rule (./print.js); every tab
  // renders, each code panel is drawn as an image first, and afterprint
  // undoes it all.
  const exportPdf = useCallback(async () => {
    setBusy(true);
    const prevTitle = document.title;
    document.documentElement.classList.add('dlc-printing');
    setPrinting(true);
    const imgs = await preparePrint(rootRef.current);
    setImages(imgs);
    await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 250)));
    try {
      await Promise.all([...(rootRef.current?.querySelectorAll('.dlc-pimg__img') || [])].map((im) => im.decode?.().catch(() => {})));
    } catch {
      /* an undecoded image still prints */
    }
    document.title = 'CITS5017 Code Lab — the exam’s code';
    const after = () => {
      window.removeEventListener('afterprint', after);
      document.title = prevTitle;
      document.documentElement.classList.remove('dlc-printing');
      setPrinting(false);
      setImages(null);
      setBusy(false);
    };
    window.addEventListener('afterprint', after);
    window.print();
  }, []);

  const searching = terms.length > 0;
  const sec = SECTION_BY_ID[tab];
  const shownSections = printing ? SECTIONS : [sec];
  const lectureCount = LECTURES.size;
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const onTabKey = (e, i) => {
    const k = e.key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const n = SECTIONS.length;
    const j = k === 'Home' ? 0 : k === 'End' ? n - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + n) % n;
    goTab(SECTIONS[j].id, { focus: true });
  };

  const renderSection = (s) => {
    const cards = cardsOf(s.id).filter((c) => printing || keep(c));
    return (
      <section key={s.id} className="dlc-sec" id={`dlc-sec-${s.id}`} role={printing ? undefined : 'tabpanel'} aria-labelledby={printing ? undefined : `dlc-tab-${s.id}`} data-sec={s.id}>
        <header className="dlc-sec__head">
          <span className="dlc-sec__no">{String(s.n).padStart(2, '0')}</span>
          <h2 className="dlc-sec__title">{s.title}</h2>
          <span className="dlc-sec__tags">{s.tags.map((t) => <span key={t} className="dlc-src">{t}</span>)}</span>
          <span className="dlc-sec__count">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span>
        </header>
        {/* the tab's cards as a ruled index: any card is two clicks away */}
        {!printing && cards.length > 0 && (
          <ol className="dlc-index" aria-label={`Cards in ${s.title}`}>
            {cards.map((c) => (
              <li key={c.id}>
                <button type="button" className="dlc-index__a" onClick={() => jumpTo(c.id)}>
                  <span className="dlc-index__no">{c.no}</span>
                  <span className="dlc-index__t">{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {s.id === 'labs' ? (
          LAB_PANELS.map((lp) => (
            <LabPanel key={lp.id} lp={lp} cards={lp.cards.map((id) => cards.find((c) => c.id === id)).filter(Boolean)} images={images} onJump={jumpTo} printing={printing} />
          ))
        ) : (
          <div className="dlc-list">
            {cards.map((c) => <Card key={c.id} card={c} image={images?.[c.id]} onJump={jumpTo} printing={printing} />)}
            {!cards.length && <p className="dlc-empty">Every card in this tab is rated useful: switch Core only off to see them.</p>}
          </div>
        )}
      </section>
    );
  };

  return (
    <div ref={rootRef} className={`pt-module dl dlc${printing ? ' dlc--printing' : ''}`} style={{ '--dlc-stick': `${stick}px`, '--dlc-bar': `${barH}px` }}>
      <style>{PRINT_CSS}</style>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="dlc-hero">
        <div className="dlc-hero__main">
          <p className="dlc-hero__kicker">CITS5017 · Deep Learning</p>
          <h2 className="dlc-hero__title">Code Lab</h2>
          <p className="dlc-hero__lead">The code the exam is likely to show you, from the lectures, labs and projects. Read it, then draw it, count it and say what it’s for.</p>
          <p className="dlc-hero__stats">
            <span><b>{CARDS.length}</b> cards</span>
            <span><b>{SECTIONS.length}</b> tabs</span>
            <span><b>{lectureCount}</b> lectures covered</span>
          </p>
        </div>
        <div className="dlc-hero__actions">
          <ExportPdf onExport={exportPdf} busy={busy} />
        </div>
      </header>

      {/* ── Print-only cover ──────────────────────────────────────────── */}
      {printing && (
        <section className="dlc-cover">
          <p className="dlc-cover__date">{today}</p>
          <p className="dlc-cover__lead">
            The CITS5017 exam gives a block of code and asks for a diagram or an explanation. This PDF holds the code most likely to be
            shown: each card has its code panel with numbered marks, a legend quoting each marked piece of code, and the exam moves
            (draw it, count it, the shapes, what it is for). Labs and projects come first. Slide and notebook code is quoted exactly (blank lines aside): a
            trimmed card is an excerpt of its source, and # … marks each gap inside it.
          </p>
          <h2 className="dlc-cover__k">Contents</h2>
          <ol className="dlc-cover__toc">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <span className="dlc-cover__sec">{s.n}. {s.title}</span>
                <span className="dlc-cover__cards">{cardsOf(s.id).map((c) => <span key={c.id}>{fullLabel(c)}</span>)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Sticky tabs + controls ────────────────────────────────────── */}
      <nav ref={barRef} className="dlc-bar" aria-label="Code Lab tabs">
        <div className="dlc-tabs" role="tablist" aria-label="Sections">
          {SECTIONS.map((s, i) => {
            const on = !searching && s.id === tab;
            return (
              <button
                key={s.id}
                ref={(el) => { tabRefs.current[s.id] = el; }}
                id={`dlc-tab-${s.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`dlc-sec-${s.id}`}
                tabIndex={s.id === tab ? 0 : -1}
                className={`dlc-tab${on ? ' dlc-tab--on' : ''}`}
                data-dlc-tab={s.id}
                onClick={() => { setQuery(''); goTab(s.id); }}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <span className="dlc-tab__no">{String(s.n).padStart(2, '0')}</span>
                <span className="dlc-tab__title">{s.title}</span>
                <span className="dlc-tab__tags">{s.tags.join(' · ')}</span>
              </button>
            );
          })}
        </div>
        <label className="dlc-tabsel">
          <span className="dlc-vh">Section</span>
          <select value={tab} onChange={(e) => { setQuery(''); goTab(e.target.value); }}>
            {SECTIONS.map((s) => <option key={s.id} value={s.id}>{String(s.n).padStart(2, '0')} · {s.title} ({s.tags.join(', ')})</option>)}
          </select>
        </label>
        <div className="dlc-ctrl">
          <div className="dlc-search">
            <svg viewBox="0 0 20 20" className="dlc-search__icon" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="12.8" y1="12.8" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              className="dlc-search__input"
              placeholder="Search every tab — try “return_sequences”, “freeze”, “Concatenate”"
              value={query}
              spellCheck={false}
              aria-label="Search every card"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setQuery(''); } }}
            />
            <kbd className="dlc-kbd" aria-hidden="true">/</kbd>
          </div>
          <label className="dlc-core">
            <input type="checkbox" checked={coreOnly} onChange={toggleCore} />
            <span className="dlc-core__box" aria-hidden="true" />
            Core only
          </label>
        </div>
      </nav>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {searching && !printing ? (
        <section className="dlc-sec dlc-results" aria-live="polite">
          <header className="dlc-sec__head">
            <span className="dlc-sec__no">⌕</span>
            <h2 className="dlc-sec__title">{results.length} {results.length === 1 ? 'card matches' : 'cards match'} “{query.trim()}”</h2>
            <span className="dlc-sec__count">from every tab{coreOnly ? ' · core only' : ''}</span>
          </header>
          {results.length ? (
            <div className="dlc-list">
              {results.map((c) => <Card key={c.id} card={c} terms={terms} onJump={jumpTo} tabName={`${String(SECTION_BY_ID[c.section].n).padStart(2, '0')} · ${SECTION_BY_ID[c.section].title}`} />)}
            </div>
          ) : (
            <p className="dlc-empty">No card matches every term. Try one word, a layer name (<code>GRU</code>, <code>Conv2D</code>) or an argument (<code>padding</code>).</p>
          )}
        </section>
      ) : (
        shownSections.map(renderSection)
      )}
    </div>
  );
}
