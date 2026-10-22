/* Unit tests for arcade/core/scheduler.js and core/progress.js — run with
   `node --test tools/dl-arcade/scheduler.test.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/arcade/core');
const S = await import(pathToFileURL(path.join(CORE, 'scheduler.js')).href);
const P = await import(pathToFileURL(path.join(CORE, 'progress.js')).href);
const { rng } = await import(pathToFileURL(path.join(CORE, 'rng.js')).href);

const T = '2026-10-22';

test('a new concept is due and in box 0', () => {
  assert.equal(S.boxOf({}, 'x'), 0);
  assert.equal(S.isDue({}, 'x', T), true);
});

test('all correct promotes one box and sets the next due date', () => {
  let b = S.applyOutcomes({}, [{ concept: 'a', correct: true }, { concept: 'a', correct: true }], T);
  assert.equal(b.a.box, 1);
  assert.equal(b.a.due, T); // box 1 → 0 days
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], T);
  assert.equal(b.a.box, 2);
  assert.equal(b.a.due, '2026-10-23');
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], '2026-10-23');
  assert.equal(b.a.box, 3);
  assert.equal(b.a.due, '2026-10-25');
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], '2026-10-25');
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], '2026-10-29');
  assert.equal(b.a.box, 5);
  assert.equal(b.a.due, '2026-11-06'); // +8 days
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], '2026-11-06');
  assert.equal(b.a.box, 5, 'never above box 5');
});

test('any wrong answer demotes one box, never below 1', () => {
  let b = S.applyOutcomes({}, [{ concept: 'a', correct: true }], T);
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], T);
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }], T); // box 3
  b = S.applyOutcomes(b, [{ concept: 'a', correct: true }, { concept: 'a', correct: false }], T);
  assert.equal(b.a.box, 2);
  b = S.applyOutcomes(b, [{ concept: 'a', correct: false }], T);
  b = S.applyOutcomes(b, [{ concept: 'a', correct: false }], T);
  assert.equal(b.a.box, 1);
  assert.equal(b.a.right, 4);
  assert.equal(b.a.wrong, 3);
  assert.equal(b.a.seen, 6);
});

test('applyOutcomes is pure and ignores outcomes without a concept', () => {
  const before = { a: { box: 2, due: T, seen: 1, right: 1, wrong: 0, last: T } };
  const after = S.applyOutcomes(before, [{ concept: 'a', correct: true }, { correct: true }], T);
  assert.equal(before.a.box, 2);
  assert.equal(after.a.box, 3);
  assert.deepEqual(Object.keys(after), ['a']);
});

test('due concepts are weakest-and-due first; box-5 ones not yet due are left out', () => {
  const b = {
    strong: { box: 5, due: '2026-11-01' },
    weak: { box: 1, due: T },
    mid: { box: 3, due: '2026-10-20' },
  };
  assert.deepEqual(S.dueConcepts(b, ['strong', 'weak', 'mid', 'new'], T), ['new', 'weak', 'mid']);
});

test('mastery is the mean of (box−1)/4', () => {
  const b = { a: { box: 5 }, b: { box: 3 }, c: { box: 1 } };
  assert.equal(S.mastery(b, ['a', 'b', 'c', 'd']), (1 + 0.5 + 0 + 0) / 4);
  assert.equal(S.mastery({}, []), 0);
});

test('planMix picks 4 distinct games when there are enough, weighted to weak concepts', () => {
  const games = [
    { id: 'g1', concepts: ['a', 'b'] },
    { id: 'g2', concepts: ['c'] },
    { id: 'g3', concepts: ['d', 'e'] },
    { id: 'g4', concepts: ['f'] },
    { id: 'g5', concepts: ['g'] },
  ];
  const plan = S.planMix(games, {}, T, rng(7));
  assert.equal(plan.length, 4);
  assert.equal(new Set(plan).size, 4);
  // the same seed gives the same plan
  assert.deepEqual(S.planMix(games, {}, T, rng(7)), plan);
  // with every other game mastered and not due, the weak game is always chosen
  const b = { c: { box: 5, due: '2027-01-01' }, d: { box: 5, due: '2027-01-01' }, e: { box: 5, due: '2027-01-01' }, f: { box: 5, due: '2027-01-01' }, g: { box: 5, due: '2027-01-01' } };
  let hits = 0;
  for (let s = 1; s <= 20; s++) if (S.planMix(games, b, T, rng(s)).includes('g1')) hits += 1;
  assert.equal(hits, 20);
});

test('planRounds repeats games only when there are fewer games than rounds', () => {
  const games = [{ id: 'g1', concepts: ['a'] }, { id: 'g2', concepts: ['b'] }];
  const plan = S.planRounds(games, {}, T, rng(3), { rounds: 5 });
  assert.equal(plan.length, 5);
  assert.deepEqual(new Set(plan.slice(0, 2)).size, 2);
});

test('gradeByLecture groups outcomes and grades', () => {
  const concepts = { a: { lecture: 1 }, b: { lecture: 1 }, c: { lecture: 4 } };
  const g = S.gradeByLecture([
    { concept: 'a', correct: true }, { concept: 'b', correct: false }, { concept: 'c', correct: true }, { concept: 'zzz', correct: true },
  ], concepts);
  assert.deepEqual(g.per[1], { right: 1, total: 2, pct: 0.5 });
  assert.deepEqual(g.per[4], { right: 1, total: 1, pct: 1 });
  assert.equal(g.total, 4);
  assert.equal(S.letter(0.8), 'HD');
  assert.equal(S.letter(0.49), 'N');
});

test('streaks count consecutive days', () => {
  let s = P.touchStreak({ count: 0, last: '' }, T);
  assert.deepEqual(s, { count: 1, last: T });
  s = P.touchStreak(s, T);
  assert.deepEqual(s, { count: 1, last: T }, 'same day does not double count');
  s = P.touchStreak(s, '2026-10-23');
  assert.equal(s.count, 2);
  s = P.touchStreak(s, '2026-10-25');
  assert.equal(s.count, 1, 'a missed day resets');
});

test('xp levels and unlocks', () => {
  assert.equal(P.levelFor(0), 1);
  assert.equal(P.levelFor(99), 1);
  assert.equal(P.levelFor(100), 2);
  assert.equal(P.levelFor(300), 3);
  assert.equal(P.xpForLevel(3), 300);
  const bests = { g: { 1: { score: 80, maxScore: 100 }, 2: { score: 50, maxScore: 100 } } };
  assert.equal(P.maxLevelUnlocked('g', bests, 3), 2, 'level 2 unlocked by ≥70 % at level 1; level 3 not yet');
  assert.equal(P.maxLevelUnlocked('h', bests, 3), 1);
  assert.equal(P.maxLevelUnlocked('g', { g: { 1: { score: 70, maxScore: 100 }, 2: { score: 70, maxScore: 100 } } }, 3), 3);
});

test('xp for a round rewards accuracy, level and a personal best', () => {
  assert.equal(P.xpForRound({ score: 100, maxScore: 100, level: 1, best: false }), 100);
  assert.equal(P.xpForRound({ score: 50, maxScore: 100, level: 2, best: false }), 75);
  assert.equal(P.xpForRound({ score: 50, maxScore: 100, level: 2, best: true }), 100);
  assert.equal(P.xpForRound({ score: 0, maxScore: 0, level: 1, best: false }), 0);
});
