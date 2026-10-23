/* ============================================================================
   GRADIENT ARCADE — headless check of /portal/dl-arcade (puppeteer-core + local
   Edge, seeded through the portal gate; adapted from
   tools/dl-lecture8-study/page-check.mjs)
   ----------------------------------------------------------------------------
     node tools/dl-arcade/arcade-check.mjs [outDir]          (dev server on 5173)
     ONLY=hub,bot,mix SITE_URL=http://localhost:5173 node tools/dl-arcade/arcade-check.mjs out
     GAMES=param-sniper,descent …                            (limit the bot/shots to some games)

   Scenarios
     unit      the scheduler / progress unit tests (node --test)
     hub       the hub renders: marquee, strip, both big cabinets, one cabinet
               per game, mastery rings; every cabinet opens its game and the
               URL changes; browser back returns to the hub, forward reopens
     deep      every game opens from its deep link (intro with Play)
     bot       a scripted bot plays one full round of every game at every
               level with right and wrong answers (DEV hook window.__dla):
               the round ends once (dla:history grows by one), the results
               screen shows, a why card with a slide receipt per mistake
     mix       the Daily Mix runs end to end (4 rounds, summary); the Exam
               unlocks after three different games and runs end to end with
               a grade per lecture; the scheduler moves concepts between
               boxes as expected
     persist   xp / bests survive a reload
     storage   with localStorage throwing, the hub renders and a round plays
     reduced   prefers-reduced-motion: the hub and a game render and play
     shots     hub + every game (play state) in jade / coral / arcade at 1440
               and 390, no horizontal page scroll
     others    the other Deep Learning modules still render
     console   zero console errors / warnings across every run
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.SITE_URL || 'http://localhost:5173';
const ROUTE = '/portal/dl-arcade';
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const GAME_FILTER = (process.env.GAMES || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = () => {
  sessionStorage.setItem('portal_auth', JSON.stringify({ token: 'mock-session-token', key: 'wiggy1', issued_at: new Date().toISOString() }));
  window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const consoleMsgs = [];

async function open({ theme = 'jade', width = 1440, height = 900, reduced = false, brokenStorage = false, wipe = false, route = ROUTE, wait = '.dla', tag = '' } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') consoleMsgs.push(`[${tag || theme}] ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => consoleMsgs.push(`[${tag || theme}] pageerror: ${String(e).slice(0, 300)}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(SEED);
  await page.evaluateOnNewDocument((t, w) => {
    try {
      if (w && !sessionStorage.getItem('dla-check-wiped')) {
        Object.keys(localStorage).filter((k) => k.startsWith('dla:')).forEach((k) => localStorage.removeItem(k));
        sessionStorage.setItem('dla-check-wiped', '1');
      }
      localStorage.setItem('portal:theme', t);
    } catch { /* broken-storage run */ }
  }, theme, wipe);
  if (brokenStorage) {
    await page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('storage disabled', 'SecurityError'); };
      const dead = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => dead });
    });
  }
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector(wait, { timeout: 30000 });
  await sleep(300);
  return page;
}

const games = async (page) => page.evaluate(() => window.__dlaGames ?? []);
const wipe = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dla:')).forEach((k) => localStorage.removeItem(k)));
const lsJson = (page, key) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, key);

