#!/usr/bin/env node
/* Evaluate an expression in the landscape harness (headless Edge) and print the JSON result.
     node tools/memory-rooms/landscape/v2/probe.mjs "<harness query>" "<js expression using L = window.__land>" */
import puppeteer from 'puppeteer-core';

const [query, expr] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://localhost:5173/tools/memory-rooms/landscape/v2/harness/index.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__land && (window.__land.ready || window.__land.error), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  const out = await page.evaluate((e) => {
    const L = window.__land;
    return JSON.stringify(eval(e), null, 1);
  }, expr);
  console.log(out);
} finally {
  await browser.close();
}
