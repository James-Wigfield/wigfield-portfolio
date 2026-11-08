/* /memories: the map (hero) and the spot list. Desktop: map + side column.
   Phone: the map on top, sized to the trip's shape, and the list below it
   scrolling on its own (never one long page); the spot card docks at the bottom. */

import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { useMedia } from '../lib/useMedia.js';
import Filters from '../map/Filters.jsx';
import SpotList from '../map/SpotList.jsx';
import SpotsMap from '../map/SpotsMap.jsx';
import { WORLD, onMap } from '../map/geo.js';
import { useSpots } from '../map/useSpots.js';

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
  const narrow = useMedia('(max-width: 819px)');
  const [person, setPerson] = useState('all');
  const [stat, setStat] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const elsewhereRef = useRef(null);

  const filtered = useMemo(
    () => spots.filter((s) => (person === 'all' || s.createdBy === person) && (stat === 'all' || s.status === stat)),
    [spots, person, stat],
  );
  const onMapSpots = useMemo(() => filtered.filter(onMap), [filtered]);
  const elsewhere = useMemo(() => filtered.filter((s) => !onMap(s)), [filtered]);
  const selected = selectedId && filtered.some((s) => s.id === selectedId) ? selectedId : null;

  const total = spots.length;
  const countText = filtered.length === total ? COPY.map.count(total) : COPY.map.countOf(filtered.length, total);
  const clearFilters = () => {
    setPerson('all');
    setStat('all');
  };

  const selectRow = (id) => setSelectedId(id);
  const showElsewhere = () => elsewhereRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  const offline = status === 'error' && error?.status === 0;
  const retryButton = (
    <button type="button" className="mr-btn" onClick={retry}>
      {COPY.map.retry}
    </button>
  );

  let listBody;
  if (status === 'loading' && !total) listBody = <StateBlock body={COPY.map.loading} />;
  else if (status === 'error' && !total)
    listBody = <StateBlock title={COPY.map.errorTitle} body={offline ? COPY.map.errorOffline : error?.message} action={retryButton} />;
  else if (!total)
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
  else if (!filtered.length)
    listBody = (
      <StateBlock
        body={COPY.list.none}
        action={
          <button type="button" className="mr-btn" onClick={clearFilters}>
            {COPY.list.clear}
          </button>
        }
      />
    );
  else listBody = <SpotList spots={onMapSpots} elsewhere={elsewhere} selectedId={selected} onSelect={selectRow} elsewhereRef={elsewhereRef} />;

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
      data-card={narrow && selected ? '' : undefined}
      style={{ '--mr-map-ratio': (WORLD.h / WORLD.w).toFixed(3) }}
    >
      <section className="mr-mappage-map">
        <SpotsMap
          spots={filtered}
          selectedId={selected}
          onSelect={setSelectedId}
          elsewhereCount={elsewhere.length}
          onElsewhere={showElsewhere}
          compact={narrow}
        >
          {(narrow || !total) && mapNote}
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
