/* ============================================================================
   TOPIC · __TOPIC_TITLE__ — THE EXAM DRILL GENERATOR
   ----------------------------------------------------------------------------
   REPLACE ME. make(seed, mode) returns one question for ../../DrillFrame.jsx
   (schema there). It must be deterministic in `seed` (use rng below), so a
   question can be reproduced, printed and checked. FIXED holds questions
   "from the unit" (with slide receipts). Numbers come from ../../maths/*.
   ========================================================================== */

// a small seeded generator (mulberry32): the same seed, the same question
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function make(seed) {
  const r = rng(seed);
  const nIn = 2 + Math.floor(r() * 9);
  const units = 1 + Math.floor(r() * 6);
  return {
    id: `r${seed}`,
    prov: '{own}',
    prompt: `REPLACE ME: a Dense layer with ${units} units gets ${nIn} inputs. How many parameters does it have?`,
    fields: [{ key: 'n', label: `Dense(${units})`, answer: (nIn + 1) * units, type: 'number' }],
    working: [`$(n_{\\text{in}} + 1) \\times \\text{units} = (${nIn} + 1) \\times ${units} = ${(nIn + 1) * units}$ {s|L1 · slide 36}`],
  };
}

export const FIXED = [
  {
    id: 'u-l1',
    title: 'From the unit',
    prov: '{s|L1 · slide 36}',
    prompt: 'REPLACE ME: a question taken from a slide.',
    fields: [{ key: 'n', label: 'Dense(300) after Flatten (784)', answer: 235500, type: 'number' }],
    working: ['$(784 + 1) \\times 300 = 235{,}500$ {s|L1 · slide 36}'],
  },
];
