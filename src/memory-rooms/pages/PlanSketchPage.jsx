/* /memories/b/:id/plan — sketch a place's plan on the phone, for places with no
   floor plan (or to mark its rooms on the floor-plan photo when there is one).
   Rooms are rectangles on a grid: drag one to move it, drag its corner to size
   it, tap to name it. Levels, and which way is north. Every change saves to this
   phone at once and goes up through the outbox (so it works with no signal);
   a sketch with overlapping rooms waits, marked, until it's fixed. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { mediaOf } from '../lib/api.js';
import { DEFAULT_GRID, roomIdFor, uniqueRoomName, validateSketch } from '../building/sketch.js';
import { emptySketch, keepSketchLocal, saveSketch, usePlace } from '../lib/places.js';
import PageMessage from './spot/PageMessage.jsx';

const VIEW = { minW: 10, minD: 8, pad: 2 }; // metres of grid shown around the rooms
const COMPASS = [0, 45, 90, 135, 180, 225, 270, 315];
const snap = (v, g) => Math.round(v / g) * g;
const round3 = (v) => Math.round(v * 1000) / 1000;

export default function PlanSketchPage() {
  const { buildingId } = useParams();
  const p = usePlace(buildingId);
  const copy = COPY.sketch;
  // the sketch being edited: the loaded one until the first change, then this page's own copy
  // (so a reload after an edit never clobbers the edit in progress)
  const [edited, setDraft] = useState(null);
  const loaded = useMemo(() => (p.status === 'ok' ? p.sketch || emptySketch() : null), [p.status, p.sketch]);
  const draft = edited ?? loaded;
  const [level, setLevel] = useState(null);
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState('draw'); // draw | mark (rooms on the floor-plan photo)
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(0);
  const pendingSave = useRef(null);
  const title = p.place?.title || '';
  // only a valid sketch goes up; an invalid one is kept on this phone (and shown) until it is fixed
  const persist = useCallback((next) => (validateSketch(next).ok ? saveSketch(buildingId, next, title) : keepSketchLocal(buildingId, next)), [buildingId, title]);

  const check = useMemo(() => (draft ? validateSketch(draft) : { ok: true, errors: [] }), [draft]);

  // save 600 ms after the last change: this phone first, then the outbox (only a valid sketch goes up)
  const commit = (next) => {
    setDraft(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      pendingSave.current = null;
      await persist(next);
      setSavedAt(Date.now());
    }, 600);
    pendingSave.current = next;
  };
  // leaving within the 600 ms still saves the last change
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (pendingSave.current) persist(pendingSave.current);
    },
    [persist],
  );

  if (p.status === 'missing') return <PageMessage dataState="missing" label={COPY.place.label} title={COPY.place.missingTitle} body={COPY.place.missingBody} />;
  if (p.status === 'error') return <PageMessage dataState="error" label={COPY.place.label} title={COPY.place.errorTitle} retryLabel={COPY.place.retry} onRetry={p.reload} />;
  if (!draft) return <div className="mr-sketch" data-state="loading"><p className="mr-label mr-place__loading">{COPY.place.loading}</p></div>;

  const grid = draft.grid || DEFAULT_GRID;
  const lv = level || draft.levels[0].id;
  const onLevel = draft.rooms.filter((r) => r.level === lv);
  const selected = draft.rooms.find((r) => r.id === sel) || null;
  const planPhoto = mediaOf(p.server, 'plan')[0]?.url || p.files.find((f) => f.type === 'plan')?.url || null;
  const errorsFor = (id) => check.errors.filter((e) => e.path.startsWith(`/rooms/${draft.rooms.findIndex((r) => r.id === id)}/`));

  const setRoom = (id, patch) => commit({ ...draft, rooms: draft.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const addRoom = () => {
    const name = uniqueRoomName(copy.newRoom(draft.rooms.length + 1), draft.rooms.map((r) => r.name));
    const id = roomIdFor(name, draft.rooms.map((r) => r.id));
    // the first free 3 x 3 m spot along the row of existing rooms on this level
    const right = onLevel.filter((r) => r.rect).reduce((m, r) => Math.max(m, r.rect[0] + r.rect[2]), 0);
    commit({ ...draft, rooms: [...draft.rooms, { id, name, level: lv, rect: [right, 0, 3, 3] }] });
    setSel(id);
  };
  const placeRoom = (room) => {
    const right = onLevel.filter((r) => r.rect).reduce((m, r) => Math.max(m, r.rect[0] + r.rect[2]), 0);
    setRoom(room.id, { rect: [right, 0, 3, 3], level: lv });
    setSel(room.id);
  };
  const removeRoom = (id) => {
    commit({ ...draft, rooms: draft.rooms.filter((r) => r.id !== id) });
    setSel(null);
  };
  const addLevel = () => {
    const n = draft.levels.length;
    const id = roomIdFor(n === 1 ? 'upstairs' : `level-${n}`, draft.levels.map((l) => l.id));
    commit({ ...draft, levels: [...draft.levels, { id, name: n === 1 ? copy.upstairs : copy.levelN(n) }] });
    setLevel(id);
  };

  return (
    <div className="mr-sketch" data-state="ok" data-mr="sketch">
      <header className="mr-sketch__head">
        <Link className="mr-stagenav__link" to={paths.place(buildingId)}>
          <span aria-hidden="true">←</span> {p.place?.title || COPY.place.label}
        </Link>
        <h1 className="mr-sketch__title">{copy.title}</h1>
        <p className="mr-sketch__hint">{mode === 'draw' ? copy.hint : copy.markHint}</p>
        <div className="mr-sketch__bar">
          <div className="mr-seg" role="group" aria-label={copy.levels}>
            {draft.levels.map((l) => (
              <button key={l.id} type="button" aria-pressed={l.id === lv} onClick={() => setLevel(l.id)} data-mr="sketch-level">
                {l.name}
              </button>
            ))}
            <button type="button" onClick={addLevel} data-mr="add-level">
              {copy.addLevel}
            </button>
          </div>
          {planPhoto && (
            <div className="mr-seg" role="group" aria-label={copy.modeLabel}>
              <button type="button" aria-pressed={mode === 'draw'} onClick={() => setMode('draw')} data-mr="mode-draw">
                {copy.modeDraw}
              </button>
              <button type="button" aria-pressed={mode === 'mark'} onClick={() => setMode('mark')} data-mr="mode-mark">
                {copy.modeMark}
              </button>
            </div>
          )}
        </div>
      </header>

      {mode === 'draw' ? (
        <SketchGrid rooms={onLevel} grid={grid} selected={sel} invalid={(id) => errorsFor(id).length > 0} onSelect={setSel} onRect={(id, rect) => setRoom(id, { rect })} north={draft.north} />
      ) : (
        <MarkPhoto url={planPhoto} rooms={onLevel} selected={sel} onSelect={setSel} onMark={(id, mark) => setRoom(id, { mark })} />
      )}

      <div className="mr-sketch__panel">
        {!check.ok && (
          <ul className="mr-sketch__errors" data-mr="sketch-errors">
            {check.errors.slice(0, 3).map((e) => (
              <li key={e.path + e.message} className="mr-msg" data-tone="danger">
                {copy.error(draft.rooms[Number(/\/rooms\/(\d+)/.exec(e.path)?.[1])]?.name, e.message)}
              </li>
            ))}
          </ul>
        )}
        {selected ? (
          <section className="mr-sketch__room" data-mr="sketch-room">
            <label className="mr-field">
              <span className="mr-label">{copy.name}</span>
              <EditField key={`${selected.id}-name`} className="mr-input" value={selected.name} maxLength={40} valid={(t) => (t.trim() ? t : null)} onCommit={(name) => setRoom(selected.id, { name })} data-mr="sketch-room-name" />
            </label>
            {selected.rect && mode === 'draw' && (
              <div className="mr-sketch__size">
                {[
                  ['w', 2, copy.width],
                  ['d', 3, copy.depth],
                ].map(([k, i, label]) => (
                  <label key={k} className="mr-field">
                    <span className="mr-label">{label}</span>
                    <EditField
                      key={`${selected.id}-${k}`}
                      className="mr-input"
                      type="number"
                      inputMode="decimal"
                      min={0.5}
                      max={60}
                      step={grid}
                      value={selected.rect[i]}
                      valid={(t) => {
                        const v = Number(t);
                        return t.trim() !== '' && Number.isFinite(v) && v >= 0.5 && v <= 60 ? round3(v) : null;
                      }}
                      onCommit={(v) => {
                        const rect = [...selected.rect];
                        rect[i] = v;
                        setRoom(selected.id, { rect });
                      }}
                      data-mr={`sketch-room-${k}`}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="mr-sketch__roomactions">
              {!selected.rect && mode === 'draw' && (
                <button type="button" className="mr-btn" onClick={() => placeRoom(selected)}>
                  {copy.place}
                </button>
              )}
              <button type="button" className="mr-linkbtn" onClick={() => removeRoom(selected.id)} data-mr="sketch-remove">
                {copy.remove}
              </button>
              <button type="button" className="mr-linkbtn" onClick={() => setSel(null)}>
                {copy.done}
              </button>
            </div>
          </section>
        ) : (
          <div className="mr-sketch__actions">
            <button type="button" className="mr-btn mr-btn--primary mr-btn--lg" onClick={addRoom} data-mr="sketch-add">
              {copy.add}
            </button>
            <label className="mr-field mr-sketch__north">
              <span className="mr-label">{copy.north}</span>
              <select
                className="mr-input"
                value={draft.north ?? ''}
                onChange={(e) => {
                  const next = { ...draft };
                  if (e.target.value === '') delete next.north;
                  else next.north = Number(e.target.value);
                  commit(next);
                }}
                data-mr="sketch-north"
              >
                <option value="">{copy.northUnknown}</option>
                {COMPASS.map((b) => (
                  <option key={b} value={b}>
                    {copy.northAt(b)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {onLevel.some((r) => !r.rect) && mode === 'draw' && (
          <p className="mr-sketch__undrawn">
            <span className="mr-label">{copy.undrawn}</span>{' '}
            {onLevel
              .filter((r) => !r.rect)
              .map((r) => (
                <button key={r.id} type="button" className="mr-linkbtn" onClick={() => setSel(r.id)}>
                  {r.name}
                </button>
              ))}
          </p>
        )}
        <p className="mr-label mr-sketch__saved" data-mr="sketch-saved" aria-live="polite">
          {savedAt ? (check.ok ? copy.saved : copy.savedLocal) : ''}
        </p>
      </div>
    </div>
  );
}

/** The grid: rooms as rectangles in metres. Drag a room to move it, its corner to size it. */
/**
 * An input over a model value that can be emptied and retyped: what's typed shows as typed, and
 * only a valid value (valid(text) !== null) reaches the model; leaving the field shows the model again.
 */
