/* ============================================================================
   ARCADE — headless check for /arcade/southern-lights
   ----------------------------------------------------------------------------
   Drives TWO real browsers through a complete night, because the whole point of
   this game is that two phones see different things. There is no test framework
   in this repo (see the vault) — verification is by driving real browsers, same
   approach as tools/dl-game-check.mjs.

   Covers the parts that would be embarrassing to ship broken: seat assignment,
   the asymmetric roles, the shared notebook, reconnect-to-same-seat, and every
   server-authority rule (you cannot touch the other seat's instrument, cannot
   exceed the shared evidence budget, cannot change a locked verdict, cannot see
   the truth early, and cannot skip the reveal unless you are the host).

     npx wrangler dev --port 8788 --local     # in one terminal
     node tools/arcade-check.mjs              # in another

   Set ARCADE_SHOTS=<dir> to write end-of-run screenshots somewhere.
   ========================================================================== */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8788';
const URL = `${BASE}/arcade/southern-lights/`;

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const state = (p) => p.evaluate(() => window.__sl?.state() ?? null);
const send = (p, m) => p.evaluate((mm) => window.__sl.room.send(mm), m);

async function waitPhase(p, phase, timeout = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state(p);
    if (s?.phase === phase) return s;
    await sleep(250);
  }
  throw new Error(`timeout waiting for phase "${phase}" (saw ${(await state(p))?.phase})`);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=430,900'],
});

const errors = [];
async function newPage(tag) {
  // Each player gets an ISOLATED browser context. Two friends are on two phones,
  // so they must not share localStorage — sharing it makes the second player
  // silently reconnect into the first player's seat via the saved session token,
  // which is correct behaviour for a refresh and wrong for a second person.
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${tag}] ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
  return p;
}

