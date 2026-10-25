/* ============================================================================
   TRICKY TOPICS — MARKING A DRILL ANSWER (shared; tested by check-maths.mjs)
   ----------------------------------------------------------------------------
     number   "235,500", "235 500", "235500" all count; `tol` allows a margin
              (absolute), e.g. probabilities to two decimals
     text     shapes and tuples: spaces, brackets and case don't matter, so
              "(None, 14, 14, 64)", "none,14,14,64" and "[None, 14, 14, 64]"
              are the same answer; `accept` lists other right answers
     choice   the option's value
   ========================================================================== */

export function parseNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/[,\s_]/g, '').replace(/−/g, '-');
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

export const normText = (v) => String(v ?? '').toLowerCase().replace(/[\s()[\]]/g, '').replace(/,$/, '').replace(/−/g, '-');

export function checkField(f, v) {
  if (v === undefined || v === null || String(v).trim() === '') return false;
  if (f.type === 'number') {
    const got = parseNumber(v);
    return Number.isFinite(got) && Math.abs(got - Number(f.answer)) <= (f.tol ?? 0) + 1e-9;
  }
  if (f.type === 'choice') return String(v) === String(f.answer);
  const want = [f.answer, ...(f.accept ?? [])].map(normText);
  return want.includes(normText(v));
}