/* ── the bot: plays the mounted round through window.__dla ──────────────── */
async function waitForHook(page, gameId, ms = 25000) {
  await page.waitForFunction((id) => window.__dla && window.__dla.gameId === id, { timeout: ms }, gameId);
}
// A value that must grade wrong for this item (null → skip())
function wrongFor(item) {
  if (!item) return null;
  switch (item.kind) {
    case 'number': return Number(item.answer) + 1;
    case 'shape': return Array.isArray(item.answer) ? item.answer.map((d) => (d === null ? null : d + 1)) : null;
    case 'choice': { const other = (item.choices ?? []).find((c) => c.value !== item.answer); return other ? other.value : null; }
    default: return null;
  }
}
async function playRound(page, { wrongEvery = 2, maxItems = 40, label = '' } = {}) {
  const t0 = Date.now();
  await page.evaluate(() => window.__dla.start());
  await page.waitForFunction(() => window.__dla && window.__dla.state() === 'play', { timeout: 5000 });
  let answered = 0;
  let wrongs = 0;
  let rights = 0;
  for (let i = 0; i < maxItems; i++) {
    const state = await page.evaluate(() => window.__dla ? window.__dla.state() : 'gone');
    if (state !== 'play') break;
    // wait until no feedback is showing
    await page.waitForFunction(() => window.__dla && (window.__dla.state() !== 'play' || !window.__dla.feedback()), { timeout: 8000 }).catch(() => {});
    if ((await page.evaluate(() => window.__dla ? window.__dla.state() : 'gone')) !== 'play') break;
    const item = await page.evaluate(() => {
      const it = window.__dla.current();
      if (!it) return null;
      return { id: it.id, kind: it.kind, answer: it.answer, choices: it.choices, concept: it.concept, hasSrc: !!it.src, hasWhy: !!it.why, hasCheck: typeof it.check === 'function' };
    });
    if (!item) { await sleep(150); continue; }
    const beWrong = wrongEvery > 0 && i % wrongEvery === 1;
    const wrong = beWrong ? wrongFor(item) : undefined;
    const res = await page.evaluate((v, useSkip, right) => {
      if (useSkip) return window.__dla.skip();
      return window.__dla.submit(right ? window.__dla.current().answer : v);
    }, wrong ?? null, beWrong && wrong === null, !beWrong);
    if (res === null || res === undefined) { await sleep(120); continue; }
    answered += 1;
    if (res.correct) rights += 1; else wrongs += 1;
    if (!beWrong && !res.correct) ok(false, `${label}: item ${item.id} (${item.kind}) grades its own answer as correct`, JSON.stringify(item.answer).slice(0, 80));
    if (beWrong && res.correct) ok(false, `${label}: item ${item.id} (${item.kind}) grades a wrong answer as correct`, JSON.stringify(wrong).slice(0, 80));
    if (!item.hasSrc || !item.hasWhy || !item.concept) ok(false, `${label}: item ${item.id} lacks src/why/concept`);
  }
  await page.waitForFunction(() => !window.__dla || window.__dla.state() === 'results', { timeout: 15000 }).catch(() => {});
  return { answered, rights, wrongs, ms: Date.now() - t0 };
}

async function resultsInfo(page) {
  return page.evaluate(() => {
    const res = document.querySelector('.dla-res');
    if (!res) return null;
    const cards = [...res.querySelectorAll('.dla-why')];
    return {
      score: res.querySelector('.dla-res__big')?.textContent ?? '',
      cards: cards.length,
      receipts: cards.map((c) => c.querySelector('.dla-why__receipt')?.textContent ?? '').filter((t) => /Lecture(s)? [\d–]+ · slide/.test(t)).length,
      whyText: cards.filter((c) => (c.querySelector('.dla-why__text')?.textContent ?? '').trim().length > 20).length,
      katexErr: res.querySelectorAll('.katex-error').length,
    };
  });
}

