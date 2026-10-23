/* The round engine's grader, kept pure and import-free so Node check scripts
   can use it: grade(item, given) → boolean (see useRound.js for the item shape). */
const near = (a, b, tol = 0) => Math.abs(Number(a) - Number(b)) <= tol + 1e-9;
const eqShape = (a, b, tol = 0) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => (b[i] === null ? v === null : near(v, b[i], tol)));

export function grade(item, given) {
  if (typeof item.check === 'function') return !!item.check(given);
  switch (item.kind) {
    case 'number': return given !== '' && given !== null && given !== undefined && near(given, item.answer, item.tol ?? 0);
    case 'shape': return eqShape(given, item.answer, item.tol ?? 0);
    case 'choice': return given === item.answer;
    default: return JSON.stringify(given) === JSON.stringify(item.answer);
  }
}
