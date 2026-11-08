/* /memories/group/:group — every room that shares a building frame, placed
   together (scene.frame: origin + rotY + y). Rendered rooms show their baked
   GLB; rooms with only a layout show the layout preview. Tap a room (in 3D
   or in the list) to bring it close; each list entry links to its spot. */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mediaOf } from '../lib/api.js';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';
import RoomViewer from '../viewer/RoomViewer.jsx';
import { StageBar } from '../viewer/ViewerControls.jsx';
import { useViewerState } from '../viewer/useViewer.js';
import PageMessage from './spot/PageMessage.jsx';
import StageNav from './spot/StageNav.jsx';
import { stageKind } from './spot/photos.js';
import { Arrow } from './spot/icons.jsx';
import '../viewer/viewer.css';

function roomOf(spot) {
  const kind = stageKind(spot);
  if (kind === 'photos') return null;
  return { id: spot.id, scene: spot.scene || null, glbUrl: kind === 'model' ? mediaOf(spot, 'model')[0].url : null };
}

export default function GroupPage() {
  const { group } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState(null);
  const key = `${group}#${attempt}`;

  useEffect(() => {
    let alive = true;
    api.listSpots().then(
      (spots) => alive && setRes({ key, kind: 'ok', spots: (spots || []).filter((s) => s.frameGroup === group && !s.deletedAt) }),
      (error) => alive && setRes({ key, kind: 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [group, attempt, key]);

  const current = res?.key === key ? res : null;
  const copy = COPY.group;

  if (current?.kind === 'error') {
    return <PageMessage dataState="error" label={copy.label} title={copy.errorTitle} retryLabel={copy.retry} onRetry={() => setAttempt((a) => a + 1)} />;
  }
  if (current?.kind === 'ok' && !current.spots.length) {
    return <PageMessage dataState="missing" label={copy.label} title={copy.emptyTitle} body={copy.emptyBody} />;
  }
  return <GroupView group={group} spots={current?.spots || null} />;
}

function GroupView({ group, spots }) {
  const [viewer, setViewer] = useState(null);
  const [focused, setFocused] = useState(null);
  const vstate = useViewerState(viewer);
  const copy = COPY.group;
  const title = copy.title(group);

  const source = useMemo(() => {
    if (!spots) return null;
    const rooms = spots.map(roomOf).filter(Boolean);
    return rooms.length ? { rooms } : null;
  }, [spots]);
  const placed = useMemo(() => new Set((source?.rooms || []).map((r) => r.id)), [source]);

  useEffect(() => {
    if (!viewer) return undefined;
    return viewer.on('room', ({ id }) => setFocused(id));
  }, [viewer]);

  useEffect(() => {
    document.title = `${title} · ${COPY.app.name}`;
  }, [title]);

  const ready = !!viewer && vstate.state === 'ready';

  return (
    <div className="mr-spot mr-group" data-stage={source ? 'model' : 'loading'}>
      <section className="mr-spot__stage">
        {(source || !spots) && (
          <RoomViewer source={source} onViewer={setViewer} label={title} bar={source ? <StageBar viewer={viewer} homeLabel={copy.whole} /> : null} />
        )}
        {spots && !source && <p className="mr-stage-empty mr-label">{copy.noLayout}</p>}
        <StageNav />
      </section>

      <aside className="mr-spot__panel">
        <header className="mr-spot__head">
          <div className="mr-spot__eyebrow">
            <span className="mr-label">{copy.label}</span>
            {spots && <span className="mr-label">{copy.rooms(spots.length)}</span>}
          </div>
          <h1 className="mr-spot__title">{title}</h1>
          <p className="mr-spot__line">{spots ? copy.hint : copy.loading}</p>
        </header>

        {spots && (
          <ul className="mr-rooms">
            {spots.map((s) => {
              const canFocus = ready && placed.has(s.id);
              return (
                <li key={s.id} className="mr-rooms__item" data-mr="group-room" data-id={s.id} aria-current={focused === s.id ? 'true' : undefined}>
                  <button
                    type="button"
                    className="mr-rooms__focus"
                    disabled={!canFocus}
                    aria-label={copy.focus(s.title)}
                    onClick={() => viewer?.focusRoom(s.id)}
                  >
                    <span className="mr-rooms__title">{s.title}</span>
                    <span className="mr-dot mr-label" data-status={s.status}>
                      {placed.has(s.id) ? COPY.app.status[s.status] || s.status : copy.noLayout}
                    </span>
                  </button>
                  <Link className="mr-rooms__open" to={paths.spot(s.id)} aria-label={copy.openLabel(s.title)}>
                    <span>{copy.open}</span>
                    <Arrow dir="right" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
