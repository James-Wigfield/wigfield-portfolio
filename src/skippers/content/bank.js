/* The question bank, loaded through import.meta.glob so a missing or
   half-written bank never breaks the build (the bank is plain data in
   ./questions/, validated by tools/skippers/check-questions.mjs). */

const mods = import.meta.glob('./questions/index.js', { eager: true });
const mod = Object.values(mods)[0] ?? {};

export const QUESTIONS = mod.QUESTIONS ?? [];
export const TOPICS = mod.TOPICS ?? [];
export const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export const topicLabel = (id) => TOPICS.find((t) => t.id === id)?.label ?? id;

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ofTopics = (topics) => QUESTIONS.filter((q) => topics.includes(q.topic));

// pick n, preferring a mix of coverage keys and some pictures
export function pickCheckIn(topics, n = 5) {
  const pool = shuffle(ofTopics(topics));
  const out = [];
  const usedCover = new Set();
  for (const q of pool) {
    if (out.length >= n) break;
    const c = q.cover?.[0];
    if (c && usedCover.has(c)) continue;
    usedCover.add(c);
    out.push(q);
  }
  for (const q of pool) {
    if (out.length >= n) break;
    if (!out.includes(q)) out.push(q);
  }
  return out;
}

/* A full mock: 40 questions weighted like the real paper (TOPICS.examWeight,
   which sums to 40), no repeats, shuffled. */
export function buildMock() {
  const out = [];
  for (const t of TOPICS) {
    const pool = shuffle(QUESTIONS.filter((q) => q.topic === t.id));
    out.push(...pool.slice(0, t.examWeight ?? 0));
  }
  if (out.length < 40) {
    const rest = shuffle(QUESTIONS.filter((q) => !out.includes(q)));
    out.push(...rest.slice(0, 40 - out.length));
  }
  return shuffle(out).slice(0, 40);
}