function EditField({ value, valid, onCommit, ...props }) {
  const [text, setText] = useState(null);
  return (
    <input
      {...props}
      value={text ?? String(value)}
      onFocus={() => setText(String(value))}
      onChange={(e) => {
        setText(e.target.value);
        const v = valid(e.target.value);
        if (v !== null) onCommit(v);
      }}
      onBlur={() => setText(null)}
    />
  );
}

/** A name that fits `width` metres at font size `fs` (metres), cut with an ellipsis. */
function fitName(name, width, fs) {
  const max = Math.max(3, Math.floor(width / (fs * 0.52)));
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function SketchGrid({ rooms, grid, selected, invalid, onSelect, onRect, north }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [live, setLive] = useState(null); // { id, rect } while dragging
  const [pxW, setPxW] = useState(390); // the grid's width on screen (so the corner handle stays thumb-sized)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setPxW(el.clientWidth || 390));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const drawn = rooms.filter((r) => r.rect);

  // a view big enough for the rooms (and a little more to drag into), fixed while dragging
  const frame = useMemo(() => {
    let x0 = 0;
    let z0 = 0;
    let x1 = VIEW.minW;
    let z1 = VIEW.minD;
    for (const r of drawn) {
      const [x, z, w, d] = r.rect;
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + w);
      z1 = Math.max(z1, z + d);
    }
    return [x0 - VIEW.pad, z0 - VIEW.pad, x1 - x0 + 2 * VIEW.pad, z1 - z0 + 2 * VIEW.pad];
    // re-frame only when the set of rooms changes, not on every drag step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn.length, drawn.map((r) => r.id).join()]);

  const toPlan = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  };
  const start = (e, room, how) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSelect(room.id);
    drag.current = { id: room.id, how, from: toPlan(e), rect: room.rect };
    setLive({ id: room.id, rect: room.rect });
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const [x, z] = toPlan(e);
    const dx = x - d.from[0];
    const dz = z - d.from[1];
    const [rx, rz, rw, rd] = d.rect;
    const rect =
      d.how === 'move'
        ? [round3(snap(rx + dx, grid)), round3(snap(rz + dz, grid)), rw, rd]
        : [rx, rz, round3(Math.max(0.5, snap(rw + dx, grid))), round3(Math.max(0.5, snap(rd + dz, grid)))];
    setLive({ id: d.id, rect });
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d && live && live.id === d.id && live.rect.join() !== d.rect.join()) onRect(d.id, live.rect);
    setLive(null);
  };

  const [fx, fz, fw, fd] = frame;
  const mPerPx = fw / Math.max(1, pxW);
  // keyboard: Tab to a room, arrows move it by the grid, Shift + arrows size it, Enter picks it
  const onKey = (e, r) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(r.id);
      return;
    }
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    onSelect(r.id);
    const [x, z, w, d] = r.rect;
    const rect = e.shiftKey
      ? [x, z, round3(Math.max(0.5, w + k[0] * grid)), round3(Math.max(0.5, d + k[1] * grid))]
      : [round3(x + k[0] * grid), round3(z + k[1] * grid), w, d];
    onRect(r.id, rect);
  };
  const lines = [];
  for (let x = Math.ceil(fx); x <= fx + fw; x += 1) lines.push(<path key={`x${x}`} d={`M${x} ${fz} V${fz + fd}`} className="mr-sketchgrid__major" />);
  for (let z = Math.ceil(fz); z <= fz + fd; z += 1) lines.push(<path key={`z${z}`} d={`M${fx} ${z} H${fx + fw}`} className="mr-sketchgrid__major" />);

  return (
    <div className="mr-sketchgrid" data-mr="sketch-grid">
      <svg
        ref={svgRef}
        viewBox={`${fx} ${fz} ${fw} ${fd}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={() => onSelect(null)}
        role="group"
        aria-label={COPY.sketch.gridLabel}
        aria-describedby="mr-sketch-keys"
      >
        <defs>
          <pattern id="mr-sketchminor" width={grid} height={grid} patternUnits="userSpaceOnUse">
            <path d={`M${grid} 0 H0 V${grid}`} className="mr-sketchgrid__minor" />
          </pattern>
        </defs>
        <rect x={fx} y={fz} width={fw} height={fd} fill="url(#mr-sketchminor)" />
        {lines}
        {drawn.map((r) => {
          const rect = live?.id === r.id ? live.rect : r.rect;
          const [x, z, w, d] = rect;
          // labels stay readable on a phone: at least 13 px (the size line 11 px), at most a fifth of the room
          const fs = Math.max(13 * mPerPx, Math.min(Math.max(0.42, 15 * mPerPx), Math.min(w, d) / 5));
          const h = Math.max(0.4, 22 * mPerPx); // the corner handle as drawn
          const hit = Math.max(h, 44 * mPerPx); // and its target: at least 44 px for a thumb
          return (
            <g
              key={r.id}
              className="mr-sketchgrid__room"
              data-sel={selected === r.id ? '' : undefined}
              data-invalid={invalid(r.id) ? '' : undefined}
              data-mr="sketch-rect"
              data-id={r.id}
              tabIndex={0}
              role="button"
              aria-pressed={selected === r.id}
              aria-label={`${r.name}, ${COPY.sketch.size(w, d)}`}
              onKeyDown={(e) => onKey(e, r)}
            >
              <rect x={x} y={z} width={w} height={d} onPointerDown={(e) => start(e, r, 'move')} />
              <text x={x + w / 2} y={z + d / 2} fontSize={fs}>
                {fitName(r.name, w - 0.2, fs)}
              </text>
              <text className="mr-sketchgrid__size" x={x + w / 2} y={z + d / 2 + fs * 1.2} fontSize={Math.max(fs * 0.62, 11 * mPerPx)}>
                {COPY.sketch.size(w, d)}
              </text>
              {selected === r.id && (
                <>
                  <rect className="mr-sketchgrid__handle" x={x + w - h / 2} y={z + d - h / 2} width={h} height={h} pointerEvents="none" />
                  <rect className="mr-sketchgrid__hit" x={x + w - hit / 2} y={z + d - hit / 2} width={hit} height={hit} fill="transparent" onPointerDown={(e) => start(e, r, 'size')} data-mr="sketch-handle" />
                </>
              )}
            </g>
          );
        })}
        {north != null && (
          <g className="mr-planview__north" transform={`translate(${fx + fw - 0.7} ${fz + 0.8}) rotate(${-north})`}>
            <path d="M0 -0.45 L0.2 0.3 L0 0.17 L-0.2 0.3 Z" />
            <text y="-0.55" fontSize="0.28">
              {COPY.titleBlock.north}
            </text>
          </g>
        )}
      </svg>
      <p className="mr-visually-hidden" id="mr-sketch-keys">
        {COPY.sketch.keys}
      </p>
    </div>
  );
}

/** The floor-plan photo: tap a room, then tap where it is on the photo. */
function MarkPhoto({ url, rooms, selected, onSelect, onMark }) {
  const ref = useRef(null);
  const tap = (e) => {
    if (!selected) return;
    const r = ref.current.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    onMark(selected, { photo: 1, u: round3(u), v: round3(v) });
  };
  return (
    <div className="mr-markphoto" data-mr="mark-photo">
      <div className="mr-markphoto__frame" ref={ref} onClick={tap} role="presentation">
        <img src={url} alt={COPY.place.planPhotoAlt} draggable={false} />
        {rooms
          .filter((r) => r.mark)
          .map((r) => (
            <span key={r.id} className="mr-planphoto__mark" data-sel={selected === r.id ? '' : undefined} style={{ left: `${r.mark.u * 100}%`, top: `${r.mark.v * 100}%` }}>
              <span className="mr-planphoto__name">{r.name}</span>
            </span>
          ))}
      </div>
      <ul className="mr-markphoto__rooms">
        {rooms.map((r) => (
          <li key={r.id}>
            <button type="button" className="mr-linkbtn" aria-pressed={selected === r.id} onClick={() => onSelect(r.id)} data-mr="mark-room">
              {r.name}
              {r.mark ? ' ·' : ''}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
