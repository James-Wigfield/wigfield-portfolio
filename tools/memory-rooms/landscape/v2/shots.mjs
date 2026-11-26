#!/usr/bin/env node
/* Screenshots of the v2 landscape harness (harness/index.html) in headless Edge on the real GPU.

     node tools/memory-rooms/landscape/v2/shots.mjs <out dir> <name>=<query> [<name>=<query> ...]
         [--size 1280x720] [--base http://localhost:5173] [--wait 1500] [--soft]

   <query> is the harness query string without the leading ?, e.g.
     ground="eye=120,40,270,-4&t=3"   air="cam=0,300,400,0,0,0&t=3"
   Prints each shot's stats (draw calls, triangles, terrain nodes, load ms) and any console errors. */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const out = path.resolve(argv[0]);
const shots = argv.slice(1).filter((a) => a.includes('=') && !a.startsWith('--'));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const base = opt('base', 'http://localhost:5173');
const wait = Number(opt('wait', 1500));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const GPU = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: argv.includes('--soft') ? SOFT : GPU });
try {
  for (const s of shots) {
    const name = s.slice(0, s.indexOf('='));
    const query = s.slice(s.indexOf('=') + 1);
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    const errors = [];
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && errors.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${base}/tools/memory-rooms/landscape/v2/harness/index.html?${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__land && (window.__land.ready || window.__land.error), { timeout: 120000 });
    await new Promise((r) => setTimeout(r, wait));
    const st = await page.evaluate(() => ({ ...window.__land.stats(), loadMs: window.__land.loadMs, error: window.__land.error }));
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(name, JSON.stringify(st), errors.length ? `\n  ${errors.slice(0, 6).join('\n  ')}` : '');
    await page.close();
  }
} finally {
  await browser.close();
}