try {
  // ── A creates the room ────────────────────────────────────────────────────
  const A = await newPage('A');
  await A.goto(URL, { waitUntil: 'networkidle2' });
  await A.type('#ar-name', 'James');
  await A.click('#ar-create');
  await A.waitForFunction('!!window.__sl', { timeout: 15000 });
  await A.waitForFunction('window.__sl.state() !== null', { timeout: 15000 });

  const code = await A.evaluate(() => window.__sl.room.code());
  ok(/^[A-Z]{5}$/.test(code), 'room code is 5 letters', code);

  const urlHasCode = await A.evaluate(() => location.search);
  ok(urlHasCode.includes(code), 'code written into the URL for refresh/share', urlHasCode);

  let sA = await state(A);
  ok(sA.phase === 'lobby', 'A lands in lobby');
  ok(sA.solo === false || sA.solo === undefined, 'solo not yet decided in lobby');

  // ── B joins via the share link ────────────────────────────────────────────
  const B = await newPage('B');
  await B.goto(`${URL}?c=${code}`, { waitUntil: 'networkidle2' });
  await B.type('#ar-name', 'Mate');
  await B.click('#ar-join');
  await B.waitForFunction('!!window.__sl && window.__sl.state() !== null', { timeout: 15000 });

  await sleep(600);
  const playersA = await A.evaluate(() => window.__sl.players());
  ok(playersA.length === 2, 'A sees both players', JSON.stringify(playersA.map((p) => p.name)));
  ok(playersA.every((p) => p.online), 'both marked online');
  ok(playersA[0].host === true && playersA[1].host === false, 'seat 0 is host');

  const seatB = await B.evaluate(() => window.__sl.room.seat());
  ok(seatB === 1, 'B took seat 1', String(seatB));

  // ── Roles are asymmetric ──────────────────────────────────────────────────
  await send(A, { t: 'start' });
  await waitPhase(A, 'brief');
  sA = await state(A);
  const sB = await state(B);
  ok(JSON.stringify(sA.role) === '["optics"]', 'A has the binoculars', JSON.stringify(sA.role));
  ok(JSON.stringify(sB.role) === '["sensors"]', 'B has the instruments', JSON.stringify(sB.role));
  ok(sA.solo === false, 'two-player night, not solo');
  ok(sA.total === 8, 'eight sightings');
  ok(sA.sighting && sA.sighting.truth === null, 'truth is NOT sent before the reveal');
  ok(sA.sighting.reveal === null, 'reveal text is NOT sent early');

  // ── Observe: server authority ─────────────────────────────────────────────
  await waitPhase(A, 'observe');
  ok((await state(A)).budget === 4, 'shared evidence budget is 4');

  // B may not use the binoculars.
  await send(B, { t: 'sample', tool: 'optics' });
  await sleep(400);
  ok((await state(B)).spent === 0, 'sensors seat CANNOT take optical evidence');

  // A may not use the instruments.
  await send(A, { t: 'sample', tool: 'scanner' });
  await sleep(400);
  ok((await state(A)).spent === 0, 'optics seat CANNOT take instrument evidence');

  // Legit: A takes two optical readings, B takes one instrument reading.
  await send(A, { t: 'sample', tool: 'optics' });
  await sleep(300);
  await send(A, { t: 'sample', tool: 'optics' });
  await sleep(300);
  await send(B, { t: 'sample', tool: 'scanner' });
  await sleep(500);

  let sn = await state(A);
  ok(sn.spent === 3, 'three pieces of evidence banked', String(sn.spent));
  ok(sn.notebook.length === 3, 'notebook is SHARED across both phones');
  ok(
    (await state(B)).notebook.length === 3,
    'B sees the evidence A collected',
  );

  // Now try to blow past the budget — this is the whole game, so it must hold.
  for (let i = 0; i < 8; i++) await send(B, { t: 'sample', tool: 'magnet' });
  for (let i = 0; i < 8; i++) await send(A, { t: 'sample', tool: 'optics' });
  await sleep(800);
  sn = await state(A);
  ok(sn.spent === 4, 'budget of 4 HOLDS under spam', `spent=${sn.spent}`);
  ok(sn.notebook.length === 4, 'notebook capped at 4 entries');

  // ── Verdict ───────────────────────────────────────────────────────────────
  await waitPhase(A, 'verdict', 40000);
  await send(A, { t: 'pick', verdict: 'mundane' });
  await sleep(400);
  sn = await state(A);
  ok(sn.myPick === 'mundane', 'A pick registered');
  ok(sn.allPicks === null, "A cannot see B's pick before B commits");

  // A cannot change their mind.
  await send(A, { t: 'pick', verdict: 'anomaly' });
  await sleep(300);
  ok((await state(A)).myPick === 'mundane', 'a locked verdict is LOCKED');

  await send(B, { t: 'pick', verdict: 'military' });
  const rev = await waitPhase(A, 'reveal', 15000);
  ok(rev.sighting.truth !== null, 'truth revealed after both commit');
  ok(typeof rev.sighting.reveal === 'string' && rev.sighting.reveal.length > 40, 'reveal text arrives');
  ok(rev.lastResult.evidence === 4, 'scored 4 evidence');
  ok(rev.lastResult.points >= 48, 'evidence alone scores points', `+${rev.lastResult.points}`);
  ok(rev.allPicks !== null, 'both picks visible at reveal');

  // Non-host cannot advance the night.
  await send(B, { t: 'continue' });
  await sleep(500);
  ok((await state(A)).phase === 'reveal', 'non-host CANNOT skip the reveal');

  // ── Reconnect: B refreshes mid-game ───────────────────────────────────────
  await B.reload({ waitUntil: 'networkidle2' });
  await B.waitForFunction('!!window.__sl && window.__sl.state() !== null', { timeout: 20000 });
  await sleep(800);
  const seatB2 = await B.evaluate(() => window.__sl.room.seat());
  ok(seatB2 === 1, 'B RECONNECTS to the same seat after a refresh', `seat=${seatB2}`);
  const sB2 = await state(B);
  ok(sB2.score === rev.score, 'score survives the refresh', `${sB2.score}`);
  ok(JSON.stringify(sB2.role) === '["sensors"]', 'B keeps the instruments after reconnect');
  const playersAfter = await A.evaluate(() => window.__sl.players());
  ok(playersAfter.length === 2, 'no ghost player created by the refresh', `${playersAfter.length} players`);

  // ── Play out the rest of the night ────────────────────────────────────────
  await send(A, { t: 'continue' });

  const verdicts = ['military', 'mundane', 'anomaly'];
  for (let round = 1; round < 8; round++) {
    await waitPhase(A, 'observe', 40000);
    // take a couple of readings so the scoring path stays exercised
    await send(A, { t: 'sample', tool: 'optics' });
    await send(B, { t: 'sample', tool: 'exposure' });
    await waitPhase(A, 'verdict', 45000);
    const v = verdicts[round % 3];
    await send(A, { t: 'pick', verdict: v });
    await send(B, { t: 'pick', verdict: round === 7 ? v : verdicts[(round + 1) % 3] });
    if (round < 7) {
      await waitPhase(A, 'reveal', 20000);
      await send(A, { t: 'continue' });
    }
    console.log(`     … sighting ${round + 1}/8 done`);
  }

  await waitPhase(A, 'reveal', 20000);
  await send(A, { t: 'continue' });
  const end = await waitPhase(A, 'ending', 20000);

  ok(end.ending !== null, 'night reaches an ending');
  ok(
    ['saw-it-too', 'honest-answer', 'just-the-sky', 'different-nights'].includes(end.ending.key),
    'ending is one of the four',
    end.ending.key,
  );
  ok(end.ending.title?.length > 3, 'ending has a title', end.ending.title);
  ok(end.ending.body?.length > 80, 'ending has real prose');
  ok(end.log.length === 8, 'log has all eight sightings', String(end.log.length));
  ok(end.proof + end.wonder > 0, 'meters moved', `proof=${end.proof} wonder=${end.wonder}`);
  ok(end.score > 0, 'final score', String(end.score));

  // The ending overlay actually rendered.
  const endTitle = await A.evaluate(() => document.querySelector('#over-inner h2')?.textContent);
  ok(!!endTitle, 'ending overlay rendered in the DOM', endTitle);

  // ── Rematch ───────────────────────────────────────────────────────────────
  await send(A, { t: 'rematch' });
  await sleep(1200);
  const fresh = await state(A);
  ok(fresh.phase === 'brief' || fresh.phase === 'observe', 'rematch starts a new night', fresh.phase);
  ok(fresh.score === 0, 'rematch resets the score');
  ok(fresh.round === 0, 'rematch resets to sighting 1');

  const shots = process.env.ARCADE_SHOTS || os.tmpdir();
  await A.screenshot({ path: path.join(shots, 'sl-A.png') });
  await B.screenshot({ path: path.join(shots, 'sl-B.png') });
  console.log(`
screenshots -> ${shots}`);
} catch (err) {
  ok(false, 'RUN COMPLETED', err.message);
  console.error(err);
} finally {
  console.log('\n--- console errors ---');
  const noisy = errors.filter((e) => !/favicon|fonts\.googleapis|Failed to load resource.*404/i.test(e));
  console.log(noisy.length ? noisy.slice(0, 15).join('\n') : '(none)');
  console.log(`\n${fails.length ? 'FAILURES: ' + fails.join(' | ') : 'ALL CHECKS PASSED'}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
}