try {
  // ── unit tests ────────────────────────────────────────────────────────────
  if (want('unit')) {
    let out = '';
    try { out = execFileSync('node', ['--test', path.join(HERE, 'scheduler.test.mjs')], { cwd: REPO }).toString(); } catch (e) { out = String(e.stdout || e); }
    const passed = Number((out.match(/(?:#|ℹ) pass (\d+)/) || [])[1] ?? 0);
    const failed = Number((out.match(/(?:#|ℹ) fail (\d+)/) || [])[1] ?? 1);
    ok(passed > 0 && failed === 0, 'scheduler + progress unit tests pass', `${passed} passed, ${failed} failed`);
  }

  const page = await open({ tag: 'hub', wipe: true });
  const GAMES = (await games(page)).filter((g) => !GAME_FILTER.length || GAME_FILTER.includes(g.id));
  const ALL = await games(page);

  // ── hub ───────────────────────────────────────────────────────────────────
  if (want('hub')) {
    const dom = await page.evaluate(() => ({
      marquee: !!document.querySelector('.dla-marquee__title'),
      strip: document.querySelectorAll('.dla-strip__cell').length,
      big: document.querySelectorAll('.dla-bigcab').length,
      cabs: [...document.querySelectorAll('.dla-cab')].map((c) => c.querySelector('.dla-cab__title')?.textContent),
      rings: document.querySelectorAll('.dla-lec .dla-ring').length,
      examLocked: document.querySelector('.dla-bigcab--exam')?.disabled,
    }));
    ok(dom.marquee && dom.strip === 4 && dom.big === 2, 'hub renders marquee, profile strip and both big cabinets');
    ok(dom.cabs.length === ALL.length && ALL.every((g) => dom.cabs.includes(g.title)), `one cabinet per game (${dom.cabs.length})`, dom.cabs.join(', '));
    ok(dom.rings === 7, 'a mastery ring per lecture (7)', String(dom.rings));
    ok(dom.examLocked === true, 'Exam is locked before three games are played');
    // cabinets open their game; back / forward work
    for (const g of GAMES) {
      await page.evaluate((title) => [...document.querySelectorAll('.dla-cab')].find((c) => c.querySelector('.dla-cab__title')?.textContent === title)?.click(), g.title);
      await page.waitForSelector('.dla-round', { timeout: 20000 }).catch(() => {});
      const url = page.url();
      const intro = await page.$('.dla-intro');
      ok(url.endsWith(`${ROUTE}/${g.id}`) && !!intro, `${g.title}: the cabinet opens the game at its route with an intro`, url.replace(BASE, ''));
      await page.goBack({ waitUntil: 'networkidle0' });
      await page.waitForSelector('.dla-hub', { timeout: 10000 }).catch(() => {});
      ok(!!(await page.$('.dla-hub')), `${g.title}: browser back returns to the hub`);
      await page.goForward({ waitUntil: 'networkidle0' });
      await page.waitForSelector('.dla-round', { timeout: 10000 }).catch(() => {});
      ok(!!(await page.$('.dla-round')), `${g.title}: browser forward reopens the game`);
      await page.goBack({ waitUntil: 'networkidle0' });
      await page.waitForSelector('.dla-hub', { timeout: 10000 }).catch(() => {});
    }
  }

  // ── deep links ────────────────────────────────────────────────────────────
  if (want('deep')) {
    for (const g of GAMES) {
      const dp = await open({ tag: `deep-${g.id}`, route: `${ROUTE}/${g.id}` });
      const st = await dp.evaluate(() => ({ round: !!document.querySelector('.dla-round'), play: !!document.querySelector('.dla-intro .dla-btn--primary'), title: document.querySelector('.dla-round__title')?.textContent }));
      ok(st.round && st.play && st.title === g.title, `${g.title}: deep link opens the intro`, st.title ?? 'no title');
      await dp.close();
    }
  }

  // ── the bot ───────────────────────────────────────────────────────────────
  if (want('bot')) {
    for (const g of GAMES) {
      for (let level = 1; level <= g.levels; level++) {
        const bp = await open({ tag: `bot-${g.id}-L${level}`, route: `${ROUTE}/${g.id}?seed=${11 + level}&level=${level}&ms=45000` });
        const before = ((await lsJson(bp, 'dla:history')) ?? []).length;
        let hooked = true;
        await waitForHook(bp, g.id).catch(() => { hooked = false; });
        ok(hooked, `${g.title} L${level}: the round engine mounts (window.__dla)`);
        if (!hooked) { await bp.close(); continue; }
        const total = await bp.evaluate(() => window.__dla.total());
        ok(total >= 4, `${g.title} L${level}: the round has items`, `${total}`);
        const r = await playRound(bp, { label: `${g.title} L${level}` });
        const after = ((await lsJson(bp, 'dla:history')) ?? []).length;
        const info = await resultsInfo(bp);
        ok(!!info, `${g.title} L${level}: the results screen shows after ${r.answered} answers (${r.rights} right, ${r.wrongs} wrong, ${(r.ms / 1000).toFixed(1)} s)`);
        ok(after === before + 1, `${g.title} L${level}: onRoundEnd fired exactly once (history +1)`, `${before} → ${after}`);
        if (info) {
          ok(info.cards === r.wrongs, `${g.title} L${level}: one why card per mistake`, `${info.cards} cards / ${r.wrongs} wrong`);
          ok(info.receipts === info.cards && info.whyText === info.cards, `${g.title} L${level}: every why card has a slide receipt and an explanation`, `${info.receipts}/${info.whyText}/${info.cards}`);
          ok(info.katexErr === 0, `${g.title} L${level}: no KaTeX errors on the results screen`);
        }
        // the unlock chain: level L+1 opens after ≥ 70 % at level L; the bot scored ~50 %, so force it for the next level via a clean all-right run when needed
        if (level < g.levels) {
          const bests = (await lsJson(bp, 'dla:profile'))?.bests?.[g.id] ?? {};
          const pct = bests[level] ? bests[level].score / bests[level].maxScore : 0;
          if (pct < 0.7) {
            const cp = await open({ tag: `bot-${g.id}-L${level}-clean`, route: `${ROUTE}/${g.id}?seed=${99 + level}&level=${level}&ms=45000` });
            await waitForHook(cp, g.id).catch(() => {});
            const cr = await playRound(cp, { wrongEvery: 0, label: `${g.title} L${level} clean` });
            ok(cr.wrongs === 0 && cr.answered > 0, `${g.title} L${level}: an all-right run grades every own answer right (${cr.answered} items)`);
            await cp.close();
          }
        }
        await bp.close();
      }
    }
    // the scheduler: two clean rounds lift concepts into box 2; a wrong answer drops one
    const sp = await open({ tag: 'boxes', route: `${ROUTE}/param-sniper?seed=7&level=1&ms=45000` });
    await waitForHook(sp, 'param-sniper');
    const boxes0 = (await lsJson(sp, 'dla:boxes')) ?? {};
    await playRound(sp, { wrongEvery: 0, label: 'boxes clean' });
    const boxes1 = (await lsJson(sp, 'dla:boxes')) ?? {};
    const touched = Object.keys(boxes1).filter((k) => (boxes1[k]?.seen ?? 0) > (boxes0[k]?.seen ?? 0));
    ok(touched.length > 0 && touched.every((k) => boxes1[k].box >= Math.min(5, (boxes0[k]?.box ?? 0) + 1)), 'a clean round promotes every concept it touched by one box', `${touched.length} concepts`);
    await sp.close();
  }

  // ── Daily Mix and Exam ────────────────────────────────────────────────────
  async function runSequence(rp, kind, maxRounds = 12) {
    let rounds = 0;
    for (let i = 0; i < maxRounds; i++) {
      const done = await rp.$('.dla-runsum');
      if (done) break;
      const gid = await rp.waitForFunction(() => window.__dla?.gameId ?? null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => null);
      if (!gid) break;
      const st = await rp.evaluate(() => window.__dla.state());
      if (st === 'intro') await rp.evaluate(() => window.__dla.start());
      await playRound(rp, { wrongEvery: 3, label: `${kind} round ${i + 1} (${gid})` });
      rounds += 1;
      await rp.waitForSelector('.dla-res__actions .dla-btn', { timeout: 15000 }).catch(() => {});
      await rp.evaluate(() => { const btns = [...document.querySelectorAll('.dla-res__actions .dla-btn')]; (btns.find((b) => /Next round|summary|Continue/i.test(b.textContent)) ?? btns[btns.length - 1])?.click(); });
      await sleep(500);
    }
    return rounds;
  }
  if (want('mix')) {
    const mp = await open({ tag: 'mix', route: `${ROUTE}/mix` });
    const plan = (await lsJson(mp, 'dla:mix'))?.plan ?? [];
    ok(plan.length === 4 && new Set(plan).size >= Math.min(4, ALL.length), 'the Daily Mix plans 4 rounds across different games', plan.join(', '));
    const rounds = await runSequence(mp, 'mix');
    const sum = await mp.evaluate(() => ({ has: !!document.querySelector('.dla-runsum'), rounds: document.querySelectorAll('.dla-runsum__rounds li').length, title: document.querySelector('.dla-runsum__title')?.textContent }));
    ok(rounds === 4 && sum.has && sum.rounds === 4, 'the Daily Mix runs end to end to its summary', `${rounds} rounds · ${sum.title}`);
    const mixState = await lsJson(mp, 'dla:mix');
    ok(mixState && mixState.done.length === 4, 'the finished mix is persisted (resumable / done for today)');
    await mp.close();
    const ep = await open({ tag: 'exam', route: ROUTE });
    const unlocked = await ep.evaluate(() => !document.querySelector('.dla-bigcab--exam')?.disabled);
    ok(unlocked, 'the Exam unlocks once three different games have been played');
    await ep.evaluate(() => document.querySelector('.dla-bigcab--exam')?.click());
    await ep.waitForSelector('.dla-run', { timeout: 10000 }).catch(() => {});
    const eplan = (await lsJson(ep, 'dla:exam'))?.plan ?? [];
    ok(eplan.length >= 6, `the Exam plans ${eplan.length} rounds`, eplan.join(', '));
    const er = await runSequence(ep, 'exam', 14);
    const esum = await ep.evaluate(() => ({ has: !!document.querySelector('.dla-runsum'), grade: document.querySelector('.dla-runsum__title')?.textContent, rows: document.querySelectorAll('.dla-grade__row').length }));
    ok(er === eplan.length && esum.has && /Grade: (HD|D|CR|P|N)/.test(esum.grade ?? '') && esum.rows >= 2, 'the Exam runs end to end with a grade per lecture', `${er} rounds · ${esum.grade} · ${esum.rows} lectures`);
    await ep.close();
  }

  // ── persistence ───────────────────────────────────────────────────────────
  if (want('persist')) {
    // make sure there is progress to persist (a clean round when this scenario runs alone)
    const warm = await open({ tag: 'persist-warm', route: `${ROUTE}/param-sniper?seed=3&level=1&ms=45000` });
    if (!((await lsJson(warm, 'dla:profile'))?.xp > 0)) {
      await waitForHook(warm, 'param-sniper').catch(() => {});
      await playRound(warm, { wrongEvery: 0, label: 'persist warm-up' });
    }
    await warm.close();
    const pp = await open({ tag: 'persist', route: ROUTE });
    const prof = await lsJson(pp, 'dla:profile');
    const shown = await pp.evaluate(() => document.querySelector('.dla-strip__xp')?.textContent ?? '');
    ok(prof && prof.xp > 0 && shown.replace(/\D/g, '') === String(prof.xp), 'xp persists across a reload and the strip shows it', `${shown}`);
    const streak = await pp.evaluate(() => document.querySelectorAll('.dla-strip__v')[1]?.textContent ?? '');
    ok(/^1/.test(streak), 'the streak counts today', streak);
    const bests = await pp.evaluate(() => [...document.querySelectorAll('.dla-cab__best')].map((b) => b.textContent));
    ok(bests.some((b) => /best \d+%/.test(b)), 'personal bests show on the cabinets', bests.join(' · '));
    await pp.close();
  }

  // ── broken storage ────────────────────────────────────────────────────────
  if (want('storage')) {
    const bp = await open({ tag: 'storage', brokenStorage: true });
    const cabs = await bp.$$eval('.dla-cab', (els) => els.length);
    ok(cabs === ALL.length, 'with localStorage throwing, the hub renders', `${cabs} cabinets`);
    await bp.goto(`${BASE}${ROUTE}/param-sniper?seed=5&level=1&ms=30000`, { waitUntil: 'networkidle0' });
    await bp.evaluateOnNewDocument(SEED);
    let hooked = true;
    await waitForHook(bp, 'param-sniper').catch(() => { hooked = false; });
    if (hooked) {
      const r = await playRound(bp, { label: 'storage round' });
      const info = await resultsInfo(bp);
      ok(!!info && r.answered > 0, 'with localStorage throwing, a round plays to its results screen', `${r.answered} answers`);
    } else ok(false, 'with localStorage throwing, a game mounts');
    await bp.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  if (want('reduced')) {
    const rp = await open({ tag: 'reduced', reduced: true });
    ok((await rp.$$eval('.dla-cab', (els) => els.length)) === ALL.length, 'reduced motion: the hub renders');
    const anim = await rp.evaluate(() => getComputedStyle(document.querySelector('.dla-marquee__lights')).animationName);
    ok(anim === 'none', 'reduced motion: the marquee lights do not animate', anim);
    await rp.goto(`${BASE}${ROUTE}/the-exchange?seed=3&level=1&ms=30000`, { waitUntil: 'networkidle0' });
    let hooked = true;
    await waitForHook(rp, 'the-exchange').catch(() => { hooked = false; });
    if (hooked) {
      const r = await playRound(rp, { label: 'reduced round' });
      ok(!!(await resultsInfo(rp)) && r.answered > 0, 'reduced motion: a game plays to its results', `${r.answered} answers`);
    } else ok(false, 'reduced motion: a game mounts');
    await rp.close();
  }

  // ── screenshots ───────────────────────────────────────────────────────────
  if (want('shots')) {
    for (const theme of ['jade', 'coral', 'arcade']) {
      for (const width of [1440, 390]) {
        const hp = await open({ theme, width, tag: `shot-hub-${theme}-${width}` });
        const el = await hp.$('.dla');
        await el.screenshot({ path: path.join(OUT, `hub-${theme}-${width}.png`) });
        const ov = await hp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(ov <= 1, `hub ${theme} @${width}: no horizontal page scroll`, `${ov}px`);
        await hp.close();
        for (const g of GAMES) {
          const gp = await open({ theme, width, tag: `shot-${g.id}-${theme}-${width}`, route: `${ROUTE}/${g.id}?seed=21&level=1&ms=60000` });
          let hooked = true;
          await waitForHook(gp, g.id).catch(() => { hooked = false; });
          if (hooked) { await gp.evaluate(() => window.__dla.start()); await sleep(900); }
          const gel = await gp.$('.dla');
          await gel.screenshot({ path: path.join(OUT, `${g.id}-${theme}-${width}.png`) });
          const gov = await gp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          ok(gov <= 1, `${g.title} ${theme} @${width}: no horizontal page scroll`, `${gov}px`);
          await gp.close();
        }
      }
    }
  }

  // ── other modules ─────────────────────────────────────────────────────────
  if (want('others')) {
    for (const [route, sel, min] of [
      ['/portal/dl-lecture-3-study', '.dl3s-sec', 18],
      ['/portal/dl-lecture-4-study', '.dl4s-sec', 18],
      ['/portal/dl-lecture-5-study', '.dl5s-sec', 11],
      ['/portal/dl-lecture-6-7-study', '.dl67s-sec', 13],
      ['/portal/dl-lecture-8-study', '.dl8s-sec', 17],
      ['/portal/dl-game', '.dlg-cover, .dlg, [class*="dlg"]', 1],
    ]) {
      try {
        const lp = await open({ tag: route.split('/').pop(), route, wait: sel });
        const n = await lp.$$eval(sel, (els) => els.length);
        ok(n >= min, `${route} still renders`, `${n}`);
        await lp.close();
      } catch (e) {
        ok(false, `${route} still renders`, String(e.message).slice(0, 80));
      }
    }
  }
  await page.close();
} finally {
  await browser.close();
}

const noise = consoleMsgs.filter((m) => !/Download the React DevTools/.test(m));
ok(noise.length === 0, 'zero console errors or warnings across every run', noise.slice(0, 8).join(' || '));
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
