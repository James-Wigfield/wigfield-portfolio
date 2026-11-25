/* Dream Rooms plan · runs bench.html in headless Edge (GPU via ANGLE d3d11) and saves out/bench.json.
     npx vite --port 5193 --strictPort        (another terminal)
     node tools/dream-rooms-plan/bench.mjs                                     */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'http://localhost:5193';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${BASE}/tools/dream-rooms-plan/bench.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__bench, { timeout: 180000 });
const res = await page.evaluate(() => window.__bench);
fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'out', 'bench.json'), JSON.stringify(res, null, 2));
console.log(res.gpu);
console.table(res.results);
await browser.close();
