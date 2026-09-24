/* ============================================================================
   PORTAL MCP — RSVP PAPERS (research-paper speed-reader) tools
   ----------------------------------------------------------------------------
   The chat-side Claude is the PDF parser: it reads a paper, extracts clean text
   in true reading order, structures it into sections/blocks and calls these
   tools to save it. The portal never parses a PDF — it only ever receives the
   clean, ordered text stored here and plays it back word-by-word.

   Storage (see ../../supabase/papers.sql): one `papers` row + one
   `paper_sections` row per section, ordered by `position`. A long paper
   arrives in several calls: `save_paper` (metadata + first batch), then
   `append_sections` for each further batch. Each append is ONE bulk insert, so
   a batch either lands whole or not at all; `unique (paper_id, position)`
   makes any ordering clash a loud error rather than a silent reorder.

   Robustness contract for the chat Claude (the tool results drive it):
     • every write returns { section_count, word_count, status, last_heading,
       next_expected_count } so the next call can chain on it;
     • `expected_count` (optional, recommended) rejects a duplicate batch when
       a call timed out client-side but was actually applied;
     • `final: true` marks the upload complete; until then the paper shows as
       "uploading" in the portal library (and is still readable).

   Auth: the MCP endpoint is authless (claude.ai custom connectors can't send
   a static bearer token), so `delete_paper` is a SOFT delete — it only sets
   `deleted_at`; the portal's Bin can restore or purge. Nothing here can
   destroy data irreversibly.
   ========================================================================== */

import { z } from 'zod';

// ── Limits ───────────────────────────────────────────────────────────────────
// A whole paper is ~200–300 KB; the practical per-call ceiling is what the chat
// model can emit in one tool call, so we ask for ~100 KB batches and only hard
// -reject clearly oversized ones. The per-paper caps stop an open endpoint
// from being used as a dumping ground.
export const LIMITS = {
  recommendedBatchBytes: 100_000,
  maxBatchBytes: 300_000,
  maxSectionsPerCall: 250,
  maxSectionsPerPaper: 800,
  maxPaperBytes: 6_000_000,
};

export const PORTAL_TOOL_ID = 'paper-rsvp';

// ── Schemas (the fixed contract) ─────────────────────────────────────────────
export const BLOCK = z.object({
  type: z
    .enum(['text', 'list', 'figure', 'table', 'equation', 'algorithm'])
    .describe('text = a paragraph (or one emphasised sentence); list = bullets; figure/table/equation/algorithm = a float shown as a pause card with its caption.'),
  text: z.string().optional().describe('type=text: the clean paragraph text.'),
  key: z.boolean().optional().describe('type=text: true when the paper emphasises this sentence (bolded key finding). It is slowed down and highlighted in the reader.'),
  items: z.array(z.string()).optional().describe('type=list: each bullet as a full sentence.'),
  label: z.string().optional().describe('Floats: the label as printed, e.g. "Figure 2", "Table 1", "Eq. 4", "Algorithm 2".'),
  caption: z.string().optional().describe('Floats: a one-to-three sentence plain-English summary of what it shows / the key finding. This is what the reader shows on the pause card.'),
  content: z.string().optional().describe('Floats, optional detail behind an expander: table → the full table as a markdown table; equation → LaTeX (no $ delimiters); algorithm → the pseudocode as plain text (one step per line); figure → omit.'),
});

export const SECTION = z.object({
  heading: z.string().describe('The heading as printed, including its number, e.g. "3.3.1 Motivation of Prior Models" or "Abstract".'),
  level: z.number().int().min(1).max(3).default(1).describe('Heading depth 1–3 ("3" = 1, "3.3" = 2, "3.3.1" = 3). Abstract / Introduction / Conclusion are level 1.'),
  part: z.enum(['main', 'appendix']).default('main').describe('"appendix" for every appendix / supplementary section. References are never sent.'),
  blocks: z.array(BLOCK).describe('The section body in reading order.'),
});

// Field docs shared by save_paper and append_sections.
const SECTIONS_ARG = z.array(SECTION).min(1).max(LIMITS.maxSectionsPerCall)
  .describe(`Sections in reading order. Keep each call under ~${Math.round(LIMITS.recommendedBatchBytes / 1000)} KB of JSON (roughly 8–15 sections); send the rest with append_sections.`);

