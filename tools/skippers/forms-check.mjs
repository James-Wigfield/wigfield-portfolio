/* ============================================================================
   SKIPPERS · FORMS - headless check of /portal/skippers
   (puppeteer-core + local Edge, seeded through the portal gate)
     node tools/skippers/forms-check.mjs [outDir]
     SITE_URL=http://localhost:5191 node tools/skippers/forms-check.mjs out

   Checks
     - both forms render in jade / coral / arcade at 1440 and 390, with no
       horizontal page scroll and zero console errors or warnings
     - every overlaid value (text, date cell, tick, placeholder) sits inside
       its target box from fields.js, and every box / tag / counter sits on
       the paper
     - desktop notes never overlap, each note's counter matches a counter on
       the page
     - deep links (/eyesight, /consent) and the switch drive the URL; phone
       zoom pans inside its frame
     - "My details" saves to localStorage `skf:applicant` and the forms pick
       it up; without it the forms show placeholders
     - print media: only the paper, one A4 sheet per form page, examples off
       by default and on with "Print examples"
     - privacy: the module, the tools and public/skippers-forms never contain
       the private markers given in SKF_PRIVATE_MARKERS (optional)
   The device-only details here are FAKE (01/01/2000, 1 Example St).
   Screenshots and PDFs land in outDir (default <temp>/skf-out).
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/skippers';
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'skf-out'));
const THEMES = ['jade', 'coral', 'arcade'];
const FORMS = [
  { id: 'eyesight', pages: 2 },
  { id: 'consent', pages: 1 },
];
const FAKE = { dob: '01/01/2000', unit: '', number: '1', street: 'Example St' };
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
};

// 0. privacy sweep over everything this feature ships or runs
// The markers themselves are private, so they never live in this file: pass
// them at run time, e.g. SKF_PRIVATE_MARKERS="dd/mm/yyyy,street" node ...
const BANNED = (process.env.SKF_PRIVATE_MARKERS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SWEEP = ['src/components/portal/modules/skippers', 'tools/skippers', 'public/skippers-forms'];
if (!BANNED.length) console.log('skip privacy sweep (SKF_PRIVATE_MARKERS not set)');
for (const dir of BANNED.length ? SWEEP : []) {
  for (const f of fs.readdirSync(dir)) {
    const txt = fs.readFileSync(path.join(dir, f)).toString('latin1');
    const hit = BANNED.find((b) => txt.includes(b));
    ok(!hit, `${dir}/${f}: no private markers${hit ? ' (FOUND ONE)' : ''}`);
  }
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, sub = '', device = FAKE } = {}) {
  const page = await browser.newPage();
  const tag = `[${theme} ${width} ${sub || 'default'}]`;
  page.on('console', (m) => {
    if (['error', 'warn'].includes(m.type())) consoleMsgs.push(`${tag} ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`${tag} pageerror ${e.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) consoleMsgs.push(`${tag} HTTP ${res.status()} ${res.url()}`);
  });
  await page.setViewport({ width, height: 1000 });
  await page.evaluateOnNewDocument(
    (t, d) => {
      sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
      try {
        localStorage.setItem('portal:theme', t);
        if (d) localStorage.setItem('skf:applicant', JSON.stringify(d));
        else localStorage.removeItem('skf:applicant');
      } catch {
        /* ignore */
      }
    },
    theme,
    device,
  );
  await page.goto(`${BASE}${ROUTE}${sub ? `/${sub}` : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.skf-paper img', { timeout: 15000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.skf-paper img')].map((i) => i.decode().catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return page;
}

// Geometry audit, run in the page.
const audit = () => {
  const r = (el) => el.getBoundingClientRect();
  const T = 0.75;
  const inside = (a, b) => a.left >= b.left - T && a.right <= b.right + T && a.top >= b.top - T && a.bottom <= b.bottom + T;
  const out = { vals: 0, bad: [], onPaper: [], notesOverlap: [], counters: [], fonts: new Set() };
  for (const paper of document.querySelectorAll('.skf-paper')) {
    const pr = r(paper);
    for (const f of paper.querySelectorAll('.skf-f')) {
      const fr = r(f);
      if (!inside(fr, pr)) out.onPaper.push(f.dataset.field);
      for (const v of f.querySelectorAll('.skf-val')) {
        if (!v.checkVisibility()) continue;
        out.vals++;
        const vr = r(v);
        if (vr.width === 0 || !inside(vr, fr)) {
          out.bad.push(`${f.dataset.field} val ${vr.left.toFixed(1)},${vr.top.toFixed(1)} ${vr.width.toFixed(1)}x${vr.height.toFixed(1)} box ${fr.left.toFixed(1)},${fr.top.toFixed(1)} ${fr.width.toFixed(1)}x${fr.height.toFixed(1)} "${v.textContent}"`);
        }
        if (!v.classList.contains('skf-ph') && v.tagName === 'SPAN') out.fonts.add(getComputedStyle(v).fontFamily.split(',')[0]);
      }
    }
    for (const t of paper.querySelectorAll('.skf-tag, .skf-anno, .skf-pin')) {
      if (!t.checkVisibility()) continue;
      if (!inside(r(t), pr)) out.onPaper.push(`${t.className}: ${t.textContent}`);
    }
  }
  for (const sheet of document.querySelectorAll('.skf-sheet')) {
    const pins = [...sheet.querySelectorAll('.skf-pin')].map((p) => p.textContent);
    const notes = [...sheet.querySelectorAll('.skf-note')];
    const counts = notes.map((n) => n.querySelector('.skf-count').textContent);
    out.counters.push(pins.join(',') === counts.join(',') ? 'match' : `pins ${pins} vs notes ${counts}`);
    for (let i = 1; i < notes.length; i++) {
      const a = r(notes[i - 1]);
      const b = r(notes[i]);
      if (b.top < a.bottom - 0.5) out.notesOverlap.push(`${counts[i - 1]}/${counts[i]}`);
    }
  }
  out.fonts = [...out.fonts];
  out.hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
  out.sidebar = [...document.querySelectorAll('.portal__sidebar *')].some((n) => n.textContent.trim() === 'Skippers · Forms');
  out.selected = document.querySelector('.skf-switch__btn[aria-selected="true"] b')?.textContent;
  out.pages = document.querySelectorAll('.skf-paper').length;
  return out;
};

// 1. forms x themes x widths, with the (fake) device details set
for (const theme of THEMES) {
  for (const width of [1440, 390]) {
    for (const f of FORMS) {
      const page = await open({ theme, width, sub: f.id });
      const a = await page.evaluate(audit);
      const label = `${theme} ${width} ${f.id}`;
      ok(a.pages === f.pages, `${label}: ${a.pages} page(s)`);
      ok(!a.hscroll, `${label}: no horizontal page scroll`);
      ok(a.vals >= 5 && a.bad.length === 0, `${label}: ${a.vals} values inside their boxes${a.bad.length ? `\n      ${a.bad.join('\n      ')}` : ''}`);
      ok(a.onPaper.length === 0, `${label}: boxes, tags and counters on the paper${a.onPaper.length ? ` (${a.onPaper.join('; ')})` : ''}`);
      ok(a.counters.every((c) => c === 'match'), `${label}: page counters match note counters (${a.counters.join(' | ')})`);
      if (width === 1440) {
        ok(a.notesOverlap.length === 0, `${label}: desktop notes do not overlap${a.notesOverlap.length ? ` (${a.notesOverlap})` : ''}`);
        ok(a.sidebar, `${label}: sidebar lists "Skippers · Forms"`);
      }
      ok(a.fonts.length && a.fonts.every((x) => /Patrick Hand/.test(x)), `${label}: values in the pen font (${a.fonts})`);
      await page.screenshot({ path: path.join(OUT, `${theme}-${width}-${f.id}.png`), fullPage: true });
      // per-page close-ups for the critique
      if (theme === 'jade') {
        const papers = await page.$$('.skf-paper');
        for (let i = 0; i < papers.length; i++) {
          await papers[i].screenshot({ path: path.join(OUT, `paper-${width}-${f.id}-${i + 1}.png`) });
        }
      }
      await page.close();
    }
  }
}

// 2. deep links + the switch
{
  const page = await open({ sub: '' });
  ok((await page.evaluate(audit)).selected === 'Eyesight & medical', 'no sub-route opens the eyesight form');
  await page.click('.skf-switch__btn:nth-child(2)');
  await page.waitForFunction(() => location.pathname.endsWith('/portal/skippers/consent'));
  ok((await page.evaluate(audit)).pages === 1, 'switch to consent: URL /portal/skippers/consent, 1 page');
  await page.close();
}

// 2b. phone zoom: the page doubles inside its own frame, the page itself never scrolls sideways
{
  const page = await open({ width: 390, sub: 'consent' });
  await page.click('.skf-phonebar .skf-link');
  const z = await page.evaluate(() => {
    const fr = document.querySelector('.skf-frame');
    return {
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      framePans: fr.scrollWidth > fr.clientWidth * 1.8,
    };
  });
  const a = await page.evaluate(audit);
  ok(!z.hscroll && z.framePans && a.bad.length === 0, 'phone zoom 2x: frame pans, page has no h-scroll, values still in their boxes');
  await page.close();
}

// 3. placeholders without device details, then the editor
{
  const page = await open({ sub: 'eyesight', device: null });
  const ph = await page.evaluate(() => ({
    n: document.querySelectorAll('.skf-ph').length,
    text: [...document.querySelectorAll('.skf-ph')].map((e) => e.textContent).join(''),
    status: document.querySelector('.skf-me__line .skf-dot')?.textContent,
  }));
  ok(ph.n === 2 * (8 + 1) && ph.text.includes('Street no. & name'), `no device details: ${ph.n} placeholders shown ("${ph.status}")`);
  const a = await page.evaluate(audit);
  ok(a.bad.length === 0, `placeholders inside their boxes${a.bad.length ? `\n      ${a.bad.join('\n      ')}` : ''}`);
  await page.screenshot({ path: path.join(OUT, 'jade-1440-eyesight-placeholders.png'), fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 1000 } });

  await page.click('.skf-me__line .skf-link');
  await page.waitForSelector('.skf-me__form');
  const inputs = await page.$$('.skf-me__form input');
  await inputs[0].type('02/02/2002');
  await inputs[2].type('7');
  await inputs[3].type('Sample Way');
  await page.click('.skf-me__form button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('.skf-ph').length === 0);
  const saved = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('skf:applicant') || 'null'),
    addr: document.querySelector('[data-field="e1-address"] .skf-val')?.textContent,
    dob: [...document.querySelectorAll('[data-field^="e1-dob-"] .skf-val')].map((e) => e.textContent).join(''),
  }));
  ok(saved.store?.street === 'Sample Way' && saved.addr === '7 Sample Way' && saved.dob === '02022002', `editor saves to skf:applicant and fills the form (${saved.addr}, ${saved.dob})`);
  await page.close();
}

// 4. print: only the paper, one A4 sheet per page, examples off unless ticked
for (const f of FORMS) {
  for (const withEx of [false, true]) {
    const page = await open({ sub: f.id });
    if (withEx) await page.click('.skf-check input');
    await page.emulateMediaType('print');
    const p = await page.evaluate(() => ({
      chrome: ['.portal__sidebar', '.portal__topbar', '.skf-top', '.skf-notes', '.skf-pin', '.skf-tag'].filter((s) => {
        const el = document.querySelector(s);
        return el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      }),
      ex: [...document.querySelectorAll('.skf-f.skf-ex')].filter((e) => getComputedStyle(e).display !== 'none').length,
      blue: [...document.querySelectorAll('.skf-f.skf-ink--blue')].filter((e) => getComputedStyle(e).display !== 'none').length,
    }));
    const a = await page.evaluate(audit);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const name = `print-${f.id}${withEx ? '-examples' : ''}.pdf`;
    fs.writeFileSync(path.join(OUT, name), pdf);
    // pdfinfo (xpdf / MiKTeX, on PATH) reads the page count and size
    const info = execFileSync('pdfinfo', [path.join(OUT, name)], { encoding: 'utf8' });
    const sheets = Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 0);
    const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
    const a4 = size && Math.abs(Number(size[1]) - 595.3) < 2 && Math.abs(Number(size[2]) - 841.9) < 2;
    ok(p.chrome.length === 0, `print ${f.id}${withEx ? ' +examples' : ''}: no portal chrome or notes${p.chrome.length ? ` (${p.chrome})` : ''}`);
    ok(sheets === f.pages && a4, `print ${f.id}${withEx ? ' +examples' : ''}: ${sheets} A4 sheet(s) (${size ? `${size[1]}x${size[2]}` : 'no mediabox'})`);
    ok(withEx ? p.ex > 0 : p.ex === 0, `print ${f.id}: example values ${withEx ? 'shown' : 'hidden'} (${p.ex}), James's shown (${p.blue})`);
    ok(a.bad.length === 0, `print ${f.id}: values inside their boxes at A4 size`);
    if (withEx) {
      const papers = await page.$$('.skf-paper');
      await papers[0].screenshot({ path: path.join(OUT, `print-${f.id}-1.png`) });
    }
    await page.close();
  }
}

await browser.close();
ok(consoleMsgs.length === 0, `console clean${consoleMsgs.length ? `:\n      ${[...new Set(consoleMsgs)].slice(0, 12).join('\n      ')}` : ''}`);
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'all checks passed'} · screenshots + PDFs in ${OUT}`);
process.exit(fails.length ? 1 : 0);
