/* /memories: the map (hero) and the list. Desktop: map + side column. Phone: the map on
   top and the list below it scrolling on its own (never one long page); the spot card
   docks at the bottom.

   The map opens on the home view (map/start.js: Perth). The list is grouped by collection
   (CONTRACTS.md 7); picking a collection flies the map to its spots and places, and "Play"
   flies through its spots in capture order (hidden while no collection is picked).
   ?c=<collectionId> opens with that collection picked; ?play=1 plays it straight away. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { useMedia } from '../lib/useMedia.js';
import Filters from '../map/Filters.jsx';
import { rememberSpots, sheetNumbers } from '../lib/sheets.js';
import { effectiveCollection, useCollections } from '../lib/collections.js';
import { usePlaces } from '../lib/places.js';
import SpotList from '../map/SpotList.jsx';
import SpotsMap from '../map/SpotsMap.jsx';
import { hasCoords } from '../map/geo.js';
import { useSpots } from '../map/useSpots.js';
import { PlayButton } from '../map/flyover/FlyoverOverlay.jsx';
import { flightLegs, flightStops } from '../map/flyover/plan.js';
import { useFlyover } from '../map/flyover/useFlyover.js';
import { boundsOf } from '../map/mapbox/project.js';

/** A collection's map frame: its own bounds, else its spots' and places' (a lone point gets ~1 km round it). */
function frameOf(group) {
  if (group.collection?.bounds) return group.collection.bounds;
  const pts = [...group.spots, ...group.places].filter(hasCoords);
  if (!pts.length) return null;
  const [[w, s], [e, n]] = boundsOf(pts);
  const pad = 0.006;
  return [
    [w - pad, s - pad],
    [e + pad, n + pad],
  ];
}

function StateBlock({ title, body, action }) {
  return (
    <div className="mr-state">
      {title && <p className="mr-state-title">{title}</p>}
      {body && <p className="mr-state-body">{body}</p>}
      {action}
    </div>
  );
}

