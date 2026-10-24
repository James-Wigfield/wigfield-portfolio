/* ============================================================================
   DL LECTURE 9 STUDY — checks for the maths, the slide facts and the data
   ----------------------------------------------------------------------------
     node tools/dl-lecture9-study/check-rl.mjs

   Plain node (no browser). Exits 1 on any failure.
     gates       slide 49: Q-value iteration on Figure 18-8 (γ 0.90, 50
                 iterations, slide 48's loop) against the printed Q-values
                 and both argmaxes (0.90 → [0, 0, 1], 0.95 → [0, 2, 1]); the
                 one printed digit that differs (Q(s0, a1)) is reported as a
                 quirk; slide 26's −22 (and Figure 18-6's −40, −50); slide
                 28's 0.95¹³ ≈ 0.5 and 0.99⁶⁹ ≈ 0.5
     rl.js       the TD and Q-learning updates on hand-worked transitions;
                 ε-greedy's decay (slide 64); the DQN target with done /
                 truncated (slide 63); transition rows summing to 1
                 (Figure 18-7, Figure 18-8); value iteration = max of the
                 Q-values; normalised advantages (mean 0, std 1)
     cartpole    slide 17 → step(1) → slide 20; termination at ±12° / ±2.4;
                 reward 1.0
     networks    parameter counts 31 and 1,282 (and the exported weights'
                 shapes); the page's PG and DQN weights balance the pole on
                 this page's port; the in-browser REINFORCE learns
     data        slide 22 reproduced exactly by the page's offline run
     content     sections cover slides 1–69 once each, in order; every lab
                 key and code card exists; every footnote resolves; every
                 code listing and code-card snippet appears verbatim in the
                 transcript; diagram parts vs sheet highlights; the notes
                 budget; the print twins of the key formulas
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const L9 = path.join(ROOT, 'src/components/portal/modules/deep-learning/lecture9-study');
const imp = (rel) => import(`file:///${path.join(L9, rel).replace(/\\/g, '/')}`);

const RL = await imp('rl.js');
const CP = await imp('cartpole.js');
const { texText } = await imp('texText.js');
const { SECTIONS } = await imp('sections.js');
const { REFS, NAMED_CODE, CODE_SLIDE, PRINTED } = await imp('slideData.js');
const { CARDS } = await imp('cards.js');
const { cardLines } = await imp('cardLines.js');
const { SHEETS, sheetKeys } = await imp('sheets/index.js');
const { FIG_PARTS } = await imp('sheets/figParts.js');
const { BASIC_RUN } = await imp('data/basicRun.js');
const { PG_RUN } = await imp('data/pgRun.js');
const { DQN_RUN } = await imp('data/dqnRun.js');
const PGT = await imp('labs/pgTrain.js');
const TRANSCRIPT = fs.readFileSync(path.join(ROOT, 'Documents/cits5017/markdown-lecs/lecture-9.md'), 'utf8').replace(/\r\n/g, '\n');

let fails = 0;
let passes = 0;
const ok = (cond, label, detail = '') => {
  if (cond) passes += 1;
  else { fails += 1; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const note = [];

/* ── gates ────────────────────────────────────────────────────────────── */
console.log('gates');
{
  const { Q } = RL.qValueIteration({ gamma: 0.9, iterations: 50 });
  const printed = PRINTED.qValues.value;
  const r8 = (v) => (Number.isFinite(v) ? Number(v.toFixed(8)) : v);
  const diffs = [];
  Q.forEach((row, s) => row.forEach((v, a) => {
    if (r8(v) !== printed[s][a]) diffs.push({ s, a, mine: v, printed: printed[s][a] });
  }));
  ok(diffs.length === 1 && diffs[0].s === 0 && diffs[0].a === 1 && near(diffs[0].mine, 17.02702703, 1e-8), 'slide 49: every Q-value matches to 8 decimals except Q(s0, a1), which is within 1e-8', JSON.stringify(diffs));
  if (diffs.length === 1) note.push(`slide 49 quirk: slide 48's loop gives Q(s0, a1) = ${diffs[0].mine.toFixed(10)} (prints 17.02702702), slide prints 17.02702703`);
  const conv = RL.qValueIteration({ gamma: 0.9, iterations: 2000 }).Q;
  ok(near(conv[0][1], 630 / 37, 1e-9) && conv[0][1].toFixed(8) === '17.02702703', 'converged Q(s0, a1) = 630/37 rounds to the slide’s 17.02702703');
  ok(JSON.stringify(RL.argmaxRows(Q)) === '[0,0,1]', 'slide 49: argmax at γ = 0.90 is [0, 0, 1]');
  ok(JSON.stringify(RL.argmaxRows(RL.qValueIteration({ gamma: 0.95, iterations: 50 }).Q)) === '[0,2,1]', 'slide 49: argmax at γ = 0.95 is [0, 2, 1]');
  const g = RL.flipGamma();
  ok(g > 0.947 && g < 0.948, 's1 flips to a2 between γ 0.947 and 0.948 (the lab’s challenge)', String(g));
  ok(JSON.stringify(RL.discountRewards([10, 0, -50], 0.8).map((v) => Math.round(v * 1e9) / 1e9)) === '[-22,-40,-50]', 'slides 26–27: γ = 0.8 on 10, 0, −50 gives −22, −40, −50');
  ok(near(10 + 0.8 * 0 + 0.8 ** 2 * -50, -22, 1e-12), 'slide 26’s sum 10 + γ·0 + γ²·(−50) = −22');
  ok(Math.abs(0.95 ** 13 - 0.5) < 0.02 && Math.abs(0.99 ** 69 - 0.5) < 0.01, 'slide 28: 0.95¹³ ≈ 0.5 and 0.99⁶⁹ ≈ 0.5', `${0.95 ** 13} / ${0.99 ** 69}`);
  ok(0.95 ** 12 > 0.5 && 0.95 ** 14 < 0.5 && 0.99 ** 68 > 0.5 && 0.99 ** 70 < 0.5, 'and 13 / 69 are where the weight crosses one half');
}

