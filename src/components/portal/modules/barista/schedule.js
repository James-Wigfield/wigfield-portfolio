/* ============================================================================
   BARISTA · DEEP-CLEAN SCHEDULE — task graph + a small, pure list scheduler
   ----------------------------------------------------------------------------
   The six-month deep clean is modelled as tasks with a duration, the
   resources they occupy and their predecessors. `buildSchedule()` places
   them with a resource-constrained list scheduler (critical-path priority:
   the task with the longest remaining chain goes first) and returns start /
   end minutes, the critical chain, the player's step order and three totals:

     total      makespan of the computed schedule
     naive      every task one after another (waiting out each soak)
     bound      a lower bound: hands-on minutes, or the longest chain,
                whichever is larger. No schedule can beat it.

   Resources:  you (1 pair of hands) · machine (1) · bath (2 vessels: a cup
   and a bowl can soak at once). Passive tasks never use `you`.

   Constraints encoded:
     • cold-first — every `heat: 'hot'` task waits for every `heat: 'cold'`
       task (screen, wand tip, grinder need the machine off and cool).
     • the filter stays out for the descale — `filter` follows the rinse.
     • the portafilter + 1 CUP basket are shared — the basket soak starts
       after the grinder has finished with the portafilter and is rinsed
       before the cleaning cycle needs the 1 CUP basket.
     • the wand tip must be back on before the descale's steam leg, and the
       shower screen before anything flows through the group head.

   Durations: `src` says where each comes from — an IB page, 'tip' (general
   practice, labelled in the UI) or 'est' (this guide's estimate of hands-on
   time; the UI labels the totals as estimates). Change a number here and
   the Gantt, the totals and the step order all recompute.
   ========================================================================== */

export const LANES = [
  { id: 'you', label: 'You' },
  { id: 'machine', label: 'Machine' },
  { id: 'bath', label: 'Soak bath' },
];

const CAPACITY = { you: 1, machine: 1, bath: 2 };