export default function MapPage() {
  const { status, spots, error, retry } = useSpots();
  const places = usePlaces();
  const { collections, reload: reloadCollections } = useCollections();
  const narrow = useMedia('(max-width: 819px)');
  const [person, setPerson] = useState('all');
  const [stat, setStat] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [liftId, setLiftId] = useState(null); // the list row under the mouse lifts its marker
  const [params, setParams] = useSearchParams();
  const [collectionId, setCollectionId] = useState(() => params.get('c') || null);
  const [pickTick, setPickTick] = useState(0); // bumps on every pick, so picking again flies again

  // sheet numbers (No. 004 / MR-004) by capture order over every spot, whatever the filters
  const numbers = useMemo(() => sheetNumbers(spots), [spots]);
  useEffect(() => {
    if (spots.length) rememberSpots(spots);
  }, [spots]);

  const filtered = useMemo(
    () => spots.filter((s) => (person === 'all' || s.createdBy === person) && (stat === 'all' || s.status === stat)),
    [spots, person, stat],
  );
  const selected = selectedId && filtered.some((s) => s.id === selectedId) ? selectedId : null;

  // the list's sections: every collection (even an empty one), then Ungrouped; a spot or place naming a
  // collection this phone doesn't know (deleted elsewhere, still loading) shows under Ungrouped
  const groups = useMemo(() => {
    const known = new Set(collections.map((c) => c.id));
    const placesById = new Map(places.map((p) => [p.id, p]));
    const of = (s) => {
      const id = effectiveCollection(s, placesById);
      return id && known.has(id) ? id : null;
    };
    const placeOf = (p) => (p.collectionId && known.has(p.collectionId) ? p.collectionId : null);
    const out = collections.map((c) => ({ id: c.id, collection: c, places: places.filter((p) => placeOf(p) === c.id), spots: filtered.filter((s) => of(s) === c.id) }));
    const loose = { id: null, collection: null, places: places.filter((p) => !placeOf(p)), spots: filtered.filter((s) => !of(s)) };
    if (loose.places.length || loose.spots.length || !out.length) out.push(loose);
    return out;
  }, [collections, places, filtered]);

  // (a collection deleted here or on another phone simply isn't found: nothing is picked)
  const picked = collectionId ? groups.find((g) => g.id === collectionId) || null : null;

  const pickCollection = (g) => {
    setCollectionId(g?.id || null);
    setPickTick((t) => t + 1);
    const next = new URLSearchParams(params);
    if (g?.id) next.set('c', g.id);
    else next.delete('c');
    next.delete('play');
    setParams(next, { replace: true });
  };
  // ask the map to fly to the picked collection: once per pick (and once for ?c= when the spots are in)
  const frame = picked && status === 'ok' ? frameOf(picked) : null;
  // (a new object each render is fine: the maps fly when its key changes)
  const focus = frame ? { key: `${picked.id}#${pickTick}`, bounds: frame } : null;

  // "Play" (and ?play=1): the flyover over the same map, through the picked collection's spots in capture
  // order. The card closes for it and comes back on exit; the filters decide which spots it visits.
  const [autoplay] = useState(() => params.get('play') === '1' && Boolean(params.get('c')));
  const stops = useMemo(() => flightStops(picked ? picked.spots : []), [picked]);
  const legs = useMemo(() => flightLegs(stops), [stops]);
  const beforeFly = useRef(null);
  const fly = useFlyover(stops, {
    autoplay,
    title: picked?.collection?.name || '',
    onExit: () => {
      setSelectedId(beforeFly.current);
      beforeFly.current = null;
      if (params.has('play')) {
        const next = new URLSearchParams(params);
        next.delete('play');
        setParams(next, { replace: true });
      }
    },
  });
  const flying = fly.active && fly.count > 0;
  const play = () => {
    beforeFly.current = selectedId;
    setSelectedId(null);
    fly.start();
  };

  const total = spots.length;
  const countText = filtered.length === total ? COPY.map.count(total) : COPY.map.countOf(filtered.length, total);
  const clearFilters = () => {
    setPerson('all');
    setStat('all');
  };

  const offline = status === 'error' && error?.status === 0;
  const retryButton = (
    <button type="button" className="mr-btn" onClick={retry}>
      {COPY.map.retry}
    </button>
  );

  let listBody;
  if (status === 'loading' && !total && !places.length) listBody = <StateBlock body={COPY.map.loading} />;
  else if (status === 'error' && !total && !places.length)
    listBody = <StateBlock title={COPY.map.errorTitle} body={offline ? COPY.map.errorOffline : error?.message} action={retryButton} />;
  else if (!total && !places.length)
    listBody = (
      <StateBlock
        title={COPY.map.emptyTitle}
        body={COPY.map.emptyBody}
        action={
          <Link className="mr-btn mr-btn--primary" to={paths.capture()}>
            {COPY.map.emptyAction}
          </Link>
        }
      />
    );
  else
    listBody = (
      <>
        {total > 0 && !filtered.length && (
          <StateBlock
            body={COPY.list.none}
            action={
              <button type="button" className="mr-btn" onClick={clearFilters}>
                {COPY.list.clear}
              </button>
            }
          />
        )}
        <SpotList
          groups={groups}
          allSpots={spots}
          selectedId={selected}
          onSelect={setSelectedId}
          onHover={setLiftId}
          numbers={numbers}
          selectedCollection={picked?.id || null}
          onPickCollection={pickCollection}
          onCollectionsChanged={reloadCollections}
          canEdit={status !== 'error'}
        />
      </>
    );

  let mapNote = null;
  if (status === 'loading' && !total) mapNote = <p className="mr-map-status">{COPY.map.loading}</p>;
  else if (status === 'error' && !total)
    mapNote = (
      <div className="mr-map-status">
        <span>{offline ? COPY.map.errorOffline : COPY.map.errorTitle}</span>
        <button type="button" className="mr-linkbtn" onClick={retry}>
          {COPY.map.retry}
        </button>
      </div>
    );
  else if (status === 'ok' && !total)
    mapNote = (
      <div className="mr-map-status">
        <span>{COPY.map.emptyTitle}</span>
        <Link className="mr-linkbtn" to={paths.capture()}>
          {COPY.map.emptyAction}
        </Link>
      </div>
    );

  return (
    <div
      className="mr-mappage"
      data-narrow={narrow ? '' : undefined}
      data-status={status}
      data-card={narrow && selected && !flying ? '' : undefined}
      data-flying={flying ? '' : undefined}
      data-collection={picked?.id || undefined}
    >
      <section className="mr-mappage-map">
        <SpotsMap
          spots={filtered}
          selectedId={selected}
          onSelect={setSelectedId}
          compact={narrow}
          fly={fly}
          flyStops={stops}
          flyLegs={legs}
          liftId={liftId}
          focus={focus}
        >
          {(narrow || !total) && mapNote}
          {!flying && picked?.collection && <PlayButton onPlay={play} disabled={!stops.length} name={picked.collection.name} />}
        </SpotsMap>
      </section>

      <aside className="mr-mappage-side">
        <div className="mr-side-head">
          <h1 className="mr-side-title">{COPY.map.title}</h1>
          <span className="mr-label">{countText}</span>
        </div>
        {total > 0 && <Filters person={person} status={stat} onPerson={setPerson} onStatus={setStat} />}
        {listBody}
      </aside>
    </div>
  );
}
