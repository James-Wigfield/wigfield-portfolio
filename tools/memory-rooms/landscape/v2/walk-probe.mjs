#!/usr/bin/env node
/* Evaluate an expression in a live landscape's walk page (local Worker). G = the WalkGame instance.
     node tools/memory-rooms/landscape/v2/walk-probe.mjs <spotId> "<js using G>" [--base http://127.0.0.1:8788] */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const [id, expr] = process.argv.slice(2);
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://127.0.0.1:8788';
const vars = Object.fromEntries(fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, vars.MEMORIES_PASSWORD);
  await page.goto(`${base}/memories/${id}/walk`, { waitUntil: 'load' });
  await page.waitForSelector('[data-mr="walk"][data-state="ready"], [data-mr="walk"][data-state="error"]', { timeout: 180000 });
  const out = await page.evaluate(async (e) => {
    const G = document.querySelector('[data-mr="walk"]').__walk;
    const r = await eval(`(async () => (${e}))()`);
    return JSON.stringify(r, null, 1);
  }, expr);
  console.log(out);
} finally {
  await browser.close();
}