export const TASKS = [
  { id: 'setup', step: 'setup', label: 'Cold start', uses: ['you'], min: 3, src: 'est', heat: 'cold', after: [] },
  { id: 'wrap', step: 'wrap', label: 'Wrap wand', uses: ['you'], min: 1, src: 'est', heat: 'cold', after: ['setup'] },
  { id: 'soften', step: 'wrap', label: 'Hot cloth', uses: ['bath'], min: 3, src: 'tip', heat: 'cold', after: ['wrap'] },
  // The kettle is freshest straight after setup, so the cloth goes on first and
  // softens the milk while you work on the shower screen.
  { id: 'screen', step: 'screen', label: 'Shower screen', uses: ['you'], min: 12, src: 'est', heat: 'cold', after: ['wrap'] },
  { id: 'tipOff', step: 'tip-off', label: 'Tip off', uses: ['you'], min: 3, src: 'est', heat: 'cold', after: ['soften', 'screen'] },
  // Open-ended: the IB gives no soak time. It lasts until the tip goes back on.
  { id: 'tipSoak', step: 'tip-off', label: 'Tip soak', uses: ['bath'], min: 0, open: true, until: 'tipOn', src: 'IB p.25', heat: 'cold', after: ['tipOff'] },
  { id: 'grinder', step: 'grinder', label: 'Grinder', uses: ['you'], min: 7, src: 'est', heat: 'cold', after: ['tipOff'] },
  { id: 'tamp', step: 'tamp', label: 'Tamp', uses: ['you'], min: 5, src: 'est', heat: 'cold', after: ['grinder'] },
  { id: 'soakStart', step: 'soak', label: 'Soak in', uses: ['you'], min: 3, src: 'est', heat: 'any', after: ['grinder'] },
  { id: 'basketSoak', step: 'soak', label: 'Basket soak', uses: ['bath'], min: 20, src: 'IB p.25', heat: 'any', after: ['soakStart'] },
  { id: 'tipOn', step: 'tip-on', label: 'Tip on', uses: ['you'], min: 2, src: 'est', heat: 'cold', after: ['tipOff', 'tamp'] },
  { id: 'descaleSetup', step: 'descale-setup', label: 'Descale in', uses: ['you', 'machine'], min: 4, src: 'est', heat: 'hot', after: ['tipOn', 'screen'] },
  { id: 'descaleHeat', step: 'descale-setup', label: 'Heating', uses: ['machine'], min: 1, src: 'est', heat: 'hot', after: ['descaleSetup'] },
  { id: 'rounds', step: 'descale-rounds', label: 'Rounds', uses: ['you', 'machine'], min: 4, src: 'est', heat: 'hot', after: ['descaleHeat'] },
  { id: 'rinse', step: 'descale-rinse', label: 'Rinse', uses: ['you', 'machine'], min: 8, src: 'est', heat: 'hot', after: ['rounds'] },
  { id: 'filterSoak', step: 'descale-rinse', label: 'Filter soak', uses: ['bath'], min: 5, src: 'IB p.22', heat: 'any', after: ['rounds'] },
  { id: 'filter', step: 'filter', label: 'New filter', uses: ['you'], min: 2, src: 'est', heat: 'hot', after: ['rinse', 'filterSoak'] },
  { id: 'basketRinse', step: 'basket-rinse', label: 'Rinse baskets', uses: ['you'], min: 3, src: 'est', heat: 'any', after: ['basketSoak'] },
  { id: 'cycleSetup', step: 'cycle', label: 'Cycle in', uses: ['you', 'machine'], min: 3, src: 'est', heat: 'hot', after: ['filter', 'basketRinse'] },
  { id: 'cycle', step: 'cycle', label: 'Cleaning cycle', uses: ['machine'], min: 5, src: 'IB p.22', heat: 'hot', after: ['cycleSetup'] },
  { id: 'housing', step: 'cycle', label: 'Housing', uses: ['you'], min: 3, src: 'est', heat: 'any', after: ['cycleSetup'] },
  { id: 'cycleRinse', step: 'cycle-rinse', label: 'Check + rinse', uses: ['you', 'machine'], min: 2, src: 'est', heat: 'hot', after: ['cycle'] },
  { id: 'finish', step: 'finish', label: 'Finish', uses: ['you'], min: 8, src: 'est', heat: 'hot', after: ['cycleRinse', 'housing'] },
];

const uniq = (a) => [...new Set(a)];

/** Expand the cold-first rule into explicit predecessors. */
function withImplicitPreds(tasks) {
  const cold = tasks.filter((t) => t.heat === 'cold').map((t) => t.id);
  return tasks.map((t) => ({
    ...t,
    preds: t.heat === 'hot' ? uniq([...t.after, ...cold]) : [...t.after],
  }));
}

/** Longest chain (minutes) from the start of each task to the end of the graph. */
function tails(tasks) {
  const succ = new Map(tasks.map((t) => [t.id, []]));
  tasks.forEach((t) => t.preds.forEach((p) => succ.get(p).push(t.id)));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map();
  const tail = (id) => {
    if (memo.has(id)) return memo.get(id);
    const t = byId.get(id);
    const v = t.min + Math.max(0, ...succ.get(id).map(tail));
    memo.set(id, v);
    return v;
  };
  tasks.forEach((t) => tail(t.id));
  return memo;
}

/**
 * Place every task. Pure: same graph in, same schedule out.
 * @returns {{ tasks, steps, total, naive, bound, handsOn, chain, critical }}
 */
