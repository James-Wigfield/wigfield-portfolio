import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import DeckCanvas from './DeckCanvas';
import DeckEditor from './DeckEditor';
import { CANVAS, SAMPLE_DECK } from './deckModel';
import { listPresentations } from '../data/presentationsApi';

// A fresh blank deck for the "New deck" action (saved via POST on first save).
function blankDeck() {
  const sid = crypto?.randomUUID ? crypto.randomUUID() : `s${Date.now()}`;
  return { title: 'New deck', dateLabel: '', canvas: { ...CANVAS }, slides: [{ id: sid, background: { type: 'color', color: 'token:surface' }, elements: [] }] };
}

/* ============================================================================
   DECK STUDIO — dynamic, AI-built slide decks  (Personal)
   ----------------------------------------------------------------------------
   Sister to the University "Presentations" tab, but the decks here are DATA, not
   hand-authored JSX: Claude builds a deck through the portal MCP server → it's
   stored in Supabase as JSON → it appears here as a tab. Every element is a
   positioned layer (rendered by DeckCanvas), so the in-portal editor (later) can
   let you drag/resize/edit them.

   The stage shell (16:9 frame, full-screen, prev/next, dots, keyboard) is shared
   with the Presentations tab via the .pres-* classes; the slide CONTENT is the
   scaled deck canvas (.dc-*). Falls back to a built-in sample deck when the
   backend has no decks yet or isn't reachable (plain `vite` dev has no Worker).
   ========================================================================== */

// Supabase row → a renderable deck entry.
function rowToEntry(row) {
  const deck = row.deck || {};
  return {
    id: row.id,
    title: row.title || deck.title || 'Untitled deck',
    dateLabel: row.dateLabel || deck.dateLabel || '',
    canvas: deck.canvas || CANVAS,
    slides: deck.slides || [],
  };
}

