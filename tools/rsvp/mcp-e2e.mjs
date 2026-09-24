/* ============================================================================
   RSVP PAPERS — end-to-end check of the MCP tools + the site Worker API
   ----------------------------------------------------------------------------
   Drives the REAL MCP Worker (wrangler dev) as an MCP client over Streamable
   HTTP, exactly as claude.ai does, and pushes two papers through the chunked
   save → append workflow: the real SegResMamba paper and a synthetic 30+-page
   paper in ~100 KB batches. Then exercises every error path the chat Claude
   must be able to act on, and finally reads everything back through the site
   Worker's password-gated /api/papers routes.

   Supabase is stood in by tools/rsvp/pgrest-stub.mjs, so nothing touches the
   live project. Run, in three terminals:

     node tools/rsvp/pgrest-stub.mjs
     (cd mcp-portal && npx wrangler dev --port 8787 --var SUPABASE_URL:http://127.0.0.1:8790)
     npx wrangler dev --port 8788 --var SUPABASE_URL:http://127.0.0.1:8790 --var PORTAL_PASSWORD:wiggy1
     node tools/rsvp/mcp-e2e.mjs

   Env: MCP_URL, SITE_URL, PORTAL_KEY, PGREST_URL override the defaults.
   ========================================================================== */
import { Client } from '../../mcp-portal/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StreamableHTTPClientTransport } from '../../mcp-portal/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import { segresmambaPaper } from './fixtures/segresmamba.mjs';
import { longPaper, chunkSections } from './fixtures/long-paper.mjs';

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:8787/mcp';
const SITE_URL = process.env.SITE_URL || 'http://127.0.0.1:8788';
const PORTAL_KEY = process.env.PORTAL_KEY || 'wiggy1';
const PGREST_URL = process.env.PGREST_URL || 'http://127.0.0.1:8790';

