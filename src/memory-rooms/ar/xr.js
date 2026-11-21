/* Android AR: WebXR immersive-ar INSIDE the spot page's viewer (same renderer,
   same loaded room, same baked materials; nothing is loaded twice).

     const ar = await startAr(viewer, { mode: 'tabletop' | 'life', overlay, onPhase, onScale, onEnd });
     ar.resetScale();   ar.end();

   - The viewer stops drawing its own frames (viewer.enterXR) and the session's
     animation loop draws viewer.scene through the XR camera.
   - A reticle follows a hit test from the middle of the screen; a tap places the
     room there, its floor on the surface, turned so you face the side the
     spot page opens on.
   - Then one finger drags it (a transient-input hit test under the finger), two
     fingers pinch to resize and twist to turn (DOM overlay touches).
   - Tabletop (1:20): the dollhouse cut-away runs every frame from the phone's
     position (viewer/dollhouse.js), so walking round the table always shows
     the inside. Life size (1:1): everything shows while you stand inside the
     footprint; from outside, the walls facing you open up.
   - The session ending (Exit, the system back gesture, an error) puts the room
     back exactly where the viewer had it (viewer.exitXR). */

import * as THREE from 'three';
import { pointInPolygon } from '../scene/polygon.js';
import { applyDollhouse, stepFades } from '../viewer/dollhouse.js';

export const BASE_SCALE = { tabletop: 1 / 20, life: 1 };
const MIN_SCALE = 1 / 100;
const MAX_SCALE = 1;

