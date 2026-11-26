#!/usr/bin/env node
/* walk-check: walking a spot's baked room as your character (/memories/:id/walk:
   pages/WalkPage.jsx + walk/), single player, in headless Edge on the real GPU, in EVERY seeded
   room with a GLB. (The multiplayer side, sockets / tickets / presence, has its own check.)

     npm run build && npx wrangler dev --port 8788      (restart wrangler after every build)
     node tools/memory-rooms/seed-dev.mjs --examples-only && node tools/memory-rooms/dev/seed-real-rooms.mjs
     node tools/memory-rooms/walk-check.mjs [--base http://127.0.0.1:8788] [--dark] [--only shed,mazda]
                                            [--quick] [--no-fps] [--swiftshader]

   Driven like a user (keyboard, mouse, real touch); the game instance
   (document.querySelector('[data-mr="walk"]').__walk) is only read, or used to set a scenario up
   (put the walker somewhere, point the camera somewhere).

   Checks
     entry     the spot page's "Walk in" link → /memories/:id/walk → the walk page; who = mr:who (James,
               Justin), no mr:who → the who picker first; a spot without a GLB has no link and the walk
               page says so; back to the spot: everything disposed (WebGL context lost, no rAF, GPU
               memory 0, listeners gone) and the spot viewer works again
     load      the full room.glb (never map.glb), ONE WebGL context, a ~5 cm walkable grid from the GLB,
               the spawn on it; the ground plate from the GLB matches scene.json (exteriors)
     walls     hold W into each wall (N, S, E, W from two start points, 5 s each; Shift where the room is
               longer than 5 s of walking, longer still on a big plate): every frame on a walkable
               cell AND inside the shell box (interiors) / on the ground plate (exteriors), no
               frame-to-frame step crosses geometry (raycast, both faces, 0.17–1.65 m), it moved as
               far as the way was clear and then stopped next to real geometry (or the box / plate
               edge), never inside it or under it; pushing at ±29° from each stop slides along;
               holding W against something while on a photo mark doesn't pop the photo; rugs don't block
     first     third person is OFF (src/memory-rooms/walk/flags.js, DECISIONS 217): the walk starts in first
               person at eye height with your sprite and tag hidden, V does nothing, there is no First / Third
               button, a photo returns to first person, the keys line has no "V". With the flag on, the third-
               person checks below run instead:
     view      third person: nothing visible hides your chest/head line (walls fade the dollhouse way,
               furniture hides), swept over 16 camera yaws at the wall stops + low camera angles
               (legs-only occlusion is listed, not failed); spinning the camera (mouse) to the outside
               of a wall hides that wall; tall furniture with the camera set on its far side hides
     keys      ←/→ turn, ↑ walks, Shift runs (speed), S / A / D walk straight with a steady camera
               (also after the 1.6 s follow delay), mouse drag turns, click → pointer lock (when
               headless allows it), wheel = camera distance (clamped), V first person and back,
               1 wave / 2 jump / 3 sit, E sits on every seat (each reachable from somewhere) and
               stands, Enter → chat (≤ 80 chars, typing doesn't walk, never stored), name tag,
               8-direction frames from heading vs camera; the room's server never has to `correct`
               a move (set-up jumps go in paced hops under its 7 m/s-over-1 s limit; the last states sent are shown)
     photo     walk onto a photo mark (keyboard at 1440, a tap at 390): data-view=photo, the right
               photo over a letterboxed view, the camera at that exact scene camera; moving off (or
               Esc) returns to first person (third with the flag on); E opens it again while standing on it
     touch     390 portrait (touch emulation): tap-to-walk to a far corner round furniture (A* on the
               same grid, path never crosses geometry, arrives), joystick, right-half look, pinch,
               interact + emote buttons, tap targets ≥ 44 px, controls in thumb reach, inputs ≥ 16 px,
               no horizontal overflow; landscape too
     perf      fps while walking: 1440 mouse ≥ 50, 390 touch + CPU ÷4 ≥ 30 (portrait and landscape),
               plus the walk's own tick time per frame (rAF is capped at the display rate, so that is
               the number that moves) and a busy-loop check that the throttle applied
     bundle    the map route (?map=atlas) loads no walk code or characters; the spot page loads
               WalkEntry only; characters come from one file; walk.css colours are tokens only
     console   zero console errors and zero page errors on every page
   Screenshots → memory-rooms-work/_page-check/walk-<room>-<w>-<scheme>.png (+ a few evidence shots).
   Exit 1 if anything fails. */

