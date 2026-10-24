/* ============================================================================
   GRADIENT ARCADE — XP, LEVELS, STREAKS, BESTS, UNLOCKS
   ----------------------------------------------------------------------------
   Pure functions (tested in tools/dl-arcade/scheduler.test.mjs) plus one
   impure `recordRound()` that applies a finished round to storage.

     xpForRound    round(100 · score/max · (1 + 0.5·(level − 1))) + 25 for a best
     levelFor(xp)  level n needs xpForLevel(n) = 50·n·(n − 1): 100, 300, 600, 1000 …
     touchStreak   consecutive calendar days with at least one round
     unlocks       level L + 1 of a game opens once level L's best is ≥ 70 %;
                   Exam mode opens once 3 different games have been played
   ========================================================================== */
import { applyOutcomes } from './scheduler.js';
import { getBoxes, setBoxes, getProfile, setProfile, pushHistory } from './storage.js';
import { todayISO } from './rng.js';

export const UNLOCK_PCT = 0.7;
export const EXAM_GAMES_NEEDED = 3;

export const xpForLevel = (n) => 50 * n * (n - 1);
export function levelFor(xp) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n += 1;
  return n;
}
// progress through the current level, 0…1
export function levelProgress(xp) {
  const n = levelFor(xp);
  const lo = xpForLevel(n);
  const hi = xpForLevel(n + 1);
  return { level: n, lo, hi, t: hi > lo ? (xp - lo) / (hi - lo) : 0 };
}

export function xpForRound({ score, maxScore, level = 1, best = false }) {
  if (!maxScore) return 0;
  const acc = Math.max(0, Math.min(1, score / maxScore));
  return Math.round(100 * acc * (1 + 0.5 * (level - 1))) + (best ? 25 : 0);
}

export function touchStreak(streak, today) {
  const s = streak ?? { count: 0, last: '' };
  if (s.last === today) return { count: s.count || 1, last: today };
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  if (s.last === yesterday) return { count: (s.count || 0) + 1, last: today };
  return { count: 1, last: today };
}

export const pctOf = (b) => (b && b.maxScore ? b.score / b.maxScore : 0);

export function maxLevelUnlocked(gameId, bests, levels = 3) {
  const g = bests?.[gameId] ?? {};
  let L = 1;
  while (L < levels && pctOf(g[L]) >= UNLOCK_PCT) L += 1;
  return L;
}

export const examUnlocked = (profile) => Object.keys(profile?.plays ?? {}).length >= EXAM_GAMES_NEEDED;

/* Apply a finished round: boxes, bests, xp, streak, history. Returns what
   the results screen shows. `result` = { score, maxScore, outcomes }.    */
export function recordRound({ gameId, level, mode, result, today = todayISO() }) {
  const boxesBefore = getBoxes();
  const boxesAfter = applyOutcomes(boxesBefore, result.outcomes ?? [], today);
  setBoxes(boxesAfter);

  const profile = getProfile();
  const prevBest = profile.bests[gameId]?.[level] ?? null;
  const isBest = result.maxScore > 0 && (!prevBest || result.score > prevBest.score);
  const gained = xpForRound({ score: result.score, maxScore: result.maxScore, level, best: isBest });
  const streakBefore = profile.streak;
  const streak = touchStreak(profile.streak, today);
  const next = {
    ...profile,
    xp: profile.xp + gained,
    streak,
    rounds: profile.rounds + 1,
    plays: { ...profile.plays, [gameId]: (profile.plays[gameId] ?? 0) + 1 },
    bests: isBest
      ? { ...profile.bests, [gameId]: { ...(profile.bests[gameId] ?? {}), [level]: { score: result.score, maxScore: result.maxScore, at: today } } }
      : profile.bests,
  };
  setProfile(next);
  pushHistory({ at: new Date().toISOString(), gameId, mode, level, score: result.score, maxScore: result.maxScore });

  const moved = (result.outcomes ?? []).reduce((acc, o) => {
    if (!o.concept || acc.seen.has(o.concept)) return acc;
    acc.seen.add(o.concept);
    const a = boxesBefore[o.concept]?.box ?? 0;
    const b = boxesAfter[o.concept]?.box ?? 0;
    if (b > a) acc.up.push(o.concept);
    else if (b < a) acc.down.push(o.concept);
    return acc;
  }, { seen: new Set(), up: [], down: [] });

  return {
    xpGained: gained,
    xpBefore: profile.xp,
    xp: next.xp,
    levelBefore: levelFor(profile.xp),
    level: levelFor(next.xp),
    isBest,
    prevBest,
    streak,
    streakGrew: streak.count > (streakBefore.count || 0) || streakBefore.last !== today,
    boxesUp: moved.up,
    boxesDown: moved.down,
    unlocked: maxLevelUnlocked(gameId, next.bests),
    unlockedBefore: maxLevelUnlocked(gameId, profile.bests),
  };
}