// ── Tool descriptions ────────────────────────────────────────────────────────
// The chat Claude only knows the format and the cleaning rules from these.
const CLEANING_RULES = `
CLEANING CONVENTIONS (apply all of them before sending):
• Follow TRUE READING ORDER, whatever the layout. Check each page's layout — single-column, two-column and mixed pages can all appear in one paper. In multi-column layouts finish each column before starting the next; never interleave lines across columns. Place floats that span columns (figures, tables, equations, algorithms) where the text FIRST refers to them, not where they sit on the page. Rejoin sentences and paragraphs split across columns or pages.
• Strip ALL citations, both "[12]" and "(Author et al., 2023)" styles, and fix the sentence around them.
• Drop affiliations, emails, footnote markers, arXiv stamps, page numbers, running headers, line numbers and the References list.
• Fix hyphenation across line breaks ("seg-\\nmentation" → "segmentation").
• Write inline math as short readable Unicode, e.g. "O(BLDN)", "Δ", "2^20", "x ∈ ℝ^d", "≈ 0.93" — never raw LaTeX in text blocks.
• Summarise every figure, table, equation and algorithm in a caption (plain English, what it shows and the takeaway). Optionally attach the detail in "content": tables as markdown, equations as LaTeX, algorithms as plain-text pseudocode.
• Tag every appendix section with "part": "appendix". Keep main-body sections as "main".
• Mark bolded / emphasised key findings as their own text block with "key": true.
• Headings carry their printed numbering; "level" is the depth (1–3). Bulleted lists become a "list" block with one item per bullet.`;

const SCHEMA_DOC = `
PAYLOAD SHAPE (one section):
{ "heading": "3.3.1 Motivation of Prior Models", "level": 3, "part": "main",
  "blocks": [
    { "type": "text", "text": "Clean paragraph text.", "key": false },
    { "type": "list", "items": ["First bullet as a sentence.", "Second bullet."] },
    { "type": "figure", "label": "Figure 2", "caption": "What the figure shows." },
    { "type": "table", "label": "Table 1", "caption": "The key finding.", "content": "| Model | Dice |\\n|---|---|\\n| Ours | 0.84 |" },
    { "type": "equation", "label": "Eq. 4", "caption": "Plain-English description.", "content": "h_t = A h_{t-1} + B x_t" },
    { "type": "algorithm", "label": "Algorithm 2", "caption": "Plain-English summary.", "content": "1: for each step t do\\n2:   …" }
  ] }`;

const WORKFLOW_DOC = `
CHUNKED WORKFLOW (papers are 200–300 KB; one call cannot carry that):
1. save_paper with the metadata + the FIRST batch of sections (≈ ${Math.round(LIMITS.recommendedBatchBytes / 1000)} KB of JSON). It returns paper_id, the portal url, section_count and next_expected_count.
2. append_sections for each further batch, in order, passing paper_id and expected_count = the section_count returned by the previous call. Never re-send a batch that was reported saved.
3. On the LAST batch pass final: true (or set final: true on save_paper if the whole paper fits in one call).
4. Reply to the user with the returned url. If a call fails, read the error: unknown paper_id → list_papers; expected_count mismatch → the batch probably already landed, call get_paper for the outline and continue from there.`;

export const SAVE_PAPER_DESCRIPTION =
  'Save a research paper to the portal\'s RSVP speed-reader (Personal → RSVP Papers) and return its portal URL. ' +
  'You are the parser: read the PDF, extract clean text in true reading order, structure it into sections and blocks, and send it here — no PDF parsing happens on the site. ' +
  'This call creates the paper with the FIRST batch of sections; send the rest with append_sections.' +
  WORKFLOW_DOC + SCHEMA_DOC + CLEANING_RULES;

export const APPEND_SECTIONS_DESCRIPTION =
  'Append the next batch of sections (in order) to a paper created with save_paper. Same section/block shape and cleaning conventions as save_paper. ' +
  `Keep each call under ~${Math.round(LIMITS.recommendedBatchBytes / 1000)} KB. Pass expected_count = the section_count returned by the previous call so a retried batch is never saved twice; ` +
  'pass final: true with the last batch to mark the paper complete. The result reports section_count, word_count, last_heading and next_expected_count.';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }], isError: true });

