// Headless check of the /skippers study site (puppeteer-core + local Edge).
//   node tools/skippers/site-check.mjs [base=http://localhost:5173] [outDir]
// For light + dark at 1440 and 390 it loads every level and every step,
// asserts no console errors / page errors and no horizontal scroll, and
// screenshots each view. Then it runs a full 40-question mock exam by
// clicking answers, hands in, and checks the score screen + review; runs a
// check-in quiz to completion; and prints the night-before sheet to PDF.
// Exit code 1 on any failure.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = process.argv[2] ?? 'http://localhost:5173';
const outDir = process.argv[3] ?? path.join(process.env.TEMP ?? '.', 'skippers-site-check');
fs.mkdirSync(outDir, { recursive: true });

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const { LEVELS } = await import(pathToFileURL(path.join(root, 'src/skippers/content/levels.js')).href);

const urls = [];
for (const l of LEVELS) {
  const lb = `/skippers${l.slug ? `/${l.slug}` : ''}`;
  if (!l.steps.length) urls.push(lb);
  for (const s of l.steps) urls.push(`${lb}/${s.id}`);
}
urls.push('/skippers/exam/drill', '/skippers/exam/mock', '/skippers/exam/deck');

const fails = [];
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'], protocolTimeout: 120000 });

async function newPage(w, theme) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: w < 600 ? 844 : 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('sk:theme', JSON.stringify(t)); } catch { /* */ }
  }, theme);
  page.errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') page.errs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => page.errs.push(`pageerror: ${e}`));
  return page;
}

let shots = 0;
async function checkView(page, u, w, theme) {
  page.errs.length = 0;
  if (process.env.VERBOSE) console.log('→', u, w, theme);
  await page.goto(base + u, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.sk-main article, .sk-main .sk-hero, .sk-main .sk-lhead', { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 350));
  const info = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - window.innerWidth,
    robots: document.querySelector('meta[name="robots"]')?.content ?? '',
    h1: document.querySelector('h1')?.textContent ?? '',
    stage: !!document.querySelector('.sk-stage, .sk-facts, .sk-cards, .sk-quiz, .sk-task, .sk-plan, .sk-cram, .sk-modes, .sk-drillgrid, .sk-script'),
  }));
  const tag = `${u} @${w} ${theme}`;
  if (info.over > 0) fails.push(`${tag}: horizontal overflow ${info.over}px`);
  if (!info.robots.includes('noindex')) fails.push(`${tag}: no noindex meta`);
  if (!info.stage) fails.push(`${tag}: no content rendered`);
  if (page.errs.length) fails.push(`${tag}: ${page.errs.join(' | ').slice(0, 300)}`);
  const file = path.join(outDir, `${u.replace(/^\/skippers\/?/, '').replace(/\//g, '_') || 'start'}-${w}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shots += 1;

}

for (const theme of ['light', 'dark']) {
  for (const w of [1440, 390]) {
    let page = await newPage(w, theme);
    for (const u of urls) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await checkView(page, u, w, theme);
          break;
        } catch (e) {
          if (attempt === 1) fails.push(`${u} @${w} ${theme}: ${String(e).slice(0, 160)}`);
          await page.close().catch(() => {});
          page = await newPage(w, theme);
        }
      }
    }
    await page.close();
  }
}

// ── a full mock exam, clicked through ──────────────────────────────────
{
  const page = await newPage(390, 'light');
  await page.goto(`${base}/skippers/exam/mock`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.sk-quiz .sk-btn--primary');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Start the mock'))?.click());
  await page.waitForSelector('.sk-opt');
  let n = 0;
  for (let i = 0; i < 40; i += 1) {
    const stem = await page.$eval('.sk-q__stem', (e) => e.textContent);
    if (!stem) fails.push(`mock q${i + 1}: empty stem`);
    await page.evaluate((k) => document.querySelectorAll('.sk-opt')[k % 4].click(), i);
    const feedback = await page.$('.sk-why');
    if (feedback) fails.push('mock shows feedback before hand-in');
    const label = await page.evaluate(() => [...document.querySelectorAll('.sk-quiz__nav button')].pop()?.textContent ?? '');
    await page.evaluate(() => [...document.querySelectorAll('.sk-quiz__nav button')].pop().click());
    n += 1;
    if (label.includes('Hand in')) break;
  }
  if (n !== 40) fails.push(`mock had ${n} questions, expected 40`);
  await page.waitForSelector('.sk-score__big');
  const score = await page.$eval('.sk-score__big', (e) => e.textContent);
  const meter = await page.$('.sk-meter');
  const reviewRows = await page.$$eval('.sk-review__row', (r) => r.length);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sk:mocks') ?? '[]'));
  if (!/\d+\/40/.test(score)) fails.push(`mock score screen wrong: ${score}`);
  if (!meter) fails.push('mock: no pass-line meter');
  if (stored.length !== 1) fails.push(`mock not saved (sk:mocks length ${stored.length})`);
  const deck = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('sk:deck') ?? '{}')).length);
  const right = Number(score.split('/')[0]);
  if (reviewRows !== 40 - right) fails.push(`mock review rows ${reviewRows} ≠ misses ${40 - right}`);
  if (deck !== 40 - right) fails.push(`deck has ${deck} cards, expected ${40 - right} misses`);
  console.log(`mock: ${score} · review rows ${reviewRows} · deck ${deck}`);
  await page.screenshot({ path: path.join(outDir, 'mock-result-390.png'), fullPage: false });
  if (page.errs.length) fails.push(`mock: ${page.errs.join(' | ').slice(0, 300)}`);

  // the weak-spots deck now has cards due
  await page.goto(`${base}/skippers/exam/deck`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.sk-q__stem');
  const deckTxt = await page.$eval('.sk-q__stem', (e) => e.textContent);
  if (!/\d+ weak-spot/.test(deckTxt) || deckTxt.startsWith('0 ')) fails.push(`deck start screen: ${deckTxt}`);

  // a check-in, answered right every time using the stored answer key
  await page.goto(`${base}/skippers/lights/check`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.sk-opt');
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => document.querySelectorAll('.sk-opt')[0].click());
    const why = await page.$('.sk-why');
    if (!why) fails.push('check-in: no explanation after answering');
    const pageRef = await page.$eval('.sk-why', (e) => e.textContent);
    if (!/Workbook p\.\d+/.test(pageRef)) fails.push(`check-in explanation without a page: ${pageRef.slice(0, 80)}`);
    await page.evaluate(() => [...document.querySelectorAll('.sk-quiz__nav button')].pop().click());
  }
  await page.waitForSelector('.sk-score__big');
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('sk:progress') ?? '{}'));
  if (prog.lights?.check === undefined) fails.push('check-in result not saved');
  await page.close();
}

// ── print the night-before sheet ───────────────────────────────────────
{
  const page = await newPage(1200, 'light');
  await page.goto(`${base}/skippers/night-before`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('.sk-cram');
  await page.emulateMediaType('print');
  const pdf = path.join(outDir, 'night-before.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true });
  const pages = (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`night-before.pdf: ${pages} page(s)`);
  if (pages !== 1) fails.push(`night-before sheet prints on ${pages} pages, expected 1`);
  await page.close();
}

await browser.close();
console.log(`${urls.length} views × 4 = ${shots} screenshots in ${outDir}`);
if (fails.length) {
  console.log(`\nFAILED (${fails.length}):`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log('all site checks passed');