const fails = [];
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? '  — ' + extra : ''}`);
  if (!cond) fails.push(label);
};
const kb = (v) => Math.round(Buffer.byteLength(JSON.stringify(v)) / 1000);

// One tool call → parsed JSON payload (+ isError flag).
async function call(client, name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
  let json = null;
  try { json = JSON.parse(text); } catch { /* deck tools return plain text */ }
  return { isError: Boolean(res.isError), text, json };
}

async function main() {
  await fetch(`${PGREST_URL}/__reset`, { method: 'POST' });

  const client = new Client({ name: 'rsvp-e2e', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  // ── tools present ──────────────────────────────────────────────────────
  console.log('--- tools ---');
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  ok(['create_presentation', 'list_presentations', 'get_presentation', 'add_slide', 'delete_presentation'].every((n) => names.includes(n)), 'Deck Studio tools still registered', names.join(', '));
  ok(['save_paper', 'append_sections', 'list_papers', 'get_paper', 'delete_paper'].every((n) => names.includes(n)), 'paper tools registered');
  const save = tools.find((t) => t.name === 'save_paper');
  ok(/reading order/i.test(save.description) && /column/i.test(save.description) && /citations/i.test(save.description) && /hyphenation/i.test(save.description) && /appendix/i.test(save.description) && /key/.test(save.description), 'save_paper description carries the cleaning conventions');
  ok(/append_sections/.test(save.description) && /100 KB/.test(save.description), 'save_paper description documents the chunked workflow');
  ok(save.inputSchema?.properties?.sections?.items?.properties?.blocks, 'save_paper JSON schema exposes sections → blocks');
  const blockSchema = save.inputSchema.properties.sections.items.properties.blocks.items;
  ok(JSON.stringify(blockSchema.properties.type.enum) === JSON.stringify(['text', 'list', 'figure', 'table', 'equation', 'algorithm']), 'block type enum matches the contract');
  ok(!(save.inputSchema.required || []).includes('final') && !(save.inputSchema.properties.sections.items.required || []).includes('level'), 'defaulted fields are optional in the input schema');

  // ── paper A: SegResMamba (real) ────────────────────────────────────────
  console.log('--- paper A: SegResMamba (real paper) ---');
  const A = segresmambaPaper();
  const aBatches = chunkSections(A.sections, 20_000); // force several calls even for a short paper
  let r = await call(client, 'save_paper', { title: A.title, authors: A.authors, year: A.year, source: A.source, sections: aBatches[0] });
  ok(!r.isError && r.json?.ok, 'save_paper A ok', r.isError ? r.text.slice(0, 300) : `${r.json.section_count} sections, ${r.json.word_count} words`);
  const aId = r.json.paper_id;
  ok(/^[0-9a-f-]{36}$/.test(aId), 'A has a uuid');
  ok(r.json.url === `https://jameswigfield.com/portal/paper-rsvp/${aId}`, 'A url is the deep link', r.json.url);
  ok(r.json.status === 'uploading', 'A status uploading after first batch');
  let expected = r.json.next_expected_count;
  for (let i = 1; i < aBatches.length; i++) {
    r = await call(client, 'append_sections', { paper_id: aId, sections: aBatches[i], expected_count: expected, final: i === aBatches.length - 1 });
    ok(!r.isError, `append A batch ${i + 1}/${aBatches.length}`, r.isError ? r.text.slice(0, 300) : `→ ${r.json.section_count} sections`);
    expected = r.json?.next_expected_count;
  }
  ok(r.json?.status === 'complete' && r.json.section_count === A.sections.length, 'A complete with all sections', `${r.json?.section_count}/${A.sections.length}`);
  ok(r.json.appendix_word_count > 0 && r.json.main_word_count > r.json.appendix_word_count, 'A main/appendix word split', `${r.json.main_word_count} / ${r.json.appendix_word_count}`);

  // ── paper B: long synthetic, ~100 KB batches ───────────────────────────
  console.log('--- paper B: long synthetic paper, chunked ---');
  const B = longPaper();
  const bBatches = chunkSections(B.sections, 100_000);
  const totalKb = kb(B.sections);
  ok(totalKb >= 200, 'B is a realistic size', `${totalKb} KB across ${B.sections.length} sections, ${bBatches.length} batches of ${bBatches.map(kb).join('/')} KB`);
  const t0 = Date.now();
  r = await call(client, 'save_paper', { title: B.title, authors: B.authors, year: B.year, source: B.source, sections: bBatches[0] });
  ok(!r.isError && r.json?.ok, `save_paper B (${kb(bBatches[0])} KB)`, r.isError ? r.text.slice(0, 300) : `${r.json.section_count} sections`);
  const bId = r.json.paper_id;
  expected = r.json.next_expected_count;
  for (let i = 1; i < bBatches.length; i++) {
    r = await call(client, 'append_sections', { paper_id: bId, sections: bBatches[i], expected_count: expected, final: i === bBatches.length - 1 });
    ok(!r.isError && r.json.section_count === expected + bBatches[i].length, `append B batch ${i + 1}/${bBatches.length} (${kb(bBatches[i])} KB)`, r.isError ? r.text.slice(0, 300) : `→ ${r.json.section_count}`);
    expected = r.json?.next_expected_count;
  }
  console.log(`      B uploaded in ${Date.now() - t0} ms`);
  ok(r.json?.status === 'complete' && r.json.section_count === B.sections.length, 'B complete', `${r.json?.section_count}/${B.sections.length}, ${r.json?.word_count} words`);
  ok(r.json.word_count > 25000, 'B word count is paper-sized', String(r.json.word_count));

  // ── error paths ────────────────────────────────────────────────────────
  console.log('--- error paths ---');
  r = await call(client, 'append_sections', { paper_id: '00000000-0000-4000-8000-000000000000', sections: bBatches[1].slice(0, 1) });
  ok(r.isError && /Unknown paper_id/.test(r.json?.error) && /list_papers/.test(r.json?.hint), 'unknown paper_id → clear error + hint');
  r = await call(client, 'append_sections', { paper_id: 'not-an-id', sections: bBatches[1].slice(0, 1) });
  ok(r.isError && /not a paper id/.test(r.json?.error), 'malformed paper_id → clear error');

  const before = expected;
  r = await call(client, 'append_sections', { paper_id: bId, sections: bBatches[bBatches.length - 1], expected_count: before - bBatches[bBatches.length - 1].length });
  ok(r.isError && /does not match/.test(r.json?.error) && /already been saved/.test(r.json?.hint) && r.json.section_count === before, 'stale expected_count (a retried batch) → rejected, nothing duplicated', r.json?.error);

  r = await call(client, 'append_sections', { paper_id: bId, sections: [{ heading: 'X', level: 1, part: 'main', blocks: [{ type: 'text', text: '   ' }, { type: 'figure' }] }], expected_count: before });
  ok(r.isError && Array.isArray(r.json?.problems) && r.json.problems.length === 2 && /nothing was saved/i.test(r.json.error), 'invalid blocks → named problems, nothing saved', (r.json?.problems || []).join(' | '));

  const huge = [{ heading: 'Huge', level: 1, part: 'main', blocks: [{ type: 'text', text: 'word '.repeat(70_000) }] }];
  r = await call(client, 'append_sections', { paper_id: bId, sections: huge, expected_count: before });
  ok(r.isError && /limit is/.test(r.json?.error) && /Split/.test(r.json?.hint), 'oversized batch → limit error with advice', r.json?.error);

  r = await call(client, 'get_paper', { paper_id: bId });
  ok(!r.isError && r.json.outline.length === B.sections.length && r.json.outline.every((s, i) => s.position === i && s.heading === B.sections[i].heading), 'get_paper outline in order, positions 0..n-1');
  ok(r.json.next_expected_count === B.sections.length && r.json.last_heading === B.sections.at(-1).heading, 'get_paper reports where to resume');
  ok(!r.json.outline[0].blocks, 'get_paper outline omits blocks by default');
  r = await call(client, 'get_paper', { paper_id: bId, with_blocks: true });
  ok(!r.isError && r.json.outline[0].blocks?.length === B.sections[0].blocks.length, 'get_paper with_blocks returns blocks');

  r = await call(client, 'list_papers', {});
  ok(!r.isError && r.json.papers.length === 2 && r.json.papers.every((p) => p.status === 'complete' && p.url.includes('/portal/paper-rsvp/')), 'list_papers lists both, complete, with urls');

  r = await call(client, 'delete_paper', { paper_id: aId });
  ok(!r.isError && r.json.deleted_at && /Bin/.test(r.json.note), 'delete_paper is a soft delete (→ Bin)');
  r = await call(client, 'list_papers', {});
  ok(r.json.papers.length === 1 && r.json.papers[0].paper_id === bId, 'binned paper hidden from list_papers');
  r = await call(client, 'list_papers', { include_deleted: true });
  ok(r.json.papers.length === 2 && r.json.papers.some((p) => p.paper_id === aId && p.deleted_at), 'include_deleted shows the Bin');
  r = await call(client, 'append_sections', { paper_id: aId, sections: aBatches[0].slice(0, 1) });
  ok(r.isError && /Bin/.test(r.json?.error), 'append to a binned paper → refused with hint');
  r = await call(client, 'delete_paper', { paper_id: aId });
  ok(!r.isError && /Already in the Bin/.test(r.json?.note), 'second delete is idempotent');

  // Deck Studio unaffected
  r = await call(client, 'list_presentations', {});
  ok(!r.isError && /No decks yet/.test(r.text), 'Deck Studio list_presentations still works against the same DB');

  // stub state: rows really exist, in order, verbatim
  const state = await (await fetch(`${PGREST_URL}/__state`)).json();
  const bRows = state.paper_sections.filter((s) => s.paper_id === bId).sort((x, y) => x.position - y.position);
  ok(bRows.length === B.sections.length && bRows.every((row, i) => row.heading === B.sections[i].heading && row.part === B.sections[i].part && row.level === B.sections[i].level), 'stored rows match the fixture order / part / level');
  ok(bRows.every((row, i) => JSON.stringify(row.blocks.map((b) => b.type)) === JSON.stringify(B.sections[i].blocks.map((b) => b.type))), 'stored block sequences match');
  ok(state.papers.find((p) => p.id === bId).section_count === B.sections.length, 'cached section_count refreshed from rows');

  // ── site Worker API ────────────────────────────────────────────────────
  console.log('--- site Worker /api/papers ---');
  const api = (p, init = {}) => fetch(`${SITE_URL}/api/papers${p}`, { ...init, headers: { authorization: `Bearer ${PORTAL_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  let res = await fetch(`${SITE_URL}/api/papers`);
  ok(res.status === 401, 'GET /api/papers without the portal password → 401', String(res.status));
  res = await api('');
  let body = await res.json();
  ok(res.ok && body.data.length === 2 && body.data.find((p) => p.id === aId).deletedAt && !body.data.find((p) => p.id === bId).deletedAt, 'list includes both, binned one carries deletedAt');
  ok(body.data.find((p) => p.id === bId).wordCount > 25000 && body.data.find((p) => p.id === bId).appendixWordCount > 0, 'list rows carry counts');
  res = await api(`/${bId}`);
  body = await res.json();
  ok(res.ok && body.data.sections.length === B.sections.length && body.data.sections.every((s, i) => s.position === i && s.heading === B.sections[i].heading), 'GET one paper: sections in order');
  ok(JSON.stringify(body.data.sections[3].blocks) === JSON.stringify(B.sections[3].blocks), 'blocks round-trip verbatim (incl. key flags, table content, LaTeX)');
  res = await api(`/${bId}/progress`, { method: 'PATCH', body: JSON.stringify({ progress: { index: 1234, total: 40000, pct: 3.0851, wpm: 320, heading: '1 Introduction', finished: false, junk: 'x' } }) });
  body = await res.json();
  ok(res.ok && body.data.progress.index === 1234 && body.data.progress.pct === 3.1 && body.data.progress.updatedAt && body.data.progress.junk === undefined, 'PATCH progress cleans + stamps', JSON.stringify(body.data?.progress));
  res = await api('/00000000-0000-4000-8000-000000000000/progress', { method: 'PATCH', body: JSON.stringify({ progress: { index: 1 } }) });
  ok(res.status === 404, 'PATCH progress on unknown paper → 404', String(res.status));
  res = await api(`/${aId}/restore`, { method: 'POST' });
  body = await res.json();
  ok(res.ok && body.data.deletedAt === null, 'POST restore clears deletedAt');
  res = await api(`/${aId}`, { method: 'DELETE' });
  body = await res.json();
  ok(res.ok && body.data.deletedAt, 'DELETE (soft) sets deletedAt');
  // a throwaway paper for the hard delete
  r = await call(client, 'save_paper', { title: 'Throwaway', sections: aBatches[0].slice(0, 2), final: true });
  const cId = r.json.paper_id;
  res = await api(`/${cId}?permanent=1`, { method: 'DELETE' });
  ok(res.ok, 'DELETE ?permanent=1 ok');
  res = await api(`/${cId}`);
  ok(res.status === 404, 'hard-deleted paper is gone (404)', String(res.status));
  const after = await (await fetch(`${PGREST_URL}/__state`)).json();
  ok(!after.paper_sections.some((s) => s.paper_id === cId), 'hard delete cascaded to its sections');
  res = await api(`/${aId}/restore`, { method: 'POST' });
  ok(res.ok, 'A restored again for the browser run');

  await client.close();
  console.log(`\nPAPER_A=${aId}\nPAPER_B=${bId}`);
  console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(' | ')}` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