export const countWords = (s) => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0);

const byteLength = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

// Words the reader will actually play for a section: paragraphs, bullets and
// float captions. `content` is detail behind an expander, so it isn't counted.
export function sectionWordCount(section) {
  let n = 0;
  for (const b of section.blocks) {
    if (b.type === 'text') n += countWords(b.text);
    else if (b.type === 'list') n += (b.items || []).reduce((a, it) => a + countWords(it), 0);
    else n += countWords(b.caption) || countWords(b.label);
  }
  return n;
}

// Validate the semantics zod can't express (a text block needs text, …) and
// tidy strings. Returns { rows, problems } — `problems` name the exact section
// and block so the chat Claude can fix its payload.
export function normalizeSections(sections) {
  const rows = [];
  const problems = [];
  sections.forEach((s, si) => {
    const heading = String(s.heading ?? '').trim();
    const where = `sections[${si}] "${heading.slice(0, 60)}"`;
    if (!heading) problems.push(`${where}: heading is empty`);
    const level = Math.min(3, Math.max(1, Math.round(Number(s.level) || 1)));
    const part = s.part === 'appendix' ? 'appendix' : 'main';
    const blocks = [];
    (s.blocks || []).forEach((b, bi) => {
      const at = `${where} blocks[${bi}] (${b.type})`;
      const clean = { type: b.type };
      switch (b.type) {
        case 'text': {
          const text = String(b.text ?? '').trim();
          if (!text) { problems.push(`${at}: "text" is empty`); return; }
          clean.text = text;
          if (b.key) clean.key = true;
          break;
        }
        case 'list': {
          const items = (b.items || []).map((it) => String(it ?? '').trim()).filter(Boolean);
          if (!items.length) { problems.push(`${at}: "items" is empty`); return; }
          clean.items = items;
          break;
        }
        default: {
          const label = String(b.label ?? '').trim();
          const caption = String(b.caption ?? '').trim();
          if (!label && !caption) { problems.push(`${at}: needs a "label" or a "caption"`); return; }
          if (label) clean.label = label;
          if (caption) clean.caption = caption;
          const content = typeof b.content === 'string' ? b.content.replace(/\s+$/, '') : '';
          if (content.trim()) clean.content = content;
        }
      }
      blocks.push(clean);
    });
    const row = { heading, level, part, blocks };
    row.word_count = sectionWordCount(row);
    rows.push(row);
  });
  return { rows, problems };
}

function checkBatch(sections) {
  const bytes = byteLength(sections);
  if (bytes > LIMITS.maxBatchBytes) {
    return fail({
      error: `This batch is ${Math.round(bytes / 1000)} KB of JSON; the limit is ${Math.round(LIMITS.maxBatchBytes / 1000)} KB.`,
      hint: `Split it into batches of about ${Math.round(LIMITS.recommendedBatchBytes / 1000)} KB and send them in order with append_sections.`,
      batch_bytes: bytes,
    });
  }
  const { rows, problems } = normalizeSections(sections);
  if (problems.length) {
    return fail({ error: 'Some blocks are invalid — nothing was saved.', problems: problems.slice(0, 20), hint: 'Fix the listed blocks and resend this batch only.' });
  }
  return { rows, bytes };
}

const paperUrl = (portalUrl, id) => `${portalUrl.replace(/\/$/, '')}/portal/${PORTAL_TOOL_ID}/${id}`;

// Recompute the cached counts from the real rows (self-healing: the cache can
// never drift from what the reader will actually load).
async function refreshCounts(db, paperId, { final } = {}) {
  const { data: rows, error } = await db
    .from('paper_sections')
    .select('position, part, word_count, heading, blocks')
    .eq('paper_id', paperId)
    .order('position', { ascending: true });
  if (error) return { error };
  let main = 0, appendix = 0, bytes = 0;
  for (const r of rows) {
    if (r.part === 'appendix') appendix += r.word_count; else main += r.word_count;
    bytes += byteLength(r.blocks);
  }
  const patch = {
    section_count: rows.length,
    word_count: main + appendix,
    main_word_count: main,
    appendix_word_count: appendix,
  };
  if (final !== undefined) patch.status = final ? 'complete' : 'uploading';
  const upd = await db.from('papers').update(patch).eq('id', paperId).select('status').single();
  if (upd.error) return { error: upd.error };
  return {
    ...patch,
    status: upd.data.status,
    last_heading: rows.length ? rows[rows.length - 1].heading : null,
    stored_bytes: bytes,
  };
}

