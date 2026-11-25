/* Dream Rooms · moving (decision 8). Hold (mouse or finger) to drift forward, drag to
   look (yaw + a little pitch), arrow keys for accessibility (up/down drift, left/right
   turn). No WASD, no pointer lock, no head bob, no running or jumping. Eased starts
   and stops; speed 0.9–1.3 m/s from mood.intensity.

     const controls = createControls(el, { onTap, onGesture })
     controls.drive() → { forward, turn }      the user's wish this frame
     stepWalker(walker, dt, drive, collide, opts)
*/

import { DIMS } from '../contracts/layout.js';

const W = DIMS.walker;
const HOLD_MS = 170; // a hold becomes a drift after this
const LOOK_PX = 14; // a drag this far inside HOLD_MS is a look, not a walk
const TAP_PX = 8;
const TAP_MS = 380;

export function baseSpeed(mood) {
  const k = Math.min(1, Math.max(0, mood?.intensity ?? 0.5));
  return W.speedMin + (W.speedMax - W.speedMin) * k;
}

export function createControls(el, { onTap, onGesture, look }) {
  const keys = { up: false, down: false, left: false, right: false };
  let down = null;
  const touchish = (e) => e.pointerType && e.pointerType !== 'mouse';

  const onDown = (e) => {
    if (e.button !== undefined && e.button > 0) return;
    if (down) return; // one pointer drives
    // audio unlock: mouse = pointerdown counts as activation; touch waits for pointerup
    if (!touchish(e)) onGesture?.();
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0, lookOnly: false };
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onMove = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.lx;
    const dy = e.clientY - down.ly;
    down.lx = e.clientX;
    down.ly = e.clientY;
    down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    if (down.moved > LOOK_PX && performance.now() - down.t < HOLD_MS) down.lookOnly = true;
    const k = touchish(e) ? 0.0065 : 0.0048;
    look(-dx * k, -dy * k * 0.8);
  };
  const onUp = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dt = performance.now() - down.t;
    if (touchish(e)) onGesture?.();
    if (down.moved < TAP_PX && dt < TAP_MS) onTap?.(e.clientX, e.clientY);
    down = null;
  };
  const onCancel = () => {
    down = null;
  };
  const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const onKey = (e) => {
    const k = KEY[e.key];
    if (!k) return;
    if (e.type === 'keydown') onGesture?.();
    keys[k] = e.type === 'keydown';
    e.preventDefault();
  };
  const onBlur = () => {
    keys.up = keys.down = keys.left = keys.right = false;
    down = null;
  };
  const onContext = (e) => e.preventDefault();
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);

  return {
    drive() {
      const held = down && !down.lookOnly && performance.now() - down.t > HOLD_MS;
      const forward = held || keys.up ? 1 : keys.down ? -0.6 : 0;
      const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
      return { forward, turn, dragging: !!down };
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    },
  };
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * One step of the walker. walker: { x, z, yaw, pitch, v, turnV, hold }.
 * drive: { forward, turn, yawTarget?, speedMul?, dragging? }.
 * collide(from, dx, dz) → { x, z }. Returns the distance moved.
 */
export function stepWalker(walker, dt, drive, collide, { speed, longHold = false }) {
  // turning: arrows ease in/out; an autopilot/auto-drift steers toward yawTarget
  if (drive.yawTarget !== undefined && drive.yawTarget !== null) {
    const err = wrapAngle(drive.yawTarget - walker.yaw);
    const want = Math.max(-1.1, Math.min(1.1, err * 2.2));
    walker.turnV += (want - walker.turnV) * (1 - Math.exp(-dt / 0.25));
  } else {
    const want = (drive.turn || 0) * 1.35;
    walker.turnV += (want - walker.turnV) * (1 - Math.exp(-dt / 0.22));
  }
  walker.yaw = wrapAngle(walker.yaw + walker.turnV * dt);
  if (!drive.dragging) walker.pitch *= 1 - Math.min(1, dt * 0.7);

  // a long straight hold eases up to 2× (the corridor only, never on entry)
  if (longHold && drive.forward > 0 && Math.abs(walker.turnV) < 0.25) walker.hold += dt;
  else walker.hold = Math.max(0, walker.hold - dt * 3);
  const mul = (drive.speedMul || 1) * (longHold ? 1 + Math.min(1, Math.max(0, walker.hold - 4) / 6) : 1);

  const target = (drive.forward || 0) * speed * mul;
  const tau = Math.abs(target) > Math.abs(walker.v) ? 0.7 : 0.45;
  walker.v += (target - walker.v) * (1 - Math.exp(-dt / tau));
  if (Math.abs(walker.v) < 0.002 && !target) walker.v = 0;
  const dist = walker.v * dt;
  if (!dist) return 0;
  const dx = -Math.sin(walker.yaw) * dist;
  const dz = -Math.cos(walker.yaw) * dist;
  const to = collide({ x: walker.x, z: walker.z }, dx, dz);
  const moved = Math.hypot(to.x - walker.x, to.z - walker.z);
  walker.x = to.x;
  walker.z = to.z;
  // walking into a wall stops you gently rather than leaving you pushing
  if (moved < Math.abs(dist) * 0.3) walker.v *= 1 - Math.min(1, dt * 4);
  return moved;
}

export function yawTo(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

export { wrapAngle };
