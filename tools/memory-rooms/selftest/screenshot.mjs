#!/usr/bin/env node
/* Screenshots of one spot page (dollhouse + photo viewpoint 1 at half blend), 1440 and 390 px.

     node tools/memory-rooms/selftest/screenshot.mjs <spotId> [--base http://127.0.0.1:8788]
   → memory-rooms-work/_selftest-truth/spot-<width>[-vp1].png */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { config, WORK } from '../lib/api.mjs';

const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--base'));
const base = (args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://127.0.0.1:8788').replace(/\/+$/, '');
const out = path.join(WORK, '_selftest-truth');
fs.mkdirSync(out, { recursive: true });
const { token } = config();

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
for (const width of [1440, 390]) {
  const page = await browser.newPage();
  const mobile = width < 600;
  await page.setViewport({ width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('mr:token', t);
    localStorage.setItem('mr:who', 'james');
  }, token);
  await page.goto(`${base}/memories/${id}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(out, `spot-${width}.png`) });
  const vp = await page.$('[data-mr="viewpoint"][data-photo="1"]');
  if (vp) {
    await vp.click();
    await new Promise((r) => setTimeout(r, 1500));
    const slider = await page.$('[data-mr="blend-slider"]');
    if (slider) {
      await slider.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(el, String(Number(el.max || 1) / 2));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await new Promise((r) => setTimeout(r, 800));
    }
    await page.screenshot({ path: path.join(out, `spot-${width}-vp1.png`) });
  }
  await page.close();
}
await browser.close();
console.log(`screenshots → ${out}`);
