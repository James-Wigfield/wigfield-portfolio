/* The list beside (desktop) or under (phone) the map, set like an archive's index and grouped
   by collection (CONTRACTS.md 7): each collection a ruled section with its name in the serif and
   how many places and spots it holds, collapsible (remembered per viewer), "Ungrouped" last.
   Inside a section: its whole places first (their room checklist's progress), then its spots,
   newest first ("No. 004", the rendered room's cut-out standing on the paper, or a small print
   of its first photo until it's built, the title in the serif, place and date).

   Picking a collection's name selects it: the map flies to its spots and "Play" plays them.
   The WHOLE list is one scroll container (`.mr-list`): on a phone it is the only thing under
   the map that scrolls, so every row, places included, can be reached and tapped. Hovering a
   spot row lifts its marker on the map. */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { mediaNamed } from '../lib/api.js';
import { readLocal, writeLocal } from '../lib/storage.js';
import { personName, placeOf, thumbOf } from '../lib/spots.js';
import { spotDate } from '../lib/sheets.js';
import { paths } from '../routes.js';
import { markerImage, useMarkerImages } from './markerImages.js';
import CollectionEdit from './CollectionEdit.jsx';

const COLLAPSED_KEY = 'mr:collapsed';
const UNGROUPED = 'none';

