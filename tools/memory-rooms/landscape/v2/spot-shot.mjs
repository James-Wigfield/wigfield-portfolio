#!/usr/bin/env node
/* Screenshot a live landscape's spot page (/memories/:id) on the local Worker: the orbit view as it opens, and
   the console errors.
     node tools/memory-rooms/landscape/v2/spot-shot.mjs <spotId> <out.png> [--base http://127.0.0.1:8788]
         [--size 1440x900] [--wait 4000] */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const [id, out] = argv;
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const base = opt('base', 'http://127.0.0.1:8788');
const [W, H] = opt('size', '1440x900').split('x').map(Number);
const vars = Object.fromEntries(fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, vars.MEMORIES_PASSWORD);
  await page.goto(`${base}/memories/${id}`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, Number(opt('wait', 6000))));
  const st = await page.evaluate(() => {
    const v = document.querySelector('.mr-viewer, [data-mr="viewer"]');
    const walk = [...document.querySelectorAll('a')].some((a) => /\/walk$/.test(a.getAttribute('href') || ''));
    return { state: v?.dataset?.state, recall: v?.dataset?.recall, walkLink: walk };
  });
  await page.screenshot({ path: out });
  console.log(JSON.stringify(st), errors.length ? `errors: ${errors.slice(0, 4).join(' | ')}` : 'no console errors');
} finally {
  await browser.close();
}
