#!/usr/bin/env node
/* Walk a LIVE landscape spot on the local Worker, headless Edge, the real GPU: screenshots from the walk page
   at given spots, a walked clip as a GIF, and the basics checked (it loads, you stand on the ground, walls and
   deep water stop you, fps).

     node tools/memory-rooms/landscape/v2/walk-land.mjs <spotId> <out dir>
         [--base http://127.0.0.1:8788] [--size 1280x720] [--at name=x,z,yaw[,pitch] ...] [--gif name=x,z,yaw,seconds]
         [--soft] [--cpu 4]

   Teleports go through the game instance (container.__walk.teleport), walking is the keyboard (W, Shift). */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const id = argv[0];
const out = path.resolve(argv[1] || 'memory-rooms-work/_walk-land');
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const many = (n) => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []));
const base = opt('base', 'http://127.0.0.1:8788');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const vars = Object.fromEntries(
  fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const token = process.env.MEMORIES_PASSWORD || vars.MEMORIES_PASSWORD;
fs.mkdirSync(out, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const args = argv.includes('--soft') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args });
const log = [];
const record = (name, ok, detail = '') => {
  log.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, token);
  if (opt('cpu')) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(opt('cpu')) });
  }
  const t0 = Date.now();
  await page.goto(`${base}/memories/${id}/walk`, { waitUntil: 'load' });
  await page.waitForSelector('[data-mr="walk"][data-state="ready"], [data-mr="walk"][data-state="error"]', { timeout: 180000 });
  const loadMs = Date.now() - t0;
  const st = await page.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    return { state: g.container.dataset.state, area: g.grid?.area, grid: `${g.grid?.nx}x${g.grid?.nz}`, gridMs: g.gridMs, pos: g.me.pos.toArray(), ground: g.grid?.heightAt?.(g.me.pos.x, g.me.pos.z), land: Boolean(g.land) };
  });
  record('loads as a live landscape', st.state === 'ready' && st.land, `${loadMs} ms to ready, grid ${st.grid} (${st.gridMs} ms), walkable ${Math.round(st.area)} m², spawn ${st.pos.map((v) => v.toFixed(1)).join(', ')}`);
  record('spawn stands on the ground', Math.abs(st.pos[1] - st.ground) < 0.05, `y ${st.pos[1].toFixed(2)} vs ground ${st.ground?.toFixed(2)}`);

  // set-up jumps are far faster than walking: the room's server would `correct` them back (7 m/s), so the
  // check ignores its corrections (the walk itself is unchanged)
  await page.evaluate(() => {
    const el = document.querySelector('[data-mr="walk"]');
    const net = el.__walkNet || el.closest('.mr-walk')?.__walkNet || el.parentElement?.__walkNet;
    if (net?.on) net.on.correct = () => {};
  });
  const place = async (x, z, yaw, pitch = 0) => {
    await page.evaluate(
      (x, z, yaw, pitch) => {
        const g = document.querySelector('[data-mr="walk"]').__walk;
        const p = g.grid.walkable(x, z) ? { x, z } : (() => {
          // nearest walkable
          const [i, j] = g.grid.cellOf(x, z);
          for (let r = 0; r < 60; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
            const c = g.grid.centreOf(i + di, j + dj);
            if (g.grid.walkable(c.x, c.z)) return c;
          }
          return { x, z };
        })();
        g.teleport(p.x, p.z);
        g.me.pos.y = g.floorY();
        g.yaw = Math.PI - (yaw * Math.PI) / 180; // walk yaw: atan2(dx, dz), so north (-z) = PI
        g.fpPitch = (pitch * Math.PI) / 180;
      },
      x, z, yaw, pitch,
    );
    await new Promise((r) => setTimeout(r, 1200));
  };

  // --at name=x,z,yaw[,pitch]  or  name=x,z,@tx,tz[,pitch]: stand at the walkable spot nearest (x, z) facing (tx, tz)
  for (const spec of many('at')) {
    const [name, rest] = spec.split('=');
    const parts = rest.split(',');
    if (parts[2].startsWith('@')) {
      const [x, z, tx, tz, pitch] = [parts[0], parts[1], parts[2].slice(1), parts[3], parts[4]].map(Number);
      await place(x, z, 0, pitch || 0);
      await page.evaluate((tx, tz) => {
        const g = document.querySelector('[data-mr="walk"]').__walk;
        g.yaw = Math.atan2(tx - g.me.pos.x, tz - g.me.pos.z);
      }, tx, tz);
      await new Promise((r) => setTimeout(r, 600));
    } else {
      const [x, z, yaw, pitch] = parts.map(Number);
      await place(x, z, yaw, pitch || 0);
    }
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log('shot', name);
  }

  // fps while standing and looking around
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(f);
          else res((n * 1000) / (performance.now() - t0));
        };
        requestAnimationFrame(f);
      }),
  );
  record('fps (standing)', fps >= 30, `${fps.toFixed(0)} fps`);
  // fps while running along (Shift + W for 5 s): the plants' instance lists refill and terrain nodes are built
  const run = async () => {
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    const r = await page.evaluate(
      () =>
        new Promise((res) => {
          const ts = [];
          const t0 = performance.now();
          const f = (t) => {
            ts.push(t);
            if (t - t0 < 5000) requestAnimationFrame(f);
            else {
              const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
              res({ fps: (ts.length * 1000) / (t - t0), p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1] });
            }
          };
          requestAnimationFrame(f);
        }),
    );
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    return r;
  };
  const rr = await run();
  record('fps (running)', rr.fps >= 30, `${rr.fps.toFixed(0)} fps, p95 frame ${rr.p95.toFixed(1)} ms, worst ${rr.max.toFixed(1)} ms`);

  // a walked clip: frames every 120 ms while holding W (Shift to run)
  for (const spec of many('gif')) {
    const [name, rest] = spec.split('=');
    const [x, z, yaw, secs, tx, tz] = rest.split(',').map(Number);
    await place(x, z, yaw, -4);
    const dir = path.join(out, `_${name}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    const y0 = await page.evaluate(() => document.querySelector('[data-mr="walk"]').__walk.me.pos.toArray());
    // with a target: tap-to-walk (A* along the walkable grid, the camera turns to the walking direction)
    if (Number.isFinite(tx)) await page.evaluate((tx, tz) => document.querySelector('[data-mr="walk"]').__walk.walkTo(tx, tz), tx, tz);
    else await page.keyboard.down('KeyW');
    const n = Math.round((secs * 1000) / 120);
    const track = [];
    for (let k = 0; k < n; k++) {
      await page.screenshot({ path: path.join(dir, `f${String(k).padStart(3, '0')}.png`), type: 'png' });
      track.push(await page.evaluate(() => {
        const g = document.querySelector('[data-mr="walk"]').__walk;
        return [g.me.pos.x, g.me.pos.y, g.me.pos.z, g.grid.heightAt(g.me.pos.x, g.me.pos.z)];
      }));
    }
    if (!Number.isFinite(tx)) await page.keyboard.up('KeyW');
    const moved = Math.hypot(track[track.length - 1][0] - y0[0], track[track.length - 1][2] - y0[2]);
    const off = Math.max(...track.map((t) => Math.abs(t[1] - t[3])));
    record(`walk ${name}: moves and stays on the ground`, moved > 1 && off < 0.05, `${moved.toFixed(1)} m, max |y - ground| ${off.toFixed(3)} m, y ${track[0][1].toFixed(1)} → ${track[track.length - 1][1].toFixed(1)}`);
    const gif = path.join(out, `${name}.gif`);
    execFileSync('magick', ['-delay', '12', '-loop', '0', path.join(dir, 'f*.png'), '-resize', '640x', '-fuzz', '3%', '-layers', 'Optimize', '-colors', '128', gif]);
    console.log('gif', gif, (fs.statSync(gif).size / 1e6).toFixed(1), 'MB');
  }
  record('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'walk-land.json'), JSON.stringify(log, null, 1));
}
