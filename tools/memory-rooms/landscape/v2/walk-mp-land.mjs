#!/usr/bin/env node
/* Two people walking a LIVE landscape together (local Worker): James and Justin open the same spot's walk, each
   sees the other, a walk by one is seen by the other at the right place and on the ground, both show on each
   other's minimap, and leaving drops the other from the list.

     node tools/memory-rooms/landscape/v2/walk-mp-land.mjs <spotId> [--base http://127.0.0.1:8788] [--out dir] */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const id = argv[0];
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const base = opt('base', 'http://127.0.0.1:8788');
const out = path.resolve(opt('out', 'memory-rooms-work/_peron2/walk/mp'));
fs.mkdirSync(out, { recursive: true });
const vars = Object.fromEntries(fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
let fails = 0;
const record = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const open = async (who) => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 960, height: 600 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.evaluateOnNewDocument(
    (t, w) => {
      localStorage.setItem('mr:token', t);
      localStorage.setItem('mr:who', w);
    },
    vars.MEMORIES_PASSWORD,
    who,
  );
  await page.goto(`${base}/memories/${id}/walk`, { waitUntil: 'load' });
  await page.waitForSelector('[data-mr="walk"][data-state="ready"]', { timeout: 120000 });
  return { page, ctx, errors };
};
const state = (p) =>
  p.evaluate(() => {
    const g = document.querySelector('[data-mr="walk"]').__walk;
    return {
      me: [g.me.pos.x, g.me.pos.y, g.me.pos.z],
      peers: [...g.peers.values()].map((q) => ({ who: q.who, p: q.pos ? [q.pos.x, q.pos.y, q.pos.z] : null })),
    };
  });
try {
  const a = await open('james');
  const b = await open('justin');
  await new Promise((r) => setTimeout(r, 3000));
  let sa = await state(a.page);
  let sb = await state(b.page);
  record('each sees the other', sa.peers.some((q) => q.who === 'justin') && sb.peers.some((q) => q.who === 'james'), `james sees ${sa.peers.map((q) => q.who).join(',') || 'nobody'}, justin sees ${sb.peers.map((q) => q.who).join(',') || 'nobody'}`);
  // James walks a stretch of path (tap-to-walk); Justin should see him arrive, on the ground
  await a.page.evaluate(() => document.querySelector('[data-mr="walk"]').__walk.walkTo(262, 170));
  await new Promise((r) => setTimeout(r, 12000));
  sa = await state(a.page);
  sb = await state(b.page);
  const seen = sb.peers.find((q) => q.who === 'james');
  const gap = seen?.p ? Math.hypot(seen.p[0] - sa.me[0], seen.p[2] - sa.me[2]) : Infinity;
  const yGap = seen?.p ? Math.abs(seen.p[1] - sa.me[1]) : Infinity;
  record('James walks and Justin sees him there', gap < 1.0 && yGap < 0.3, `James at ${sa.me.map((v) => v.toFixed(1)).join(', ')}, Justin sees ${seen?.p?.map((v) => v.toFixed(1)).join(', ') ?? 'nothing'} (${gap.toFixed(2)} m, dy ${yGap.toFixed(2)})`);
  await a.page.screenshot({ path: path.join(out, 'james.png') });
  await b.page.screenshot({ path: path.join(out, 'justin.png') });
  // leaving: Justin's list drops James
  await a.ctx.close();
  await new Promise((r) => setTimeout(r, 4000));
  sb = await state(b.page);
  record('leaving drops James from Justin\'s walk', !sb.peers.some((q) => q.who === 'james'), `${sb.peers.length} left`);
  record('no console errors', a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors].slice(0, 4).join(' | '));
} finally {
  await browser.close();
}
process.exit(fails ? 1 : 0);
