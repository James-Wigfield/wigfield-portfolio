/* ============================================================================
   DREAM ROOMS · check-contracts: the two contracts accept their samples and
   reject a set of broken mutations; the corridor world builds and checks.
     node tools/dream-rooms/check-contracts.mjs
   Prints ids and paths only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDream, checkWorld, checkCorridorWorld, validateSchema, strangenessIds } from '../../src/dream-rooms/contracts/validate.js';
import { fillSpans } from '../../src/dream-rooms/contracts/spans.js';
import { buildCorridorWorld, NEWEST_NEAREST } from '../../src/dream-rooms/contracts/corridorWorld.js';
import { doorwayFrame, linkTransform, rotY, sub, dot } from '../../src/dream-rooms/contracts/layout.js';
import { renumberNight, dreamtOnFor, ownText, firstWords } from '../../src/dream-rooms/contracts/rows.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FIX = path.join(REPO, 'src/dream-rooms/contracts/fixtures');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const TEXT = fs.readFileSync(path.join(HERE, 'samples/sample-dream.txt'), 'utf8');
const DREAM = read(path.join(FIX, 'sample.dream.json'));
const WORLD = read(path.join(FIX, 'sample.world.json'));
const NIGHTS = read(path.join(HERE, 'samples/fixtures-nights.json')).dreams;

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`);
  if (!cond) fails.push(label);
};

// ── dream.json ──────────────────────────────────────────────────────────────
{
  const r = checkDream(DREAM, TEXT);
  ok(r.ok, 'sample dream.json passes (no spans yet)', r.errors.slice(0, 3).join(' | '));
  const { dream: spanned, missing } = fillSpans(DREAM, TEXT);
  ok(missing.length === 0, 'fillSpans finds every quote', missing.join(', '));
  const r2 = checkDream(spanned, TEXT);
  ok(r2.ok, 'sample dream.json passes with spans', r2.errors.slice(0, 3).join(' | '));
  ok(strangenessIds(DREAM).sort().join() === ['c1', 'l1', 'l2', 'p1', 'time', 'v1', 'v2'].sort().join(), 'strangeness ids of the sample', strangenessIds(DREAM).join(','));

  const mutations = [
    ['no title', (d) => delete d.title],
    ['quote not in text', (d) => { d.places[0].quote[0] = 'words that were never said'; }],
    ['bad archetype', (d) => { d.places[0].archetype = 'castle'; }],
    ['motif not lower-hyphen', (d) => { d.motifs.push('Missed Flight'); }],
    ['link to a missing place', (d) => { d.links[0].to = 'p9'; }],
    ['change of a missing target', (d) => { d.changes[0].target = 'o9'; }],
    ['duplicate id', (d) => { d.vague[1].id = 'v1'; }],
    ['extra property', (d) => { d.places[0].colour = 'green'; }],
    ['bad presence', (d) => { d.figures[0].presence = 'nearby'; }],
    ['fragment not his words', (d) => { d.fragments[0].text = 'a fragment he never wrote'; }],
    ['wrong src', (d) => { d.places[0].src = [[0, 5], [0, 5], [0, 5]]; }],
    ['certainty above 1', (d) => { d.places[0].certainty = 1.4; }],
  ];
  for (const [label, mut] of mutations) {
    const d = clone(DREAM);
    mut(d);
    ok(!checkDream(d, TEXT).ok, `dream.json rejects: ${label}`);
  }
}

// ── world.json ──────────────────────────────────────────────────────────────
{
  const r = checkWorld(WORLD, { dream: DREAM, text: TEXT });
  ok(r.ok, 'sample world.json passes', r.errors.slice(0, 4).join(' | '));
  ok(r.warnings.length === 0, 'sample world.json has no warnings', r.warnings.join(' | '));
  for (const id of strangenessIds(DREAM)) ok(Boolean(r.coverage[id]), `strangeness ${id} is covered`);

  const W = (fn) => {
    const w = clone(WORLD);
    fn(w);
    return w;
  };
  const mutations = [
    ['invented without why', (w) => { delete w.doorways[0].why; }],
    ['uncited prop', (w) => { delete w.modules[0].props[0].for; }],
    ['invented prop', (w) => { w.modules[0].props[0] = { ...w.modules[0].props[0], for: undefined, invented: true, why: 'filler' }; delete w.modules[0].props[0].for; }],
    ['a strangeness id left uncovered (l1)', (w) => { for (const o of [w.links[1], w.doorways[2]]) { delete o.for; o.invented = true; o.why = 'a door'; } }],
    ['dropped without a reason', (w) => { w.dropped = [{ id: 'v1' }]; }],
    ['doorway outside its wall', (w) => { w.doorways[0].at = 15.9; }],
    ['modules too close', (w) => { w.modules[1].origin = [30, 0, 0]; }],
    ['route not linked', (w) => { w.route = ['hall', 'pool', 'corridor']; }],
    ['dissolve to a missing module', (w) => { w.links[2].to = 'attic'; }],
    ['words not his words', (w) => { w.words[0].text = 'gate 14 now boarding'; }],
    ['wake line not his words', (w) => { w.wake.line = 'and then I woke up'; }],
    ['drop ceiling uncited', (w) => { w.modules[0].ceiling = { is: 'drop-tiles', invented: true, why: 'a ceiling' }; }],
    ['invented finish not plain', (w) => { w.modules[0].finishes.walls = { is: 'wallpaper', invented: true, why: 'walls' }; }],
    ['invented light with a source', (w) => { w.modules[2].lights = { is: 'panels', invented: true, why: 'light' }; }],
    ['enter link in a dream world', (w) => { w.links.push({ kind: 'enter', door: 'd1', dream: '0f6a6b2e-6c1a-4d1e-9a51-1b0e9c2d0a01' }); }],
    ['over the atlas budget', (w) => { w.modules[0].size = [60, 6, 60]; }],
    ['repeat corridor doorway on n', (w) => { w.doorways[1].wall = 'n'; w.doorways[1].at = 1.1; }],
    ['stub leaves the repeating segment', (w) => { w.doorways[1].at = 7; }],
    ['doorway in two links', (w) => { w.links.push({ kind: 'teleport', a: 'd1', b: 'd3', invented: true, why: 'again' }); }],
    ['for cites a missing id', (w) => { w.modules[0].for = ['p9']; }],
    ['spawn outside its module', (w) => { w.spawn.at = [30, 0, 8]; }],
    ['swap of a missing prop', (w) => { w.swaps[0].target = 'pool/benches'; }],
    ['words on a prop that cannot carry them', (w) => { w.words[0].on = 'hall/lockers'; }],
    ['unknown kit', (w) => { w.modules[0].kit = 'castle'; }],
    ['fit check: most entities dropped, no fallback', (w) => { w.dropped = ['p1', 'p2', 'p3', 'l1', 'l2', 'f1', 'o1'].map((id) => ({ id, reason: 'test' })); }],
  ];
  for (const [label, mut] of mutations) ok(!checkWorld(W(mut), { dream: DREAM, text: TEXT }).ok, `world.json rejects: ${label}`);

  // the still fallback is accepted without a route
  const still = W((w) => {
    w.fallback = 'still';
    w.dropped = ['p1', 'p2', 'p3', 'l1', 'l2', 'f1', 'o1'].map((id) => ({ id, reason: 'test' }));
    delete w.route;
    delete w.spawn;
  });
  const rs = checkWorld(still, { dream: DREAM, text: TEXT });
  ok(rs.ok, 'a still-fallback world passes', rs.errors.slice(0, 3).join(' | '));
}

// ── the validator itself ────────────────────────────────────────────────────
{
  let threw = false;
  try {
    validateSchema({ type: 'object', patternProperties: {} }, {});
  } catch {
    threw = true;
  }
  ok(threw, 'the schema interpreter throws on an unknown keyword');
}

// ── geometry: the teleport map ──────────────────────────────────────────────
{
  const fa = doorwayFrame(WORLD, WORLD.doorways[0]);
  const fb = doorwayFrame(WORLD, WORLD.doorways[1]);
  const t = linkTransform(fa, fb);
  const back = linkTransform(fb, fa);
  const near = (a, b) => Math.hypot(...sub(a, b)) < 1e-9;
  ok(near(t.pos(fa.m), fb.m), 'teleport maps m_a to m_b');
  ok(near(rotY(fa.side, t.delta), fb.side.map((x) => -x)), 'teleport maps side_a to −side_b');
  ok(near(rotY(fa.out, t.delta), fb.out.map((x) => -x)), 'teleport maps out_a to −out_b');
  const p = [fa.m[0] + 0.2, 1.5, fa.m[2] - 0.1];
  ok(near(back.pos(t.pos(p)), p), 'teleport there and back is the identity');
  ok(dot(sub(fa.b1, fa.centre), fa.inward) < 0, 'stubs sit outside their module');
}

// ── rows ────────────────────────────────────────────────────────────────────
{
  ok(dreamtOnFor(new Date(2026, 10, 25, 6, 10)) === '2026-11-24', 'before 2 pm: last night');
  ok(dreamtOnFor(new Date(2026, 10, 25, 15, 0)) === '2026-11-25', 'after 2 pm: tonight');
  const night = [{ id: 'a', night_order: 1 }, { id: 'b', night_order: 2 }, { id: 'c', night_order: 3 }];
  const ch = renumberNight(night, { id: 'c', to: 1 });
  ok(JSON.stringify(ch) === JSON.stringify([{ id: 'c', night_order: 1 }, { id: 'a', night_order: 2 }, { id: 'b', night_order: 3 }]), 'renumber: moving 3 to 1');
  ok(renumberNight([{ id: 'a', night_order: 2 }, { id: 'b', night_order: 5 }]).length === 2, 'renumber closes gaps');
  ok(ownText({ raw_text: 'abcdef', own: [0, 3], extra_text: 'xy' }) === 'abc\n\nxy', 'ownText = own slice + extra');
  ok(firstWords('one two three four five six seven') === 'one two three four five six…', 'first words');
}

// ── the corridor world ──────────────────────────────────────────────────────
{
  const rows = NIGHTS.map((d) => ({ ...d, first_words: firstWords(d.raw_text) }));
  const w = buildCorridorWorld(rows, { now: new Date(2026, 10, 25) });
  const r = checkCorridorWorld(w);
  ok(r.ok, 'the corridor world of the fixtures checks', r.errors.slice(0, 3).join(' | '));
  ok(w.doors.length === 9 && w.breaks.length === 5, 'nine doors, five night breaks', `${w.doors.length} / ${w.breaks.length}`);
  ok(NEWEST_NEAREST ? w.doors[0].dreamt_on === '2026-11-24' : w.doors[0].dreamt_on === '2026-09-30', 'the direction constant decides which night is nearest');
  ok(w.links.length === 4 && w.links.every((l) => w.doors.find((d) => d.id === l.door)?.state === 'ajar'), 'only rendered doors open');
  const gapFar = w.pieces.filter((p, i) => p.piece === 'plain' && i > 0).length;
  ok(gapFar >= 3, 'far-apart nights get a longer gap', `${gapFar} plain pieces`);
  const at = buildCorridorWorld(rows, { at: NIGHTS[2].id });
  ok(at.spawn.facing === 'e' || at.spawn.facing === 'w', '?at puts the walker at a door, facing it');
  const empty = buildCorridorWorld([]);
  const re = checkCorridorWorld(empty);
  ok(re.ok && empty.doors.length === 1 && empty.doors[0].sign[0] === 'nothing dreamt yet', 'zero dreams: a short corridor ending in one shut door', re.errors.join(' | '));
  const broken = clone(w);
  [broken.doors[1].z, broken.doors[2].z] = [broken.doors[2].z, broken.doors[1].z];
  ok(!checkCorridorWorld(broken).ok, 'the corridor check rejects doors out of order');
  const broken2 = clone(w);
  broken2.doors[0].state = 'shut-dark';
  ok(!checkCorridorWorld(broken2).ok, 'the corridor check rejects a door state that does not match its status');
}

console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
