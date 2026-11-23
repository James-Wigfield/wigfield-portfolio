/* /memories/b/:id — a whole place. Before it's built in 3D this is its room
   checklist: the sketch plan (or the floor-plan photo with each room marked)
   fills in as rooms are captured, and each room opens the normal capture with
   the room filled in. Works with no signal: the place, its sketch and its room
   captures may all still be in the outbox (lib/places.js). */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import { mediaOf } from '../lib/api.js';
import { roomIdFor, uniqueRoomName } from '../building/sketch.js';
import { emptySketch, roomStates, saveSketch, usePlace } from '../lib/places.js';
import { formatDate } from '../lib/format.js';
import PageMessage from './spot/PageMessage.jsx';
import { useMedia } from '../lib/useMedia.js';
import PlanView, { PhotoMarks } from './place/PlanView.jsx';
import SharePanel from '../shell/SharePanel.jsx';

// the 3D building (three.js) is its own chunk: it only loads once the place has been built
const BuildingView = lazy(() => import('./place/BuildingView.jsx'));
// "Walk in" + who's walking the place now (the place walk, /memories/b/:id/walk)
const WalkEntry = lazy(() => import('../walk/WalkEntry.jsx'));

export default function PlacePage() {
  const { buildingId } = useParams();
  const p = usePlace(buildingId);
  const copy = COPY.place;
  const narrow = useMedia('(max-width: 860px)');
  const navigate = useNavigate();
  const [pick, setPick] = useState(null);
  const [levelPick, setLevelPick] = useState(null);
  const [adding, setAdding] = useState('');

  const sketch = p.sketch || emptySketch();
  const rooms = useMemo(() => roomStates(sketch, p.spots, p.queued), [sketch, p.spots, p.queued]);
  const levels = sketch.levels;
  const done = rooms.filter((r) => r.state !== 'todo').length;
  const title = p.place?.title || '';

  useEffect(() => {
    if (title) document.title = `${title} · ${COPY.app.name}`;
  }, [title]);

  if (p.status === 'missing') return <PageMessage dataState="missing" label={copy.label} title={copy.missingTitle} body={copy.missingBody} />;
  if (p.status === 'error') return <PageMessage dataState="error" label={copy.label} title={copy.errorTitle} body={p.error?.message === 'offline' ? copy.offline : null} retryLabel={copy.retry} onRetry={p.reload} />;
  if (p.status === 'loading') return <div className="mr-place" data-state="loading"><p className="mr-label mr-place__loading">{copy.loading}</p></div>;

  // the floor-plan photo: the uploaded one, else the copy still on this phone
  const planPhoto = mediaOf(p.server, 'plan')[0]?.url || p.files.find((f) => f.type === 'plan')?.url || null;
  const outside = [...mediaOf(p.server, 'thumb').map((m) => m.url), ...p.files.filter((f) => f.type === 'thumb').map((f) => f.url)];
  // one level at a time on the plan (an upstairs room drawn over the ground floor reads as nonsense)
  const shownLevel = levels.some((l) => l.id === levelPick) ? levelPick : levels[0]?.id;
  const onLevel = levels.length > 1 ? rooms.filter((r) => r.room.level === shownLevel) : rooms;
  const hasRects = onLevel.some((r) => r.room.rect);
  const hasMarks = planPhoto && onLevel.some((r) => r.room.mark);
  const chosen = rooms.find((r) => r.room.id === pick) || null;
  // built in 3D (CONTRACTS.md 6.4): its traced plan and at least one level model on the server
  const built = Boolean(p.server?.plan && mediaOf(p.server, 'model').some((m) => /^level-/.test(m.name || '')));

  const addRoom = async (e) => {
    e.preventDefault();
    if (!adding.trim()) return;
    // two rooms with one name can't be told apart on the checklist: the second is "Bedroom 2"
    const name = uniqueRoomName(adding, sketch.rooms.map((r) => r.name));
    const id = roomIdFor(name, sketch.rooms.map((r) => r.id));
    await saveSketch(buildingId, { ...sketch, rooms: [...sketch.rooms, { id, name, level: levels[0].id }] }, title);
    setAdding('');
    p.reload();
  };
  const captureRoom = (room) => navigate(paths.captureRoom(buildingId, room.id, room.name, title));

  return (
    <div className="mr-place" data-state="ok" data-mr="place">
      <header className="mr-place__head">
        <div className="mr-spot__eyebrow">
          <span className="mr-label">{copy.label}</span>
          <span className="mr-dot mr-label" data-status={p.server?.status || 'captured'}>
            {p.server ? COPY.app.status[p.server.status] : copy.onPhone}
          </span>
        </div>
        <h1 className="mr-place__title">{title}</h1>
        <p className="mr-place__meta">
          {[p.place?.placeLabel, formatDate(p.place?.capturedAt), copy.progress(done, rooms.length)].filter(Boolean).join(' · ')}
        </p>
      </header>

      {built && (
        <Suspense fallback={<div className="mr-building mr-building--loading" />}>
          <BuildingView place={p.server} plan={p.server.plan} spots={p.spots} narrow={narrow} />
          <div className="mr-place__walk">
            <WalkEntry place={p.server} />
          </div>
        </Suspense>
      )}

      <section className="mr-place__plan" aria-label={copy.checklist}>
        {levels.length > 1 && (
          <div className="mr-seg mr-place__levels" role="group" aria-label={COPY.sketch.levels}>
            {levels.map((l) => (
              <button key={l.id} type="button" aria-pressed={l.id === shownLevel} onClick={() => setLevelPick(l.id)} data-mr="place-level">
                {l.name}
              </button>
            ))}
          </div>
        )}
        {hasRects ? (
          <PlanView rooms={onLevel} selected={pick} onPick={setPick} north={sketch.north ?? null} />
        ) : hasMarks ? (
          <PhotoMarks url={planPhoto} rooms={onLevel} selected={pick} onPick={setPick} />
        ) : planPhoto ? (
          <figure className="mr-planphoto">
            <img src={planPhoto} alt={copy.planPhotoAlt} />
          </figure>
        ) : (
          <p className="mr-place__noplan">{copy.noPlan}</p>
        )}
        {hasRects && planPhoto && (
          <details className="mr-place__photo">
            <summary className="mr-linkbtn">{copy.planPhotoShow}</summary>
            <img src={planPhoto} alt={copy.planPhotoAlt} />
          </details>
        )}
        <div className="mr-place__planlinks">
          <Link className="mr-linkbtn" to={paths.placePlan(buildingId)} data-mr="sketch-link">
            {hasRects ? copy.editSketch : copy.sketchIt}
          </Link>
        </div>
      </section>

      {chosen && (
        <section className="mr-place__pick" data-mr="room-pick">
          <span className="mr-label">{copy.roomLabel}</span>
          <h2 className="mr-place__roomname">{chosen.room.name}</h2>
          <p className="mr-msg">{copy.stateLong[chosen.state]}</p>
          {chosen.state === 'captured' ? (
            <Link className="mr-btn mr-btn--lg" to={paths.spot(chosen.spot.id)}>
              {copy.openRoom}
            </Link>
          ) : (
            <button type="button" className="mr-btn mr-btn--primary mr-btn--lg" onClick={() => captureRoom(chosen.room)} data-mr="capture-room">
              {chosen.state === 'queued' ? copy.captureAgain : copy.captureRoom}
            </button>
          )}
        </section>
      )}

      <section className="mr-place__rooms" aria-label={copy.checklist}>
        <div className="mr-place__roomshead">
          <h2 className="mr-label">{copy.checklist}</h2>
          <span className="mr-label">{copy.progress(done, rooms.length)}</span>
        </div>
        {levels.map((level) => {
          const list = rooms.filter((r) => r.room.level === level.id);
          if (!list.length) return null;
          return (
            <div key={level.id}>
              {levels.length > 1 && <h3 className="mr-label mr-place__level">{level.name}</h3>}
              <ul className="mr-checklist">
                {list.map(({ room, state, spot }) => (
                  <li key={room.id} className="mr-checklist__row" data-state={state} data-mr="checklist-room" data-id={room.id}>
                    <span className="mr-dot" data-status={state === 'captured' ? 'rendered' : state === 'queued' ? 'modelling' : 'captured'}>
                      <span className="mr-checklist__name">{room.name}</span>
                    </span>
                    <span className="mr-label mr-checklist__state">{copy.stateShort[state]}</span>
                    {state === 'captured' ? (
                      <Link className="mr-linkbtn" to={paths.spot(spot.id)}>
                        {copy.open}
                      </Link>
                    ) : (
                      <button type="button" className="mr-linkbtn" onClick={() => captureRoom(room)}>
                        {state === 'queued' ? copy.again : copy.capture}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <form className="mr-place__add" onSubmit={addRoom}>
          <label className="mr-field">
            <span className="mr-label">{copy.addLabel}</span>
            <span className="mr-place__addrow">
              <input className="mr-input" value={adding} maxLength={40} placeholder={copy.addPlaceholder} onChange={(e) => setAdding(e.target.value)} data-mr="add-room-input" />
              <button type="submit" className="mr-btn" disabled={!adding.trim()} data-mr="add-room">
                {copy.add}
              </button>
            </span>
          </label>
        </form>
      </section>

      {outside.length > 0 && (
        <section className="mr-place__outside">
          <h2 className="mr-label">{copy.outside}</h2>
          <div className="mr-place__thumbs">
            {outside.map((u) => (
              <img key={u} src={u} alt="" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {/* a private link to this place alone (once it's on the server) */}
      {p.server && <SharePanel kind="building" id={buildingId} />}
    </div>
  );
}