/* ── rl.js ────────────────────────────────────────────────────────────── */
console.log('rl.js');
{
  // TD: V = 10, r = 10, V(s′) = 20, α = 0.1, γ = 0.9 → target 28, δ 18, new 11.8
  const td = RL.tdUpdate(10, 10, 20, 0.1, 0.9);
  ok(near(td.target, 28) && near(td.error, 18) && near(td.next, 11.8) && near(td.blend, td.next, 1e-12), 'TD: (1−α)V + α(r + γV′) = V + αδ on a hand-worked transition');
  // Q-learning: Q = 5, r = 10, next row [1, 4, −∞], α = 0.5, γ = 0.9 → target 13.6, new 9.3
  const ql = RL.qLearningUpdate(5, 10, [1, 4, -Infinity], 0.5, 0.9);
  ok(near(ql.target, 13.6) && near(ql.next, 9.3), 'Q-learning: max over the next row ignores −∞; (1−α)Q + α(r + γ max) on a hand-worked transition');
  ok(RL.epsilonAt(0) === 1 && near(RL.epsilonAt(250), 0.5) && near(RL.epsilonAt(494), 0.012) && near(RL.epsilonAt(495), 0.01) && RL.epsilonAt(599) === 0.01, 'slide 64: ε = max(1 − episode/500, 0.01): 1 → 0.5 at 250 → 0.01 from 495');
  const R = RL.rng(3);
  let explored = 0;
  for (let k = 0; k < 4000; k++) if (RL.epsilonGreedy([1, 5, 2], 0.3, R).explored) explored += 1;
  ok(Math.abs(explored / 4000 - 0.3) < 0.03, 'ε-greedy explores with probability ε', String(explored / 4000));
  ok(RL.epsilonGreedy([1, 5, 2], 0, R).action === 1, 'ε = 0 takes the argmax');
  const t = RL.dqnTargets({ rewards: [1, 1, 1], dones: [false, true, false], truncateds: [false, false, true], nextQ: [[2, 3], [5, 1], [4, 4]], discountFactor: 0.95 });
  ok(JSON.stringify(t.maxNext) === '[3,5,4]' && JSON.stringify(t.runs) === '[1,0,0]' && near(t.targets[0], 3.85) && t.targets[1] === 1 && t.targets[2] === 1, 'slide 63: runs = 1 − (dones | truncateds) drops the future term; target = r + runs·γ·max');
  ok(RL.CHAIN_187.every((r) => near(r.reduce((a, b) => a + b, 0), 1, 1e-12)), 'Figure 18-7: every row of the transition matrix sums to 1');
  ok(JSON.stringify(RL.CHAIN_187) === '[[0.7,0.2,0,0.1],[0,0,0.9,0.1],[0,1,0,0],[0,0,0,1]]', 'slide 40’s matrix, row by row');
  ok(RL.CHAIN_187[1][2] === 0.9, 'slide 40: (row 2, column 3) counted from 1 = s1 → s2 = 0.9');
  ok(RL.T_188.every((row, s) => row.every((p, a) => (p === null ? !RL.ACTIONS_188[s].includes(a) : near(p.reduce((x, y) => x + y, 0), 1, 1e-12)))), 'Figure 18-8: each possible (s, a) row sums to 1; None ↔ impossible');
  const v = RL.valueIteration({ gamma: 0.9, iterations: 400 }).V;
  const q = RL.qValueIteration({ gamma: 0.9, iterations: 400 }).Q;
  ok(v.every((x, s) => near(x, Math.max(...q[s]), 1e-9)), 'value iteration converges to max_a Q*(s, a)');
  const adv = RL.discountAndNormalizeRewards([[10, 0, -50], [10, 20]], 0.8);
  const np = [[-0.2843507, -0.8659772, -1.189103], [1.2666532, 1.0727777]];
  ok(adv.every((r, i) => r.every((v, j) => near(v, np[i][j], 1e-6))), 'discount_and_normalize_rewards matches NumPy (population std) on [[10, 0, −50], [10, 20]], γ 0.8');
  const runs = Array.from({ length: 10 }, (_, k) => RL.qLearningRun({ seed: k + 1 }));
  const worst = Math.max(...runs.map((r) => Math.abs(r.Q[0][0] - 700 / 37) / (700 / 37)));
  ok(worst < 0.11 && runs.every((r) => JSON.stringify(RL.argmaxRows(r.Q)) === '[0,0,1]'), 'the page’s Q-learning runs (seeds 1–10) land within about 10% of Q*(s0, a0), each with the right policy', `worst ${(worst * 100).toFixed(1)}%`);
  // Keras 3's Nadam on a scalar (reference: momentum decay 0.96^t)
  const L1 = [{ act: 'linear', W: [[0]], b: [0] }];
  const st = {};
  [0.3, -0.1, 0.5, 0.2, 0.2, -0.4, 0.1, 0.9, 0.3, 0.3].forEach((g) => RL.nadam(L1, [{ W: [[g]], b: [0] }], st, 0.01));
  ok(near(L1[0].W[0][0], -0.04617416, 1e-8), 'nadam follows Keras 3 (10 scalar steps → −0.04617416)', L1[0].W[0][0].toFixed(8));
}

