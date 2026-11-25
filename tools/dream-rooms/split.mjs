/* ============================================================================
   DREAM ROOMS · split: one capture that holds two dreams → two rows.
     node tools/dream-rooms/split.mjs <id> --at "<exact words that start the second dream>"
   Only where the text says so explicitly ("…and then I had another one where…").
   The Worker finds the phrase with indexOf inside the row's own slice and fails
   when it isn't there, or is there twice. The original keeps its full raw_text
   untouched and gets `own` + `split_into`; the new row (split_from = original,
   same night, the next night_order) holds the rest. Each part reads only its own
   slice. The log in the work folder holds ids only, never the words.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { api } from './lib/api.mjs';
import { WORK, args, logEvent, writeJson } from './lib/work.mjs';
import { ownText } from '../../src/dream-rooms/contracts/rows.js';

const a = args();
const id = a._[0];
if (!id || typeof a.at !== 'string' || !a.at.trim()) {
  console.log('usage: node tools/dream-rooms/split.mjs <id> --at "<exact words that start the second dream>"');
  process.exit(1);
}

try {
  const { parent, child } = await api.split(id, a.at);
  const dir = path.join(WORK, id);
  fs.mkdirSync(dir, { recursive: true });
  // the parent's work folder now holds only its own slice
  if (fs.existsSync(path.join(dir, 'raw.txt'))) fs.writeFileSync(path.join(dir, 'raw.txt'), ownText(parent));
  if (fs.existsSync(path.join(dir, 'row.json'))) {
    const { files, ...rest } = parent;
    void files;
    writeJson(path.join(dir, 'row.json'), rest);
  }
  logEvent(dir, { step: 'split', parent: parent.id, child: child.id, own: parent.own, child_night_order: child.night_order });
  console.log(`split ${parent.id} → ${child.id}  (parent own ${parent.own[0]}–${parent.own[1]}, child #${child.night_order} that night, status ${child.status})`);
} catch (err) {
  console.error(`split failed: ${err.status ? `HTTP ${err.status} ` : ''}${String(err.message || err).split('\n')[0]}`);
  console.error('Not splitting on a guess: render it as one dream and note it in reading.md.');
  process.exit(1);
}
