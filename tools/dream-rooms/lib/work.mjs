/* Dream Rooms · the work folder (CONTRACTS.md §9): dream-rooms-work/<id>/ (gitignored).
   Everything here is local. Logs hold ids, timings and sizes, never words (decision 14). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const WORK = path.join(REPO, 'dream-rooms-work');

/** The work folder of a dream id (or an absolute/relative path to one). */
export function workDir(idOrPath) {
  if (!idOrPath) throw new Error('No dream id given.');
  if (fs.existsSync(idOrPath) && fs.statSync(idOrPath).isDirectory()) return path.resolve(idOrPath);
  return path.join(WORK, idOrPath);
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}
const maybe = (p, fn) => (fs.existsSync(p) ? fn(p) : null);

/** { dir, id, raw, row, dream, world } (any part may be null). */
export function loadWork(idOrPath) {
  const dir = workDir(idOrPath);
  return {
    dir,
    id: path.basename(dir),
    raw: maybe(path.join(dir, 'raw.txt'), (p) => fs.readFileSync(p, 'utf8')),
    row: maybe(path.join(dir, 'row.json'), readJson),
    dream: maybe(path.join(dir, 'dream.json'), readJson),
    world: maybe(path.join(dir, 'world.json'), readJson),
  };
}

/** Append an event to <dir>/log.json: ids, statuses, timings and sizes only. */
export function logEvent(dir, event) {
  const p = path.join(dir, 'log.json');
  const log = fs.existsSync(p) ? readJson(p) : [];
  log.push({ at: new Date().toISOString(), ...event });
  writeJson(p, log);
}

/** Parse "--flag value" / "--flag" / positional args. */
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

/** Print the problems of a check, numbered; never words (validate.js messages are word-free). */
export function printProblems(label, list) {
  if (!list.length) return;
  console.log(`${label} (${list.length}):`);
  for (const m of list) console.log(`  · ${m}`);
}