/* ── cartpole.js ──────────────────────────────────────────────────────── */
console.log('cartpole.js');
{
  const r = CP.step(CP.SLIDE17_OBS, 1);
  ok(r.obs.every((x, i) => near(x, CP.SLIDE20_OBS[i], 1e-8)) && r.reward === 1 && r.terminated === false, 'slide 17’s obs, then step(1), gives slide 20’s obs (to 1e-8), reward 1.0, done False');
  ok(CP.isDone([2.41, 0, 0, 0]) && CP.isDone([-2.41, 0, 0, 0]) && !CP.isDone([2.39, 0, 0, 0]), 'done when the cart leaves ±2.4');
  ok(CP.isDone([0, 0, 0.21, 0]) && CP.isDone([0, 0, -0.21, 0]) && !CP.isDone([0, 0, 0.2, 0]), 'done when the pole tilts past ±12° (0.2094 rad)');
  ok(near(CP.THETA_LIMIT, (12 * Math.PI) / 180, 1e-12), '12° in radians');
  ok(CP.basicPolicy([0, 0, -0.01, 0]) === 0 && CP.basicPolicy([0, 0, 0.01, 0]) === 1, 'slide 21: basic_policy pushes the way the pole leans');
}

/* ── networks ─────────────────────────────────────────────────────────── */
console.log('networks');
{
  ok(RL.paramCountOf([4, 5, 1]) === 31 && RL.paramCountOf([4, 32, 32, 2]) === 1282, 'parameter counts: 4→5→1 = 31, 4→32→32→2 = 1,282');
  ok(PG_RUN.paramCount === 31 && DQN_RUN.paramCount === 1282, 'the offline runs report the same counts');
  const pg = RL.fromWeights(PG_RUN.weights, ['relu', 'sigmoid']);
  ok(RL.paramCount(pg) === 31 && pg[0].W.length === 4 && pg[0].W[0].length === 5, 'PG weights load as 4 × 5, 5 × 1');
  const dq = RL.fromWeights(DQN_RUN.bestWeights, ['elu', 'elu', 'linear']);
  ok(RL.paramCount(dq) === 1282 && dq[2].W[0].length === 2, 'DQN weights load as 4 × 32, 32 × 32, 32 × 2');
  const R = RL.rng(77);
  const pgLen = Array.from({ length: 10 }, () => PGT.playPolicy(pg, CP.reset(R), R, 200, true).states.length - 1);
  ok(RL.mean(pgLen) >= 150, 'the page’s offline PG weights balance this page’s CartPole port (greedy, mean ≥ 150 of 200)', RL.mean(pgLen).toFixed(1));
  const dqLen = Array.from({ length: 10 }, () => {
    let obs = CP.reset(R);
    let n = 0;
    for (; n < 200; n++) {
      const qv = RL.forward(dq, obs).out;
      const s = CP.step(obs, qv[1] > qv[0] ? 1 : 0);
      obs = s.obs;
      if (s.terminated) { n += 1; break; }
    }
    return n;
  });
  ok(RL.mean(dqLen) >= 80, 'the page’s DQN best weights balance this page’s port (greedy, mean ≥ 80)', RL.mean(dqLen).toFixed(1));
  const T = PGT.newTrainer(42);
  for (let i = 0; i < PGT.PG.iterations; i++) PGT.trainIteration(T);
  ok(T.curve[T.curve.length - 1] > 150 && T.curve[0] < 60, 'in-browser REINFORCE learns (iteration 1 < 60, iteration 150 > 150)', `${T.curve[0].toFixed(1)} → ${T.curve[T.curve.length - 1].toFixed(1)}`);
}

