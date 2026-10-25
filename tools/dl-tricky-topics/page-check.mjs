/* ============================================================================
   DL TRICKY TOPICS — headless check of /portal/dl-tricky-topics
   (puppeteer-core + local Edge, seeded through the portal gate; adapted from
   tools/dl-lecture9-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/page-check.mjs [outDir]       (dev server on 5184)
     SITE_URL=http://localhost:5184 ONLY=render,fits node tools/dl-tricky-topics/page-check.mjs out

   Iterates src/…/tricky-topics/topics/index.js, so a new topic is checked
   with no edit here. window.print is stubbed before the page loads in EVERY
   run, so a print dialog can never hang an unattended check.

   Checks
     render    every topic via its deep link: the opener (hero, strips), every
               step (gist, Read, one lab), the drill, every notebook page; one
               tab per topic; provenance labels; no KaTeX errors
     tabs      clicking a tab opens that topic (URL too); /portal/dl-tricky-
               topics with no sub-route reopens the last topic; a step deep
               link lands on the step
     fits      every notebook page ≤ 30 rules at the 760 px reference: the
               page's own indicator AND an independent re-measurement
     pens      notebook pages: blue headings, black body, red markers, green
               highlights, each ≥ 4.5:1 on the paper in all three themes; no
               handwriting font
     focus     focus mode enters (fullscreen or the overlay) and exits
     persist   a notebook tick and a "got it" survive a reload; the tab shows
               the progress; "Resume at step N" offers and jumps
     storage   with localStorage throwing, the page renders and ticks
     reduced   prefers-reduced-motion: story labs open on their last beat; the
               hero sits on its end state
     keyboard  every lab's first control works from the keyboard and changes
               the picture; ≤ 3 controls per lab; the drill marks an answer
               typed and entered
     export    Export PDF calls the stubbed print once, in print mode, with
               every maths drawer open and the drill's worked set shown;
               afterprint restores
     nlm       the NotebookLM dropdown: every prompt < 1,000 characters; Copy
     shots     3 themes × 1440 / 390 per topic, no horizontal page scroll;
               the tab bar is a select at 390
     others    every other Deep Learning module in the registry still renders
     clean     no duplicate ids, no nested buttons, no emoji; zero console
               errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT = path.join(REPO, 'src/components/portal/modules/deep-learning/tricky-topics');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5184';
const ROUTE = '/portal/dl-tricky-topics';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { TOPICS } = await imp('topics/index.js');
const DATA = {};
for (const t of TOPICS) {
  DATA[t.id] = {
    topic: (await imp(`topics/${t.id}/topic.js`)).default,
    sheets: (await imp(`topics/${t.id}/sheets/index.js`)).SHEETS,
    prompts: (await imp(`topics/${t.id}/exportPrompt.js`)).PROMPTS,
  };
}
const registry = fs.readFileSync(path.join(REPO, 'src/components/portal/registry.js'), 'utf8');
const DL_MODULES = [...registry.matchAll(/id:\s*'([^']+)'[^}]*?group:\s*'Deep Learning'/gs)].map((m) => m[1]).filter((id) => id !== 'dl-tricky-topics');

let passN = 0;
const fails = [];
const ok = (cond, label, extra = '') => {
  if (cond) passN += 1;
  else fails.push(label);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  // a real print dialog would hang an unattended run
  window.print = () => {
    window.__printCalls = (window.__printCalls || 0) + 1;
    window.__printClass = document.documentElement.className;
    window.__printState = {
      drawers: document.querySelectorAll('.dltt-maths').length,
      openDrawers: document.querySelectorAll('.dltt-maths__body').length,
      drillPrint: !!document.querySelector('.dltt-drill__print'),
      hero: document.querySelector('.dltt-hero-anim svg')?.outerHTML ?? '',
      stories: [...document.querySelectorAll('.dltt-story')].every((s) => {
        const b = s.querySelectorAll('.dltt-story__beat');
        return b.length === 0 || b[b.length - 1].classList.contains('dltt-story__beat--on');
      }),
    };
  };
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, clear = true, route = ROUTE, wait = '.dltt-sec', tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${e}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t, wipe) => {
    try {
      if (wipe && !sessionStorage.getItem('dltt-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dltt:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dltt-check-wiped', '1');
      }
      localStorage.setItem('portal:theme', t);
    } catch { /* broken-storage run */ }
  }, theme, clear);
  if (brokenStorage) {
    await page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
      const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
    });
  }
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  if (wait) await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(600);
  return page;
}
const topicUrl = (id, step) => `${ROUTE}/${id}${step ? `/${step}` : ''}`;