function summary(paper, counts, portalUrl, extra = {}) {
  return {
    ok: true,
    paper_id: paper.id,
    title: paper.title,
    url: paperUrl(portalUrl, paper.id),
    status: counts.status,
    section_count: counts.section_count,
    word_count: counts.word_count,
    main_word_count: counts.main_word_count,
    appendix_word_count: counts.appendix_word_count,
    last_heading: counts.last_heading,
    next_expected_count: counts.section_count,
    ...extra,
    next: counts.status === 'complete'
      ? 'Upload complete. Give the user the url.'
      : `Send the next batch with append_sections(paper_id, sections, expected_count=${counts.section_count}); pass final=true on the last one.`,
  };
}

// Insert a batch at positions start..start+n-1. Returns { error } on failure.
async function insertBatch(db, paperId, rows, start) {
  const payload = rows.map((r, i) => ({
    paper_id: paperId,
    position: start + i,
    heading: r.heading,
    level: r.level,
    part: r.part,
    blocks: r.blocks,
    word_count: r.word_count,
  }));
  const { error } = await db.from('paper_sections').insert(payload);
  return { error };
}

async function loadPaper(db, id) {
  const { data, error } = await db
    .from('papers')
    .select('id, title, status, section_count, word_count, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return { error };
  return { paper: data };
}

async function countSections(db, paperId) {
  const { count, error } = await db
    .from('paper_sections')
    .select('id', { count: 'exact', head: true })
    .eq('paper_id', paperId);
  return error ? { error } : { count: count ?? 0 };
}

const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

// ── Registration ─────────────────────────────────────────────────────────────
// `ctx.db()` returns a fresh Supabase client (secret key); `ctx.portalUrl` is
// the site origin used to build the paper's deep link.
export function registerPaperTools(server, ctx) {
  const portalUrl = ctx.portalUrl || 'https://jameswigfield.com';

  // ── save_paper ─────────────────────────────────────────────────────────
  server.registerTool(
    'save_paper',
    {
      title: 'Save a paper to the RSVP reader',
      description: SAVE_PAPER_DESCRIPTION,
      inputSchema: {
        title: z.string().min(1).describe('Paper title as printed.'),
        authors: z.array(z.string()).default([]).describe('Author names in order, e.g. ["Albert Gu", "Tri Dao"]. No affiliations or emails.'),
        year: z.number().int().min(1900).max(2100).optional().describe('Publication year.'),
        source: z.string().optional().describe('DOI or URL, if known.'),
        sections: SECTIONS_ARG,
        final: z.boolean().default(false).describe('true only if this single call carries the WHOLE paper.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, authors, year, source, sections, final }) => {
      const checked = checkBatch(sections);
      if (checked.isError) return checked;
      const db = ctx.db();

      const ins = await db
        .from('papers')
        .insert({
          title: title.trim(),
          authors: (authors || []).map((a) => String(a).trim()).filter(Boolean),
          year: year ?? null,
          source: source?.trim() || null,
          status: 'uploading',
          created_by: 'claude',
        })
        .select('id, title, status')
        .single();
      if (ins.error) return fail({ error: `Could not create the paper: ${ins.error.message}` });
      const paper = ins.data;

      const batch = await insertBatch(db, paper.id, checked.rows, 0);
      if (batch.error) {
        // Leave nothing half-made: a paper with no sections is just noise.
        await db.from('papers').delete().eq('id', paper.id);
        return fail({ error: `Could not save the first batch of sections: ${batch.error.message}`, hint: 'Nothing was created. Fix the payload and call save_paper again.' });
      }

      const counts = await refreshCounts(db, paper.id, { final: Boolean(final) });
      if (counts.error) return fail({ error: `Sections saved but the paper summary failed to update: ${counts.error.message}`, paper_id: paper.id, hint: 'Call get_paper to confirm the state before continuing.' });

      return ok(summary(paper, counts, portalUrl, { batch_bytes: checked.bytes, sections_saved: checked.rows.length }));
    },
  );

  // ── append_sections ────────────────────────────────────────────────────
  server.registerTool(
    'append_sections',
    {
      title: 'Append sections to a paper',
      description: APPEND_SECTIONS_DESCRIPTION,
      inputSchema: {
        paper_id: z.string().describe('The paper_id returned by save_paper.'),
        sections: SECTIONS_ARG,
        expected_count: z.number().int().min(0).optional().describe('RECOMMENDED: the section_count returned by the previous call. If the paper already has a different number of sections the batch is rejected (it probably already landed).'),
        final: z.boolean().default(false).describe('true on the last batch — marks the paper complete.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ paper_id, sections, expected_count, final }) => {
      if (!isUuid(paper_id)) return fail({ error: `"${paper_id}" is not a paper id.`, hint: 'Use the paper_id returned by save_paper, or call list_papers.' });
      const checked = checkBatch(sections);
      if (checked.isError) return checked;
      const db = ctx.db();

      const { paper, error: loadErr } = await loadPaper(db, paper_id);
      if (loadErr) return fail({ error: `Could not load the paper: ${loadErr.message}` });
      if (!paper) return fail({ error: `Unknown paper_id ${paper_id}.`, hint: 'Call list_papers to find the right id, or save_paper to start a new paper.' });
      if (paper.deleted_at) return fail({ error: `Paper "${paper.title}" is in the portal Bin (deleted ${paper.deleted_at}).`, hint: 'Restore it from the portal library first, or save it again with save_paper.' });

      const counted = await countSections(db, paper_id);
      if (counted.error) return fail({ error: `Could not count the existing sections: ${counted.error.message}` });
      const current = counted.count;

      if (expected_count !== undefined && expected_count !== current) {
        const counts = await refreshCounts(db, paper_id);
        return fail({
          error: `expected_count ${expected_count} does not match: "${paper.title}" currently has ${current} sections.`,
          section_count: current,
          last_heading: counts.last_heading ?? null,
          hint: current > expected_count
            ? 'This batch (or a previous one) has probably already been saved — do NOT resend it. Call get_paper for the outline and continue from the first heading that is missing.'
            : 'Fewer sections than you expected are stored. Call get_paper for the outline, then resend from the first missing section with expected_count set to the current count.',
        });
      }

      if (current + checked.rows.length > LIMITS.maxSectionsPerPaper) {
        return fail({ error: `This would take the paper to ${current + checked.rows.length} sections; the limit is ${LIMITS.maxSectionsPerPaper}.`, hint: 'Merge small sub-sections into their parent section.' });
      }
      if ((paper.word_count || 0) > 0 && paper.word_count * 8 + checked.bytes > LIMITS.maxPaperBytes) {
        return fail({ error: 'This paper has reached the storage limit.', hint: 'Trim the appendix detail (content fields) or split the paper.' });
      }

      const batch = await insertBatch(db, paper_id, checked.rows, current);
      if (batch.error) {
        const clash = /duplicate key|23505|unique/i.test(batch.error.message || '') || batch.error.code === '23505';
        return fail({
          error: clash
            ? 'Position clash: another append landed on this paper at the same time. Nothing from this batch was saved.'
            : `Could not save this batch: ${batch.error.message}. Nothing from this batch was saved.`,
          hint: 'Call get_paper for the current outline, then resend from the first missing section with expected_count set to the current count.',
        });
      }

      const counts = await refreshCounts(db, paper_id, { final: Boolean(final) });
      if (counts.error) return fail({ error: `Batch saved but the paper summary failed to update: ${counts.error.message}`, paper_id, hint: 'Call get_paper to confirm the state before continuing.' });

      return ok(summary(paper, counts, portalUrl, { batch_bytes: checked.bytes, sections_saved: checked.rows.length }));
    },
  );

  // ── list_papers ────────────────────────────────────────────────────────
  server.registerTool(
    'list_papers',
    {
      title: 'List saved papers',
      description: 'List the papers in the portal RSVP reader (newest first) with their ids, status (uploading/complete), section and word counts, reading progress and portal url. Pass include_deleted to also see papers in the Bin.',
      inputSchema: {
        include_deleted: z.boolean().default(false).describe('Also list soft-deleted papers (the portal Bin).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_deleted }) => {
      let q = ctx.db()
        .from('papers')
        .select('id, title, authors, year, status, section_count, word_count, main_word_count, appendix_word_count, progress, updated_at, deleted_at')
        .order('updated_at', { ascending: false });
      if (!include_deleted) q = q.is('deleted_at', null);
      const { data, error } = await q;
      if (error) return fail({ error: error.message });
      if (!data.length) return ok({ papers: [], note: 'No papers yet. Use save_paper to add one.' });
      return ok({
        papers: data.map((p) => ({
          paper_id: p.id,
          title: p.title,
          authors: p.authors,
          year: p.year,
          status: p.status,
          section_count: p.section_count,
          word_count: p.word_count,
          main_word_count: p.main_word_count,
          appendix_word_count: p.appendix_word_count,
          progress_pct: p.progress?.pct ?? 0,
          updated_at: p.updated_at,
          deleted_at: p.deleted_at,
          url: paperUrl(portalUrl, p.id),
        })),
      });
    },
  );

  // ── get_paper ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_paper',
    {
      title: 'Get a paper\'s outline',
      description: 'Fetch one paper\'s metadata and its section outline (position, heading, level, part, word_count) — use it to resume an interrupted upload (continue after the last heading listed) or to check what was saved. Pass with_blocks to include the full block content.',
      inputSchema: {
        paper_id: z.string().describe('The paper id.'),
        with_blocks: z.boolean().default(false).describe('Include each section\'s blocks (large).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ paper_id, with_blocks }) => {
      if (!isUuid(paper_id)) return fail({ error: `"${paper_id}" is not a paper id.` });
      const db = ctx.db();
      const { data: paper, error } = await db.from('papers').select('*').eq('id', paper_id).maybeSingle();
      if (error) return fail({ error: error.message });
      if (!paper) return fail({ error: `Unknown paper_id ${paper_id}.`, hint: 'Call list_papers.' });
      const cols = `position, heading, level, part, word_count${with_blocks ? ', blocks' : ''}`;
      const secs = await db.from('paper_sections').select(cols).eq('paper_id', paper_id).order('position', { ascending: true });
      if (secs.error) return fail({ error: secs.error.message });
      return ok({
        paper_id: paper.id,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        source: paper.source,
        status: paper.status,
        deleted_at: paper.deleted_at,
        url: paperUrl(portalUrl, paper.id),
        section_count: secs.data.length,
        word_count: paper.word_count,
        next_expected_count: secs.data.length,
        last_heading: secs.data.length ? secs.data[secs.data.length - 1].heading : null,
        progress: paper.progress,
        outline: secs.data,
      });
    },
  );

  // ── delete_paper (soft) ────────────────────────────────────────────────
  server.registerTool(
    'delete_paper',
    {
      title: 'Move a paper to the Bin',
      description: 'Soft-delete a paper: it disappears from the reader library into the portal\'s Bin, where it can be restored or permanently deleted. Nothing is destroyed by this call.',
      inputSchema: { paper_id: z.string().describe('The paper id (see list_papers).') },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ paper_id }) => {
      if (!isUuid(paper_id)) return fail({ error: `"${paper_id}" is not a paper id.` });
      const db = ctx.db();
      const { paper, error } = await loadPaper(db, paper_id);
      if (error) return fail({ error: error.message });
      if (!paper) return fail({ error: `Unknown paper_id ${paper_id}.` });
      if (paper.deleted_at) return ok({ ok: true, paper_id, title: paper.title, note: `Already in the Bin since ${paper.deleted_at}.` });
      const upd = await db.from('papers').update({ deleted_at: new Date().toISOString() }).eq('id', paper_id).select('deleted_at').single();
      if (upd.error) return fail({ error: upd.error.message });
      return ok({ ok: true, paper_id, title: paper.title, deleted_at: upd.data.deleted_at, note: 'Moved to the portal Bin. It can be restored or permanently deleted from the RSVP Papers library.' });
    },
  );
}
