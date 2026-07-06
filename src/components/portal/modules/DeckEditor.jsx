import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import DeckCanvas from './DeckCanvas';
import { useFitScale } from './useFitScale';
import { CANVAS, resolveColor } from './deckModel';
import { renderMarkdown } from './markdownLite';
import { createPresentation, updatePresentation } from '../data/presentationsApi';

/* ============================================================================
   DeckEditor — in-portal drag/resize/edit for a deck (Phase 3)
   ----------------------------------------------------------------------------
   Edits the SAME positioned-layer model the MCP produces and DeckCanvas renders,
   so Claude can build a deck and you can then fine-tune it here. Three columns:
   a slide rail (thumbnails + add/reorder/delete), the editable canvas (select,
   drag, resize, keyboard-nudge), and an inspector (markdown + style + geometry).
   Save writes back through the Worker (PUT for a real deck; POST when editing the
   built-in sample, which has no row yet).

   Coordinates are canvas units in the fixed 1280×720 space; the canvas is scaled
   to fit (shared useFitScale), and pointer deltas are divided by that scale.
   ========================================================================== */

const MIN = 40;                       // min element size (canvas units)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id${Date.now()}${Math.floor(Math.random() * 1e6)}`);

// Resize handles: position (%) + which edges each moves.
const HANDLES = [
  { k: 'nw', x: 0, y: 0, l: true, t: true, cur: 'nwse' },
  { k: 'n', x: 50, y: 0, t: true, cur: 'ns' },
  { k: 'ne', x: 100, y: 0, r: true, t: true, cur: 'nesw' },
  { k: 'e', x: 100, y: 50, r: true, cur: 'ew' },
  { k: 'se', x: 100, y: 100, r: true, b: true, cur: 'nwse' },
  { k: 's', x: 50, y: 100, b: true, cur: 'ns' },
  { k: 'sw', x: 0, y: 100, l: true, b: true, cur: 'nesw' },
  { k: 'w', x: 0, y: 50, l: true, cur: 'ew' },
];

const COLOR_PRESETS = [
  { label: 'Ink', v: 'token:ink' },
  { label: 'Body', v: 'token:ink-2' },
  { label: 'Muted', v: 'token:ink-3' },
  { label: 'Accent', v: 'token:accent' },
  { label: 'Accent ink', v: 'token:accent-ink' },
];

