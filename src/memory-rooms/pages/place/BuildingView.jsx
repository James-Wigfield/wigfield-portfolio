/* The whole place in 3D, on its page (/memories/b/:id) once it has been built: its level GLBs and its exterior
   as one RoomViewer group, and the four ways to look at it (viewer/buildingStage.js):
     Outside (the house, roof on) · Inside (the roof lifted off, a level slider down through the floors) ·
     Plan (every level side by side, each cut at 1.2 m) · Levels (pulled apart)
   Spin (a slow turntable) and Furnished (the rooms with or without their furniture, on the empty bake) work on
   every stage and keep their state across them. Tapping a room flies into it and opens its spot (when it has one).
   Its own chunk: three.js loads only here. */

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
import { FurnishedToggle, SpinToggle } from '../../viewer/ViewerControls.jsx';
import TitleBlock from '../spot/TitleBlock.jsx';
import LevelSlider from './LevelSlider.jsx';
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
    // each level's empty bake (model/level-<id>-empty): loaded the first time Furnished goes off
    const rooms = planRef.current.levels
      .map((l) => ({ id: `level-${l.id}`, glbUrl: url(`level-${l.id}`), emptyUrl: url(`level-${l.id}-empty`), scene: null }))
      .filter((r) => r.glbUrl);
    const ext = url('exterior');
    if (ext) rooms.push({ id: 'exterior', glbUrl: ext, scene: null });
    return rooms.length ? { rooms } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, planKey]);
  // only levels that have a model can be shown, lowest first (the Inside slider's order)
  const levels = useMemo(
    () => [...plan.levels].sort((p, q) => p.elevation - q.elevation).filter((l) => source?.rooms.some((r) => r.id === `level-${l.id}`)),
    [plan, source],
  );
  // Inside: the open level (an index into `levels`), the top one until picked
  const [openPick, setOpenPick] = useState(null);
  const open = openPick == null ? levels.length - 1 : Math.min(openPick, levels.length - 1);

  const ready = Boolean(viewer) && vstate.state === 'ready';
  const want = useRef({ stage, open });
  want.current = { stage, open };
  useEffect(() => {
    if (!ready) return undefined;
    const s = new BuildingStage(viewer, planRef.current);
    stageRef.current = s;
    s.set(want.current.stage, { open: want.current.open, animate: false }); // keep the stage it was on
    return () => {
      s.dispose();
      stageRef.current = null;
    };
  }, [ready, viewer, planKey]);
  useEffect(() => {
    stageRef.current?.set(stage, { open: want.current.open });
  }, [stage]);
  const settleOpen = (i) => {
    setOpenPick(i);
    stageRef.current?.setOpen(i);
  };
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
        >
          {stage === 'inside' && levels.length > 1 && (
            <LevelSlider
              levels={levels}
              value={open}
              disabled={!ready}
              onScrub={(p) => stageRef.current?.setOpen(p, { scrub: true })}
              onSettle={settleOpen}
            />
          )}
        </RoomViewer>
      </div>
      <div className="mr-building__bar">
        <div className="mr-seg" role="group" aria-label={copy.viewLabel}>
          {STAGES.map((s) => (
            <button key={s} type="button" aria-pressed={stage === s} disabled={!ready} onClick={() => pickStage(s)} data-mr={`building-${s}`}>
              {copy.stages[s]}
            </button>
          ))}
        </div>
        <div className="mr-building__toggles">
          <FurnishedToggle viewer={viewer} />
          <SpinToggle viewer={viewer} />
        </div>
      </div>
      <p className="mr-building__hint mr-label" aria-live="polite">
        {note || copy.hint}
      </p>
    </section>
  );
}
