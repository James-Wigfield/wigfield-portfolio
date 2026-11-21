/* The whole place in 3D, on its page (/memories/b/:id) once it has been built: its level GLBs and its exterior
   as one RoomViewer group, and the four ways to look at it (viewer/buildingStage.js):
     Outside (the house, roof on) · Inside (the roof lifted off) · Plan (one level, cut at 1.2 m) · Levels (pulled apart)
   Tapping a room flies into it and opens its spot (when it has one). Its own chunk: three.js loads only here. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COPY } from '../../copy.js';
import { mediaOf } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { goWithTransition } from '../../lib/transition.js';
import { paths } from '../../routes.js';
import RoomViewer from '../../viewer/RoomViewer.jsx';
import { BuildingStage, STAGES } from '../../viewer/buildingStage.js';
import { useViewerState } from '../../viewer/useViewer.js';
import TitleBlock from '../spot/TitleBlock.jsx';
import '../../viewer/viewer.css';

export default function BuildingView({ place, plan, spots, narrow = false }) {
  const copy = COPY.building;
  const navigate = useNavigate();
  const [viewer, setViewer] = useState(null);
  const vstate = useViewerState(viewer);
  const stageRef = useRef(null);
  const [stage, setStage] = useState('outside');
  const [note, setNote] = useState(null);
  const leaving = useRef(false); // a tap is already flying in (or the page has gone)

  // Which models to load, as a string: the place row is re-read whenever an upload finishes (a new object each
  // time), and the building must not reload for that, only when its models or its plan change.
  const models = mediaOf(place, 'model');
  const modelKey = models.map((m) => `${m.name}=${m.url}`).sort().join('|');
  const planKey = `${place.id}:${place.planVersion}`;
  const planRef = useRef(plan);
  planRef.current = plan;
  const source = useMemo(() => {
    const url = (name) => models.find((m) => m.name === name)?.url || null;
    const rooms = planRef.current.levels.map((l) => ({ id: `level-${l.id}`, glbUrl: url(`level-${l.id}`), scene: null })).filter((r) => r.glbUrl);
    const ext = url('exterior');
    if (ext) rooms.push({ id: 'exterior', glbUrl: ext, scene: null });
    return rooms.length ? { rooms } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, planKey]);
  // only levels that have a model can be shown
  const levels = useMemo(() => plan.levels.filter((l) => source?.rooms.some((r) => r.id === `level-${l.id}`)), [plan, source]);
  const [levelPick, setLevelPick] = useState(null);
  const level = levels.some((l) => l.id === levelPick) ? levelPick : levels[0]?.id || null;

  const ready = Boolean(viewer) && vstate.state === 'ready';
  const want = useRef({ stage, level });
  want.current = { stage, level };
  useEffect(() => {
    if (!ready) return undefined;
    const s = new BuildingStage(viewer, planRef.current);
    stageRef.current = s;
    s.set(want.current.stage, { level: want.current.level, animate: false }); // keep the stage it was on
    return () => {
      s.dispose();
      stageRef.current = null;
    };
  }, [ready, viewer, planKey]);
  useEffect(() => {
    stageRef.current?.set(stage, { level });
  }, [stage, level]);
  useEffect(() => {
    leaving.current = false;
    return () => {
      leaving.current = true;
    };
  }, []);

  // tap a room: fly into it, then open its spot
  useEffect(() => {
    if (!ready) return undefined;
    return viewer.on('tap', ({ point, world, roomId }) => {
      const s = stageRef.current;
      if (!s || !point || leaving.current || !roomId?.startsWith('level-')) return;
      // (pulled-apart levels only move up: the plan point under the tap is the same)
      const room = s.roomAt(roomId.slice(6), [point.x, point.z]);
      if (!room) return;
      const spot = spots.find((x) => x.roomId === room.id && !x.deletedAt);
      if (!spot) {
        setNote(copy.notCaptured(room.name || room.id));
        return;
      }
      setNote(null);
      leaving.current = true;
      viewer.diveTo?.(world || point, 520).then(() => {
        if (document.contains(viewer.container)) goWithTransition(navigate, paths.spot(spot.id));
      });
    });
  }, [ready, viewer, spots, navigate, copy]);

  if (!source) return null;
  const pickStage = (s) => {
    setNote(null);
    setStage(s);
  };
  return (
    <section className="mr-building" data-mr="building" data-stage={stage}>
      <div className="mr-building__stage">
        <RoomViewer
          source={source}
          onViewer={setViewer}
          label={place.title}
          stamp={<TitleBlock viewer={viewer} name={place.title} place={place.placeLabel} date={formatDate(place.capturedAt)} compact={narrow} />}
        />
      </div>
      <div className="mr-building__bar">
        <div className="mr-seg" role="group" aria-label={copy.viewLabel}>
          {STAGES.map((s) => (
            <button key={s} type="button" aria-pressed={stage === s} disabled={!ready} onClick={() => pickStage(s)} data-mr={`building-${s}`}>
              {copy.stages[s]}
            </button>
          ))}
        </div>
        {stage === 'plan' && levels.length > 1 && (
          <div className="mr-seg" role="group" aria-label={copy.levelLabel}>
            {levels.map((l) => (
              <button key={l.id} type="button" aria-pressed={level === l.id} disabled={!ready} onClick={() => setLevelPick(l.id)} data-mr="building-level">
                {l.name || l.id}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mr-building__hint mr-label" aria-live="polite">
        {note || copy.hint}
      </p>
    </section>
  );
}