import { THIRD_PERSON_ENABLED as THIRD } from '../../src/memory-rooms/walk/flags.js';
import { EYE_M } from '../../src/memory-rooms/walk/scale.js';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { client, config, REPO, WORK } from './lib/api.mjs';
import { COPY } from '../../src/memory-rooms/copy.js';
import { aabb } from '../../src/memory-rooms/scene/geometry.js';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const base = opt('--base', 'http://127.0.0.1:8788').replace(/\/+$/, '');
const scheme = args.includes('--dark') ? 'dark' : 'light';
const only = opt('--only', null)?.split(',').map((s) => s.trim().toLowerCase());
const QUICK = args.includes('--quick');
const FPS_ON = !args.includes('--no-fps');
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const OUT = path.join(WORK, '_page-check');
fs.mkdirSync(OUT, { recursive: true });
const cfg = config();
cfg.base = base;
const api = client(cfg);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const W_COPY = COPY.walk;

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
};
const info = (line) => console.log(`  · ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sel = (name) => `[data-mr="${name}"]`;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v));
let current = null; // the page whose sections are running (to tag server corrections)
async function section(name, fn) {
  await current?.evaluate((n) => window.__wc && (window.__wc.during = n), name).catch(() => {});
  try {
    return await fn();
  } catch (e) {
    record(`${name}: ran without throwing`, false, e.message.split('\n')[0]);
    return null;
  }
}

/* ── which rooms ─────────────────────────────────────────────────────────── */

const slug = (t) =>
  t
    .replace(/\([^)]*\)/g, '')
    .replace(/[’']/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const roomModel = (s) => s.media.find((m) => m.type === 'model' && m.name === 'room') || s.media.find((m) => m.type === 'model' && m.name !== 'map');
const all = await api.listSpots();
const ROOMS = all
  .filter((s) => !s.deletedAt && roomModel(s) && s.scene)
  // a room of a whole place (shell { building, room }) is walked in place-walk-check: this check's walls and
  // area are the v1 / v2 box and polygon rooms'
  .filter((s) => {
    const inBuilding = Boolean(s.scene?.shell?.building);
    if (inBuilding) console.log(`  · ${s.title}: a room of a whole place, walked in place-walk-check (skipped here)`);
    // a landscape: a v1 diorama has no walk; a live one (site.terrain.live) has its own check (landscape/v2/walk-land.mjs)
    const landscape = Boolean(s.scene?.site?.terrain);
    if (landscape) console.log(`  · ${s.title}: a landscape, walked in landscape/v2/walk-land.mjs (skipped here)`);
    return !inBuilding && !landscape;
  })
  .map((s) => ({ spot: s, name: slug(s.title), kind: s.scene.kind }))
  .filter((r) => !only || only.some((o) => r.name.includes(o)));
if (!ROOMS.length) {
  console.error('No spots with a room.glb: run seed-dev.mjs --examples-only and dev/seed-real-rooms.mjs first.');
  process.exit(1);
}
console.log(`walk-check (${scheme}) at ${base}: ${ROOMS.map((r) => `${r.name} (${r.kind})`).join(', ')}\n`);

/* ── the browser + pages ─────────────────────────────────────────────────── */

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: [...(args.includes('--swiftshader') ? SOFT : GPU), '--autoplay-policy=no-user-gesture-required'] });

/** A page: width 1440 (mouse) | 390 (touch, portrait) | 'land' (844 × 390 touch). */
async function open(kind, { who = 'james', via = browser } = {}) {
  const page = await via.newPage();
  const phone = kind !== 1440;
  const viewport = kind === 'land' ? { width: 844, height: 390 } : phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.emulate({
    viewport: { ...viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, isLandscape: kind === 'land' },
    userAgent: phone ? IPHONE : await browser.userAgent(),
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.problems = [];
  page.requests = [];
  page.bodies = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.problems.push(`console.error: ${m.text()}`);
  });
  page.on('request', (r) => {
    page.requests.push(r.url());
    const body = r.postData?.();
    if (body) page.bodies.push(body);
  });
  await page.evaluateOnNewDocument(
    (token, who) => {
      try {
        localStorage.setItem('mr:token', token);
        if (who) localStorage.setItem('mr:who', who);
        else localStorage.removeItem('mr:who');
      } catch {
        /* ignore */
      }
      // every WebGL context the page makes, and where it was made
      window.__glContexts = [];
      const get = HTMLCanvasElement.prototype.getContext;
      const seen = new WeakSet();
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = get.call(this, type, ...rest);
        if (ctx && /webgl/.test(String(type)) && !seen.has(ctx)) {
          seen.add(ctx);
          window.__glContexts.push({ ctx, path: location.pathname, canvas: this });
        }
        return ctx;
      };
    },
    cfg.token,
    who,
  );
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
function noErrors(page, label) {
  record(`${label}: no console/page errors`, page.problems.length === 0, page.problems.slice(0, 3).join(' | '));
  page.problems.length = 0;
}
const ready = (page, timeout = 60000) =>
  page
    .waitForSelector(`${sel('walk')}[data-state="ready"]`, { timeout })
    .then(() => true)
    .catch(() => false);

/* ── in-page helpers (read state, set a scenario up, raycast the real geometry) ── */

function INSTALL(area) {
  const el = document.querySelector('[data-mr="walk"]');
  const g = el.__walk;
  const V3 = g.camera.position.constructor;
  const rc = new g.raycaster.constructor();
  const W = (window.__wc = { el, g, area });
  const meshes = [];
  g.room.root.traverse((o) => o.isMesh && meshes.push(o));
  W.meshes = meshes;
  const nameOf = (o) => {
    for (let n = o; n; n = n.parent) if (/^(obj__|wall_|floor|ceiling|ground)/.test(n.name || '')) return n.name;
    return o.name || '?';
  };
  W.frames = (n = 2) =>
    new Promise((r) => {
      let k = 0;
      const f = () => (++k >= n ? r() : requestAnimationFrame(f));
      requestAnimationFrame(f);
    });
  W.state = () => ({
    x: g.me.pos.x,
    z: g.me.pos.z,
    yaw: g.yaw,
    pitch: g.pitch,
    dist: g.dist,
    view: g.view,
    anim: g.animOf(g.me),
    sitting: g.me.sitting ? g.me.sitting.kit || 'floor' : null,
    heading: g.me.heading,
    ds: { ...el.dataset },
    cam: g.camera.position.toArray(),
    fov: g.camera.fov,
  });
  W.walkable = (x, z) => g.grid.walkable(x, z);
  W.inArea = (x, z) => x >= area.x0 && x <= area.x1 && z >= area.z0 && z <= area.z1;
  W.clearLine = (a, b) => {
    const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / g.grid.cell) * 2));
    for (let k = 0; k <= n; k++) if (!g.grid.walkable(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)) return false;
    return true;
  };
  W.freeRun = (x, z, dx, dz) => {
    let d = 0;
    while (d < 40 && g.grid.walkable(x + dx * (d + 0.01), z + dz * (d + 0.01))) d += 0.01;
    return d;
  };
  /** Scenario reset between tests: standing, third person (first while it's off), no path, no emote. */
  W.reset = () => {
    g.path = null;
    if (g.me.sitting) g.standUp();
    g.me.emote = null;
    if (g.view === 'first') g.toggleView(); // a no-op while third person is off (flags.js)
  };
  /* The room's server (workers/memory-walk.js) clamps any move faster than 7 m/s since your last
     state and sends a `correct` back, so a set-up jump waits until it is a plausible one. */
  W.corrections = [];
  W.sends = [];
  g.on('local', (s) => {
    W.sends.push({ t: Math.round(performance.now()), p: [s.p[0], s.p[2]], a: s.a });
    if (W.sends.length > 8) W.sends.shift();
  });
  const net = el.__walkNet;
  if (net?.on?.correct) {
    const orig = net.on.correct;
    net.on.correct = (m) => {
      const now = Math.round(performance.now());
      W.corrections.push({ t: now, p: m.p, at: [+g.me.pos.x.toFixed(2), +g.me.pos.z.toFixed(2)], view: g.view, path: Boolean(g.path), sitting: g.me.sitting?.id || g.me.sitting?.floor || null, during: W.during || '?', sent: W.sends.slice(-3).map((s) => `${s.a}@(${s.p[0].toFixed(2)},${s.p[1].toFixed(2)}) ${now - s.t}ms ago`).join(' ← ') });
      orig(m);
    };
  }
  W.put = async (x, z) => {
    if (g.view === 'photo') g.leavePhoto();
    if (g.photoView) g.photoView.t0 = performance.now() - 10000; // finish its fly-out now
    await W.frames(2);
    W.reset();
    // The room allows 7 m/s over at most 1 s since the last state (+ 1.2 m): a long set-up jump goes
    // in hops of ≤ 6 m, each paced at 6 m/s, so the server never has to correct it.
    const x0 = g.me.pos.x;
    const z0 = g.me.pos.z;
    const d = Math.hypot(x - x0, z - z0);
    const hops = Math.max(1, Math.ceil(d / 6));
    for (let k = 1; k <= hops; k++) {
      const need = (d / hops / 6) * 1000 + 60 - (performance.now() - g.sent.at);
      if (d > 0.5 && need > 0) await new Promise((r) => setTimeout(r, need));
      // a mark you stood on may have opened its photo meanwhile
      if (g.view === 'photo') g.leavePhoto();
      if (g.photoView) g.photoView.t0 = performance.now() - 10000;
      W.reset();
      g.teleport(x0 + ((x - x0) * k) / hops, z0 + ((z - z0) * k) / hops);
    }
    g.me.still = 0;
    await W.frames(1);
  };
  // ── the real geometry: raycasts against every room mesh ──
  const cast = (o, d, far) => {
    rc.set(o, d);
    rc.near = 0;
    rc.far = far;
    return rc.intersectObjects(meshes, false);
  };
  /** Collision queries see both faces of everything, visible or hidden (a hidden wall is still a wall). */
  const bothSides = (fn) => {
    const saved = [];
    for (const m of meshes) for (const mat of [].concat(m.material)) saved.push([mat, mat.side]);
    for (const [mat] of saved) mat.side = 2;
    try {
      return fn();
    } finally {
      for (const [mat, s] of saved) mat.side = s;
    }
  };
  const HEIGHTS = [0.17, 0.3, 0.45, 0.75, 1.0, 1.3, 1.65]; // the grid's band is 0.15–1.7 m (a kerb counts)
  /** Nearest geometry around (x, z) at body heights, within a fan (centre angle a0 ± half) or all round. */
  W.clearance = (x, z, far = 0.6, a0 = null, half = Math.PI) =>
    bothSides(() => {
      let best = { d: Infinity, name: null };
      const n = a0 === null ? 32 : 15;
      for (const h of HEIGHTS) {
        for (let k = 0; k < n; k++) {
          const a = a0 === null ? (k / n) * Math.PI * 2 : a0 - half + (2 * half * k) / (n - 1);
          const hit = cast(new V3(x, h, z), new V3(Math.sin(a), 0, Math.cos(a)), far)[0];
          if (hit && hit.distance < best.d) best = { d: hit.distance, name: nameOf(hit.object), h };
        }
      }
      if (!Number.isFinite(best.d)) best.d = 99; // nothing within reach (JSON has no Infinity)
      // something overhead inside the body band (a table top, a loft deck, a bunk)
      const up = cast(new V3(x, 0.16, z), new V3(0, 1, 0), 1.5)[0];
      best.overhead = up ? `${nameOf(up.object)} at ${(0.16 + up.distance).toFixed(2)} m` : null;
      return best;
    });
  /** Frame-to-frame steps that pass through geometry (body heights). pts: [[x, z]…] */
  W.crossings = (pts, every = 2) =>
    bothSides(() => {
      const out = [];
      for (let i = every; i < pts.length; i += every) {
        const a = pts[i - every];
        const b = pts[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-4) continue;
        const d = new V3((b[0] - a[0]) / len, 0, (b[1] - a[1]) / len);
        for (const h of [0.3, 0.8, 1.4]) {
          const hit = cast(new V3(a[0], h, a[1]), d, len)[0];
          if (hit) {
            out.push({ i, at: [+a[0].toFixed(2), +a[1].toFixed(2)], h, name: nameOf(hit.object) });
            break;
          }
        }
      }
      return out;
    });
  const visibleChain = (o) => {
    for (let n = o; n; n = n.parent) if (!n.visible) return false;
    return true;
  };
  const opaque = (hit) => {
    const m = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
    return m && m.visible !== false && (!m.transparent || m.opacity >= 0.5);
  };
  /** What visible, opaque geometry stands between the camera and your body (as drawn: material sides as they are). */
  W.blockedView = () => {
    const cam = g.camera.position.clone();
    const out = [];
    for (const h of [0.6, 1.1, 1.6]) {
      const tgt = new V3(g.me.pos.x, h, g.me.pos.z);
      const dir = tgt.clone().sub(cam);
      const len = dir.length();
      dir.normalize();
      const hit = cast(cam, dir, Math.max(0.01, len - 0.15)).find((x) => visibleChain(x.object) && opaque(x));
      if (hit) out.push({ h, name: nameOf(hit.object), d: +hit.distance.toFixed(2), len: +len.toFixed(2) });
    }
    return out;
  };
  /** Furniture-between scenarios: you a step from a piece, the camera on its far side (set up), lowish. */
  W.furnitureCases = async (max = 3) => {
    const out = [];
    const tall = g.blockers.filter((b) => b.box.max.y >= 0.8 && b.box.min.y < 1.2 && (b.box.max.x - b.box.min.x) * (b.box.max.z - b.box.min.z) < 0.4 * g.grid.area + 4);
    tall.sort((a, b) => b.box.max.y - a.box.max.y);
    const { nx, nz, walk } = g.grid;
    for (const b of tall) {
      if (out.length >= max) break;
      const c = b.box.getCenter(new V3());
      // a walkable cell 0.3–1.0 m from the box (horizontally)
      let spot = null;
      for (let j = 0; j < nz && !spot; j += 2)
        for (let i = 0; i < nx; i += 2) {
          if (!walk[j * nx + i]) continue;
          const p = g.grid.centreOf(i, j);
          const dx = Math.max(b.box.min.x - p.x, 0, p.x - b.box.max.x);
          const dz = Math.max(b.box.min.z - p.z, 0, p.z - b.box.max.z);
          const d = Math.hypot(dx, dz);
          if (d >= 0.3 && d <= 1.0) {
            spot = p;
            break;
          }
        }
      if (!spot) continue;
      await W.put(spot.x, spot.z);
      const yaw = Math.atan2(c.x - spot.x, c.z - spot.z); // the camera sits toward the piece, beyond it
      let hit = false;
      for (const pitch of [0.3, 0.45, 0.6]) {
        await W.aim(yaw, pitch, 3.6);
        const cam = g.camera.position.clone();
        const dir = new V3(spot.x, 1.1, spot.z).sub(cam);
        const len = dir.length();
        const p = new V3();
        const ray = new g.raycaster.ray.constructor(cam, dir.clone().normalize());
        if (ray.intersectBox(b.box, p) && p.distanceTo(cam) < len - 0.15) {
          hit = true;
          out.push({ name: b.node.name, pitch, hidden: !b.node.visible, blocked: W.blockedView().map((x) => `${x.name}@${x.h}`) });
          break;
        }
      }
      if (!hit) continue;
    }
    return out;
  };
  W.fades = () => Object.fromEntries(Object.entries(g.room.fades).map(([k, f]) => [k, +f.value.toFixed(2)]));
  W.wallVisible = (side) => (g.room.walls[side] || []).some((o) => o.visible);
  W.settle = async () => {
    for (let k = 0; k < 90; k++) {
      await W.frames(1);
      if (Object.values(g.room.fades).every((f) => f.value === f.target)) break;
    }
    await W.frames(2);
  };
  /** Set the third-person camera (scenario set-up), then let fades and blockers catch up. */
  W.aim = async (yaw, pitch = g.pitch, dist = g.dist) => {
    g.yaw = yaw;
    g.pitch = pitch;
    g.dist = dist;
    g.lastLook = performance.now();
    await W.settle();
  };
  W.project = (x, y, z) => {
    const v = new V3(x, y, z).project(g.camera);
    const rect = g.canvas.getBoundingClientRect();
    const r = g.viewRect();
    return { x: rect.left + r.x + ((v.x + 1) / 2) * r.w, y: rect.top + r.y + ((1 - v.y) / 2) * r.h, z: v.z };
  };
  // ── recorder: one sample per frame ──
  W.startRec = () => {
    const r = (W.rec = { pts: [], views: [], on: true });
    const t0 = performance.now();
    const tick = (t) => {
      if (!r.on) return;
      r.pts.push([+(t - t0).toFixed(1), g.me.pos.x, g.me.pos.z]); // raw: a stop sits exactly on a cell edge
      if (r.views[r.views.length - 1] !== g.view) r.views.push(g.view);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  W.stopRec = () => {
    const r = W.rec;
    r.on = false;
    r.off = r.pts.filter((p) => !g.grid.walkable(p[1], p[2])).length;
    r.offFirst = r.pts.find((p) => !g.grid.walkable(p[1], p[2])) || null;
    r.outside = r.pts.filter((p) => !W.inArea(p[1], p[2])).length;
    return { pts: r.pts, views: r.views, off: r.off, offFirst: r.offFirst, outside: r.outside };
  };
  // ── grid maths for choosing scenarios ──
  const nb8 = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  /** Distance (m) from each walkable cell to the nearest unwalkable one. */
  W.openness = () => {
    const { nx, nz, walk, cell } = g.grid;
    const d = new Float32Array(nx * nz);
    for (let k = 0; k < d.length; k++) d[k] = walk[k] ? 1e9 : 0;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!d[k]) continue;
        if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 1);
        if (j > 0) d[k] = Math.min(d[k], d[k - nx] + 1);
        if (i > 0 && j > 0) d[k] = Math.min(d[k], d[k - nx - 1] + Math.SQRT2);
        if (i < nx - 1 && j > 0) d[k] = Math.min(d[k], d[k - nx + 1] + Math.SQRT2);
        if (i === 0 || j === 0) d[k] = Math.min(d[k], 1);
      }
    for (let j = nz - 1; j >= 0; j--)
      for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i;
        if (!d[k]) continue;
        if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + 1);
        if (j < nz - 1) d[k] = Math.min(d[k], d[k + nx] + 1);
        if (i < nx - 1 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx + 1] + Math.SQRT2);
        if (i > 0 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx - 1] + Math.SQRT2);
        if (i === nx - 1 || j === nz - 1) d[k] = Math.min(d[k], 1);
      }
    for (let k = 0; k < d.length; k++) d[k] *= cell;
    return d;
  };
  /** Two start points: the most open walkable spots, away from photo marks and each other. */
  W.startPoints = () => {
    const { nx, walk } = g.grid;
    const d = W.openness();
    const ks = [];
    for (let k = 0; k < d.length; k++) if (walk[k] && d[k] > 0.12) ks.push(k);
    ks.sort((a, b) => d[b] - d[a]);
    const at = (k) => ({ ...g.grid.centreOf(k % nx, Math.floor(k / nx)), open: +d[k].toFixed(2) });
    const farFromMarks = (p) => g.marks.every((m) => Math.hypot(m.x - p.x, m.z - p.z) > 0.65);
    const out = [];
    for (const k of ks) {
      const p = at(k);
      if (!farFromMarks(p)) continue;
      if (out.length === 0) out.push(p);
      else if (Math.hypot(p.x - out[0].x, p.z - out[0].z) > Math.min(2.5, Math.sqrt(g.grid.area) * 0.45)) {
        out.push(p);
        break;
      }
    }
    return out;
  };
  /** Geodesic distance (m) over walkable cells from (x, z): Dijkstra on 8 neighbours, no corner cutting. */
  W.geodesic = (x, z) => {
    const { nx, nz, walk, cell } = g.grid;
    const [si, sj] = g.grid.cellOf(x, z);
    const dist = new Float64Array(nx * nz).fill(Infinity);
    const s = sj * nx + si;
    if (!walk[s]) return dist;
    dist[s] = 0;
    const heap = [[0, s]];
    const push = (f, k) => {
      heap.push([f, k]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const end = heap.pop();
      if (heap.length) {
        heap[0] = end;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [dk, k] = pop();
      if (dk > dist[k]) continue;
      const i = k % nx;
      const j = (k - i) / nx;
      for (const [di, dj, c] of nb8) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = jj * nx + ii;
        if (!walk[kk]) continue;
        if (di && dj && (!walk[j * nx + ii] || !walk[jj * nx + i])) continue;
        const nd = dk + c * cell;
        if (nd < dist[kk]) {
          dist[kk] = nd;
          push(nd, kk);
        }
      }
    }
    return dist;
  };
  /** Far targets that need routing round something (the straight line is blocked), farthest first. */
  W.farTargets = (avoidMarks = 0.6) => {
    const { nx, walk } = g.grid;
    const from = { x: g.me.pos.x, z: g.me.pos.z };
    const geo = W.geodesic(from.x, from.z);
    let max = 0;
    for (let k = 0; k < geo.length; k++) if (walk[k] && Number.isFinite(geo[k])) max = Math.max(max, geo[k]);
    const open = W.openness();
    const cands = [];
    for (let k = 0; k < geo.length; k++) {
      if (!walk[k] || !Number.isFinite(geo[k]) || geo[k] < 0.5 * max) continue;
      const p = g.grid.centreOf(k % nx, Math.floor(k / nx));
      if (open[k] < 0.08) continue;
      if (g.marks.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < avoidMarks)) continue;
      if (W.clearLine(from, p)) continue;
      cands.push({ ...p, geo: geo[k], straight: Math.hypot(p.x - from.x, p.z - from.z) });
    }
    cands.sort((a, b) => b.geo - a.geo);
    const out = [];
    for (const c of cands) {
      if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > 0.6)) out.push(c);
      if (out.length >= 30) break;
    }
    return { max, out };
  };
  /** Find a camera (scenario set-up) that draws floor point (x, z) somewhere a thumb can tap it. */
  W.frameTarget = async (x, z, safe) => {
    const me = g.me.pos;
    if (g.view === 'first') {
      // first person: face the target and look down until it's drawn where a thumb can tap it
      const toward = Math.atan2(x - me.x, z - me.z);
      for (const pitch of [-0.15, -0.3, -0.45, -0.6, -0.8, -1.0]) {
        for (const off of [0, 0.25, -0.25, 0.5, -0.5]) {
          g.yaw = toward + off;
          g.fpPitch = pitch;
          g.lastLook = performance.now();
          await W.settle();
          const p = W.project(x, 0, z);
          if (p.z <= -1 || p.z >= 1) continue;
          if (p.x < safe.x0 || p.x > safe.x1 || p.y < safe.y0 || p.y > safe.y1) continue;
          if (document.elementFromPoint(p.x, p.y) !== g.canvas) continue;
          return { x: Math.round(p.x), y: Math.round(p.y), yaw: g.yaw, pitch, dist: 0 };
        }
      }
      return null;
    }
    const away = Math.atan2(me.x - x, me.z - z); // the camera sits on the far side of you from the target
    for (const dist of [3.6, 5.5, 7.5, 9]) {
      for (const pitch of [0.55, 0.8, 1.05, 1.25]) {
        for (const off of [0, 0.35, -0.35, 0.7, -0.7]) {
          await W.aim(away + off, pitch, dist);
          const p = W.project(x, 0, z);
          if (p.z <= -1 || p.z >= 1) continue;
          if (p.x < safe.x0 || p.x > safe.x1 || p.y < safe.y0 || p.y > safe.y1) continue;
          if (document.elementFromPoint(p.x, p.y) !== g.canvas) continue;
          return { x: Math.round(p.x), y: Math.round(p.y), yaw: g.yaw, pitch, dist };
        }
      }
    }
    return null;
  };
  W.nearestWalkable = (x, z) => {
    const { nx, nz, walk } = g.grid;
    let best = null;
    let bd = Infinity;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        if (!walk[j * nx + i]) continue;
        const p = g.grid.centreOf(i, j);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) {
          bd = d;
          best = { ...p, d };
        }
      }
    return best;
  };
  /** The walkable spot nearest a seat's front from which E sits on THAT seat (null: nowhere). Probes
      the game's own nearestSeat() from every walkable cell (your position is put back after). */
  W.seatSpot = (id) => {
    const { nx, nz, walk } = g.grid;
    const seat = g.seats.find((s) => s.id === id);
    const keep = g.me.pos.clone();
    let best = null;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        if (!walk[j * nx + i]) continue;
        const p = g.grid.centreOf(i, j);
        g.me.pos.set(p.x, 0, p.z);
        if (g.nearestSeat()?.id !== id) continue;
        const d = Math.hypot(p.x - seat.edge.x, p.z - seat.edge.z);
        if (!best || d < best.d) best = { ...p, d };
      }
    g.me.pos.copy(keep);
    return best;
  };
  /** A walkable point 0.5–1.8 m from (x, z) with a clear straight line to it, clear of other marks. */
  W.approach = (x, z, self) => {
    const { nx, nz, walk } = g.grid;
    let best = null;
    for (let j = 0; j < nz; j += 2)
      for (let i = 0; i < nx; i += 2) {
        if (!walk[j * nx + i]) continue;
        const p = g.grid.centreOf(i, j);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < 0.5 || d > 1.8) continue;
        // start clear of the other marks (walking over one is fine: a mark needs you to stand still)
        if (g.marks.some((m) => m !== self && Math.hypot(m.x - p.x, m.z - p.z) < 0.45)) continue;
        if (!W.clearLine(p, { x, z })) continue;
        const score = Math.abs(d - 1.2);
        if (!best || score < best.score) best = { ...p, score };
      }
    return best;
  };
  /** The sprite's current sheet cell (and whether it is mirrored). */
  W.cell = () => {
    const s = g.me.sprite;
    const L = s.L;
    const mirror = s.tex.repeat.x < 0;
    const col = Math.round(s.tex.offset.x * L.cols - (mirror ? 1 : 0));
    const row = Math.round((1 - s.tex.offset.y) * L.rows - 1);
    return { cell: row * L.cols + col, mirror };
  };
  return {
    grid: { nx: g.grid.nx, nz: g.grid.nz, cell: g.grid.cell, area: +g.grid.area.toFixed(2), start: g.grid.start },
    gridMs: g.gridMs,
    interior: g.room.interior,
    marks: g.marks.map((m) => ({ photo: m.photo, x: m.x, z: m.z })),
    seats: g.seats.map((s) => ({ id: s.id, kit: s.kit, edge: s.edge, heading: s.heading, size: s.size })),
    walls: Object.fromEntries(Object.entries(g.room.walls).map(([k, v]) => [k, v.length])),
    ground: (() => {
      let gr = null;
      g.room.root.traverse((o) => {
        if (!gr && /^ground/.test(o.name || '')) gr = o;
      });
      if (!gr) return null;
      const b = new (g.bounds.constructor)().setFromObject(gr);
      return [b.min.x, b.min.z, b.max.x, b.max.z];
    })(),
    dpr: g.renderer.getPixelRatio(),
    who: g.who,
  };
}
const install = (page, area) => page.evaluate(INSTALL, area);
const st = (page) => page.evaluate(() => window.__wc.state());

/** Area the walker must stay in: the shell box (interiors) / the ground plate (exteriors). */
function areaOf(spot) {
  const sc = spot.scene;
  if (sc.kind === 'interior' && sc.shell) return { kind: 'interior', x0: 0, x1: sc.shell.width, z0: 0, z1: sc.shell.depth };
  const [w, d] = sc.site?.ground?.size || [0, 0];
  return { kind: 'exterior', x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 };
}

/* ── mouse + keyboard helpers (1440) ─────────────────────────────────────── */

const CX = 720;
const CY = 470;
/** Mouse drag on the canvas: dx px → yaw −0.006·dx (WalkGame.look). */
async function drag(page, dx, dy = 0) {
  const x0 = CX - dx / 2;
  const y0 = CY - dy / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 14 });
  await page.mouse.up();
}
/** Turn the third-person camera so W walks along `look` (radians, atan2(dx, dz)), by mouse drag. */
async function faceBy(page, look) {
  const s = await st(page);
  const goal = s.view === 'first' ? look : look - Math.PI;
  const px = Math.round(-wrap(goal - s.yaw) / 0.006);
  if (Math.abs(px) < 1) return;
  if (Math.abs(px) < 12) {
    await drag(page, px + 60);
    await drag(page, -60);
  } else await drag(page, px);
}
async function hold(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await wait(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}
const DIRS = { north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2 }; // look angle atan2(dx, dz)

/* ── per room, 1440 (mouse + keyboard) ───────────────────────────────────── */

const fpsRows = [];
let chatDone = false;
let framesDone = false;

for (const room of ROOMS) {
  const { spot, name } = room;
  const area = areaOf(spot);
  const label = `${name}`;
  console.log(`\n── ${spot.title} (${room.kind}) ─────────────────────────────`);
  const page = await open(1440);
  current = page;
  let G = null;

  // entry: the spot page's Walk in link → the walk page
  await section(`${label} entry`, async () => {
    await page.goto(`${base}/memories/${spot.id}`, { waitUntil: 'networkidle2' });
    const viewer = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 90000 }).then(() => true).catch(() => false);
    const link = await page.waitForSelector(sel('walk-link'), { visible: true, timeout: 15000 }).catch(() => null);
    const href = link ? await link.evaluate((a) => a.getAttribute('href')) : null;
    const text = link ? await link.evaluate((a) => a.textContent.trim()) : null;
    record(`${label}: the spot page shows "${W_COPY.link}" → /memories/:id/walk`, viewer && href === `/memories/${spot.id}/walk` && text === W_COPY.link, `viewer ${viewer ? 'ready' : 'NOT ready'}, href ${href}`);
    const walkReqBefore = page.requests.filter((u) => /\/assets\/WalkPage-|traveller-/.test(u)).length;
    record(`${label}: the spot page loads WalkEntry only (not the walk page or characters)`, page.requests.some((u) => /\/assets\/WalkEntry-/.test(u)) && walkReqBefore === 0, `${walkReqBefore} walk-page/character request(s)`);
    const glBefore = await page.evaluate(() => window.__glContexts.length);
    page.requests.length = 0;
    if (link) await link.click();
    const ok = await ready(page);
    const url = new URL(page.url()).pathname;
    record(`${label}: clicking it opens the walk page and the room loads`, ok && url === `/memories/${spot.id}/walk`, `${url}, state ${await page.$eval(sel('walk'), (e) => e.dataset.state).catch(() => 'none')}`);
    if (!ok) return;
    const gl = await page.evaluate((n) => ({ made: window.__glContexts.slice(n).length, live: window.__glContexts.filter((c) => !c.ctx.isContextLost()).length, walk: window.__glContexts.slice(n).filter((c) => /\/walk$/.test(c.path)).length }), glBefore);
    record(`${label}: one WebGL context on the walk page (the spot viewer's is released)`, gl.made === 1 && gl.live === 1, `${gl.made} made on the walk page, ${gl.live} live`);
    const glbs = page.requests.filter((u) => /\/model\/(room|map)\.glb/.test(u));
    record(`${label}: loads the full room.glb (not map.glb)`, glbs.some((u) => /\/model\/room\.glb/.test(u)) && !glbs.some((u) => /\/model\/map\.glb/.test(u)), glbs.map((u) => u.match(/model\/\w+\.glb/)[0]).join(', '));
  });

  const ok = await page.$(`${sel('walk')}[data-state="ready"]`);
  if (!ok) {
    record(`${label}: walk page ready`, false);
    await shot(page, `walk-${name}-1440`);
    noErrors(page, `${label} 1440`);
    await page.close();
    continue;
  }
  G = await install(page, area);

  // load: grid from the GLB
  await section(`${label} load`, async () => {
    const s = await st(page);
    const startOk = await page.evaluate((x, z) => window.__wc.walkable(x, z), s.x, s.z);
    record(
      `${label}: a ${G.grid.cell * 100} cm walkable grid built from the GLB, the spawn on it`,
      Math.abs(G.grid.cell - 0.05) < 1e-9 && G.grid.area > 1 && startOk,
      `${G.grid.nx}×${G.grid.nz} cells, ${G.grid.area} m² walkable, built in ${G.gridMs} ms, spawn (${f2(s.x)}, ${f2(s.z)}), ${G.marks.length} photo marks, ${G.seats.length} seats (${G.seats.map((x) => x.kit).join(', ') || 'none'})`,
    );
    if (area.kind === 'exterior') {
      const gr = G.ground;
      const okPlate = gr && Math.abs(gr[0] - area.x0) < 0.05 && Math.abs(gr[1] - area.z0) < 0.05 && Math.abs(gr[2] - area.x1) < 0.05 && Math.abs(gr[3] - area.z1) < 0.05;
      record(`${label}: the GLB's ground plate matches scene.json's site.ground`, Boolean(okPlate), gr ? `GLB x ${f2(gr[0])}…${f2(gr[2])}, z ${f2(gr[1])}…${f2(gr[3])}` : 'no ground node');
    }
    if (/she-?d/.test(name)) {
      // the octagon: the corners of its bounding box are outside its walls
      const corners = await page.evaluate((a) => [[0.3, 0.3], [a.x1 - 0.3, 0.3], [0.3, a.z1 - 0.3], [a.x1 - 0.3, a.z1 - 0.3]].map(([x, z]) => window.__wc.walkable(x, z)), area);
      record(`${label}: the octagon's cut-off corners are not walkable`, corners.every((v) => !v), corners.join(' '));
    }
    const tag = await page.evaluate(() => {
      const t = document.querySelector('.mr-walk__tag[data-self]');
      return t ? { text: t.querySelector('.mr-walk__name').textContent, hidden: t.hidden } : null;
    });
    if (THIRD) record(`${label}: your name tag shows "${COPY.app.people.james}" over your character`, tag?.text === COPY.app.people.james && !tag.hidden && G.who === 'james', JSON.stringify(tag));
    else record(`${label}: first person: your name tag is "${COPY.app.people.james}" and hidden (your head is the camera)`, tag?.text === COPY.app.people.james && tag.hidden && G.who === 'james', JSON.stringify(tag));
    await wait(600);
    await shot(page, `walk-${name}-1440`);
  });

  // walls: hold W into each wall from two start points
  const stops = [];
  await section(`${label} walls`, async () => {
    const starts = await page.evaluate(() => window.__wc.startPoints());
    info(`start points ${starts.map((p) => `(${f2(p.x)}, ${f2(p.z)}) open ${p.open} m`).join(', ')}`);
    const runs = [];
    for (const [si, start] of starts.slice(0, QUICK ? 1 : 2).entries()) {
      for (const [dirName, look] of Object.entries(DIRS)) {
        const dir = [Math.sin(look), Math.cos(look)];
        await page.evaluate((x, z) => window.__wc.put(x, z), start.x, start.z);
        await faceBy(page, look);
        const free = await page.evaluate((x, z, dx, dz) => window.__wc.freeRun(x, z, dx, dz), start.x, start.z, dir[0], dir[1]);
        const run = free > 6.5; // a long hall: Shift, so the hold reaches the far side
        // at least 5 s; longer only where even running can't reach the far side in 5 s (a big plate)
        const holdMs = Math.max(5000, Math.round((free / (run ? 3.4 : 1.5) + 1.5) * 1000));
        const before = await st(page);
        await page.evaluate(() => window.__wc.startRec());
        await hold(page, run ? ['ShiftLeft', 'KeyW'] : ['KeyW'], holdMs);
        await wait(80);
        const rec = await page.evaluate(() => window.__wc.stopRec());
        const pts = rec.pts;
        const last = pts[pts.length - 1];
        const tEnd = last[0];
        const at1 = pts.find((p) => p[0] >= tEnd - 1000) || pts[0];
        const tail = Math.hypot(last[1] - at1[1], last[2] - at1[2]);
        const moved = (last[1] - before.x) * dir[0] + (last[2] - before.z) * dir[1];
        const xs = pts.map((p) => [p[1], p[2]]);
        const crossings = await page.evaluate((xs) => window.__wc.crossings(xs, 2), xs);
        const ahead = await page.evaluate((x, z, a) => window.__wc.clearance(x, z, 0.6, a, 1.2), last[1], last[2], look);
        const around = await page.evaluate((x, z) => window.__wc.clearance(x, z, 0.3), last[1], last[2]);
        const edge = Math.min(...[dir[0] > 0.5 ? area.x1 - last[1] : Infinity, dir[0] < -0.5 ? last[1] - area.x0 : Infinity, dir[1] > 0.5 ? area.z1 - last[2] : Infinity, dir[1] < -0.5 ? last[2] - area.z0 : Infinity]);
        const against = ahead.d <= 0.45 || edge <= 0.3;
        const inside = around.d >= 0.1 && !around.overhead;
        const photoFlash = rec.views.includes('photo');
        const r = { start: si, dirName, free, run, moved, tail, off: rec.off, offFirst: rec.offFirst, outside: rec.outside, crossings, ahead, around, edge, against, inside, photoFlash, n: pts.length, end: [last[1], last[2]] };
        runs.push(r);
        if (si === 0) stops.push({ dirName, look, x: last[1], z: last[2] });
        const okRun = rec.off === 0 && rec.outside === 0 && crossings.length === 0 && moved >= Math.min(free, 0.3) - 0.12 && moved >= free - 0.15 && tail < 0.02 && against && inside;
        record(
          `${label}: hold ${run ? 'Shift+' : ''}W ${dirName} ${(holdMs / 1000).toFixed(0)} s from start ${si + 1}: stays walkable + inside, moves, stops against something`,
          okRun,
          `moved ${f2(moved)} m of ${f2(free)} m clear, last 1 s ${(tail * 100).toFixed(1)} cm, ${rec.off}/${pts.length} frames off-grid${rec.offFirst ? ` (first at ${f2(rec.offFirst[1])}, ${f2(rec.offFirst[2])})` : ''}, ${rec.outside} outside the ${area.kind === 'interior' ? 'shell box' : 'plate'}, ${crossings.length} steps through geometry${crossings[0] ? ` (${crossings[0].name} at ${crossings[0].at})` : ''}, stopped ${ahead.d < 1 ? `${f2(ahead.d)} m from ${ahead.name}` : `${f2(edge)} m from the ${area.kind === 'interior' ? 'box' : 'plate'} edge`}, nearest geometry ${f2(around.d)} m${around.overhead ? `, UNDER ${around.overhead}` : ''}`,
        );
        if (photoFlash) info(`a photo opened during the ${dirName} push from start ${si + 1} (views ${rec.views.join(' → ')})`);
      }
    }
    const flashes = runs.filter((r) => r.photoFlash);
    record(`${label}: holding W against a wall never pops a photo open`, flashes.length === 0, flashes.map((r) => `${r.dirName}@start${r.start + 1} ended (${f2(r.end[0])}, ${f2(r.end[1])})`).join('; '));

    // angled pushes from where each run stopped (up against something): you slide along it
    let slid = 0;
    const slideNotes = [];
    for (const stop of stops) {
      let best = null;
      for (const off of [0.5, -0.5]) {
        const look = stop.look + off; // 29° off straight into what stopped you
        const dir = [Math.sin(look), Math.cos(look)];
        await page.evaluate((x, z) => window.__wc.put(x, z), stop.x, stop.z);
        await faceBy(page, look);
        await page.evaluate(() => window.__wc.startRec());
        await hold(page, ['KeyW'], QUICK ? 1000 : 1500);
        const rec = await page.evaluate(() => window.__wc.stopRec());
        let side = 0;
        let total = 0;
        for (let i = 3; i < rec.pts.length; i += 3) {
          const dx = rec.pts[i][1] - rec.pts[i - 3][1];
          const dz = rec.pts[i][2] - rec.pts[i - 3][2];
          const len = Math.hypot(dx, dz);
          if (len < 5e-4) continue;
          total += len;
          if ((dx * dir[0] + dz * dir[1]) / len < Math.cos((20 * Math.PI) / 180)) side += len;
        }
        const crossings = await page.evaluate((xs) => window.__wc.crossings(xs, 2), rec.pts.map((p) => [p[1], p[2]]));
        const note = `${stop.dirName}${off > 0 ? '+' : '−'}29°: ${f2(total)} m, ${f2(side)} m of it sliding${rec.off ? `, ${rec.off} OFF-GRID` : ''}${rec.outside ? `, ${rec.outside} OUTSIDE` : ''}${crossings.length ? `, THROUGH ${crossings[0].name}` : ''}`;
        if (rec.off || rec.outside || crossings.length) record(`${label}: angled push ${stop.dirName}${off > 0 ? '+' : '−'}29° stays walkable and inside`, false, note);
        if (!best || side > best.side) best = { side, note };
      }
      if (best.side >= 0.1) slid += 1;
      slideNotes.push(best.note);
    }
    record(`${label}: pushing at an angle into what stopped you slides along it (not a dead stop)`, slid >= Math.min(2, stops.length), `${slid}/${stops.length} stops slide: ${slideNotes.join('; ')}`);
  });

  // view: nothing visible between the camera and you (walls fade, furniture hides)
  if (!THIRD)
    await section(`${label} first person`, async () => {
      await page.evaluate(() => window.__wc.settle());
      await page.evaluate(() => window.__wc.frames(3));
      const fp = await page.evaluate(() => {
        const g = window.__wc.g;
        const t = document.querySelector('.mr-walk__tag[data-self]');
        return { view: window.__wc.el.dataset.view, gview: g.view, cam: g.camera.position.toArray(), me: [g.me.pos.x, g.me.pos.y, g.me.pos.z], sprite: g.me.sprite.mesh.visible, tag: t?.hidden ?? true, btn: Boolean(document.querySelector('[data-mr="walk-view"]')), keys: document.querySelector('.mr-walk__keys')?.textContent || '', fades: window.__wc.fades() };
      });
      record(
        `${label}: walking in starts in first person (eye height, your sprite + tag hidden, walls all drawn)`,
        fp.view === 'first' && fp.gview === 'first' && Math.abs(fp.cam[1] - fp.me[1] - EYE_M) < 0.01 && Math.hypot(fp.cam[0] - fp.me[0], fp.cam[2] - fp.me[2]) < 0.01 && !fp.sprite && fp.tag && Object.values(fp.fades || {}).every((v) => v >= 0.99),
        `view ${fp.view}, eye ${f2(fp.cam[1] - fp.me[1])} m, sprite ${fp.sprite ? 'DRAWN' : 'hidden'}, tag ${fp.tag ? 'hidden' : 'SHOWN'}`,
      );
      await page.keyboard.press('KeyV');
      await page.evaluate(() => window.__wc.frames(3));
      const afterV = await page.evaluate(() => ({ view: window.__wc.el.dataset.view, gview: window.__wc.g.view }));
      await page.evaluate(() => window.__wc.g.toggleView()); // the method itself is off too
      await page.evaluate(() => window.__wc.frames(3));
      const afterCall = await page.evaluate(() => window.__wc.g.view);
      record(
        `${label}: no way into third person: V does nothing, no First / Third button, toggleView() is off, the keys line has no "V"`,
        afterV.view === 'first' && afterV.gview === 'first' && afterCall === 'first' && !fp.btn && !/\bV\b/.test(fp.keys),
        `after V: ${afterV.view}; after toggleView(): ${afterCall}; button ${fp.btn ? 'PRESENT' : 'none'}; keys "${fp.keys}"`,
      );
    });
  if (THIRD)
  await section(`${label} view`, async () => {
    // a real spin: walk into each wall, drag the camera round to its far side
    for (const stop of stops) {
      await page.evaluate((x, z) => window.__wc.put(x, z), stop.x, stop.z);
      await page.evaluate((look) => window.__wc.aim(look - Math.PI, 0.55, 3.6), stop.look);
      await drag(page, -Math.round(Math.PI / 0.006)); // +π: the camera swings to the other side of you, past the wall you face
      await page.evaluate(() => window.__wc.settle());
      const v = await page.evaluate((side) => ({ blocked: window.__wc.blockedView(), fades: window.__wc.fades(), visible: side ? window.__wc.wallVisible(side) : null, cam: window.__wc.g.camera.position.toArray() }), area.kind === 'interior' ? stop.dirName : null);
      const nearWall = area.kind === 'interior' && { north: stop.z - area.z0, south: area.z1 - stop.z, west: stop.x - area.x0, east: area.x1 - stop.x }[stop.dirName] < 0.6;
      const camOutside = area.kind === 'interior' && !(v.cam[0] > area.x0 && v.cam[0] < area.x1 && v.cam[2] > area.z0 && v.cam[2] < area.z1);
      const wallHidden = nearWall && camOutside ? v.visible === false && v.fades[stop.dirName] === 0 : true;
      record(
        `${label}: camera spun (mouse) to the far side of the ${stop.dirName} stop: ${nearWall && camOutside ? `the ${stop.dirName} wall hides, ` : ''}nothing blocks the view`,
        wallHidden && !v.blocked.some((b) => b.h >= 1.1),
        `${v.blocked.length ? `blocked by ${[...new Set(v.blocked.map((b) => b.name))].join(', ')} (at ${v.blocked.map((b) => b.h).join('/')} m)` : 'clear'}${nearWall && camOutside ? `, ${stop.dirName} wall ${v.visible ? 'DRAWN' : 'hidden'} (fade ${v.fades[stop.dirName]})` : ''}`,
      );
      if (v.blocked.some((b) => b.h >= 1.1)) await shot(page, `walk-${name}-1440-blocked-${stop.dirName}`);
    }
    // a sweep: 16 yaws at each stop, + a low camera at the start points
    const bad = [];
    let n = 0;
    const starts = await page.evaluate(() => window.__wc.startPoints());
    const configs = [];
    for (const stop of stops) for (let k = 0; k < 16; k++) configs.push({ x: stop.x, z: stop.z, yaw: (k / 16) * Math.PI * 2, pitch: 0.55, where: `${stop.dirName} stop` });
    for (const [i, p] of starts.entries()) for (let k = 0; k < 8; k++) configs.push({ x: p.x, z: p.z, yaw: (k / 8) * Math.PI * 2, pitch: 0.2, where: `start ${i + 1} low` });
    for (const c of QUICK ? configs.filter((_, i) => i % 2 === 0) : configs) {
      const v = await page.evaluate(async (c) => {
        await window.__wc.put(c.x, c.z);
        await window.__wc.aim(c.yaw, c.pitch, 3.6);
        return window.__wc.blockedView();
      }, c);
      n += 1;
      if (v.length) bad.push({ ...c, by: [...new Set(v.map((b) => b.name))].join('+'), hs: v.map((b) => b.h).join('/') });
    }
    // a failure = your chest or head hidden; legs-only (0.6 m line) is listed as a note
    const hard = bad.filter((b) => b.hs.split('/').some((h) => Number(h) >= 1.1));
    const legs = bad.filter((b) => !hard.includes(b));
    const fmt = (list) => list.slice(0, 4).map((b) => `${b.where} yaw ${Math.round((b.yaw * 180) / Math.PI)}° pitch ${b.pitch} by ${b.by} (at ${b.hs} m)`).join('; ');
    record(
      `${label}: third person, swept over ${n} camera angles: no visible wall or furniture hides you (chest/head line)`,
      hard.length === 0,
      hard.length ? `${hard.length}/${n} blocked: ${fmt(hard)}` : '',
    );
    if (legs.length) info(`legs only (0.6 m line) hidden in ${legs.length}/${n}: ${fmt(legs)}`);
    if (hard.length) {
      const b = hard[0];
      await page.evaluate(async (c) => {
        await window.__wc.put(c.x, c.z);
        await window.__wc.aim(c.yaw, c.pitch, 3.6);
      }, b);
      await shot(page, `walk-${name}-1440-blocked-sweep`);
    }
    // furniture: a piece between the camera and you hides
    const fc = await page.evaluate(() => window.__wc.furnitureCases(3));
    if (fc.length) {
      record(
        `${label}: furniture between the camera and you is hidden (${fc.length} pieces, camera set on their far side)`,
        fc.every((c) => c.hidden && !c.blocked.some((b) => Number(b.split('@')[1]) >= 1.1)),
        fc.map((c) => `${c.name} ${c.hidden ? 'hidden' : 'DRAWN'}${c.blocked.length ? ` (view blocked by ${c.blocked.join('+')})` : ''}`).join(', '),
      );
    } else info('no tall furniture with a spot beside it to stand the camera behind');
    await page.evaluate(() => window.__wc.aim(window.__wc.g.yaw, 0.55, 3.6));
  });

  // rugs and other flat things don't block
  await section(`${label} rugs`, async () => {
    const rugs = (spot.scene.objects || []).filter((o) => o.kit === 'rug');
    if (!rugs.length) return;
    const others = (spot.scene.objects || []).filter((o) => o.kit !== 'rug' && o.at[1] + o.size[1] >= 0.15 && o.at[1] <= 1.7).map((o) => aabb(o));
    for (const rug of rugs) {
      const b = aabb(rug);
      const pts = [];
      for (let x = b.min[0] + 0.05; x < b.max[0]; x += 0.1)
        for (let z = b.min[2] + 0.05; z < b.max[2]; z += 0.1) {
          const clearOfOthers = others.every((o) => x < o.min[0] - 0.35 || x > o.max[0] + 0.35 || z < o.min[2] - 0.35 || z > o.max[2] + 0.35);
          const clearOfEdge = area.kind !== 'interior' || (x > area.x0 + 0.4 && x < area.x1 - 0.4 && z > area.z0 + 0.4 && z < area.z1 - 0.4);
          if (clearOfOthers && clearOfEdge) pts.push([x, z]);
        }
      if (!pts.length) {
        info(`rug "${rug.id}": all of it lies under or next to other furniture`);
        continue;
      }
      const ok = await page.evaluate((pts) => pts.filter(([x, z]) => window.__wc.walkable(x, z)).length, pts);
      record(`${label}: the rug "${rug.id}" doesn't block (open floor on it is walkable)`, ok / pts.length >= 0.9, `${ok}/${pts.length} points on the rug clear of other furniture are walkable`);
    }
  });

  // keys: turn, walk, run, drag, wheel, V, emotes, frames
  const startA = (await page.evaluate(() => window.__wc.startPoints()))[0];
  await section(`${label} keys`, async () => {
    await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
    await page.evaluate(() => window.__wc.settle());
    let s0 = await st(page);
    await hold(page, ['ArrowLeft'], 500);
    let s1 = await st(page);
    record(`${label}: ← turns the camera (keyboard only)`, s1.yaw - s0.yaw > 0.6 && Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.01, `yaw +${f2(s1.yaw - s0.yaw)} rad in 0.5 s, moved ${f2(Math.hypot(s1.x - s0.x, s1.z - s0.z))} m`);
    s0 = await st(page);
    await hold(page, ['ArrowRight'], 500);
    s1 = await st(page);
    record(`${label}: → turns the other way`, s0.yaw - s1.yaw > 0.6, `yaw −${f2(s0.yaw - s1.yaw)} rad`);
    // walking + running speed along the most open direction
    const best = await page.evaluate((x, z) => {
      let b = null;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const d = window.__wc.freeRun(x, z, Math.sin(a), Math.cos(a));
        if (!b || d > b.d) b = { a, d };
      }
      return b;
    }, startA.x, startA.z);
    const speedOf = (rec) => {
      let v = 0;
      for (let i = 0; i < rec.pts.length; i++) {
        const j = rec.pts.findIndex((p) => p[0] >= rec.pts[i][0] + 150);
        if (j < 0) break;
        v = Math.max(v, Math.hypot(rec.pts[j][1] - rec.pts[i][1], rec.pts[j][2] - rec.pts[i][2]) / ((rec.pts[j][0] - rec.pts[i][0]) / 1000));
      }
      return v;
    };
    const speeds = {};
    for (const [mode, keys] of [['walk', ['ArrowUp']], ['run', ['ShiftLeft', 'KeyW']]]) {
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      await faceBy(page, best.a);
      await page.evaluate(() => window.__wc.startRec());
      await hold(page, keys, Math.min(700, Math.max(250, ((best.d - 0.3) / (mode === 'run' ? 3.4 : 1.5)) * 1000)));
      const rec = await page.evaluate(() => window.__wc.stopRec());
      speeds[mode] = speedOf(rec);
    }
    record(`${label}: ↑ walks (~1.5 m/s), Shift+W runs (~3.4 m/s)`, Math.abs(speeds.walk - 1.5) < 0.3 && Math.abs(speeds.run - 3.4) < 0.5, `walk ${f2(speeds.walk)} m/s, run ${f2(speeds.run)} m/s (${f2(best.d)} m clear)`);

    // S walks back, A/D step sideways: in a straight line, also once the camera's follow kicks in
    // (it swings in behind you after 1.6 s without a look)
    const lines = [];
    for (const [key, yawOff] of [['KeyS', 0], ['KeyD', -Math.PI / 2], ['KeyA', Math.PI / 2]]) {
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      // the key then walks along best.a (first person looks ALONG yaw, third looks back at you from it)
      await page.evaluate((y) => window.__wc.aim(y, 0.55, 3.6), best.a + yawOff + (THIRD ? 0 : Math.PI));
      await wait(1900); // longer than the follow delay
      const y0 = (await st(page)).yaw;
      await page.evaluate(() => window.__wc.startRec());
      await hold(page, [key], Math.round(Math.min(1500, Math.max(400, ((best.d - 0.3) / 1.5) * 1000))));
      const rec = await page.evaluate(() => window.__wc.stopRec());
      const y1 = (await st(page)).yaw;
      let len = 0;
      for (let i = 1; i < rec.pts.length; i++) len += Math.hypot(rec.pts[i][1] - rec.pts[i - 1][1], rec.pts[i][2] - rec.pts[i - 1][2]);
      const a = rec.pts[0];
      const b = rec.pts[rec.pts.length - 1];
      const chord = Math.hypot(b[1] - a[1], b[2] - a[2]);
      const dev = chord > 0.01 ? Math.abs(wrap(Math.atan2(b[1] - a[1], b[2] - a[2]) - best.a)) : Math.PI;
      lines.push({ key: key.slice(3), dyaw: y1 - y0, len, straight: len ? chord / len : 0, dev: (dev * 180) / Math.PI });
    }
    record(
      `${label}: S walks back and A/D step sideways in a straight line, the camera steady (after the follow delay)`,
      lines.every((l) => Math.abs(l.dyaw) < 0.35 && l.straight > 0.9 && l.dev < 20),
      lines.map((l) => `${l.key}: camera turned ${f2(l.dyaw)} rad, ${f2(l.len)} m walked, straightness ${f2(l.straight)}, ${Math.round(l.dev)}° off`).join('; '),
    );

    // mouse drag turns (back at the start point: a run can end on a photo mark)
    await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
    s0 = await st(page);
    await drag(page, 120);
    s1 = await st(page);
    record(`${label}: a mouse drag turns the camera`, Math.abs(s1.yaw - s0.yaw + 0.72) < 0.03, `120 px → yaw ${f2(s1.yaw - s0.yaw)} rad`);

    // wheel: camera distance, clamped (third person only: first person has no camera distance)
    if (THIRD) {
    await page.mouse.move(CX, CY);
    s0 = await st(page);
    await page.mouse.wheel({ deltaY: 300 });
    await wait(150);
    s1 = await st(page);
    await page.mouse.wheel({ deltaY: -4000 });
    await wait(150);
    const sMin = await st(page);
    await page.mouse.wheel({ deltaY: 4000 });
    await wait(150);
    const sMax = await st(page);
    const camDist = await page.evaluate(() => {
      const g = window.__wc.g;
      return Math.hypot(g.camera.position.x - g.me.pos.x, g.camera.position.y - 1.15, g.camera.position.z - g.me.pos.z);
    });
    record(
      `${label}: the wheel sets the camera distance (clamped 1.3–9 m)`,
      sMax.view === 'third' && s1.dist > s0.dist * 1.3 && Math.abs(sMin.dist - 1.3) < 0.01 && Math.abs(sMax.dist - 9) < 0.01 && Math.abs(camDist - 9) < 0.15,
      `${f2(s0.dist)} → ${f2(s1.dist)} m (+300), min ${f2(sMin.dist)}, max ${f2(sMax.dist)}, camera ${f2(camDist)} m from you (view ${sMax.view})`,
    );
    await page.mouse.wheel({ deltaY: Math.round(Math.log(3.6 / 9) / 0.0012) });
    await wait(100);

    // V: first person and back
    await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
    await page.evaluate(() => window.__wc.settle());
    await page.keyboard.press('KeyV');
    await page.evaluate(() => window.__wc.frames(3));
    const fp = await page.evaluate(() => {
      const g = window.__wc.g;
      const t = document.querySelector('.mr-walk__tag[data-self]');
      const btn = document.querySelector('[data-mr="walk-view"]');
      return { view: window.__wc.el.dataset.view, cam: g.camera.position.toArray(), me: [g.me.pos.x, g.me.pos.z], sprite: g.me.sprite.mesh.visible, tag: t.hidden, fov: g.camera.fov, btn: btn?.textContent, pressed: btn?.getAttribute('aria-pressed'), fades: window.__wc.fades() };
    });
    record(
      `${label}: V → first person (eye height, your sprite + tag hidden, walls all drawn)`,
      fp.view === 'first' && Math.abs(fp.cam[1] - EYE_M) < 0.01 && Math.hypot(fp.cam[0] - fp.me[0], fp.cam[2] - fp.me[1]) < 0.01 && !fp.sprite && fp.tag && fp.btn === W_COPY.view.third && fp.pressed === 'true',
      `view ${fp.view}, eye ${f2(fp.cam[1])} m, sprite ${fp.sprite ? 'drawn' : 'hidden'}, tag ${fp.tag ? 'hidden' : 'shown'}, button "${fp.btn}" pressed=${fp.pressed}`,
    );
    // first person: W walks where you look
    const look = await page.evaluate((x, z) => {
      let b = null;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const d = window.__wc.freeRun(x, z, Math.sin(a), Math.cos(a));
        if (!b || d > b.d) b = { a, d };
      }
      return b;
    }, startA.x, startA.z);
    await faceBy(page, look.a);
    s0 = await st(page);
    await hold(page, ['KeyW'], 400);
    s1 = await st(page);
    const fwd = [Math.sin(s1.yaw), Math.cos(s1.yaw)];
    const mv = [s1.x - s0.x, s1.z - s0.z];
    const mlen = Math.hypot(...mv);
    record(`${label}: first person, W walks where you look`, mlen > 0.2 && (mv[0] * fwd[0] + mv[1] * fwd[1]) / mlen > 0.95, `moved ${f2(mlen)} m, cos to the view ${f2((mv[0] * fwd[0] + mv[1] * fwd[1]) / (mlen || 1))}`);
    await page.click(sel('walk-view'));
    await page.evaluate(() => document.activeElement?.blur());
    await page.evaluate(() => window.__wc.settle());
    const tp = await page.evaluate(() => {
      const g = window.__wc.g;
      return { view: window.__wc.el.dataset.view, cam: g.camera.position.toArray(), me: [g.me.pos.x, g.me.pos.z], yaw: g.yaw, pitch: g.pitch, dist: g.dist, sprite: g.me.sprite.mesh.visible };
    });
    const horiz = Math.hypot(tp.cam[0] - tp.me[0], tp.cam[2] - tp.me[1]);
    const behind = ((tp.cam[0] - tp.me[0]) * fwd[0] + (tp.cam[2] - tp.me[1]) * fwd[1]) / (horiz || 1);
    record(
      `${label}: the view button returns to third person: behind and above you`,
      tp.view === 'third' && tp.sprite && behind < -0.9 && tp.cam[1] > 1.6 && Math.abs(horiz - tp.dist * Math.cos(tp.pitch)) < 0.05,
      `view ${tp.view}, sprite ${tp.sprite ? 'drawn' : 'HIDDEN'}, camera ${f2(horiz)} m back (cos to your heading ${f2(behind)}; dist ${f2(tp.dist)}, pitch ${f2(tp.pitch)}), ${f2(tp.cam[1])} m up`,
    );
    } else {
      // first person (the only view): W walks where you look
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      await page.evaluate(() => window.__wc.settle());
      const look = await page.evaluate((x, z) => {
        let b = null;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const d = window.__wc.freeRun(x, z, Math.sin(a), Math.cos(a));
          if (!b || d > b.d) b = { a, d };
        }
        return b;
      }, startA.x, startA.z);
      await faceBy(page, look.a);
      s0 = await st(page);
      await hold(page, ['KeyW'], 400);
      s1 = await st(page);
      const fwd = [Math.sin(s1.yaw), Math.cos(s1.yaw)];
      const mv = [s1.x - s0.x, s1.z - s0.z];
      const mlen = Math.hypot(...mv);
      record(`${label}: first person, W walks where you look`, mlen > 0.2 && (mv[0] * fwd[0] + mv[1] * fwd[1]) / mlen > 0.95, `moved ${f2(mlen)} m, cos to the view ${f2((mv[0] * fwd[0] + mv[1] * fwd[1]) / (mlen || 1))}`);
    }

    // emotes: 1 wave, 2 jump, 3 sit (floor, away from seats) / 3 again stands
    const away = await page.evaluate(() => {
      const W = window.__wc;
      const ok = (p) => W.g.seats.every((s) => Math.hypot(s.edge.x - p.x, s.edge.z - p.z) > 2.2) && W.g.marks.every((m) => Math.hypot(m.x - p.x, m.z - p.z) > 0.6);
      return W.startPoints().find(ok) || null;
    });
    if (away) await page.evaluate((x, z) => window.__wc.put(x, z), away.x, away.z);
    const idleCell = await page.evaluate(() => window.__wc.cell());
    await page.keyboard.press('Digit1');
    await page.evaluate(() => window.__wc.frames(3));
    const w1 = await page.evaluate(() => ({ anim: window.__wc.el.dataset.anim, cell: window.__wc.cell() }));
    await wait(1900);
    const w2 = await st(page);
    await page.keyboard.press('Digit2');
    await page.evaluate(() => window.__wc.frames(3));
    const j1 = await page.evaluate(() => ({ anim: window.__wc.el.dataset.anim, cell: window.__wc.cell() }));
    await wait(1100);
    const j2 = await st(page);
    record(
      `${label}: 1 waves, 2 jumps (frames from the sheet), then back to idle`,
      w1.anim === 'wave' && w1.cell.cell !== idleCell.cell && w2.anim === 'idle' && j1.anim === 'jump' && j1.cell.cell !== idleCell.cell && j2.anim === 'idle',
      `wave ${w1.anim} cell ${w1.cell.cell} → ${w2.anim}; jump ${j1.anim} cell ${j1.cell.cell} → ${j2.anim}; idle cell ${idleCell.cell}${away ? '' : ' (no spot 2 m from seats)'}`,
    );
    // (a human pause between presses: sitting hops you up to ~1.7 m, and the room's server only
    // allows 1.2 m + 7 m/s since your last state, so two hops 15 ms apart would be clamped)
    await wait(250);
    await page.keyboard.press('Digit3');
    await page.evaluate(() => window.__wc.frames(3));
    const sit = await st(page);
    await wait(250);
    await page.keyboard.press('Digit3');
    await page.evaluate(() => window.__wc.frames(3));
    const stand = await st(page);
    const expectSit = away ? 'floor' : sit.sitting;
    record(`${label}: 3 sits (on the floor away from seats), 3 again stands`, sit.ds.sitting === expectSit && sit.anim === 'sit' && !stand.ds.sitting && stand.anim === 'idle', `sitting=${sit.ds.sitting} anim ${sit.anim} → sitting=${stand.ds.sitting ?? '–'} anim ${stand.anim}`);
    // the buttons do the same (first person: they show only while someone else is in the room to see them)
    if (THIRD) {
      await page.click(sel('walk-emote-wave'));
      await page.evaluate(() => window.__wc.frames(3));
      const bw = await st(page);
      await page.evaluate(() => document.activeElement?.blur());
      record(`${label}: the Wave button waves`, bw.anim === 'wave', bw.anim);
      await wait(1700);
    } else {
      record(`${label}: first person, alone: no Wave / Jump / Sit buttons (you can't see yourself; the keys still work)`, !(await page.$(sel('walk-emote-wave'))) && !(await page.$(sel('walk-emote-jump'))) && !(await page.$(sel('walk-emote-sit'))));
      await wait(1700);
    }

    // 8-direction frames: the frame follows your heading against the camera's angle (your own sprite: third person
    // only; the others' sprites, which first person still shows, are walk-mp-check's)
    if (!framesDone && THIRD) {
      framesDone = true;
      const seen = await page.evaluate(async () => {
        const W = window.__wc;
        const out = new Set();
        let facing = 0;
        for (let k = 0; k < 16; k++) {
          await W.aim((k / 16) * Math.PI * 2);
          const c = W.cell();
          out.add(`${c.cell}${c.mirror ? 'm' : ''}`);
          const s = W.g.me.sprite.mesh;
          const toCam = Math.atan2(W.g.camera.position.x - s.position.x, W.g.camera.position.z - s.position.z);
          if (Math.abs(Math.atan2(Math.sin(s.rotation.y - toCam), Math.cos(s.rotation.y - toCam))) < 1e-3) facing += 1;
        }
        return { n: out.size, cells: [...out], facing };
      });
      record(`${label}: idle frames: 8 directions as the camera circles you, the sprite always facing the camera`, seen.n === 8 && seen.facing === 16, `${seen.n} distinct frames (${seen.cells.join(' ')}), camera-facing ${seen.facing}/16`);
      // walking away from the camera shows the back ('north' walk frames)
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      await faceBy(page, best.a);
      await page.keyboard.down('KeyW');
      await wait(300);
      const back = await page.evaluate(() => window.__wc.cell());
      await page.keyboard.up('KeyW');
      const northCells = await page.evaluate(() => window.__wc.g.me.sprite.L.anims.walk.north);
      record(`${label}: walking away from the camera shows your back (walk "north" frames)`, northCells.includes(back.cell) && !back.mirror, `cell ${back.cell}, north cells ${northCells.join(',')}`);
    }
  });

  // seats: E sits, E stands; moving stands too
  await section(`${label} seats`, async () => {
    if (!G.seats.length) {
      const sittable = (spot.scene.objects || []).filter((o) => /bench|banquette|seat|couch|chair|stool/i.test(`${o.id} ${o.kit}`) && !['chair', 'stool', 'armchair', 'sofa', 'bed', 'bunk'].includes(o.kit));
      info(`no seats in this room's scene.json${sittable.length ? ` (looks sittable but not a seat kit: ${sittable.map((o) => `${o.id}=${o.kit}`).join(', ')})` : ''}`);
      return;
    }
    let firstSpot = null;
    for (const seat of G.seats.slice(0, QUICK ? 1 : 6)) {
      const spotAt = await page.evaluate((id) => window.__wc.seatSpot(id), seat.id);
      if (!spotAt) {
        const near = await page.evaluate((x, z) => window.__wc.nearestWalkable(x, z), seat.edge.x, seat.edge.z);
        record(`${label}: seat "${seat.id}" (${seat.kit}) can be reached on foot and sat on`, false, `no walkable spot sits you on it (E there picks another seat or none); the nearest walkable spot is ${f2(near.d)} m from its front (${f2(seat.edge.x)}, ${f2(seat.edge.z)})`);
        continue;
      }
      firstSpot ??= { seat, at: spotAt };
      await page.evaluate((x, z) => window.__wc.put(x, z), spotAt.x, spotAt.z);
      await page.evaluate(() => window.__wc.frames(4));
      const hint = await page.$eval(sel('walk-hint'), (e) => e.textContent).catch(() => null);
      const act = await page.$eval(sel('walk-interact'), (e) => e.textContent).catch(() => null);
      const kitSeen = hint && /sit on the (\w+)/.exec(hint)?.[1];
      await wait(250); // human pace (see the 3 / 3 check)
      await page.keyboard.press('KeyE');
      await page.evaluate(() => window.__wc.frames(3));
      const s1 = await page.evaluate(() => {
        const g = window.__wc.g;
        return { sitting: window.__wc.el.dataset.sitting, anim: window.__wc.el.dataset.anim, x: g.me.pos.x, z: g.me.pos.z, heading: g.me.heading, seat: g.me.sitting?.id, hint: document.querySelector('[data-mr="walk-hint"]')?.textContent };
      });
      const sat = G.seats.find((x) => x.id === s1.seat);
      await wait(250);
      await page.keyboard.press('KeyE');
      await page.evaluate(() => window.__wc.frames(3));
      const s2 = await st(page);
      const standOk = !s2.ds.sitting && s2.anim === 'idle' && (await page.evaluate((x, z) => window.__wc.walkable(x, z), s2.x, s2.z));
      record(
        `${label}: seat "${seat.id}" (${seat.kit}): hint, E sits facing out, E stands back on the floor`,
        hint === W_COPY.hint.seat(kitSeen) && act === W_COPY.interact.seat(kitSeen) && Boolean(sat) && s1.sitting === sat.kit && s1.anim === 'sit' && Math.hypot(s1.x - sat.edge.x, s1.z - sat.edge.z) < 0.01 && Math.abs(wrap(s1.heading - sat.heading)) < 0.01 && s1.hint === W_COPY.hint.stand && standOk,
        `from ${f2(spotAt.d)} m: hint "${hint}", sat on ${s1.seat} [${s1.sitting}, ${s1.anim}], then ${s2.ds.sitting ? 'still sitting' : `stood at (${f2(s2.x)}, ${f2(s2.z)})`}`,
      );
    }
    // moving stands you up
    if (!firstSpot) return;
    await page.evaluate((x, z) => window.__wc.put(x, z), firstSpot.at.x, firstSpot.at.z);
    await wait(250);
    await page.keyboard.press('KeyE');
    await page.evaluate(() => window.__wc.frames(3));
    const a = await st(page);
    await wait(250);
    await hold(page, ['KeyS'], 200);
    const b = await st(page);
    if (a.sitting) record(`${label}: moving while seated stands you up`, !b.ds.sitting && b.anim !== 'sit', `${a.sitting} → ${b.ds.sitting ?? 'standing'}`);
  });

  // chat (once): Enter, typing doesn't walk, 80 chars, bubble, never stored
  if (!chatDone) {
    chatDone = true;
    await section(`${label} chat`, async () => {
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Enter');
      const input = await page.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 }).catch(() => null);
      const focus = input && (await page.evaluate(() => document.activeElement?.dataset.mr));
      const s0 = await st(page);
      await page.keyboard.type('wasd ');
      await wait(300);
      const s1 = await st(page);
      record(`${label}: Enter opens the chat line, focused; typing WASD in it doesn't walk`, Boolean(input) && focus === 'walk-chat-input' && Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.001, `focus ${focus}, moved ${f2(Math.hypot(s1.x - s0.x, s1.z - s0.z))} m`);
      const marker = `chk${Date.now().toString(36)}`;
      const long = `${marker} ${'x'.repeat(120)}`;
      await page.keyboard.type(long);
      const value = await page.$eval(sel('walk-chat-input'), (e) => e.value);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__wc.frames(3));
      const bubble = await page.evaluate(() => {
        const b = document.querySelector('.mr-walk__tag[data-self] .mr-walk__bubble');
        const r = b?.getBoundingClientRect();
        return b ? { text: b.textContent, hidden: b.hidden, w: r.width, h: r.height, subtitle: b.parentElement.hasAttribute('data-subtitle'), y: r.top / innerHeight } : null;
      });
      if (!THIRD) record(`${label}: first person: your own line shows as a subtitle low on the stage`, Boolean(bubble?.subtitle) && bubble.y > 0.5, bubble ? `subtitle ${bubble.subtitle}, at ${Math.round(bubble.y * 100)}% down` : 'no bubble');
      record(`${label}: the line takes at most 80 characters; Enter shows it in a bubble over you`, value.length === 80 && bubble && !bubble.hidden && bubble.text === value.trim() && bubble.text.length <= 80 && bubble.h > 0, `input ${value.length} chars, bubble ${bubble?.text.length} chars, ${bubble?.hidden ? 'hidden' : 'shown'}`);
      await shot(page, `walk-${name}-1440-chat`);
      const stored = await page.evaluate(async (marker) => {
        const hits = [];
        for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) if (String(s.getItem(s.key(i))).includes(marker)) hits.push(s.key(i));
        if (indexedDB.databases) {
          for (const db of await indexedDB.databases()) hits.push(`idb:${db.name}?`);
        }
        return hits;
      }, marker);
      const idbNames = stored.filter((h) => h.startsWith('idb:'));
      const inStorage = stored.filter((h) => !h.startsWith('idb:'));
      const posted = page.bodies.filter((b) => b.includes(marker)).length;
      record(`${label}: the chat line is never stored (no storage key, no HTTP body holds it)`, inStorage.length === 0 && posted === 0, `storage ${inStorage.join(', ') || 'clean'}, ${posted} HTTP bodies, IndexedDB dbs present: ${idbNames.join(', ') || 'none'}`);
      await wait(6400);
      const gone = await page.evaluate(() => document.querySelector('.mr-walk__tag[data-self] .mr-walk__bubble')?.hidden);
      record(`${label}: the bubble goes after ~6 s`, gone === true);
      // Escape closes an open chat without sending
      await page.keyboard.press('Enter');
      await page.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 }).catch(() => null);
      await page.keyboard.type('not sent');
      await page.keyboard.press('Escape');
      await wait(200);
      const closed = !(await page.$(sel('walk-chat-input')));
      const bub = await page.evaluate(() => document.querySelector('.mr-walk__tag[data-self] .mr-walk__bubble')?.hidden);
      record(`${label}: Escape closes the chat line without sending`, closed && bub === true);
    });
  }

  // photo marks: walk onto one (keyboard), the view blends into that exact photo
  await section(`${label} photo`, async () => {
    const photos = Object.fromEntries(spot.media.filter((m) => m.type === 'photo').map((m) => [Number(m.name), m]));
    const marks = G.marks.slice(0, QUICK ? 1 : 3);
    let eDone = false;
    let movedOff = false;
    for (const [mi, mark] of marks.entries()) {
      const cam = spot.scene.cameras.find((c) => c.photo === mark.photo);
      const ap = await page.evaluate((x, z, photo) => window.__wc.approach(x, z, window.__wc.g.marks.find((m) => m.photo === photo)), mark.x, mark.z, mark.photo);
      if (!ap) {
        record(`${label}: photo ${mark.photo}: a clear way onto its mark`, false, `no walkable spot 0.5–1.8 m away (clear of other marks) with a straight clear line to (${f2(mark.x)}, ${f2(mark.z)})`);
        continue;
      }
      await page.evaluate((x, z) => window.__wc.put(x, z), ap.x, ap.z);
      const look = Math.atan2(mark.x - ap.x, mark.z - ap.z);
      await faceBy(page, look);
      await page.keyboard.down('KeyW');
      await page
        .waitForFunction((x, z) => Math.hypot(window.__wc.g.me.pos.x - x, window.__wc.g.me.pos.z - z) < 0.1, { timeout: 4000, polling: 'raf' }, mark.x, mark.z)
        .catch(() => null);
      await page.keyboard.up('KeyW');
      const entered = await page.waitForFunction(() => window.__wc.el.dataset.view === 'photo', { timeout: 3000 }).then(() => true).catch(() => false);
      await wait(1400); // the fly (0.7 s) + the photo fade (0.42 s)
      const ps = await page.evaluate(() => {
        const W = window.__wc;
        const g = W.g;
        const img = g.photoEl;
        const r = img.getBoundingClientRect();
        const stage = W.el.getBoundingClientRect();
        const fwd = new g.camera.position.constructor(0, 0, -1).applyQuaternion(g.camera.quaternion);
        return { view: W.el.dataset.view, photo: W.el.dataset.photo, hidden: img.hidden, opacity: Number(getComputedStyle(img).opacity), src: img.currentSrc || img.src, natural: [img.naturalWidth, img.naturalHeight], rect: [r.x - stage.x, r.y - stage.y, r.width, r.height], stage: [stage.width, stage.height], cam: g.camera.position.toArray(), fwd: fwd.toArray(), fov: g.camera.fov, clear: g.clear.getHexString(), me: [g.me.pos.x, g.me.pos.z] };
      });
      const media = photos[mark.photo];
      const aspect = media?.width && media?.height ? media.width / media.height : cam.aspect ?? 0.75;
      const [SW, SH] = ps.stage;
      let rw = SW;
      let rh = SW / aspect;
      if (rh > SH) {
        rh = SH;
        rw = SH * aspect;
      }
      const box = [(SW - rw) / 2, (SH - rh) / 2, rw, rh];
      const boxErr = Math.max(...box.map((v, i) => Math.abs(v - ps.rect[i])));
      const want = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
      const wl = Math.hypot(...want);
      const angle = (Math.acos(Math.min(1, (want[0] * ps.fwd[0] + want[1] * ps.fwd[1] + want[2] * ps.fwd[2]) / wl)) * 180) / Math.PI;
      const camErr = Math.hypot(ps.cam[0] - cam.pos[0], ps.cam[1] - cam.pos[1], ps.cam[2] - cam.pos[2]);
      const vfov = aspect < 1 ? cam.fov ?? 70 : (2 * Math.atan(Math.tan(((cam.fov ?? 70) * Math.PI) / 360) / aspect) * 180) / Math.PI;
      const srcOk = new URL(ps.src, base).pathname.endsWith(`/photos/${mark.photo}.jpg`);
      // the letterbox band is the stage colour, the photo inside it isn't blank
      let band = 'n/a';
      let bandOk = true;
      const bandPx = Math.max(box[0], box[1]);
      if (bandPx >= 8) {
        const clip = box[1] >= 8 ? { x: Math.round(SW / 2 - 10), y: 2, width: 20, height: Math.min(6, Math.floor(box[1]) - 3) } : { x: 2, y: Math.round(SH / 2 - 10), width: Math.min(6, Math.floor(box[0]) - 3), height: 20 };
        const stat = await sharp(await page.screenshot({ clip })).stats();
        const mean = stat.channels.slice(0, 3).map((c) => c.mean);
        const want3 = [0, 2, 4].map((i) => parseInt(ps.clear.slice(i, i + 2), 16));
        const diff = Math.max(...mean.map((v, i) => Math.abs(v - want3[i])));
        bandOk = diff < 10;
        band = `band rgb(${mean.map((v) => Math.round(v)).join(',')}) vs stage #${ps.clear}`;
      }
      record(
        `${label}: photo ${mark.photo}: walking onto its mark blends into that exact photo, letterboxed`,
        entered && ps.view === 'photo' && ps.photo === String(mark.photo) && !ps.hidden && ps.opacity > 0.98 && srcOk && ps.natural[0] > 0 && boxErr < 2 && camErr < 0.02 && angle < 1 && Math.abs(ps.fov - vfov) < 0.5 && bandOk,
        `data-view ${ps.view} photo ${ps.photo}, img ${ps.hidden ? 'hidden' : 'shown'} opacity ${f2(ps.opacity)} ${srcOk ? `photos/${mark.photo}.jpg` : `WRONG ${ps.src}`} ${ps.natural.join('×')}, rect off by ${f2(boxErr)} px from the ${aspect.toFixed(3)} letterbox, camera ${(camErr * 100).toFixed(1)} cm / ${f2(angle)}° / fov ${f2(ps.fov)} vs ${f2(vfov)}, ${band}`,
      );
      if (mi === 0) await shot(page, `walk-${name}-1440-photo`);
      const backState = () =>
        page.evaluate(() => {
          const g = window.__wc.g;
          return { view: window.__wc.el.dataset.view, photo: window.__wc.el.dataset.photo ?? null, hidden: g.photoEl.hidden, pv: Boolean(g.photoView), d: Math.hypot(g.camera.position.x - g.me.pos.x, g.camera.position.z - g.me.pos.z), sprite: g.me.sprite.mesh.visible };
        });
      // back from a photo: third person (camera behind you, your sprite drawn), or first person while third is off
      const BACK = THIRD ? 'third' : 'first';
      const isBack = (b) => b.view === BACK && b.photo === null && b.hidden && !b.pv && (THIRD ? b.sprite && b.d > 1 : !b.sprite && b.d < 0.05);
      const backNote = (b) => `view ${b.view}, photo ${b.hidden ? 'hidden' : 'SHOWN'}, camera ${f2(b.d)} m from you`;
      // Esc returns to third person (you stay on the mark)
      await page.keyboard.press('Escape');
      await wait(1000);
      let back = await backState();
      record(`${label}: photo ${mark.photo}: Esc returns to ${BACK} person`, isBack(back), backNote(back));
      // on the mark again (disarmed): E opens the photo when no seat is in reach; else step off and back on
      const hintNow = await page.$eval(sel('walk-hint'), (e) => e.textContent).catch(() => null);
      let open = false;
      if (hintNow === W_COPY.hint.mark) {
        await page.keyboard.press('KeyE');
        open = await page.waitForFunction(() => window.__wc.el.dataset.view === 'photo', { timeout: 2000 }).then(() => true).catch(() => false);
        if (!eDone) record(`${label}: standing on a mark, E opens its photo`, open, `photo ${mark.photo}: ${open ? 'opened' : 'did not open'}`);
        eDone = true;
      } else if (!movedOff) {
        // step back off along the clear way in, then walk on again (a fresh look first, so the camera
        // doesn't start following mid-test)
        await page.evaluate(() => window.__wc.aim(window.__wc.g.yaw));
        await hold(page, ['KeyS'], 450);
        await page.keyboard.down('KeyW');
        await page.waitForFunction((x, z) => Math.hypot(window.__wc.g.me.pos.x - x, window.__wc.g.me.pos.z - z) < 0.1, { timeout: 3000, polling: 'raf' }, mark.x, mark.z).catch(() => null);
        await page.keyboard.up('KeyW');
        open = await page.waitForFunction(() => window.__wc.el.dataset.view === 'photo', { timeout: 3000 }).then(() => true).catch(() => false);
      }
      // moving off (S, back the clear way you came) returns to third person
      if (open && !movedOff) {
        movedOff = true;
        await wait(900);
        await page.evaluate(() => window.__wc.aim(window.__wc.g.yaw));
        await page.keyboard.down('KeyS');
        await wait(120);
        const leaving = await page.evaluate(() => ({ view: window.__wc.el.dataset.view, photo: window.__wc.el.dataset.photo ?? null }));
        await wait(330);
        await page.keyboard.up('KeyS');
        await wait(900);
        back = await backState();
        record(`${label}: photo ${mark.photo}: moving off returns to ${BACK} person`, leaving.view === BACK && leaving.photo === null && isBack(back), `as you move: view ${leaving.view}; after: ${backNote(back)}`);
      }
    }
    if (!eDone) info(`E on a photo mark: not tried (every tested mark has a seat in reach, and E sits first, as its hint says)`);
    if (!movedOff) record(`${label}: moving off a photo returns to third person`, false, 'could not get back into a photo to try');
  });

  // who: Justin's character (once per run is enough, in the first room)
  if (room === ROOMS[0]) {
    await section(`${label} who`, async () => {
      const p2 = await open(1440, { who: 'justin' });
      await p2.goto(`${base}/memories/${spot.id}/walk`, { waitUntil: 'networkidle2' });
      const okJ = await ready(p2);
      const j = okJ
        ? await p2.evaluate(() => {
            const g = document.querySelector('[data-mr="walk"]').__walk;
            return { who: g.who, tag: document.querySelector('.mr-walk__tag[data-self] .mr-walk__name')?.textContent, sheet: g.me.sprite.tex.image?.src || '' };
          })
        : null;
      record(`${label}: as Justin (mr:who) you are Justin's character`, okJ && j.who === 'justin' && j.tag === COPY.app.people.justin && /traveller-orange/.test(j.sheet), JSON.stringify(j));
      noErrors(p2, `${label} as Justin`);
      await p2.close();
      // no mr:who yet: the who picker first, then the walk as the one picked
      const ctx = await browser.createBrowserContext();
      const p3 = await open(1440, { who: null, via: ctx });
      await p3.goto(`${base}/memories/${spot.id}/walk`, { waitUntil: 'networkidle2' });
      const picker = await p3.waitForSelector(sel('who-justin'), { visible: true, timeout: 15000 }).catch(() => null);
      if (picker) await picker.click();
      const okP = picker && (await ready(p3));
      const who = okP ? await p3.evaluate(() => document.querySelector('[data-mr="walk"]').__walk.who) : null;
      record(`${label}: no one picked yet: the who picker comes first, then you walk as that person`, Boolean(picker) && okP && who === 'justin', `picker ${picker ? 'shown' : 'NOT shown'}, walking as ${who}`);
      noErrors(p3, `${label} who picker`);
      await p3.close();
      await ctx.close();
    });
  }

  // pointer lock (once): a click locks the pointer for mouse-look
  if (room === ROOMS[0]) {
    await section(`${label} pointer lock`, async () => {
      await page.evaluate((x, z) => window.__wc.put(x, z), startA.x, startA.z);
      await page.mouse.click(CX, CY);
      await wait(300);
      const locked = await page.evaluate(() => document.pointerLockElement === window.__wc.g.canvas);
      if (!locked) {
        info('a click asked for pointer lock; headless Edge did not grant it (not verifiable here)');
        return;
      }
      const s0 = await st(page);
      await page.mouse.move(CX + 100, CY);
      await wait(100);
      const s1 = await st(page);
      record(`${label}: a click locks the pointer and the mouse turns without a drag`, Math.abs(s1.yaw - s0.yaw) > 0.1, `yaw ${f2(s1.yaw - s0.yaw)}`);
      await page.evaluate(() => document.exitPointerLock());
    });
  }

  // leave: back to the spot, everything disposed, the spot viewer works
  await section(`${label} dispose`, async () => {
    await page.evaluate(() => {
      const g = window.__wc.g;
      const L = (window.__left = { g, gl: g.renderer.getContext(), canvas: g.canvas, tick: g.tick, scheduled: 0, ran: 0, mem0: { ...g.renderer.info.memory } });
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        if (cb === L.tick && L.g.disposed) L.scheduled += 1;
        return raf(cb);
      };
    });
    await page.click(sel('walk-back'));
    const viewer = await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).then(() => true).catch(() => false);
    await wait(1200);
    await page.keyboard.down('KeyW');
    await wait(100);
    await page.keyboard.up('KeyW');
    const d = await page.evaluate(() => {
      const L = window.__left;
      return { disposed: L.g.disposed, lost: L.gl.isContextLost(), attached: L.canvas.isConnected, scheduled: L.scheduled, raf: L.g.raf, mem0: L.mem0, mem: { ...L.g.renderer.info.memory }, keys: L.g.keys.size, walkEl: Boolean(document.querySelector('[data-mr="walk"]')), url: location.pathname, live: window.__glContexts.filter((c) => !c.ctx.isContextLost()).length };
    });
    record(
      `${label}: leaving (the Spot link) disposes the walk: context lost, canvas gone, no rAF, GPU memory freed, keys unhooked`,
      d.disposed && d.lost && !d.attached && d.scheduled === 0 && d.mem.geometries === 0 && d.mem.textures === 0 && d.keys === 0 && !d.walkEl,
      `context ${d.lost ? 'lost' : 'LIVE'}, canvas ${d.attached ? 'ATTACHED' : 'removed'}, ${d.scheduled} frames scheduled after, geometries ${d.mem0.geometries} → ${d.mem.geometries}, textures ${d.mem0.textures} → ${d.mem.textures}, keys held ${d.keys}`,
    );
    let fly = 'no viewpoint buttons';
    const vp = await page.$(`${sel('viewpoint')}[data-photo="1"]`);
    if (vp) {
      await vp.click();
      fly = (await page.waitForSelector(sel('blend-slider'), { timeout: 4000 }).catch(() => null)) ? 'viewpoint 1 flies + blend slider' : 'viewpoint 1: NO blend slider';
    }
    record(`${label}: the spot viewer works again after the walk (loads, a photo viewpoint flies)`, viewer && d.url === `/memories/${spot.id}` && d.live === 1 && fly.endsWith('slider'), `viewer ${viewer ? 'ready' : 'NOT ready'}, ${d.live} live WebGL context(s), ${fly}`);
  });

  const corr1440 = await page.evaluate(() => window.__wc?.corrections || []).catch(() => []);
  record(`${label} 1440: the room's server never had to correct a move (walking, running, sitting, set-up jumps paced)`, corr1440.length === 0, corr1440.slice(0, 3).map((c) => `during "${c.during}": at (${c.at}) → (${c.p[0]}, ${c.p[2]}), view ${c.view}${c.sitting ? `, sitting on ${c.sitting}` : ''}${c.path ? ', mid-path' : ''}; last sent: ${c.sent}`).join('; '));
  noErrors(page, `${label} 1440`);
  await page.close();

  /* ── 390 portrait: touch ── */
  const phone = await open(390);
  current = phone;
  await section(`${label} 390`, async () => {
    await phone.goto(`${base}/memories/${spot.id}/walk`, { waitUntil: 'networkidle2' });
    if (!(await ready(phone))) {
      record(`${label} 390: walk page ready`, false);
      return;
    }
    const P = await install(phone, area);
    const touchOn = await phone.evaluate(() => document.querySelector('.mr-walk').hasAttribute('data-touch'));
    record(`${label} 390: touch controls on, a lower pixel ratio`, touchOn && P.dpr <= 1.5, `data-touch ${touchOn}, pixel ratio ${P.dpr} (device 2)`);
    await wait(500);
    await shot(phone, `walk-${name}-390`);
    // controls: tap targets, thumb reach, overflow
    const ui = await phone.evaluate(() => {
      const H = innerHeight;
      const els = [...document.querySelectorAll('.mr-walk button, .mr-walk a')].filter((e) => e.getClientRects().length);
      return {
        small: els.map((e) => ({ m: e.dataset.mr, r: e.getBoundingClientRect() })).filter((x) => x.r.height < 44 || x.r.width < 44).map((x) => `${x.m} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
        reach: [...document.querySelectorAll('.mr-walk__buttons button')].map((e) => ({ m: e.dataset.mr, y: (e.getBoundingClientRect().top + e.getBoundingClientRect().bottom) / 2 / H, x: (e.getBoundingClientRect().left + e.getBoundingClientRect().right) / 2 / innerWidth })),
        overflow: document.documentElement.scrollWidth - innerWidth,
        n: els.length,
      };
    });
    const out = ui.reach.filter((r) => r.y < 0.6);
    record(`${label} 390: every button/link ≥ 44 px`, ui.small.length === 0, ui.small.join(', ') || `${ui.n} controls`);
    record(`${label} 390: emote/interact/chat/view buttons in thumb reach (lower 40%)`, out.length === 0 && ui.reach.length >= (THIRD ? 5 : 1), out.map((r) => `${r.m} at ${Math.round(r.y * 100)}%`).join(', ') || ui.reach.map((r) => `${r.m.replace('walk-', '')} ${Math.round(r.y * 100)}%`).join(' '));
    record(`${label} 390: no horizontal overflow`, ui.overflow <= 1, `${ui.overflow}px`);

    // tap-to-walk to a far corner round furniture (a real touch tap where it's drawn)
    const SAFE = { x0: 24, x1: 390 - 24, y0: 120, y1: 844 - 200 };
    const ft = await phone.evaluate(() => window.__wc.farTargets());
    let tapped = null;
    for (const target of ft.out.slice(0, 12)) {
      const at = await phone.evaluate((x, z, safe) => window.__wc.frameTarget(x, z, safe), target.x, target.z, SAFE);
      if (at) {
        tapped = { target, at };
        break;
      }
    }
    if (!tapped) {
      record(`${label} 390: a far corner that needs routing round furniture, drawn where a thumb can tap it`, false, `${ft.out.length} candidates (max geodesic ${f2(ft.max)} m), none on screen`);
    } else {
      const { target, at } = tapped;
      const s0 = await st(phone);
      await phone.evaluate(() => window.__wc.startRec());
      await phone.touchscreen.tap(at.x, at.y);
      await phone.waitForFunction(() => window.__wc.el.dataset.path && window.__wc.el.dataset.path !== 'arrived', { timeout: 2000 }).catch(() => null);
      const plan = await phone.evaluate(() => (window.__wc.g.path || []).map((p) => [p.x, p.z]));
      const arrived = await phone.waitForFunction(() => window.__wc.el.dataset.path === 'arrived', { timeout: 6000 + (target.geo / 1.8) * 1500 }).then(() => true).catch(() => false);
      const rec = await phone.evaluate(() => window.__wc.stopRec());
      const s1 = await st(phone);
      const legs = [[s0.x, s0.z], ...plan];
      const legCross = await phone.evaluate((pts) => window.__wc.crossings(pts, 1), legs);
      const legClear = await phone.evaluate((pts) => pts.slice(1).every((p, i) => window.__wc.clearLine({ x: pts[i][0], z: pts[i][1] }, { x: p[0], z: p[1] })), legs);
      const walkCross = await phone.evaluate((xs) => window.__wc.crossings(xs, 2), rec.pts.map((p) => [p[1], p[2]]));
      const end = plan[plan.length - 1] || [NaN, NaN];
      const miss = Math.hypot(end[0] - target.x, end[1] - target.z);
      const final = Math.hypot(s1.x - end[0], s1.z - end[1]);
      record(
        `${label} 390: tap-to-walk to a far corner routes round obstacles and arrives`,
        plan.length >= 2 && legClear && legCross.length === 0 && arrived && final < 0.08 && miss < 0.35 && rec.off === 0 && rec.outside === 0 && walkCross.length === 0,
        `target (${f2(target.x)}, ${f2(target.z)}) ${f2(target.geo)} m round vs ${f2(target.straight)} m straight (blocked), tapped (${at.x}, ${at.y}); path ${plan.length} legs${legClear ? '' : ' NOT on the grid'}${legCross.length ? ` through ${legCross[0].name}` : ''}, ${arrived ? 'arrived' : 'NOT arrived'} ${f2(final)} m from its end, end ${f2(miss)} m from the tapped spot, ${rec.off} frames off-grid, ${rec.outside} outside, ${walkCross.length} steps through geometry`,
      );
      await shot(phone, `walk-${name}-390-tapwalk`);
    }

    // a photo mark by tap
    const marks = await phone.evaluate(() => {
      const g = window.__wc.g;
      const geo = window.__wc.geodesic(g.me.pos.x, g.me.pos.z);
      return g.marks
        .map((m) => {
          const [i, j] = g.grid.cellOf(m.x, m.z);
          return { photo: m.photo, x: m.x, z: m.z, geo: geo[j * g.grid.nx + i], d: Math.hypot(m.x - g.me.pos.x, m.z - g.me.pos.z) };
        })
        .filter((m) => Number.isFinite(m.geo) && m.d > 1);
    });
    let markAt = null;
    for (const m of marks) {
      const at = await phone.evaluate((x, z, safe) => window.__wc.frameTarget(x, z, safe), m.x, m.z, SAFE);
      if (at) {
        markAt = { m, at };
        break;
      }
    }
    if (!markAt) record(`${label} 390: a photo mark on screen to tap`, false, `${marks.length} reachable marks > 1 m away`);
    else {
      await phone.touchscreen.tap(markAt.at.x, markAt.at.y);
      const entered = await phone.waitForFunction(() => window.__wc.el.dataset.view === 'photo', { timeout: 5000 + (markAt.m.geo / 1.8) * 1500 }).then(() => true).catch(() => false);
      await wait(1400);
      const ps = await phone.evaluate(() => {
        const W = window.__wc;
        const r = W.g.photoEl.getBoundingClientRect();
        return { view: W.el.dataset.view, photo: W.el.dataset.photo, hidden: W.g.photoEl.hidden, opacity: Number(getComputedStyle(W.g.photoEl).opacity), rect: [r.x, r.y, r.width, r.height] };
      });
      record(`${label} 390: tapping a photo mark walks there and blends into photo ${markAt.m.photo}, letterboxed`, entered && ps.photo === String(markAt.m.photo) && !ps.hidden && ps.opacity > 0.98 && (ps.rect[1] > 4 || ps.rect[0] > 4), `view ${ps.view} photo ${ps.photo}, rect ${ps.rect.map((v) => Math.round(v)).join(',')}`);
      await shot(phone, `walk-${name}-390-photo`);
      // the joystick takes you back out
      await phone.touchscreen.touchStart(90, 640);
      await phone.touchscreen.touchMove(90, 600);
      await wait(400);
      await phone.touchscreen.touchEnd();
      await wait(1000);
      const v = await st(phone);
      record(`${label} 390: moving the joystick leaves the photo (back to ${THIRD ? 'third' : 'first'} person)`, v.view === (THIRD ? 'third' : 'first') && !v.ds.photo, v.view);
    }

    // joystick (left half), look (right half), pinch
    const startP = (await phone.evaluate(() => window.__wc.startPoints()))[0];
    await phone.evaluate((x, z) => window.__wc.put(x, z), startP.x, startP.z);
    const dirFree = await phone.evaluate((x, z) => {
      let b = null;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const d = window.__wc.freeRun(x, z, Math.sin(a), Math.cos(a));
        if (!b || d > b.d) b = { a, d };
      }
      return b;
    }, startP.x, startP.z);
    await phone.evaluate((a, third) => window.__wc.aim(third ? a - Math.PI : a, 0.55, 3.6), dirFree.a, THIRD);
    let s0 = await st(phone);
    await phone.touchscreen.touchStart(90, 640);
    await phone.touchscreen.touchMove(90, 610);
    await wait(80);
    const stickShown = await phone.evaluate(() => !document.querySelector('.mr-walk__stick').hidden);
    await wait(Math.min(700, ((dirFree.d - 0.2) / 1.5) * 1000));
    await phone.touchscreen.touchEnd();
    await wait(100);
    let s1 = await st(phone);
    const stickHidden = await phone.evaluate(() => document.querySelector('.mr-walk__stick').hidden);
    const mv = [s1.x - s0.x, s1.z - s0.z];
    const ml = Math.hypot(...mv);
    const cosF = (mv[0] * Math.sin(dirFree.a) + mv[1] * Math.cos(dirFree.a)) / (ml || 1);
    record(`${label} 390: the left-thumb joystick walks forward (stick drawn while held)`, ml > 0.2 && cosF > 0.9 && stickShown && stickHidden, `moved ${f2(ml)} m (cos ${f2(cosF)}), stick ${stickShown ? 'shown' : 'NOT shown'} → ${stickHidden ? 'hidden' : 'STILL shown'}`);
    s0 = await st(phone);
    await phone.touchscreen.touchStart(300, 450);
    for (let k = 1; k <= 10; k++) await phone.touchscreen.touchMove(300 - k * 8, 450);
    await phone.touchscreen.touchEnd();
    s1 = await st(phone);
    record(`${label} 390: dragging on the right half turns the camera (no walking)`, Math.abs(s1.yaw - s0.yaw - 0.48) < 0.05 && Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.005, `yaw ${f2(s1.yaw - s0.yaw)} rad`);
    const cdp = await phone.createCDPSession();
    const pinch = async (from, to) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195 - from, y: 450, id: 1 }, { x: 195 + from, y: 450, id: 2 }] });
      for (let k = 1; k <= 10; k++) {
        const d = from + ((to - from) * k) / 10;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 - d, y: 450, id: 1 }, { x: 195 + d, y: 450, id: 2 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(100);
    };
    s0 = await st(phone);
    await pinch(40, 100);
    const sIn = await st(phone);
    await pinch(100, 40);
    const sOut = await st(phone);
    record(`${label} 390: pinch out brings the camera closer, pinch in moves it back`, sIn.dist < s0.dist * 0.6 && sOut.dist > sIn.dist * 1.8 && Math.hypot(sOut.x - s0.x, sOut.z - s0.z) < 0.01, `${f2(s0.dist)} → ${f2(sIn.dist)} → ${f2(sOut.dist)} m`);

    // buttons: emote + interact (seat) by tap
    const wave = await phone.$(sel('walk-emote-wave'));
    if (wave) {
      const b = await wave.boundingBox();
      await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await phone.evaluate(() => window.__wc.frames(3));
      const a = await st(phone);
      record(`${label} 390: tapping Wave waves`, a.anim === 'wave', a.anim);
      await wait(1700);
    }
    let near = null;
    for (const seat of P.seats) {
      near = await phone.evaluate((id) => window.__wc.seatSpot(id), seat.id);
      if (near) break;
    }
    if (near) {
      await phone.evaluate((x, z) => window.__wc.put(x, z), near.x, near.z);
      await phone.evaluate(() => window.__wc.frames(4));
      await wait(250);
      const btn = await phone.$(sel('walk-interact'));
      const text = btn ? await btn.evaluate((e) => e.textContent) : null;
      if (btn) {
        const b = await btn.boundingBox();
        await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      }
      await phone.evaluate(() => window.__wc.frames(3));
      const a = await st(phone);
      await wait(250); // human pace between sit and stand
      const btn2 = await phone.$(sel('walk-interact'));
      const text2 = btn2 ? await btn2.evaluate((e) => e.textContent) : null;
      if (btn2) {
        const b = await btn2.boundingBox();
        await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      }
      await phone.evaluate(() => window.__wc.frames(3));
      const c = await st(phone);
      record(`${label} 390: the interact button sits ("${text}") and stands ("${text2}")`, Boolean(btn) && Boolean(a.sitting) && text2 === W_COPY.interact.stand && !c.sitting, `${a.sitting ?? 'not sitting'} → ${c.sitting ?? 'standing'}`);
    }
    // the chat line on a phone: 16 px input
    const say = await phone.$(sel('walk-chat'));
    if (say && room === ROOMS[0]) {
      const b = await say.boundingBox();
      await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      const input = await phone.waitForSelector(sel('walk-chat-input'), { visible: true, timeout: 3000 }).catch(() => null);
      const fs16 = input ? await input.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)) : 0;
      const sendH = await phone.$eval(sel('walk-chat-send'), (e) => e.getBoundingClientRect().height).catch(() => 0);
      record(`${label} 390: the chat input is ≥ 16 px (no zoom on focus), Send ≥ 44 px`, fs16 >= 16 && sendH >= 44, `${fs16}px, Send ${Math.round(sendH)} px`);
      await phone.keyboard.press('Escape');
    }
  });
  const corr390 = await phone.evaluate(() => window.__wc?.corrections || []).catch(() => []);
  record(`${label} 390: the room's server never had to correct a move (tap-to-walk, joystick)`, corr390.length === 0, corr390.slice(0, 3).map((c) => `during "${c.during}": at (${c.at}) → (${c.p[0]}, ${c.p[2]}), view ${c.view}${c.sitting ? `, sitting on ${c.sitting}` : ''}${c.path ? ', mid-path' : ''}; last sent: ${c.sent}`).join('; '));
  noErrors(phone, `${label} 390`);
  await phone.close();

  /* ── 390 landscape ── */
  const land = await open('land');
  await section(`${label} landscape`, async () => {
    await land.goto(`${base}/memories/${spot.id}/walk`, { waitUntil: 'networkidle2' });
    if (!(await ready(land))) {
      record(`${label} landscape: walk page ready`, false);
      return;
    }
    await install(land, area);
    await wait(500);
    await shot(land, `walk-${name}-390land`);
    const ui = await land.evaluate(() => {
      const els = [...document.querySelectorAll('.mr-walk button, .mr-walk a')].filter((e) => e.getClientRects().length);
      const rs = els.map((e) => ({ m: e.dataset.mr, r: e.getBoundingClientRect() }));
      const top = document.querySelector('.mr-walk__top').getBoundingClientRect();
      const btns = [...document.querySelectorAll('.mr-walk__buttons button')].map((e) => e.getBoundingClientRect());
      return {
        off: rs.filter((x) => x.r.left < 0 || x.r.top < 0 || x.r.right > innerWidth || x.r.bottom > innerHeight).map((x) => x.m),
        small: rs.filter((x) => x.r.height < 44 || x.r.width < 44).map((x) => x.m),
        overlapTop: btns.some((b) => b.top < top.bottom),
        leftHalf: btns.filter((b) => b.left < innerWidth / 2).length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    record(`${label} landscape: controls on screen, ≥ 44 px, clear of the header`, ui.off.length === 0 && ui.small.length === 0 && !ui.overlapTop && ui.overflow <= 1, `off-screen ${ui.off.join(',') || 'none'}, small ${ui.small.join(',') || 'none'}, overlaps header ${ui.overlapTop}, ${ui.leftHalf} buttons on the left half, overflow ${ui.overflow}px`);
    // the joystick works in landscape too (facing open floor)
    const lp = (await land.evaluate(() => window.__wc.startPoints()))[0];
    await land.evaluate((x, z) => window.__wc.put(x, z), lp.x, lp.z);
    const la = await land.evaluate((x, z) => {
      let b = null;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const d = window.__wc.freeRun(x, z, Math.sin(a), Math.cos(a));
        if (!b || d > b.d) b = { a, d };
      }
      return b;
    }, lp.x, lp.z);
    await land.evaluate((a) => window.__wc.aim(a - Math.PI, 0.55, 3.6), la.a);
    const s0 = await st(land);
    await land.touchscreen.touchStart(150, 250);
    await land.touchscreen.touchMove(150, 215);
    await wait(500);
    await land.touchscreen.touchEnd();
    const s1 = await st(land);
    record(`${label} landscape: the joystick walks`, Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.1, `moved ${f2(Math.hypot(s1.x - s0.x, s1.z - s0.z))} m`);
  });
  noErrors(land, `${label} landscape`);
  await land.close();

  /* ── fps (alone, after the functional checks) ── */
  if (FPS_ON) {
    const row = { room: name };
    for (const kind of [1440, 390, 'land']) {
      const p = await open(kind);
      await p.goto(`${base}/memories/${spot.id}/walk`, { waitUntil: 'networkidle2' });
      if (!(await ready(p))) {
        await p.close();
        continue;
      }
      await install(p, area);
      const sp = (await p.evaluate(() => window.__wc.startPoints()))[0];
      await p.evaluate((x, z) => window.__wc.put(x, z), sp.x, sp.z);
      await wait(800);
      // the CPU throttle really applies (a fixed busy loop, before and after)
      const busy = () =>
        p.evaluate(() => {
          const a = performance.now();
          let x = 0;
          for (let i = 0; i < 3e6; i++) x += Math.sqrt(i);
          return performance.now() - a + x * 0;
        });
      const b0 = await busy();
      if (kind !== 1440) await p.emulateCPUThrottling(4);
      const b1 = await busy();
      await p.evaluate(() => {
        // the walk's own work per frame (its tick: input, collision, camera, sprites, render submit)
        const g = window.__wc.g;
        const orig = g.tick;
        const ms = (window.__tickMs = []);
        g.tick = (t) => {
          const a = performance.now();
          orig(t);
          ms.push(performance.now() - a);
        };
        const s = (window.__soak = { frames: [], on: true });
        let last = performance.now();
        const tick = (t) => {
          s.frames.push(t - last);
          last = t;
          if (s.on) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const t0 = Date.now();
      const secs = QUICK ? 4 : 6;
      if (kind === 1440) {
        await p.keyboard.down('KeyW');
        let i = 0;
        while (Date.now() - t0 < secs * 1000) {
          const dx = (i++ % 2 ? -1 : 1) * 260;
          await p.mouse.move(CX - dx / 2, CY);
          await p.mouse.down();
          for (let k = 1; k <= 30; k++) {
            await p.mouse.move(CX - dx / 2 + (dx * k) / 30, CY);
            await wait(16);
          }
          await p.mouse.up();
        }
        await p.keyboard.up('KeyW');
      } else {
        const [jx, jy] = kind === 'land' ? [150, 250] : [90, 640];
        await p.touchscreen.touchStart(jx, jy);
        let a = 0;
        while (Date.now() - t0 < secs * 1000) {
          a += 0.2;
          await p.touchscreen.touchMove(jx + 45 * Math.sin(a), jy - 45 * Math.cos(a));
          await wait(30);
        }
        await p.touchscreen.touchEnd();
      }
      const { frames, tick } = await p.evaluate(() => {
        window.__soak.on = false;
        return { frames: window.__soak.frames.slice(5), tick: window.__tickMs.slice(5) };
      });
      const tSorted = [...tick].sort((a, b) => a - b);
      const tickMean = tick.reduce((a, b) => a + b, 0) / (tick.length || 1);
      const tickP95 = tSorted[Math.floor(tSorted.length * 0.95)] || 0;
      if (kind !== 1440) await p.emulateCPUThrottling(1);
      const total = frames.reduce((a, b) => a + b, 0);
      const sorted = [...frames].sort((a, b) => a - b);
      const fps = (frames.length / total) * 1000;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const lbl = kind === 1440 ? '1440 mouse' : kind === 390 ? '390 touch, CPU ÷4' : '844×390 landscape touch, CPU ÷4';
      const min = kind === 1440 ? 50 : 30;
      row[kind] = `${fps.toFixed(1)} fps (p95 ${p95.toFixed(1)} ms), tick ${tickMean.toFixed(2)} ms (p95 ${tickP95.toFixed(2)})`;
      record(
        `${label} fps ${lbl} ≥ ${min} while walking`,
        fps >= min && (kind === 1440 || b1 / b0 > 2.5),
        `${fps.toFixed(1)} fps, p95 frame ${p95.toFixed(1)} ms, ${frames.length} frames; the walk's own tick ${tickMean.toFixed(2)} ms mean, p95 ${tickP95.toFixed(2)} ms${kind === 1440 ? '' : `; throttle check: a busy loop ${b0.toFixed(0)} → ${b1.toFixed(0)} ms (×${(b1 / b0).toFixed(1)})`}`,
      );
      noErrors(p, `${label} fps ${kind}`);
      await p.close();
    }
    fpsRows.push(row);
  }
}

/* ── a spot without a GLB: no Walk in, and the walk page says so ─────────── */
await section('no-room', async () => {
  const src = ROOMS[0].spot;
  const page = await open(1440);
  const stripped = { ...src, status: 'modelling', media: src.media.filter((m) => m.type !== 'model') };
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const p = new URL(r.url()).pathname;
    if (r.method() === 'GET' && (p === `/api/memories/spots/${src.id}` || p === '/api/memories/spots')) {
      r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: p.endsWith('/spots') ? [stripped] : stripped }) });
    } else r.continue();
  });
  await page.goto(`${base}/memories/${src.id}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.mr-spot, [data-mr="viewer"]', { timeout: 20000 }).catch(() => null);
  await wait(1500);
  const link = await page.$(sel('walk-link'));
  record('no GLB: the spot page has no "Walk in"', !link);
  await page.goto(`${base}/memories/${src.id}/walk`, { waitUntil: 'networkidle2' });
  const msg = await page.waitForSelector('[data-mr-page="noroom"]', { timeout: 15000 }).catch(() => null);
  const text = msg ? await msg.evaluate((e) => e.textContent) : '';
  const glb = page.requests.filter((u) => /\.glb/.test(u)).length;
  record('no GLB: /walk says there is nothing to walk yet (no GLB fetched)', Boolean(msg) && text.includes(W_COPY.noRoomTitle) && glb === 0, `"${text.slice(0, 80)}", ${glb} GLB request(s)`);
  noErrors(page, 'no GLB');
  await page.close();
});

/* ── the map route loads no walk code ────────────────────────────────────── */
await section('bundle', async () => {
  const page = await open(1440);
  await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-mr="map"]', { timeout: 20000 }).catch(() => null);
  await wait(1500);
  const js = [...new Set(page.requests.filter((u) => /\/assets\/.*\.js(\?|$)/.test(u)))];
  const walkUrls = page.requests.filter((u) => /\/assets\/(WalkPage|WalkEntry)-|traveller-/.test(u));
  let inside = [];
  for (const u of js) {
    const text = await (await fetch(u)).text();
    if (/mr-walk__stick|mr-walk__canvas|traveller-(blue|orange)/.test(text)) inside.push(u.split('/').pop());
  }
  record('bundle: the map route (?map=atlas) requests no walk page, WalkEntry or character sheets', walkUrls.length === 0, walkUrls.map((u) => u.split('/').pop()).join(', ') || `${js.length} JS chunks`);
  record('bundle: none of the map route\'s chunks contain the walk game or characters', inside.length === 0, inside.join(', '));
  noErrors(page, 'map route');
  await page.close();
  // static: the characters come from one file; walk.css colours are tokens only; no left-border callouts
  const srcFiles = [];
  const walkDir = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walkDir(p);
      else if (/\.(jsx?|css)$/.test(f.name)) srcFiles.push(p);
    }
  };
  walkDir(path.join(REPO, 'src'));
  const refs = srcFiles.filter((p) => /traveller-(blue|orange)\.(png|json)/.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(REPO, p).replace(/\\/g, '/'));
  record('characters: the sheets are referenced from one file (swap a character there)', refs.length === 1 && refs[0] === 'src/memory-rooms/walk/characters.js', refs.join(', '));
  const css = fs.readFileSync(path.join(REPO, 'src/memory-rooms/walk/walk.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const literals = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(white|black|red|blue|green|orange)(?![-\w])/g) || [];
  const leftBorder = /border-left\s*:/.test(css);
  // all copy from copy.js: no literal UI text in the walk's JSX or the game's DOM
  const hard = [];
  for (const f of ['src/memory-rooms/pages/WalkPage.jsx', 'src/memory-rooms/walk/WalkEntry.jsx', 'src/memory-rooms/walk/WalkGame.js']) {
    const text = fs.readFileSync(path.join(REPO, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const jsxText = f.endsWith('.jsx') ? [...text.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*</g)].map((m) => m[1]).filter((t) => /[a-z]{2,}/.test(t) && !/=>|\(|\)|;/.test(t)) : [];
    const attrs = [...text.matchAll(/\b(aria-label|placeholder|title|alt)=["']([^"']+)["']/g)].map((m) => `${m[1]}="${m[2]}"`);
    const dom = f.endsWith('.js') ? [...text.matchAll(/textContent\s*=\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]) : [];
    for (const t of [...jsxText, ...attrs, ...dom]) hard.push(`${path.basename(f)}: ${t.slice(0, 40)}`);
  }
  record('copy: the walk UI takes its words from copy.js (no literal text in WalkPage/WalkEntry/WalkGame)', hard.length === 0, hard.slice(0, 5).join('; '));
  record('walk.css: colours only through .mr tokens; no left-border callouts', literals.length === 0 && !leftBorder, `${literals.length} colour literal(s) ${literals.join(' ')}${leftBorder ? ', a border-left rule' : ''}`);
});

/* ── theme: the 3D stage follows the --mr-stage token (light/dark) ───────── */
await section('theme', async () => {
  const page = await open(1440);
  await page.goto(`${base}/memories/${ROOMS[0].spot.id}/walk`, { waitUntil: 'networkidle2' });
  if (!(await ready(page))) return;
  const t = await page.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    const probe = document.createElement('span');
    probe.style.color = 'var(--mr-stage)';
    document.querySelector('.mr-walk').appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    const m = c.match(/[\d.]+/g).map(Number);
    const hex = m
      .slice(0, 3)
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('');
    const bg = getComputedStyle(document.querySelector('.mr-walk')).backgroundColor;
    return { clear: g.clear.getHexString(), token: hex, bg };
  });
  const ch = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = ch(t.token).reduce((a, b) => a + b, 0);
  const same = ch(t.clear).every((v, i) => Math.abs(v - ch(t.token)[i]) <= 1);
  record(`theme (${scheme}): the 3D clear colour is the --mr-stage token`, same && (scheme === 'dark' ? lum < 300 : lum > 450), `clear #${t.clear}, token #${t.token}, page ${t.bg}`);
  // the walk UI: no coloured rounded left-border boxes, no filled colour pills
  const bad = await page.evaluate(() => {
    const out = [];
    const sat = (c) => {
      const m = (c.match(/[\d.]+/g) || []).map(Number);
      if (m.length < 3 || (m.length > 3 && m[3] === 0)) return 0;
      const [r, g, b] = m.map((v) => v / 255);
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      return mx === 0 ? 0 : (mx - mn) / mx;
    };
    for (const e of document.querySelectorAll('.mr-walk *')) {
      if (!e.getClientRects().length) continue;
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      if (parseFloat(cs.borderLeftWidth) >= 2 && parseFloat(cs.borderRightWidth) === 0 && radius > 0 && sat(cs.borderLeftColor) > 0.25) out.push(`left-border ${e.className}`);
      if (radius >= r.height / 2 - 1 && r.width > r.height * 1.6 && sat(cs.backgroundColor) > 0.3 && e.textContent.trim()) out.push(`pill ${e.className}`);
    }
    return out;
  });
  record(`theme (${scheme}): no coloured left-border callouts or filled pills on the walk page`, bad.length === 0, bad.join(', '));
  noErrors(page, 'theme');
  await page.close();
});

await browser.close();

if (fpsRows.length) {
  console.log('\nfps while walking (1440 mouse | 390 touch CPU ÷4 | 844×390 touch CPU ÷4):');
  for (const r of fpsRows) console.log(`  ${r.room.padEnd(18)} ${r[1440] ?? '–'} | ${r[390] ?? '–'} | ${r.land ?? '–'}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${scheme}). Screenshots: ${OUT}`);
if (failed.length) {
  console.log('\nFailed:');
  for (const f of failed) console.log(`✗ ${f.name}  ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