export function buildSchedule(source = TASKS) {
  const tasks = withImplicitPreds(source);
  const order = new Map(tasks.map((t, i) => [t.id, i]));
  const tail = tails(tasks);
  const start = new Map();
  const end = new Map();
  const running = [];
  let time = 0;
  let guard = 0;

  const free = (r) => CAPACITY[r] - running.filter((id) => tasks[order.get(id)].uses.includes(r)).length;

  while (start.size < tasks.length && guard++ < 1000) {
    // Retire whatever has finished by now.
    for (let i = running.length - 1; i >= 0; i -= 1) {
      if (end.get(running[i]) <= time) running.splice(i, 1);
    }
    const ready = tasks
      .filter((t) => !start.has(t.id) && t.preds.every((p) => end.has(p) && end.get(p) <= time))
      .sort((a, b) => tail.get(b.id) - tail.get(a.id) || order.get(a.id) - order.get(b.id));
    for (const t of ready) {
      if (t.uses.every((r) => free(r) > 0)) {
        start.set(t.id, time);
        end.set(t.id, time + t.min);
        if (t.min > 0) running.push(t.id);
      }
    }
    // Zero-length tasks finish instantly — loop again at the same time.
    if (ready.some((t) => start.has(t.id) && t.min === 0)) continue;
    const next = running.map((id) => end.get(id)).filter((e) => e > time);
    if (!next.length) break;
    time = Math.min(...next);
  }

  const placed = tasks.map((t) => {
    const s = start.get(t.id);
    // Open-ended soaks run until the task that ends them starts.
    const e = t.open && t.until ? start.get(t.until) : end.get(t.id);
    return { ...t, start: s, end: e };
  });
  const byId = new Map(placed.map((t) => [t.id, t]));
  const total = Math.max(...placed.map((t) => t.end));

  // Critical chain: walk back from the last task through whatever it waited
  // on — a predecessor or a resource neighbour that ended exactly at its start.
  const chain = [];
  let cur = placed.reduce((a, b) => (b.end > a.end || (b.end === a.end && !b.open) ? b : a));
  while (cur) {
    chain.unshift(cur.id);
    if (cur.start === 0) break;
    const c = cur;
    const blockers = placed.filter(
      (t) => t.id !== c.id && !t.open && t.end === c.start &&
        (c.preds.includes(t.id) || t.uses.some((r) => c.uses.includes(r))),
    );
    cur = blockers.sort((a, b) => b.min - a.min)[0];
  }

  const handsOn = placed.filter((t) => t.uses.includes('you')).reduce((s, t) => s + t.min, 0);

  // Minutes your hands are free — the schedule's only gap to the bound.
  const idle = [];
  let cursor = 0;
  placed
    .filter((t) => t.uses.includes('you'))
    .sort((a, b) => a.start - b.start)
    .forEach((t) => {
      if (t.start > cursor) idle.push({ start: cursor, end: t.start });
      cursor = Math.max(cursor, t.end);
    });
  const longest = Math.max(...placed.map((t) => tail.get(t.id)));
  const naive = placed.filter((t) => !t.open).reduce((s, t) => s + t.min, 0);

  // Player steps in the order you start them.
  const steps = [];
  placed
    .filter((t) => t.uses.includes('you'))
    .sort((a, b) => a.start - b.start || order.get(a.id) - order.get(b.id))
    .forEach((t) => {
      if (!steps.some((s) => s.id === t.step)) steps.push({ id: t.step, start: t.start });
    });
  steps.forEach((s) => {
    const own = placed.filter((t) => t.step === s.id);
    s.end = Math.max(...own.map((t) => t.end));
    s.tasks = own.map((t) => t.id);
  });

  return {
    tasks: placed,
    byId,
    steps,
    total,
    naive,
    handsOn,
    idle,
    bound: Math.max(handsOn, longest),
    chain,
    critical: new Set(chain),
  };
}

/** Minutes → "1 h 16 min" / "45 min". */
export function fmtMinutes(m) {
  const r = Math.round(m);
  if (r < 60) return `${r} min`;
  const h = Math.floor(r / 60);
  const mm = r % 60;
  return mm ? `${h} h ${mm} min` : `${h} h`;
}
