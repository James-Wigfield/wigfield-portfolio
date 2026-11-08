#!/usr/bin/env node
/* Prints DOM facts the headless suite asserts on, for debugging a failing check.
     node tools/memory-rooms/dev-viewer/debug-dom.mjs <spotId> */

import puppeteer from 'puppeteer-core';

const spotId = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => localStorage.setItem('mr:token', 'trip-local'));
await page.goto(`http://localhost:5192/memories/${spotId}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-mr="viewer"][data-state="ready"]', { timeout: 60000 });
console.log(
  await page.evaluate(() => ({
    stage: document.querySelectorAll('.mr-spot__stage').length,
    vpInStage: document.querySelectorAll('.mr-spot__stage [data-mr="viewpoint"]').length,
    vpAll: document.querySelectorAll('[data-mr="viewpoint"]').length,
    vpParents: [...document.querySelectorAll('[data-mr="viewpoint"]')].map((el) => {
      const chain = [];
      for (let n = el; n && chain.length < 9; n = n.parentElement) chain.push(n.className || n.tagName);
      return chain.join(' < ');
    })[0],
    posters: [...document.querySelectorAll('.mr-viewer__poster')].map((p) => `${p.className} src=${!!p.getAttribute('src')}`),
  })),
);
await browser.close();