/* ── data ─────────────────────────────────────────────────────────────── */
console.log('data');
{
  ok(JSON.stringify(BASIC_RUN.stats) === JSON.stringify(PRINTED.basicStats.value) && BASIC_RUN.match === true, 'slide 22 reproduced exactly: (41.698, 8.389445512070509, 24.0, 63.0)', JSON.stringify(BASIC_RUN.stats));
  ok(BASIC_RUN.totals.length === 500 && near(RL.mean(BASIC_RUN.totals), 41.698, 1e-9) && Math.max(...BASIC_RUN.totals) === 63, 'its 500 totals give the same mean and max');
  ok(PG_RUN.curve.length === 150 && DQN_RUN.curve.length === DQN_RUN.episodes, 'PG curve has 150 iterations; DQN curve one value per completed episode', `${DQN_RUN.episodes}`);
  const bytes = ['basicRun.js', 'pgRun.js', 'dqnRun.js'].reduce((a, f) => a + fs.statSync(path.join(L9, 'data', f)).size, 0);
  ok(bytes < 300 * 1024, 'lazy data under 300 KB', `${(bytes / 1024).toFixed(1)} KB`);
}

/* ── content ──────────────────────────────────────────────────────────── */
console.log('content');
{
  const seen = [];
  SECTIONS.forEach((s) => String(s.slides).split(',').forEach((part) => {
    const [a, b] = part.trim().split(/[–-]/).map(Number);
    for (let n = a; n <= (b || a); n++) seen.push(n);
  }));
  ok(JSON.stringify(seen) === JSON.stringify(Array.from({ length: 69 }, (_, i) => i + 1)), 'sections cover slides 1–69 once each, in order', `${seen.length}`);
  const labKeys = [...fs.readFileSync(path.join(L9, 'labs/index.js'), 'utf8').matchAll(/^\s+(\w+): \w+Lab,/gm)].map((m) => m[1]);
  const missingLabs = SECTIONS.flatMap((s) => (s.play ?? []).filter((k) => !labKeys.includes(k)));
  ok(missingLabs.length === 0, 'every section’s lab key is registered', missingLabs.join(', '));
  const missingCards = SECTIONS.flatMap((s) => (s.cards ?? []).filter((k) => !CARDS[k]));
  ok(missingCards.length === 0 && SECTIONS.reduce((a, s) => a + (s.cards?.length ?? 0), 0) === Object.keys(CARDS).length, 'every code card exists and is placed exactly once', missingCards.join(', '));
  const fn = new Set();
  const scan = (x) => JSON.stringify(x).replace(/\[\^(\d+)\]/g, (_, n) => fn.add(Number(n)));
  SECTIONS.forEach((s) => scan(s.read));
  ok([...fn].every((n) => REFS[n]) && fn.has(1), 'every footnote marker resolves (Williams, 1992)');
  // every listing appears verbatim in the transcript (the "{" artefact is written "–" here)
  const bad = Object.entries(NAMED_CODE).filter(([, code]) => !TRANSCRIPT.includes(code.replace(/# extra code – /g, '# extra code { ')) && !code.split('\n').every((ln) => TRANSCRIPT.includes(ln.replace(/# extra code – /g, '# extra code { '))));
  ok(bad.length === 0, `every NAMED_CODE listing (${Object.keys(NAMED_CODE).length}) appears verbatim in the transcript`, bad.map(([k]) => k).join(', '));
  const sectionOf = (slide) => SECTIONS.find((s) => s.slides.split(/[–-]/).map(Number).reduce((lo, hi, i, arr) => (arr.length === 1 ? slide === lo : slide >= arr[0] && slide <= arr[1])));
  const cardBad = [];
  Object.entries(CARDS).forEach(([id, c]) => c.snippets.forEach((sn) => {
    const all = NAMED_CODE[sn.src]?.split('\n') ?? [];
    const lines = cardLines(sn);
    if (!all.length || sn.lines[0] < 1 || sn.lines[1] > all.length || !lines.trim() || !NAMED_CODE[sn.src].includes(lines)) cardBad.push(`${id}:${sn.src}`);
    const sec = sectionOf(CODE_SLIDE[sn.src]);
    if (!sec?.cards?.includes(id)) cardBad.push(`${id} not in the section of slide ${CODE_SLIDE[sn.src]}`);
  }));
  ok(cardBad.length === 0, 'every code card quotes its slide’s listing verbatim and sits in that slide’s section', cardBad.join(', '));
  ok(Object.values(CARDS).every((c) => c.answer.length >= 3 && c.answer.length <= 5 && c.prompt.length < 220), 'code cards: one prompt, 3–5 answer sentences');
  // diagram parts vs sheet highlights
  const dsrc = fs.readFileSync(path.join(L9, 'diagrams.jsx'), 'utf8');
  const partBad = [];
  Object.entries(FIG_PARTS).forEach(([fig, parts]) => parts.forEach((p) => { if (!dsrc.includes(`<P k="${p}">`)) partBad.push(`${fig}.${p}`); }));
  Object.values(SHEETS).forEach((sh) => sh.blocks.forEach((b) => (b.fig?.hl ?? []).forEach((h) => { if (!FIG_PARTS[b.fig.key]?.includes(h)) partBad.push(`${b.fig.key}:${h}`); })));
  ok(partBad.length === 0, 'diagram parts and sheet highlights agree', partBad.join(', '));
  // notes budget: text lines (not diagrams or table rows) under 100, at most 10 a page
  let lines = 0;
  const big = [];
  Object.entries(SHEETS).forEach(([id, sh]) => {
    const rows = new Set();
    sh.blocks.forEach((b) => b.items.forEach((it, i) => { if (it.table) it.table.rows.forEach((_, r) => rows.add(`${b.id}:${i}.${r}`)); }));
    const n = sheetKeys(sh).filter((k) => !k.endsWith(':fig') && !rows.has(k)).length;
    lines += n;
    if (n > 10) big.push(`${id}:${n}`);
  });
  ok(lines < 100 && big.length === 0, 'notes budget: under 100 text lines, at most 10 a page', `${lines} lines`);
  ok(!SHEETS.s00 && !SHEETS.s18, 'no notebook page for the intro and the summary');
  // print twins
  const twins = [
    ["V^*(s) = \\max_a \\sum_{s'} T(s, a, s') \\left[ R(s, a, s') + \\gamma V^*(s') \\right]", 'V*(s) = max_a Σ_s′ T(s, a, s′) [R(s, a, s′) + γ V*(s′)]'],
    ["Q_{k+1}(s,a) \\leftarrow (1-\\alpha) Q_k(s,a) + \\alpha \\left( r + \\gamma \\max_{a'} Q_k(s', a') \\right)", 'Qₖ₊₁(s,a) ← (1−α) Qₖ(s,a) + α (r + γ max_a′ Qₖ(s′, a′))'],
    ["y(s,a) = r + \\gamma \\max_{a'} Q_{\\boldsymbol{\\theta}}(s',a')", 'y(s,a) = r + γ max_a′ Q_θ(s′,a′)'],
    ['\\pi^*(s) = \\operatorname*{argmax}_{a} Q^*(s,a)', 'π*(s) = argmax_a Q*(s,a)'],
    ["\\delta_k(s, r, s') = r + \\gamma V_k(s') - V_k(s)", 'δₖ(s, r, s′) = r + γ Vₖ(s′) − Vₖ(s)'],
    ['\\tau = 0.02', 'τ = 0.02'],
    ['\\frac{2\\epsilon}{3} = 0.1', '2ε/3 = 0.1'],
    ['\\epsilon', 'ε'],
  ];
  twins.forEach(([tex, want]) => ok(texText(tex) === want, `texText: ${want}`, texText(tex)));

  // Rich's tokeniser: no markup asterisk survives as plain text anywhere
  const { TOKEN, firstSentence } = await imp('richToken.js');
  const plainOf = (text) => {
    const out = [];
    let rest = text;
    while (rest) {
      const m = TOKEN.exec(rest);
      if (!m) { out.push(rest); break; }
      out.push(rest.slice(0, m.index));
      if (m[3]) out.push(...plainOf(m[0].slice(3, -3)));
      else if (m[4]) out.push(...plainOf(m[0].slice(2, -2)));
      else if (m[7]) out.push(...plainOf(m[0].slice(1, -1)));
      rest = rest.slice(m.index + m[0].length);
    }
    return out;
  };
  const strings = [];
  const collect = (x) => {
    if (typeof x === 'string') strings.push(x);
    else if (Array.isArray(x)) x.forEach(collect);
    else if (x && typeof x === 'object') Object.entries(x).forEach(([k, v]) => { if (!['tex', 'formula', 'code', 'src'].includes(k)) collect(v); });
  };
  collect(SECTIONS.map((s) => s.read));
  collect(Object.values(CARDS).map((c) => [c.prompt, c.answer]));
  collect(Object.values(SHEETS));
  const stray = strings.filter((t) => plainOf(t).some((p) => p.includes('*')));
  ok(stray.length === 0, `no stray markup asterisks in ${strings.length} strings (***bold italic*** parses as one token)`, stray.slice(0, 2).map((t) => t.slice(0, 60)).join(' | '));
  const bi = TOKEN.exec('a ***agent*** makes');
  ok(bi && bi[3] === '***agent***', '***term*** is a single bold-italic token');
  ok(firstSentence('One. Two is long enough to fold away here, really quite long, more than the minimum of characters, honestly yes. Three.', 40) === 'One.', 'a Slide check folds to its first sentence');
  ok(firstSentence('Uses `a.b` and $x. Y$ first. Rest of it is long enough to fold away, well over the minimum length set here for this test.', 40) === 'Uses `a.b` and $x. Y$ first.', 'the fold never cuts inside code or TeX');
}

note.forEach((n) => console.log(`  note: ${n}`));
console.log(`\n${fails ? `${fails} FAILED` : 'ALL PASS'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
