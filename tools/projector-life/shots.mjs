/* ============================================================================
   PROJECTOR LIFE — screenshots of every preset and every tab
   ----------------------------------------------------------------------------
     node tools/projector-life/shots.mjs [outDir]        (dev server on 5191)
     ONLY=presets,tabs,coral,stage,mcp  THEMES=arcade,jade  WIDTHS=1440,390
   outDir defaults to Documents/projector-life/screenshots. JPEG q80.

     preset-NN-<id>-<theme>-<w>.jpg        every preset × {arcade, jade} × {1440, 390}
                                           (viewport, after the opening glide; each
                                           preset applied by a click, ~7 s to settle)
     preset-NN-<id>-<theme>-390-full.jpg   the whole module at phone width (the drawer) for
                                           the default and the presets that open groups
     stage-NN-<id>.jpg                     the stage canvas alone (overlay hidden),
                                           1440, arcade — the hero shots
     tab-plan[-<section>]-<theme>-<w>.jpg  Plan tab, every sub-section (the module, clipped)
     tab-apps-<theme>-<w>.jpg              Applications tab (the module, clipped)
     mcp-<theme>-1440.jpg                  the MCP preview drawer, open
     coral: preset-01 + tab-plan + tab-apps at 1440
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, PRESETS, launch, openPage, applyPreset, waitCamera, canvasLight, clickTab, splitNoise, sleep } from './qa-kit.mjs';

const OUT = path.resolve(process.argv[2] || path.join(REPO, 'Documents/projector-life/screenshots'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const THEMES = (process.env.THEMES || 'arcade,jade').split(',');
const WIDTHS = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const SETTLE = Number(process.env.SETTLE || 7000);
const H = { 1440: 900, 390: 844 };
fs.mkdirSync(OUT, { recursive: true });

const pad2 = (n) => String(n).padStart(2, '0');
const LOG = [];
const made = [];
const notes = [];
const shot = async (page, name, opts = {}) => {
  const file = path.join(OUT, name);
  const { module: mod, ...rest } = opts;
  if (mod) {
    // the whole module (tabs → MCP drawer / tab content), not the portal's long stacked sidebar
    // scroll to the top first so the sticky portal header sits in its own place, not over the tabs
    const y0 = await page.evaluate(() => {
      const y = scrollY;
      window.scrollTo({ top: 0, behavior: 'instant' });
      return y;
    });
    await sleep(250);
    const clip = await page.evaluate(() => {
      const r = document.querySelector('.pjl').getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.top + scrollY - 8), width: document.documentElement.clientWidth, height: r.height + 16 };
    });
    await page.screenshot({ path: file, type: 'jpeg', quality: 80, clip, captureBeyondViewport: true });
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y0);
    await sleep(150);
  } else {
    await page.screenshot({ path: file, type: 'jpeg', quality: 80, ...rest });
  }
  made.push(name);
  return file;
};

const browser = await launch();
try {
  // ── presets (+ stage heroes, + phone full pages) ──────────────────────────
  if (want('presets') || want('stage')) {
    for (const theme of THEMES) {
      for (const w of WIDTHS) {
        const doPresets = want('presets');
        const doStage = want('stage') && theme === 'arcade' && w === 1440;
        if (!doPresets && !doStage) continue;
        const { page } = await openPage(browser, { theme, width: w, height: H[w] || 900, tag: `${theme}-${w}`, sink: LOG });
        await sleep(1500); // the opening glide
        for (const [i, p] of PRESETS.entries()) {
          await applyPreset(page, p);
          await waitCamera(page);
          await sleep(SETTLE);
          const light = await canvasLight(page);
          if (light.frac < 0.03) notes.push(`${p.id} ${theme} ${w}: stage only ${(light.frac * 100).toFixed(1)} % lit`);
          // keep the page where the opening glide left it (presets may scroll the side panel, never the page)
          if (doPresets) {
            await shot(page, `preset-${pad2(i + 1)}-${p.id}-${theme}-${w}.jpg`);
            if (w < 860 && (i === 0 || p.open?.length)) await shot(page, `preset-${pad2(i + 1)}-${p.id}-${theme}-${w}-full.jpg`, { module: true });
          }
          if (doStage) {
            await page.evaluate(() => {
              document.querySelector('.pjl-ov').style.visibility = 'hidden';
            });
            await sleep(60);
            const el = await page.$('canvas.pjl-canvas');
            const file = path.join(OUT, `stage-${pad2(i + 1)}-${p.id}.jpg`);
            await el.screenshot({ path: file, type: 'jpeg', quality: 85 });
            made.push(path.basename(file));
            await page.evaluate(() => {
              document.querySelector('.pjl-ov').style.visibility = '';
            });
          }
          console.log(`  ${theme} ${w} ${p.id}  lit ${(light.frac * 100).toFixed(0)} %`);
        }
        if (want('mcp') && w === 1440) {
          await applyPreset(page, PRESETS[0]);
          await sleep(1500);
          await page.click('.pjl-mcp__bar');
          await page.waitForSelector('.pjl-mcp__body .pjl-code__code');
          await page.evaluate(() => document.querySelector('.pjl-mcp').scrollIntoView({ block: 'start' }));
          await sleep(400);
          await shot(page, `mcp-${theme}-1440.jpg`);
        }
        await page.close();
      }
    }
  }

  // ── Plan + Applications tabs ──────────────────────────────────────────────
  const tabShots = async (theme, w) => {
    const { page } = await openPage(browser, { theme, width: w, height: H[w] || 900, tag: `tabs-${theme}-${w}`, sink: LOG });
    await sleep(1200);
    await clickTab(page, 'Plan');
    await page.waitForFunction(() => document.getElementById('pjl-panel-plan')?.getBoundingClientRect().height > 400 && !document.querySelector('.pjl-wait'), { timeout: 8000 });
    const subs = await page.$$eval('.pjl-subnav__b', (bs) => bs.map((b) => b.textContent.replace(/^\d+/, '').trim().toLowerCase().replace(/[^a-z]+/g, '-')));
    for (const [i, s] of subs.entries()) {
      await page.evaluate((k) => document.querySelectorAll('.pjl-subnav__b')[k].click(), i);
      await sleep(600);
      await shot(page, `tab-plan${i === 0 ? '' : `-${s}`}-${theme}-${w}.jpg`, { module: true });
    }
    await page.evaluate(() => document.querySelectorAll('.pjl-subnav__b')[0].click());
    await clickTab(page, 'Applications');
    await page.waitForFunction(() => document.getElementById('pjl-panel-apps')?.getBoundingClientRect().height > 400 && !document.querySelector('.pjl-wait'), { timeout: 8000 });
    await sleep(800);
    await shot(page, `tab-apps-${theme}-${w}.jpg`, { module: true });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 1) notes.push(`tabs ${theme} ${w}: ${ov} px horizontal overflow`);
    await page.close();
  };
  if (want('tabs')) {
    for (const theme of THEMES) for (const w of WIDTHS) await tabShots(theme, w);
  }

  // ── coral once at 1440: the default preset and each tab ───────────────────
  if (want('coral')) {
    const { page } = await openPage(browser, { theme: 'coral', width: 1440, height: 900, tag: 'coral-1440', sink: LOG });
    await sleep(SETTLE);
    await shot(page, `preset-01-${PRESETS[0].id}-coral-1440.jpg`);
    await page.close();
    await tabShots('coral', 1440);
  }
} finally {
  await browser.close();
}

const { kept } = splitNoise(LOG);
console.log(`\n${made.length} shots → ${OUT}`);
if (notes.length) console.log(`notes:\n  ${notes.join('\n  ')}`);
if (kept.length) console.log(`console (${kept.length}):\n  ${kept.slice(0, 10).map((m) => `[${m.tag}] ${m.type}: ${m.text.slice(0, 200)}`).join('\n  ')}`);
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ when: new Date().toISOString(), made, notes, console: kept }, null, 2));
