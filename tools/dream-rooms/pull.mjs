/* ============================================================================
   DREAM ROOMS · pull: fetch a dream into its work folder and mark it `reading`.
     node tools/dream-rooms/pull.mjs --next            the oldest captured dream
     node tools/dream-rooms/pull.mjs <id>              that dream (captured, or stale)
     node tools/dream-rooms/pull.mjs <id> --reread     re-read a rendered or failed dream
     node tools/dream-rooms/pull.mjs --list            every dream's id + status (+ stale)
     node tools/dream-rooms/pull.mjs --reset <id>      a stale reading/building dream → captured
   Writes dream-rooms-work/<id>/raw.txt (its own text + "remembered more") and
   row.json; on a re-read also dream.prev.json / world.prev.json. Prints ids and
   statuses only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { api } from './lib/api.mjs';
import { WORK, args, logEvent, writeJson } from './lib/work.mjs';
import { ownText, STALE_MS } from '../../src/dream-rooms/contracts/rows.js';

const a = args();
const stale = (r) => (r.status === 'reading' || r.status === 'building') && Date.now() - Date.parse(r.status_at || r.updated_at || 0) > STALE_MS;

async function main() {
  if (a.list) {
    const rows = await api.list();
    for (const r of rows) {
      const full = stale(r) ? await api.get(r.id) : null;
      console.log(`${r.id}  ${r.dreamt_on} #${r.night_order}  ${r.status}${full && stale(full) ? '  (stale)' : ''}${r.split_from ? '  (split)' : ''}`);
    }
    console.log(`${rows.length} dreams; ${rows.filter((r) => r.status === 'captured').length} waiting to be read.`);
    return;
  }

  if (a.reset) {
    const id = a.reset === true ? a._[0] : a.reset;
    const row = await api.get(id);
    if (!['reading', 'building'].includes(row.status) && !a.force) {
      console.log(`${id} is ${row.status}; only a reading/building dream can be reset (add --force to reset anyway).`);
      process.exit(1);
    }
    if (!stale(row) && !a.force) console.log(`note: ${id} isn't stale yet (under 2 h); resetting anyway.`);
    await api.patch(id, { status: 'captured', fail_reason: null });
    console.log(`${id} → captured`);
    return;
  }

  let id = a._[0];
  if (a.next || !id) {
    const rows = await api.list();
    const next = rows.find((r) => r.status === 'captured');
    if (!next) {
      const st = [];
      for (const r of rows.filter((x) => x.status === 'reading' || x.status === 'building')) {
        const full = await api.get(r.id);
        if (stale(full)) st.push(r.id);
      }
      console.log(`Nothing waiting to be read.${st.length ? ` Stale (reset with --reset <id>): ${st.join(', ')}` : ''}`);
      process.exit(2);
    }
    id = next.id;
  }

  const row = await api.get(id);
  if (row.deleted_at) throw new Error(`${id} is deleted.`);
  const ok = row.status === 'captured' || stale(row) || (a.reread && ['rendered', 'failed', 'reading', 'building'].includes(row.status));
  if (!ok) {
    console.log(`${id} is ${row.status}. Use --reread to read it again${row.status === 'reading' || row.status === 'building' ? ', or wait until it is stale (2 h)' : ''}.`);
    process.exit(1);
  }

  const dir = path.join(WORK, id);
  fs.mkdirSync(dir, { recursive: true });
  const text = ownText(row);
  fs.writeFileSync(path.join(dir, 'raw.txt'), text);
  const { files, ...rest } = row;
  writeJson(path.join(dir, 'row.json'), rest);
  if (row.dream) writeJson(path.join(dir, 'dream.prev.json'), row.dream);
  if (row.world) writeJson(path.join(dir, 'world.prev.json'), row.world);
  void files;
  const updated = await api.patch(id, { status: 'reading', fail_reason: null });
  writeJson(path.join(dir, 'row.json'), { ...rest, status: updated.status, status_at: updated.status_at, updated_at: updated.updated_at });
  logEvent(dir, { step: 'pull', status: 'reading', chars: text.length, reread: Boolean(a.reread) });
  console.log(`pulled ${id}  (${row.dreamt_on} #${row.night_order}, ${text.length} chars${row.extra_text ? ', with remembered-more' : ''}${row.split_from ? `, split from ${row.split_from}` : ''})`);
  console.log(`work folder: ${dir}`);
}

main().catch((err) => {
  console.error(`pull failed: ${err.status ? `HTTP ${err.status} ` : ''}${String(err.message || err).split('\n')[0]}`);
  process.exit(1);
});