export default function DeckStudio() {
  const [decks, setDecks] = useState(null);        // null until first load resolves
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'sample' | 'error'
  const [note, setNote] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [idx, setIdx] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [editorDeck, setEditorDeck] = useState(null); // non-null → editing
  const stageRef = useRef(null);

  // Load decks. setState only ever runs inside the async continuation (not
  // synchronously in the effect), satisfying react-hooks/set-state-in-effect.
  const load = useCallback((cancelledRef) =>
    listPresentations().then(({ data, error }) => {
      if (cancelledRef?.current) return;
      if (error) {
        setDecks([SAMPLE_DECK]);
        setStatus('sample');
        setNote(`Showing the sample deck — ${error.message}`);
      } else if (!data || data.length === 0) {
        setDecks([SAMPLE_DECK]);
        setStatus('sample');
        setNote('No decks yet. Ask Claude to build one via the portal MCP, then hit refresh.');
      } else {
        setDecks(data.map(rowToEntry));
        setStatus('ready');
        setNote('');
      }
    }), []);

  useEffect(() => {
    const cancelledRef = { current: false };
    load(cancelledRef);
    return () => { cancelledRef.current = true; };
  }, [load]);

  const refresh = () => { setStatus('loading'); load(); };

  // Track full-screen state for the toggle icon/label.
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const activeDeck = decks?.find((d) => d.id === activeId) ?? decks?.[0] ?? null;
  const slides = activeDeck?.slides ?? [];
  const count = slides.length;
  const safeIdx = Math.min(idx, Math.max(0, count - 1));
  const slide = slides[safeIdx];

  const goto = useCallback((i) => setIdx((prev) => {
    const next = Math.min(count - 1, Math.max(0, i));
    return next === prev ? prev : next;
  }), [count]);
  const go = useCallback((n) => setIdx((prev) => Math.min(count - 1, Math.max(0, prev + n))), [count]);

  const pickDeck = (id) => { setActiveId(id); setIdx(0); };

  // After an editor save: exit, select the saved deck, reload from the backend.
  const handleSaved = (savedId) => {
    setEditorDeck(null);
    if (savedId) { setActiveId(savedId); setIdx(0); }
    setStatus('loading');
    load();
  };

  const toggleFs = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      const req = el.requestFullscreen?.();
      if (req?.then) req.then(() => el.focus?.()).catch(() => {});
      else el.focus?.();
    }
  }, []);

  const onKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ': e.preventDefault(); go(1); break;
      case 'ArrowLeft':
      case 'PageUp': e.preventDefault(); go(-1); break;
      case 'Home': e.preventDefault(); goto(0); break;
      case 'End': e.preventDefault(); goto(count - 1); break;
      case 'f':
      case 'F': e.preventDefault(); toggleFs(); break;
      default: break;
    }
  }, [go, goto, count, toggleFs]);

  return (
    <div className="pt-module pres ds">
      <div>
        <p className="pres-kicker">Personal · Deck Studio</p>
        <p className="pt-module__intro">
          AI-built, editable slide decks. Ask Claude to “build a deck on …” through the portal MCP server — it’s
          saved to Supabase and shows up here as a tab. Step through with the arrows or on-screen controls, and
          present it in full screen. <kbd>F</kbd> toggles full screen; <kbd>←</kbd>/<kbd>→</kbd> change slides.
        </p>
      </div>

      {editorDeck ? (
        <DeckEditor deck={editorDeck} onDone={handleSaved} onCancel={() => setEditorDeck(null)} />
      ) : (
      <>
      {/* ── Toolbar: deck tabs + actions ──────────────────────────────── */}
      <div className="ds-toolbar">
        <div className="pres-tabs ds-tabs" role="tablist" aria-label="Decks">
          {(decks ?? []).map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === activeDeck?.id}
              className={`pres-tab${d.id === activeDeck?.id ? ' pres-tab--active' : ''}`}
              onClick={() => pickDeck(d.id)}
              title={d.title}
            >
              <span className="pres-tab__dot" aria-hidden="true" />
              {d.dateLabel ? `${d.title} · ${d.dateLabel}` : d.title}
            </button>
          ))}
        </div>
        <div className="ds-actions">
          <button className="pres-btn" onClick={() => setEditorDeck(blankDeck())}>
            <Icon name="edit" size={14} /><span className="pres-btn__label">New</span>
          </button>
          <button className="pres-btn" onClick={() => setEditorDeck(activeDeck)} disabled={!activeDeck}>
            <Icon name="edit" size={14} /><span className="pres-btn__label">Edit</span>
          </button>
          <button className="pres-btn" onClick={refresh} disabled={status === 'loading'}>
            <Icon name="swap" size={15} />
            <span className="pres-btn__label">{status === 'loading' ? 'Loading…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {note && (
        <p className="ds-note">
          {status === 'sample' && <span className="ds-note__badge">SAMPLE</span>}
          {note}
          {status === 'sample' && ' Editing it saves a real copy.'}
        </p>
      )}

      {/* ── Stage (the full-screen target) ────────────────────────────── */}
      <div
        className={`pres-stage${isFs ? ' pres-stage--fs' : ''}`}
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="slide presentation"
        aria-label={activeDeck ? `${activeDeck.title} — slide ${safeIdx + 1} of ${count}` : 'Deck'}
      >
        <div className="pres-screen">
          {slide
            ? <DeckCanvas slide={slide} canvas={activeDeck?.canvas || CANVAS} />
            : <p className="pt-loading dc-empty">{decks ? 'This deck has no slides.' : 'Loading decks…'}</p>}
        </div>

        <div className="pres-controls">
          <button className="pres-btn" onClick={() => go(-1)} disabled={safeIdx === 0 || !count} aria-label="Previous slide">
            <Icon name="arrowLeft" size={16} />
          </button>

          <div className="pres-dots" role="tablist" aria-label="Slides">
            {slides.map((s, i) => (
              <button
                key={s.id || i}
                className={`pres-dot${i === safeIdx ? ' pres-dot--active' : ''}`}
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === safeIdx ? 'true' : undefined}
              />
            ))}
          </div>

          <span className="pres-counter">{count ? safeIdx + 1 : 0} / {count}</span>

          <button className="pres-btn" onClick={() => go(1)} disabled={safeIdx >= count - 1 || !count} aria-label="Next slide">
            <Icon name="arrowRight" size={16} />
          </button>

          <button className="pres-btn pres-btn--fs" onClick={toggleFs} aria-label={isFs ? 'Exit full screen' : 'Enter full screen'}>
            <Icon name={isFs ? 'compress' : 'expand'} size={16} />
            <span className="pres-btn__label">{isFs ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
