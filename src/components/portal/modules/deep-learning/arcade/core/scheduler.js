/* ============================================================================
   GRADIENT ARCADE — SPACED REPETITION (Leitner boxes)
   ----------------------------------------------------------------------------
   Pure functions, no DOM, no storage: unit-tested by
   tools/dl-arcade/scheduler.test.mjs.

   Every drillable concept (core/concepts.js) sits in a box 1–5. A box's
   review interval is INTERVALS[box − 1] days: 0 / 1 / 2 / 4 / 8. A concept
   never seen counts as box 0 ("new"), which is always due.

   After a round, applyOutcomes() aggregates that round's outcomes per
   concept: all correct → up one box; any wrong → down one box (never below
   1). A concept is due again on `due` = the day it was reviewed +
   INTERVALS[newBox − 1].

   Sampling weight (the Daily Mix and the Exam lean on weak and due
   concepts): new 4 · box 1 4 · box 2 3 · box 3 2 · box 4 1 · box 5 0.5,
   and ×2 when the concept is due.

   Mastery of a set of concepts = mean of (box − 1) / 4 (new = 0).
   ========================================================================== */

export const BOXES = 5;
export const INTERVALS = [0, 1, 2, 4, 8];
export const WEIGHT = { 0: 4, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0.5 };

const DAY = 86400000;

export function addDays(iso, n) {
  const t = Date.parse(`${iso}T00:00:00Z`) + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export const boxOf = (boxes, id) => boxes[id]?.box ?? 0;
export const isDue = (boxes, id, today) => {
  const s = boxes[id];
  if (!s) return true;
  return !s.due || s.due <= today;
};

// outcomes: [{ concept, correct }] → a NEW boxes object
export function applyOutcomes(boxes, outcomes, today) {
  const per = new Map();
  outcomes.forEach((o) => {
    if (!o || !o.concept) return;
    const cur = per.get(o.concept) ?? { right: 0, wrong: 0 };
    if (o.correct) cur.right += 1;
    else cur.wrong += 1;
    per.set(o.concept, cur);
  });
  const next = { ...boxes };
  per.forEach((r, id) => {
    const prev = boxes[id] ?? { box: 0, due: '', seen: 0, right: 0, wrong: 0, last: '' };
    let box = prev.box;
    if (r.wrong > 0) box = Math.max(1, box - 1);
    else box = Math.min(BOXES, box + 1);
    next[id] = {
      box,
      due: addDays(today, INTERVALS[box - 1]),
      seen: prev.seen + 1,
      right: prev.right + r.right,
      wrong: prev.wrong + r.wrong,
      last: today,
    };
  });
  return next;
}

export function weightOf(boxes, id, today) {
  const w = WEIGHT[boxOf(boxes, id)] ?? 1;
  return isDue(boxes, id, today) ? w * 2 : w;
}

// Concept ids sorted weakest-and-most-due first.
export function dueConcepts(boxes, ids, today) {
  return ids
    .map((id) => ({ id, w: weightOf(boxes, id, today), due: isDue(boxes, id, today), box: boxOf(boxes, id) }))
    .filter((c) => c.due)
    .sort((a, b) => b.w - a.w || a.box - b.box || a.id.localeCompare(b.id))
    .map((c) => c.id);
}

export function mastery(boxes, ids) {
  if (!ids.length) return 0;
  const s = ids.reduce((a, id) => a + Math.max(0, boxOf(boxes, id) - 1) / (BOXES - 1), 0);
  return s / ids.length;
}

/* ── planning rounds ──────────────────────────────────────────────────────
   games: manifests [{ id, concepts: [...] }]; conceptIds: every drillable id.
   Score a game by the summed weight of its concepts (so a game whose
   concepts are weak or due ranks first), pick `rounds` games by weighted
   sampling without replacement (variety), then re-add a game only if there
   are fewer games than rounds. Deterministic given the rng.              */
export function planRounds(games, boxes, today, rand, { rounds = 4 } = {}) {
  const pool = games.filter((g) => g.concepts?.length);
  if (!pool.length) return [];
  const score = (g) => g.concepts.reduce((a, id) => a + weightOf(boxes, id, today), 0) / Math.sqrt(g.concepts.length);
  const left = pool.slice();
  const plan = [];
  while (plan.length < rounds) {
    if (!left.length) left.push(...pool);
    const i = rand.weighted(left.map(score));
    const g = left.splice(i, 1)[0];
    plan.push(g.id);
  }
  return plan;
}

export const planMix = (games, boxes, today, rand) => planRounds(games, boxes, today, rand, { rounds: 4 });
export const planExam = (games, boxes, today, rand) => planRounds(games, boxes, today, rand, { rounds: Math.max(6, games.length) });

/* ── grading an exam by lecture ───────────────────────────────────────────
   outcomes: [{ concept, correct }]; concepts: { [id]: { lecture } }.
   Returns { [lecture]: { right, total, pct } } and an overall grade.      */
export function gradeByLecture(outcomes, concepts) {
  const per = {};
  outcomes.forEach((o) => {
    const lec = concepts[o.concept]?.lecture;
    if (lec === undefined) return;
    per[lec] = per[lec] ?? { right: 0, total: 0, pct: 0 };
    per[lec].total += 1;
    if (o.correct) per[lec].right += 1;
  });
  Object.values(per).forEach((r) => { r.pct = r.total ? r.right / r.total : 0; });
  const total = outcomes.length;
  const right = outcomes.filter((o) => o.correct).length;
  return { per, total, right, pct: total ? right / total : 0, grade: letter(total ? right / total : 0) };
}

export function letter(pct) {
  if (pct >= 0.8) return 'HD';
  if (pct >= 0.7) return 'D';
  if (pct >= 0.6) return 'CR';
  if (pct >= 0.5) return 'P';
  return 'N';
}