export async function startAr(viewer, { mode = 'tabletop', overlay, onPhase, onScale, onEnd } = {}) {
  if (!navigator.xr) throw new Error('no webxr');
  const renderer = viewer.renderer;
  if (!renderer || !viewer.rooms?.length) throw new Error('room not loaded');

  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    ...(overlay ? { domOverlay: { root: overlay } } : {}),
  });

  const scene = viewer.scene;
  const world = viewer.world;
  const saved = { autoClear: renderer.autoClear, parent: world.parent };
  viewer.enterXR(session);

  // The room hangs under a placement root: its footprint centre on the root's origin, floor at 0.
  const box = viewer.bounds?.clone() || new THREE.Box3().setFromObject(world);
  const centre = box.getCenter(new THREE.Vector3());
  const place = new THREE.Group();
  place.name = 'ar__place';
  place.visible = false;
  scene.add(place);
  place.add(world);
  world.position.set(-centre.x, 0, -centre.z);
  let scale = BASE_SCALE[mode] ?? BASE_SCALE.tabletop;
  place.scale.setScalar(scale);

  // Facing: the spot page's opening view, from the room's centre (radians about +y).
  const home = viewer.homePose;
  const homeAz = home ? Math.atan2(home.pos.x - home.target.x, home.pos.z - home.target.z) : 0;

  // the reticle takes the overlay's ink (--mr-ar-ink: light over any camera feed)
  const ink = overlay ? getComputedStyle(overlay).color : '';
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setStyle(ink || 'rgb(255, 255, 255)', THREE.SRGBColorSpace), transparent: true, opacity: 0.9, depthTest: false }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  reticle.renderOrder = 10;
  scene.add(reticle);

  renderer.autoClear = true;
  renderer.setScissorTest(false);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  // The loop is set BEFORE the session starts, and skips any call without an XR frame: set after,
  // three also runs it from the window's rAF, drawing every frame twice.
  let live = false; // frames wait until everything below is set up (an XR frame can land mid-await)
  renderer.setAnimationLoop((t, frame) => live && frame && onFrame(t, frame));
  let hitSource = null;
  try {
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitSource = await session.requestHitTestSource({ space: viewerSpace });
  } catch (err) {
    // put the viewer back as it was and end the session: nothing below ever ran
    renderer.setAnimationLoop(null);
    renderer.xr.enabled = false;
    renderer.autoClear = saved.autoClear;
    world.position.set(0, 0, 0);
    (saved.parent || scene).add(world);
    place.removeFromParent();
    reticle.removeFromParent();
    reticle.geometry.dispose();
    reticle.material.dispose();
    viewer.exitXR();
    session.end().catch(() => {});
    throw err;
  }
  let touchSource = null;
  session
    .requestHitTestSourceForTransientInput?.({ profile: 'generic-touchscreen' })
    ?.then((s) => {
      touchSource = s;
    })
    .catch(() => {});

  let placed = false;
  let phase = null;
  const setPhase = (p) => {
    if (p === phase) return;
    phase = p;
    onPhase?.(p);
  };
  setPhase('finding');
  onScale?.(scale);

  // ── gestures ──
  let dragging = false;
  let grab = null; // offset from the first hit under the finger to the room's origin
  let pinch = null; // { dist, angle, scale, yaw }
  const touchPair = (e) => {
    const [a, b] = e.touches;
    return { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), angle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) };
  };
  const onTouchStart = (e) => {
    if (!placed || e.touches.length !== 2) return;
    const p = touchPair(e);
    pinch = { ...p, scale, yaw: place.rotation.y };
    dragging = false;
  };
  const onTouchMove = (e) => {
    if (!pinch || e.touches.length !== 2) return;
    const p = touchPair(e);
    scale = THREE.MathUtils.clamp((pinch.scale * p.dist) / Math.max(1, pinch.dist), MIN_SCALE, MAX_SCALE);
    place.scale.setScalar(scale);
    place.rotation.y = pinch.yaw - (p.angle - pinch.angle);
    onScale?.(scale);
  };
  const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinch = null;
  };
  overlay?.addEventListener('touchstart', onTouchStart, { passive: true });
  overlay?.addEventListener('touchmove', onTouchMove, { passive: true });
  overlay?.addEventListener('touchend', onTouchEnd, { passive: true });
  overlay?.addEventListener('touchcancel', onTouchEnd, { passive: true });

  const _hit = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();

  const placeAt = (pos) => {
    const cam = renderer.xr.getCamera();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    // turn the room so the side the spot page opens on faces the phone
    const toCam = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
    place.rotation.set(0, toCam - homeAz, 0);
    place.position.copy(pos);
    place.visible = true;
    placed = true;
    setPhase('placed');
  };

  const onSelectStart = () => {
    if (!placed || pinch) return;
    dragging = true;
    grab = null;
  };
  const onSelectEnd = () => {
    dragging = false;
    grab = null;
  };
  const onSelect = () => {
    if (!placed && reticle.visible) {
      reticle.matrix.decompose(_hit, _q, _s);
      placeAt(_hit.clone());
    }
  };
  session.addEventListener('selectstart', onSelectStart);
  session.addEventListener('selectend', onSelectEnd);
  session.addEventListener('select', onSelect);

  // ── frames ──
  const camPos = new THREE.Vector3();
  const local = new THREE.Vector3();
  let last = 0;
  const shell = viewer.rooms.length === 1 ? viewer.rooms[0].shell : null;

  function onFrame(t, frame) {
    const dt = last ? Math.min(50, t - last) : 16;
    last = t;
    const ref = renderer.xr.getReferenceSpace();
    if (frame && ref) {
      if (!placed && hitSource) {
        const hit = frame.getHitTestResults(hitSource)[0];
        const pose = hit?.getPose(ref);
        reticle.visible = Boolean(pose);
        if (pose) reticle.matrix.fromArray(pose.transform.matrix);
        setPhase(pose ? 'ready' : 'finding');
      } else {
        reticle.visible = false;
      }
      if (placed && dragging && !pinch && touchSource) {
        const res = frame.getHitTestResultsForTransientInput(touchSource)[0];
        const pose = res?.results?.[0]?.getPose(ref);
        if (pose) {
          _m.fromArray(pose.transform.matrix);
          _hit.setFromMatrixPosition(_m);
          if (!grab) grab = place.position.clone().sub(_hit);
          place.position.copy(_hit).add(grab);
        }
      }
    }

    // dollhouse: from where the phone is now
    const cam = renderer.xr.getCamera();
    camPos.setFromMatrixPosition(cam.matrixWorld);
    for (const room of viewer.rooms) {
      const c = world.localToWorld(room.centre.clone());
      let cutaway = mode !== 'life';
      if (!cutaway && shell) {
        // life size: open the walls only while standing outside the footprint
        local.copy(camPos);
        room.holder.worldToLocal(local);
        cutaway = !pointInPolygon([local.x, local.z], shell.outline);
      }
      applyDollhouse(room, [camPos.x, camPos.z], [c.x, c.z], cutaway);
      stepFades(room, dt, false);
    }
    renderer.render(scene, viewer.camera);
  }

  live = true;

  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    session.removeEventListener('selectstart', onSelectStart);
    session.removeEventListener('selectend', onSelectEnd);
    session.removeEventListener('select', onSelect);
    overlay?.removeEventListener('touchstart', onTouchStart);
    overlay?.removeEventListener('touchmove', onTouchMove);
    overlay?.removeEventListener('touchend', onTouchEnd);
    overlay?.removeEventListener('touchcancel', onTouchEnd);
    try {
      hitSource?.cancel();
      touchSource?.cancel();
    } catch {
      /* the session is gone anyway */
    }
    hitSource = null;
    touchSource = null;
    renderer.xr.enabled = false;
    renderer.autoClear = saved.autoClear;
    world.position.set(0, 0, 0);
    (saved.parent || scene).add(world);
    place.removeFromParent();
    reticle.removeFromParent();
    reticle.geometry.dispose();
    reticle.material.dispose();
    viewer.exitXR();
    onEnd?.();
  };
  session.addEventListener('end', cleanup);

  return {
    session,
    resetScale() {
      scale = BASE_SCALE[mode] ?? BASE_SCALE.tabletop;
      place.scale.setScalar(scale);
      onScale?.(scale);
    },
    end() {
      if (ended) return Promise.resolve();
      return session.end().catch(cleanup);
    },
  };
}