export default function DeckEditor({ deck, onDone, onCancel }) {
  const [title, setTitle] = useState(deck.title || 'Untitled deck');
  const [dateLabel, setDateLabel] = useState(deck.dateLabel || '');
  // Deep-ish copy of slides so edits don't mutate the loaded deck until saved.
  const [slides, setSlides] = useState(() => JSON.parse(JSON.stringify(deck.slides || [])));
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [saveError, setSaveError] = useState('');

  const canvas = deck.canvas || CANVAS;
  const { ref, s, left, top } = useFitScale(canvas);
  const scaleRef = useRef(1);
  scaleRef.current = s || 1;
  const dragRef = useRef(null);

  const idx = Math.min(slideIdx, Math.max(0, slides.length - 1));
  const current = slides[idx];
  const selected = current?.elements.find((e) => e.id === selectedId) || null;

  // ── mutations ──────────────────────────────────────────────────────────
  const patchSlides = useCallback((fn) => { setSlides((prev) => fn(prev)); setDirty(true); }, []);

  const updateEl = useCallback((elId, patch) => {
    patchSlides((prev) => prev.map((sl, i) => (i !== idx ? sl : {
      ...sl,
      elements: sl.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)),
    })));
  }, [idx, patchSlides]);

  const updateStyle = useCallback((elId, stylePatch) => {
    patchSlides((prev) => prev.map((sl, i) => (i !== idx ? sl : {
      ...sl,
      elements: sl.elements.map((e) => (e.id === elId ? { ...e, style: { ...e.style, ...stylePatch } } : e)),
    })));
  }, [idx, patchSlides]);

  const addText = () => {
    const maxZ = Math.max(0, ...(current?.elements || []).map((e) => e.z || 0));
    const el = { id: uid(), type: 'text', x: 340, y: 300, w: 600, h: 130, z: maxZ + 1, markdown: 'New text', style: { fontSize: 32, align: 'left', color: 'token:ink' } };
    patchSlides((prev) => prev.map((sl, i) => (i !== idx ? sl : { ...sl, elements: [...sl.elements, el] })));
    setSelectedId(el.id);
  };

  const deleteEl = (elId) => {
    patchSlides((prev) => prev.map((sl, i) => (i !== idx ? sl : { ...sl, elements: sl.elements.filter((e) => e.id !== elId) })));
    setSelectedId((cur) => (cur === elId ? null : cur));
  };

  const restack = (elId, toFront) => {
    const zs = (current?.elements || []).map((e) => e.z || 0);
    updateEl(elId, { z: toFront ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1 });
  };

  const addSlide = () => {
    const blank = { id: uid(), background: { type: 'color', color: 'token:surface' }, elements: [] };
    patchSlides((prev) => [...prev.slice(0, idx + 1), blank, ...prev.slice(idx + 1)]);
    setSelectedId(null);
    setSlideIdx(idx + 1);
  };

  const deleteSlide = (i) => {
    if (slides.length <= 1) return;
    patchSlides((prev) => prev.filter((_, j) => j !== i));
    setSelectedId(null);
    setSlideIdx((cur) => clamp(cur > i ? cur - 1 : cur, 0, slides.length - 2));
  };

  const moveSlide = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    patchSlides((prev) => { const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next; });
    setSlideIdx(j);
  };

  // ── drag / resize (pointer, delta ÷ scale) ───────────────────────────────
  const startMove = (e, elId) => {
    e.stopPropagation();
    setSelectedId(elId);
    const el = current.elements.find((x) => x.id === elId);
    dragRef.current = { mode: 'move', elId, sx: e.clientX, sy: e.clientY, box: { x: el.x, y: el.y, w: el.w, h: el.h } };
  };
  const startResize = (e, elId, hd) => {
    e.stopPropagation();
    setSelectedId(elId);
    const el = current.elements.find((x) => x.id === elId);
    dragRef.current = { mode: 'resize', hd, elId, sx: e.clientX, sy: e.clientY, box: { x: el.x, y: el.y, w: el.w, h: el.h } };
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const sc = scaleRef.current || 1;
      const dx = (e.clientX - d.sx) / sc;
      const dy = (e.clientY - d.sy) / sc;
      const b = d.box;
      if (d.mode === 'move') {
        updateEl(d.elId, {
          x: Math.round(clamp(b.x + dx, 0, canvas.w - b.w)),
          y: Math.round(clamp(b.y + dy, 0, canvas.h - b.h)),
        });
      } else {
        const hd = d.hd;
        let { x, y, w, h } = b;
        if (hd.l) { const nw = Math.max(MIN, b.w - dx); x = b.x + (b.w - nw); w = nw; }
        else if (hd.r) { w = Math.max(MIN, b.w + dx); }
        if (hd.t) { const nh = Math.max(MIN, b.h - dy); y = b.y + (b.h - nh); h = nh; }
        else if (hd.b) { h = Math.max(MIN, b.h + dy); }
        updateEl(d.elId, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [updateEl, canvas.w, canvas.h]);

  // Keyboard: nudge / delete / deselect (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'Escape') { setSelectedId(null); return; }
      if (!selectedId || !selected) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); updateEl(selectedId, { x: Math.round(clamp(selected.x - step, 0, canvas.w - selected.w)) }); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); updateEl(selectedId, { x: Math.round(clamp(selected.x + step, 0, canvas.w - selected.w)) }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); updateEl(selectedId, { y: Math.round(clamp(selected.y - step, 0, canvas.h - selected.h)) }); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); updateEl(selectedId, { y: Math.round(clamp(selected.y + step, 0, canvas.h - selected.h)) }); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteEl(selectedId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected, idx, canvas.w, canvas.h]);

  // ── save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaveState('saving');
    setSaveError('');
    const builtDeck = { version: deck.version || 1, title, dateLabel, canvas, slides };
    const isNew = deck.isSample || deck.id === 'sample' || !deck.id;
    const res = isNew
      ? await createPresentation({ title, dateLabel, deck: builtDeck })
      : await updatePresentation(deck.id, { title, dateLabel, deck: builtDeck });
    if (res.error) { setSaveState('error'); setSaveError(res.error.message); return; }
    setSaveState('idle');
    setDirty(false);
    onDone?.(isNew ? res.data?.id : deck.id);
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onCancel?.();
  };

  const invS = 1 / (s || 1);

  return (
    <div className="de">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="de-bar">
        <input className="de-input de-input--title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Deck title" />
        <input className="de-input de-input--date" value={dateLabel} onChange={(e) => { setDateLabel(e.target.value); setDirty(true); }} placeholder="Tab label (optional)" />
        <div className="de-bar__spacer" />
        <button className="pres-btn" onClick={addText}><Icon name="edit" size={14} /><span className="pres-btn__label">Text</span></button>
        <button className="pres-btn" onClick={addSlide}><Icon name="deck" size={14} /><span className="pres-btn__label">Slide</span></button>
        <button className="pres-btn" onClick={cancel}>Cancel</button>
        <button className="pres-btn pres-btn--fs" onClick={save} disabled={saveState === 'saving'}>
          <Icon name="check" size={14} /><span className="pres-btn__label">{saveState === 'saving' ? 'Saving…' : 'Save'}</span>
        </button>
      </div>
      {saveError && <p className="ds-note"><span className="ds-note__badge">ERROR</span>{saveError}</p>}

      <div className="de-main">
        {/* ── Slide rail ────────────────────────────────────────────── */}
        <div className="de-rail">
          {slides.map((sl, i) => (
            <div key={sl.id || i} className={`de-thumb${i === idx ? ' de-thumb--active' : ''}`}>
              <button className="de-thumb__canvas" onClick={() => { setSlideIdx(i); setSelectedId(null); }} aria-label={`Edit slide ${i + 1}`}>
                <span className="de-thumb__n">{i + 1}</span>
                <div className="de-thumb__mini"><DeckCanvas slide={sl} canvas={canvas} /></div>
              </button>
              <div className="de-thumb__ctrls">
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0} aria-label="Move slide up">↑</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} aria-label="Move slide down">↓</button>
                <button onClick={() => deleteSlide(i)} disabled={slides.length <= 1} aria-label="Delete slide">✕</button>
              </div>
            </div>
          ))}
          <button className="de-addslide" onClick={addSlide}>+ Add slide</button>
        </div>

        {/* ── Editable canvas ───────────────────────────────────────── */}
        <div className="de-stagewrap">
          <div className="de-stage2" ref={ref} onPointerDown={() => setSelectedId(null)}>
            <div
              className="dc-canvas de-canvas"
              style={{
                width: canvas.w, height: canvas.h,
                transform: `translate(${left}px, ${top}px) scale(${s})`,
                background: current?.background?.type === 'color' ? resolveColor(current.background.color) : undefined,
                visibility: s ? 'visible' : 'hidden',
              }}
            >
              {[...(current?.elements || [])].sort((a, b) => (a.z || 0) - (b.z || 0)).map((el) => {
                const st = el.style || {};
                const sel = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    className={`de-el${sel ? ' de-el--sel' : ''}`}
                    style={{
                      left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z || 0,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      outlineWidth: sel ? `${Math.max(1, 2 * invS)}px` : undefined,
                    }}
                    onPointerDown={(e) => startMove(e, el.id)}
                  >
                    <div
                      className="de-el__content"
                      style={{
                        fontSize: st.fontSize ? `${st.fontSize}px` : undefined,
                        textAlign: st.align || 'left',
                        color: resolveColor(st.color),
                        background: resolveColor(st.bg),
                      }}
                    >
                      <div className="dc-md">{renderMarkdown(el.markdown)}</div>
                    </div>
                    {sel && HANDLES.map((hd) => (
                      <span
                        key={hd.k}
                        className="de-handle"
                        style={{
                          left: `${hd.x}%`, top: `${hd.y}%`,
                          width: `${14 * invS}px`, height: `${14 * invS}px`,
                          borderWidth: `${Math.max(1, 1.5 * invS)}px`,
                          cursor: `${hd.cur}-resize`,
                        }}
                        onPointerDown={(e) => startResize(e, el.id, hd)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="de-hint">Drag to move · handles to resize · arrows to nudge (Shift = 10px) · Delete to remove · Esc to deselect</p>
        </div>

        {/* ── Inspector ─────────────────────────────────────────────── */}
        <div className="de-inspector">
          {!selected ? (
            <p className="de-inspector__empty">Select a text box to edit it, or add one with <b>Text</b>.</p>
          ) : (
            <>
              <label className="de-field">
                <span>Text (markdown)</span>
                <textarea className="de-textarea" value={selected.markdown} onChange={(e) => updateEl(selected.id, { markdown: e.target.value })} rows={5} />
              </label>

              <label className="de-field">
                <span>Font size</span>
                <input type="number" min="8" max="220" value={selected.style?.fontSize ?? 32}
                  onChange={(e) => updateStyle(selected.id, { fontSize: clamp(+e.target.value || 0, 8, 220) })} />
              </label>

              <div className="de-field">
                <span>Align</span>
                <div className="de-seg">
                  {['left', 'center', 'right'].map((a) => (
                    <button key={a} className={`de-seg__b${(selected.style?.align || 'left') === a ? ' de-seg__b--on' : ''}`}
                      onClick={() => updateStyle(selected.id, { align: a })}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div className="de-field">
                <span>Colour</span>
                <div className="de-swatches">
                  {COLOR_PRESETS.map((c) => (
                    <button key={c.v} className={`de-swatch${selected.style?.color === c.v ? ' de-swatch--on' : ''}`}
                      style={{ background: resolveColor(c.v) }} title={c.label} aria-label={c.label}
                      onClick={() => updateStyle(selected.id, { color: c.v })} />
                  ))}
                </div>
              </div>

              <div className="de-field">
                <span>Position &amp; size</span>
                <div className="de-grid4">
                  {['x', 'y', 'w', 'h'].map((k) => (
                    <label key={k}><em>{k}</em>
                      <input type="number" value={Math.round(selected[k])}
                        onChange={(e) => {
                          const v = +e.target.value || 0;
                          if (k === 'x') updateEl(selected.id, { x: clamp(v, 0, canvas.w - selected.w) });
                          else if (k === 'y') updateEl(selected.id, { y: clamp(v, 0, canvas.h - selected.h) });
                          else if (k === 'w') updateEl(selected.id, { w: clamp(v, MIN, canvas.w) });
                          else updateEl(selected.id, { h: clamp(v, MIN, canvas.h) });
                        }} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="de-inspector__row">
                <button className="pres-btn" onClick={() => restack(selected.id, true)}>Front</button>
                <button className="pres-btn" onClick={() => restack(selected.id, false)}>Back</button>
                <button className="pres-btn de-del" onClick={() => deleteEl(selected.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