try {
  /* ── render ───────────────────────────────────────────────────────────── */
  if (want('render')) {
    for (const t of TOPICS) {
      const d = DATA[t.id];
      const page = await open({ route: topicUrl(t.id), tag: `render ${t.id}` });
      const r = await page.evaluate((tid) => ({
        secs: document.querySelectorAll('.dltt-sec').length,
        open: !!document.getElementById(`dltt-${tid}-open`),
        hero: !!document.querySelector('.dltt-hero-anim svg'),
        strips: document.querySelectorAll('.dltt-strip__row').length,
        stages: document.querySelectorAll('.dltt-stage').length,
        gists: document.querySelectorAll('.dltt-gist').length,
        drill: !!document.querySelector('.dltt-drill .dltt-drill__q'),
        sheets: document.querySelectorAll('.dltt-sh:not(.dltt-sh--measure)').length,
        katexErr: document.querySelectorAll('.katex-error').length,
        prov: document.querySelectorAll('.dltt-prov').length,
        tabs: document.querySelectorAll('.dltt-tab').length,
        onTab: document.querySelector('.dltt-tab[aria-selected="true"]')?.id,
        title: document.querySelector('.dltt-opener__title')?.textContent,
      }), t.id);
      const nSteps = d.topic.steps.length;
      ok(r.open && r.title === d.topic.title, `${t.id}: opens on its opener via the deep link`);
      ok(r.secs === 1 + nSteps + 1 + (d.sheets.length ? 1 : 0), `${t.id}: opener + ${nSteps} steps + drill + Write`, `${r.secs} sections`);
      ok(r.hero, `${t.id}: the hero animation renders`);
      ok(r.strips >= Math.min(5, d.topic.showsUp.length) + d.topic.examAsks.length, `${t.id}: "where it shows up" and "what the exam asks" rows`, `${r.strips}`);
      ok(r.gists === nSteps && r.stages === nSteps, `${t.id}: every step has its gist and one lab`, `${r.gists} gists, ${r.stages} labs`);
      ok(r.drill, `${t.id}: the drill renders a question`);
      ok(r.sheets === d.sheets.length, `${t.id}: ${d.sheets.length} notebook page(s)`, `${r.sheets}`);
      ok(r.katexErr === 0, `${t.id}: no KaTeX errors`, `${r.katexErr}`);
      ok(r.prov > nSteps * 2, `${t.id}: provenance labels throughout`, `${r.prov}`);
      ok(r.tabs === TOPICS.length && r.onTab === `dltt-tab-${t.id}`, `${t.id}: one tab per topic, this one selected`);
      const clean = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
        const nested = document.querySelectorAll('button button, a button, button a').length;
        const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(document.querySelector('.dltt')?.innerText ?? '');
        const pills = [...document.querySelectorAll('.dltt-prov, .dltt-lec, .dltt-tab, .dltt-receipt')].filter((e) => {
          const bg = getComputedStyle(e).backgroundColor;
          return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        }).length;
        return { dup: [...new Set(dup)], nested, emoji, pills };
      });
      ok(clean.dup.length === 0, `${t.id}: no duplicate ids`, clean.dup.slice(0, 5).join(', '));
      ok(clean.nested === 0, `${t.id}: no nested interactive elements`);
      ok(!clean.emoji, `${t.id}: no emoji`);
      ok(clean.pills === 0, `${t.id}: provenance labels, lecture labels and tabs are not filled`, `${clean.pills}`);
      await page.close();
    }
  }

  /* ── tabs + deep links ────────────────────────────────────────────────── */
  if (want('tabs') && TOPICS.length > 1) {
    const a = TOPICS[0].id;
    const b = TOPICS[TOPICS.length - 1].id;
    const page = await open({ route: topicUrl(a), tag: 'tabs' });
    await page.click(`#dltt-tab-${b}`);
    await page.waitForFunction((id) => location.pathname.endsWith(`/${id}`) && document.querySelector('.dltt-topic')?.dataset.topic === id, { timeout: 15000 }, b).catch(() => {});
    ok(await page.evaluate((id) => location.pathname.endsWith(`/${id}`) && document.querySelector('.dltt-topic')?.dataset.topic === id, b), `clicking the "${b}" tab opens it and updates the URL`);
    // keyboard: ArrowLeft from the selected tab moves to the previous one
    await page.focus(`#dltt-tab-${b}`);
    await page.keyboard.press('ArrowLeft');
    await sleep(800);
    const prev = TOPICS[TOPICS.length - 2].id;
    ok(await page.evaluate((id) => document.querySelector('.dltt-topic')?.dataset.topic === id, prev), 'the tab bar works from the keyboard (← selects the previous topic)');
    await page.click(`#dltt-tab-${b}`);
    await sleep(800);
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dltt-sec');
    await sleep(500);
    ok(await page.evaluate((id) => location.pathname.endsWith(`/${id}`) && document.querySelector('.dltt-topic')?.dataset.topic === id, b), 'with no sub-route the last topic visited reopens (and the URL names it)');
    const step = DATA[a].topic.steps[Math.min(3, DATA[a].topic.steps.length - 1)].id;
    await page.goto(`${BASE}${topicUrl(a, step)}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dltt-sec');
    await sleep(1200);
    const top = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top, `dltt-${a}-${step}`);
    ok(top !== undefined && top < 400 && top > -40, `a step deep link (/${a}/${step}) lands on the step`, `top ${Math.round(top)}`);
    await page.close();
  }

  /* ── fits: every notebook page ≤ 30 rules ─────────────────────────────── */
  if (want('fits')) {
    for (const t of TOPICS) {
      const page = await open({ route: topicUrl(t.id), tag: `fits ${t.id}` });
      await page.waitForFunction(() => [...document.querySelectorAll('.dltt-fit')].every((e) => e.dataset.rules), { timeout: 20000 }).catch(() => {});
      await sleep(600);
      const res = await page.evaluate(() => [...document.querySelectorAll('.dltt-nb')].map((nb) => {
        const fit = nb.querySelector('.dltt-fit');
        const sh = nb.querySelector('.dltt-measure .dltt-sh');
        const probe = sh.querySelector('.dltt-sh__probe');
        const tools = sh.querySelector('.dltt-sh__tools');
        const step = probe.getBoundingClientRect().height;
        const top = parseFloat(getComputedStyle(sh).paddingTop) || 0;
        const gap = parseFloat(getComputedStyle(tools).marginTop) || 0;
        const own = Math.ceil((tools.offsetTop - top - gap) / step - 0.05);
        return { page: fit.dataset.page, shown: Number(fit.dataset.rules), own, width: sh.getBoundingClientRect().width, text: fit.textContent };
      }));
      res.forEach((r) => {
        ok(r.shown > 0 && r.shown <= 30, `${t.id}/${r.page}: fits one page (${r.text})`);
        ok(r.own === r.shown && r.own <= 30, `${t.id}/${r.page}: re-measured at ${Math.round(r.width)} px: ${r.own} rules`, `indicator ${r.shown}`);
        ok(Math.abs(r.width - 760) < 1, `${t.id}/${r.page}: the measuring copy is 760 px wide`);
      });
      await page.close();
    }
  }

  /* ── pens ─────────────────────────────────────────────────────────────── */
  if (want('pens')) {
    const lum = (c) => {
      // rgb()/rgba() give 0–255; color(srgb r g b) (from color-mix) gives 0–1
      const srgb = /^color\(srgb/.test(c);
      const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number).map((v, i) => (srgb && i < 3 ? v * 255 : v));
      const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    for (const theme of ['jade', 'coral', 'arcade']) {
      const page = await open({ theme, route: topicUrl(TOPICS[0].id), tag: `pens ${theme}` });
      const p = await page.evaluate(() => {
        const sh = document.querySelector('.dltt-sh:not(.dltt-sh--measure)');
        sh.scrollIntoView();
        const cs = (sel) => { const e = sh.querySelector(sel); return e ? getComputedStyle(e).color : null; };
        const paper = getComputedStyle(sh).backgroundColor;
        const fonts = [...sh.querySelectorAll('*')].map((e) => getComputedStyle(e).fontFamily).join(' | ');
        const vars = getComputedStyle(sh);
        return {
          paper,
          title: cs('.dltt-sh__title'),
          head: cs('.dltt-sh__h'),
          body: cs('.dltt-sh__t'),
          mark: cs('.dltt-sh__mark'),
          green: cs('.dltt-sh__g'),
          blue: vars.getPropertyValue('--pen-blue').trim(),
          hand: /caveat|patrick|kalam|indie flower|shadows into|handlee|gochi|architects/i.test(fonts),
        };
      });
      const toRgb = async (c) => page.evaluate((col) => { const d = document.createElement('i'); d.style.color = col; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }, c);
      const blue = await toRgb(p.blue);
      ok(p.title === blue && p.head === blue, `pens (${theme}): headings in the blue pen`);
      ok(!p.hand, `pens (${theme}): no handwriting font`);
      for (const [name, col] of [['blue', p.title], ['black', p.body], ['red', p.mark], ['green', p.green]]) {
        if (!col) { ok(false, `pens (${theme}): the ${name} pen is used`); continue; }
        const r = ratio(col, p.paper);
        ok(r >= 4.5, `pens (${theme}): ${name} pen ≥ 4.5:1 on the paper`, r.toFixed(2));
      }
      await page.close();
    }
  }

  /* ── focus mode ───────────────────────────────────────────────────────── */
  if (want('focus')) {
    const page = await open({ route: topicUrl(TOPICS[0].id), tag: 'focus' });
    await page.click('.dltt-opener__actions .dltt-btn--primary');
    await page.waitForFunction(() => document.querySelector('.dltt--focus'), { timeout: 5000 }).catch(() => {});
    ok(await page.evaluate(() => !!document.querySelector('.dltt--focus')), 'focus mode enters');
    ok(await page.evaluate(() => !!document.querySelector('.dltt--focus .dltt-tabs')), 'the topic tabs stay reachable in focus mode');
    // (an element click: headless mouse coordinates are off inside real fullscreen)
    await page.$eval('.dltt-bar .dltt-btn--primary', (b) => b.click());
    await page.waitForFunction(() => !document.querySelector('.dltt--focus'), { timeout: 5000 }).catch(() => {});
    ok(await page.evaluate(() => !document.querySelector('.dltt--focus')), 'focus mode exits');
    await page.close();
  }

  /* ── persistence + resume ─────────────────────────────────────────────── */
  if (want('persist')) {
    const t = TOPICS[0];
    const page = await open({ route: topicUrl(t.id), tag: 'persist' });
    await page.$eval('.dltt-sh:not(.dltt-sh--measure) .dltt-sh__u', (b) => b.click());
    await page.$eval('.dltt-done', (b) => b.click());
    await sleep(300);
    const s3 = DATA[t.id].topic.steps[2].id;
    await page.evaluate((id) => { const el = document.getElementById(id); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant' }); }, `dltt-${t.id}-${s3}`);
    await sleep(900);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.dltt-sec');
    await sleep(700);
    const st = await page.evaluate(() => ({
      tick: document.querySelector('.dltt-sh:not(.dltt-sh--measure) .dltt-sh__u')?.getAttribute('aria-pressed'),
      done: document.querySelector('.dltt-done')?.getAttribute('aria-pressed'),
      mark: document.querySelector('.dltt-tab--on .dltt-tab__frac')?.textContent,
      resume: document.querySelector('.dltt-resume .dltt-btn')?.textContent ?? '',
    }));
    ok(st.tick === 'true', 'a notebook tick survives a reload');
    ok(st.done === 'true', 'a step marked "got it" survives a reload');
    ok(/^1\//.test(st.mark ?? ''), 'the tab’s progress mark counts it', st.mark);
    ok(/Resume at step 3/.test(st.resume), '"Resume at step N" offers the step you were reading', st.resume.trim());
    if (st.resume) {
      await page.click('.dltt-resume .dltt-btn');
      await sleep(1200);
      const top = await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, `dltt-${t.id}-${s3}`);
      ok(top < 300 && top > -40, '"Resume" jumps to it', `top ${Math.round(top)}`);
    }
    await page.close();
  }

  /* ── broken storage ───────────────────────────────────────────────────── */
  if (want('storage')) {
    const page = await open({ route: topicUrl(TOPICS[0].id), brokenStorage: true, tag: 'storage' });
    ok(await page.evaluate(() => document.querySelectorAll('.dltt-sec').length > 3), 'renders with localStorage throwing');
    await page.$eval('.dltt-sh:not(.dltt-sh--measure) .dltt-sh__u', (b) => b.click());
    ok(await page.evaluate(() => document.querySelector('.dltt-sh:not(.dltt-sh--measure) .dltt-sh__u').getAttribute('aria-pressed') === 'true'), 'ticks still work without storage');
    await page.close();
  }

  /* ── reduced motion ───────────────────────────────────────────────────── */
  if (want('reduced')) {
    for (const t of TOPICS) {
      const page = await open({ route: topicUrl(t.id), reduced: true, tag: `reduced ${t.id}` });
      const r = await page.evaluate(() => ({
        stories: [...document.querySelectorAll('.dltt-story')].map((s) => { const b = s.querySelectorAll('.dltt-story__beat'); return b[b.length - 1]?.classList.contains('dltt-story__beat--on'); }),
        hero: document.querySelector('.dltt-hero-anim svg')?.outerHTML ?? '',
      }));
      ok(r.stories.every(Boolean), `${t.id}: reduced motion — every story lab opens on its last beat`, `${r.stories.length} stories`);
      // the hero's end state is what print shows: compare the two
      await page.click('.dltt-export > .dltt-btn');
      await page.waitForFunction(() => window.__printCalls === 1, { timeout: 15000 }).catch(() => {});
      const printed = await page.evaluate(() => window.__printState?.hero ?? '');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      ok(r.hero && r.hero === printed, `${t.id}: reduced motion — the hero sits on its end state (the same picture print shows)`);
      await page.close();
    }
  }

  /* ── keyboard + controls ──────────────────────────────────────────────── */
  if (want('keyboard')) {
    for (const t of TOPICS) {
      const page = await open({ route: topicUrl(t.id), tag: `keyboard ${t.id}` });
      const n = await page.$$eval('.dltt-stage', (els) => els.length);
      for (let i = 0; i < n; i++) {
        const info = await page.evaluate((k) => {
          const st = document.querySelectorAll('.dltt-stage')[k];
          const ctrls = st.querySelectorAll('[role="slider"], .dltt-switch, select, .dltt-lock');
          const title = st.querySelector('.dltt-stage__title')?.textContent;
          const first = st.querySelector('[role="slider"], .dltt-switch [role="radio"][aria-checked="false"], select, .dltt-lock, .dltt-story__beat:not(.dltt-story__beat--on), [role="button"][tabindex="0"]');
          if (first) { first.scrollIntoView({ block: 'center' }); first.setAttribute('data-kb', '1'); }
          return { count: ctrls.length, title, has: !!first, kind: first ? (first.getAttribute('role') || first.tagName) : null, before: st.querySelector('.dltt-stage__floor').innerHTML.length + st.querySelector('.dltt-stage__floor').textContent };
        }, i);
        ok(info.count <= 3, `${t.id} · "${info.title}": ≤ 3 controls`, `${info.count}`);
        if (!info.has) { ok(false, `${t.id} · "${info.title}": has a keyboard-reachable control`); continue; }
        await page.$eval('[data-kb="1"]', (e) => e.focus());
        if (info.kind === 'SELECT') await page.keyboard.press('ArrowDown');
        else if (info.kind === 'slider') { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); }
        else await page.keyboard.press('Enter');
        await sleep(450);
        const after = await page.evaluate((k) => { const st = document.querySelectorAll('.dltt-stage')[k]; document.querySelector('[data-kb="1"]')?.removeAttribute('data-kb'); return st.querySelector('.dltt-stage__floor').innerHTML.length + st.querySelector('.dltt-stage__floor').textContent; }, i);
        ok(after !== info.before, `${t.id} · "${info.title}": its first control works from the keyboard (${info.kind})`);
      }
      // the drill: type an answer, Enter, a mark appears
      const drill = await page.$('.dltt-drill .dltt-drill__in');
      if (drill) {
        const tagName = await drill.evaluate((e) => e.tagName);
        await drill.evaluate((e) => e.focus());
        if (tagName === 'SELECT') {
          await page.keyboard.press('ArrowDown');
          await page.$eval('.dltt-drill__live .dltt-btn--primary', (b) => b.focus());
          await page.keyboard.press('Enter');
        } else {
          await page.keyboard.type('12');
          await page.keyboard.press('Enter');
        }
        await sleep(300);
        ok(await page.evaluate(() => !!document.querySelector('.dltt-drill .dltt-mark')), `${t.id}: the drill marks an answer entered from the keyboard`);
      } else ok(false, `${t.id}: the drill has an input`);
      await page.close();
    }
  }

  /* ── export + NotebookLM ──────────────────────────────────────────────── */
  if (want('export') || want('nlm')) {
    for (const t of TOPICS) {
      const page = await open({ route: topicUrl(t.id), tag: `export ${t.id}` });
      if (want('export')) {
        await page.click('.dltt-export > .dltt-btn');
        await page.waitForFunction(() => window.__printCalls === 1, { timeout: 15000 }).catch(() => {});
        const s = await page.evaluate(() => ({ calls: window.__printCalls, cls: window.__printClass, state: window.__printState }));
        ok(s.calls === 1, `${t.id}: Export PDF calls print once`);
        ok(/dltt-printing/.test(s.cls ?? ''), `${t.id}: print runs in print mode`);
        ok(s.state && s.state.drawers > 0 && s.state.openDrawers === s.state.drawers, `${t.id}: every maths drawer is open in print`, s.state ? `${s.state.openDrawers}/${s.state.drawers}` : '');
        ok(s.state?.drillPrint, `${t.id}: the drill prints a worked set`);
        ok(s.state?.stories, `${t.id}: story labs print their last beat`);
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await sleep(300);
        ok(await page.evaluate(() => !document.documentElement.classList.contains('dltt-printing')), `${t.id}: afterprint restores the page`);
      }
      if (want('nlm')) {
        const d = DATA[t.id];
        await page.click('.dltt-export__toggle');
        await sleep(200);
        const blocks = await page.$$eval('.dltt-nlm__text', (els) => els.map((e) => e.textContent));
        ok(blocks.length === 1 + (d.prompts.parts?.length ?? 0), `${t.id}: the NotebookLM dropdown shows ${1 + (d.prompts.parts?.length ?? 0)} prompt(s)`);
        ok(blocks.every((b) => b.length < 1000), `${t.id}: every prompt < 1,000 characters`, blocks.map((b) => b.length).join(', '));
        await page.click('.dltt-nlm__copy');
        await sleep(200);
        ok(await page.$eval('.dltt-nlm__copy', (b) => /Copied|Selected/.test(b.textContent)), `${t.id}: Copy copies or selects the prompt`);
      }
      await page.close();
    }
  }

  /* ── shots: 3 themes × 2 widths ───────────────────────────────────────── */
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        for (const t of TOPICS) {
          const page = await open({ theme, width, height: width === 390 ? 844 : 900, route: topicUrl(t.id), tag: `shot ${theme} ${width} ${t.id}` });
          const s = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth, select: !!document.querySelector('.dltt-tabs__select select'), tabs: document.querySelectorAll('.dltt-tab').length }));
          ok(s.sw <= s.cw + 1, `${theme} ${width}: ${t.id} has no horizontal page scroll`, `${s.sw} vs ${s.cw}`);
          if (width === 390) ok(s.select && s.tabs === 0, `${theme} 390: ${t.id}'s topic bar is a select`);
          await page.screenshot({ path: path.join(OUT, `${t.id}-${theme}-${width}.png`) });
          await page.close();
        }
      }
    }
  }

  /* ── other Deep Learning modules ──────────────────────────────────────── */
  if (want('others')) {
    for (const id of DL_MODULES) {
      const before = consoleMsgs.length;
      const page = await open({ route: `/portal/${id}`, wait: '.portal__content', clear: false, tag: `other ${id}` });
      await sleep(900);
      const n = await page.evaluate(() => document.querySelector('.portal__content')?.innerText.length ?? 0);
      const errs = consoleMsgs.slice(before).filter((m) => /pageerror|error/.test(m));
      ok(n > 200 && errs.length === 0, `another Deep Learning module still renders: ${id}`, `${n} chars, ${errs.length} errors`);
      await page.close();
    }
  }
} catch (e) {
  ok(false, `the check ran to the end`, e.stack);
} finally {
  await browser.close();
}

const own = consoleMsgs.filter((m) => !/\[other /.test(m));
ok(own.length === 0, 'zero console errors / warnings on the page', own.slice(0, 6).join(' | '));
console.log(`\n${fails.length ? `${fails.length} FAILED:\n  ${fails.join('\n  ')}` : 'ALL PASSED'} · ${passN} passed`);
process.exit(fails.length ? 1 : 0);