function readCollapsed() {
  try {
    const v = JSON.parse(readLocal(COLLAPSED_KEY, '[]'));
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function SpotRow({ spot, n, selected, onSelect, onHover }) {
  useMarkerImages(); // re-render when a shrunk hero arrives
  // the cut-out: render/marker, else the hero trimmed in the browser (the map's markers share it)
  const stored = mediaNamed(spot, 'render', 'marker');
  const made = !stored && spot.status === 'rendered' ? markerImage(spot) : null;
  const marker = stored || made;
  const th = marker ? null : thumbOf(spot);
  return (
    <button
      type="button"
      className="mr-row"
      data-mr="spot-row"
      data-id={spot.id}
      aria-pressed={selected}
      onClick={() => onSelect(spot.id)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(spot.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(spot.id)}
      onBlur={() => onHover(null)}
    >
      <span className="mr-row-no" data-mr="row-no">
        {n ? COPY.list.no(n) : ''}
      </span>
      <span className="mr-row-cut" data-kind={marker ? 'marker' : th ? 'print' : 'none'}>
        {marker ? <img src={marker.url} alt="" loading="lazy" /> : th ? <img src={th.url} alt="" loading="lazy" /> : null}
      </span>
      <span className="mr-row-main">
        <span className="mr-row-title">{spot.title}</span>
        <span className="mr-row-sub">
          <span className="mr-dot" data-status={spot.status} aria-hidden="true" />
          {[placeOf(spot), COPY.list.day(spotDate(spot))].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="mr-row-side">
        <span className="mr-dot" data-status={spot.status}>
          {COPY.app.status[spot.status] || spot.status}
        </span>
        <span className="mr-label">{personName(spot.createdBy)}</span>
      </span>
    </button>
  );
}

function PlaceRow({ place, spots }) {
  const rooms = place.sketch?.rooms || [];
  const ids = new Set(rooms.map((r) => r.id));
  const done = new Set(spots.filter((s) => s.buildingId === place.id && s.roomId && ids.has(s.roomId)).map((s) => s.roomId)).size;
  return (
    <Link className="mr-row mr-placerow" to={paths.place(place.id)} data-mr="place-row" data-id={place.id}>
      <svg className="mr-placerow__glyph" viewBox="0 0 56 44" aria-hidden="true">
        <path d="M6 38 V8 H50 V38 Z" />
        <path d="M28 8 V24 H50 M6 24 H20 M28 30 V38" />
      </svg>
      <span className="mr-row-main">
        <span className="mr-row-title">{place.title || COPY.place.label}</span>
        <span className="mr-row-sub">
          {[place.placeLabel, COPY.place.progress(done, rooms.length), place.local ? COPY.place.onPhone : null].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M5 3.5 9.5 8 5 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * groups: [{ id (collection id, or null = Ungrouped), collection, places, spots }] in display order.
 * allSpots: every spot (a place row counts its captured rooms from them).
 * selectedCollection: the picked collection's id (or null); onPickCollection(group | null).
 */
export default function SpotList({ groups, allSpots, selectedId, onSelect, onHover = () => {}, numbers, selectedCollection = null, onPickCollection = () => {}, onCollectionsChanged = () => {}, canEdit = true }) {
  const ref = useRef(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [editing, setEditing] = useState(null); // a collection id, or 'new'

  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeLocal(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });

  // the section holding the selected spot opens while it is selected (not remembered)
  const holding = selectedId ? groups.find((g) => g.spots.some((s) => s.id === selectedId)) : null;
  const holdingKey = holding ? holding.id || UNGROUPED : null;

  // Keep the selected row in view when the selection comes from the map.
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const row = ref.current.querySelector(`[data-mr="spot-row"][data-id="${CSS.escape(selectedId)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, holdingKey]);

  const row = (s) => (
    <li key={s.id}>
      <SpotRow spot={s} n={numbers?.get(s.id)} selected={s.id === selectedId} onSelect={onSelect} onHover={onHover} />
    </li>
  );

  return (
    <div className="mr-list" ref={ref} data-mr="spot-list">
      {groups.map((g) => {
        const key = g.id || UNGROUPED;
        const open = !collapsed.has(key) || key === holdingKey;
        const count = g.places.length + g.spots.length;
        const picked = Boolean(g.id) && g.id === selectedCollection;
        const bodyId = `mr-coll-${key}`;
        const name = g.collection ? g.collection.name : COPY.collections.ungrouped;
        return (
          <section key={key} className="mr-coll" data-mr="collection" data-id={key} data-open={open ? '' : undefined} data-picked={picked ? '' : undefined}>
            {editing === g.id && g.collection ? (
              <CollectionEdit
                collection={g.collection}
                count={count}
                onDone={(changed) => {
                  setEditing(null);
                  if (changed) onCollectionsChanged(changed);
                }}
              />
            ) : (
              <div className="mr-coll-head">
                <button
                  type="button"
                  className="mr-coll-toggle"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  aria-label={open ? COPY.collections.collapse(name) : COPY.collections.expand(name)}
                  onClick={() => toggle(key)}
                  data-mr="collection-toggle"
                >
                  <Chevron />
                </button>
                {g.id ? (
                  <button
                    type="button"
                    className="mr-coll-name"
                    aria-pressed={picked}
                    onClick={() => {
                      if (!open) toggle(key);
                      onPickCollection(picked ? null : g);
                    }}
                    title={picked ? COPY.collections.unpickLabel(name) : COPY.collections.pickLabel(name)}
                    data-mr="collection-head"
                  >
                    <span className="mr-coll-title">{name}</span>
                    {picked && <span className="mr-dot" data-status="rendered">{COPY.collections.picked}</span>}
                  </button>
                ) : (
                  <span className="mr-coll-name mr-coll-name--plain">
                    <span className="mr-coll-title">{name}</span>
                  </span>
                )}
                <span className="mr-label mr-coll-count" data-mr="collection-count">
                  {COPY.collections.count(g.places.length, g.spots.length)}
                </span>
                {g.id && canEdit && (
                  <button type="button" className="mr-linkbtn mr-coll-edit" onClick={() => setEditing(g.id)} data-mr="collection-edit">
                    {COPY.collections.edit}
                  </button>
                )}
              </div>
            )}
            {open && (
              <ul className="mr-list-rows" id={bodyId}>
                {g.places.map((p) => (
                  <li key={`p-${p.id}`}>
                    <PlaceRow place={p} spots={allSpots} />
                  </li>
                ))}
                {g.spots.map(row)}
                {!count && <li className="mr-coll-empty">{COPY.collections.empty}</li>}
              </ul>
            )}
          </section>
        );
      })}
      {canEdit && (
        <div className="mr-coll-new">
          {editing === 'new' ? (
            <CollectionEdit
              onDone={(changed) => {
                setEditing(null);
                if (changed) onCollectionsChanged(changed);
              }}
            />
          ) : (
            <button type="button" className="mr-linkbtn" onClick={() => setEditing('new')} data-mr="collection-new">
              {COPY.collections.newLink}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
