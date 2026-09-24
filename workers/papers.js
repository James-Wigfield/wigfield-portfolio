/* ============================================================================
   RSVP PAPERS — server-side /api/papers routes (portal-password gated)
   ----------------------------------------------------------------------------
   The reader's access to the RLS-locked `papers` + `paper_sections` tables
   (see supabase/papers.sql). RLS is ON with NO policies, so the browser can't
   read them; the SECRET key used here bypasses RLS. Papers are WRITTEN by the
   portal MCP server (mcp-portal/src/papers.js); this layer only reads them,
   saves reading progress and manages the Bin.

     GET    /api/papers                 → { data: [paper…] }  (live AND binned; the
                                          client splits on deletedAt)
     GET    /api/papers/:id             → { data: paper + sections[] in order }
     PATCH  /api/papers/:id/progress    → body { progress } → { data: { id, progress } }
     POST   /api/papers/:id/restore     → clears deleted_at
     DELETE /api/papers/:id             → soft delete (sets deleted_at)
     DELETE /api/papers/:id?permanent=1 → hard delete (cascades to sections)

   Only the portal's own hard-delete is irreversible, and it sits behind the
   portal password — the open MCP endpoint can only soft-delete.
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';

const PAPER_COLS = 'id, title, authors, year, source, status, section_count, word_count, main_word_count, appendix_word_count, progress, created_at, updated_at, deleted_at';
const SECTION_COLS = 'position, heading, level, part, blocks, word_count';

export async function handlePapersApi(request, env, url, { requirePortalAuth, json, readJson }) {
  const denied = requirePortalAuth(request, env);
  if (denied) return denied;

  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return json({ error: 'Supabase isn’t configured on the Worker (SUPABASE_URL / SUPABASE_SECRET_KEY).' }, 503);
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

  const parts = url.pathname.split('/').filter(Boolean); // ['api','papers', id?, action?]
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;
  const action = parts[3] || null;

  // ── Collection ───────────────────────────────────────────────────────────
  if (!id) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const { data, error } = await db.from('papers').select(PAPER_COLS).order('updated_at', { ascending: false });
    return error ? json({ error: error.message }, 500) : json({ data: data.map(mapPaperRow) });
  }

  if (!isUuid(id)) return json({ error: 'Not a paper id' }, 400);

  // ── Item actions ─────────────────────────────────────────────────────────
  if (action === 'progress') {
    if (request.method !== 'PATCH' && request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
    const body = await readJson(request);
    const progress = body?.progress;
    if (!progress || typeof progress !== 'object') return json({ error: 'body.progress is required' }, 400);
    const clean = cleanProgress(progress);
    const { data, error } = await db.from('papers').update({ progress: clean }).eq('id', id).select('id, progress').single();
    if (error) return json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    return json({ data });
  }

  if (action === 'restore') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const { data, error } = await db.from('papers').update({ deleted_at: null }).eq('id', id).select(PAPER_COLS).single();
    if (error) return json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    return json({ data: mapPaperRow(data) });
  }

  if (action) return json({ error: 'Not found' }, 404);

  // ── Item ─────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const { data: paper, error } = await db.from('papers').select(PAPER_COLS).eq('id', id).single();
    if (error) return json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    const secs = await db.from('paper_sections').select(SECTION_COLS).eq('paper_id', id).order('position', { ascending: true });
    if (secs.error) return json({ error: secs.error.message }, 500);
    return json({ data: { ...mapPaperRow(paper), sections: secs.data.map(mapSectionRow) } });
  }

  if (request.method === 'DELETE') {
    const permanent = url.searchParams.get('permanent') === '1';
    if (permanent) {
      const { error } = await db.from('papers').delete().eq('id', id);
      return error ? json({ error: error.message }, 500) : json({ data: { id, permanent: true } });
    }
    const { data, error } = await db.from('papers').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id, deleted_at').single();
    if (error) return json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    return json({ data: { id: data.id, deletedAt: data.deleted_at } });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ── helpers ──────────────────────────────────────────────────────────────────
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function mapPaperRow(r) {
  return {
    id: r.id,
    title: r.title,
    authors: Array.isArray(r.authors) ? r.authors : [],
    year: r.year,
    source: r.source,
    status: r.status,
    sectionCount: r.section_count,
    wordCount: r.word_count,
    mainWordCount: r.main_word_count,
    appendixWordCount: r.appendix_word_count,
    progress: r.progress || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function mapSectionRow(r) {
  return {
    position: r.position,
    heading: r.heading,
    level: r.level,
    part: r.part,
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    wordCount: r.word_count,
  };
}

// Only keep the fields the reader writes, with sane types — the column is
// jsonb, so this is the one place its shape is enforced.
function cleanProgress(p) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    index: Math.max(0, Math.floor(num(p.index))),
    total: Math.max(0, Math.floor(num(p.total))),
    pct: Math.min(100, Math.max(0, Math.round(num(p.pct) * 10) / 10)),
    wpm: Math.min(3000, Math.max(50, Math.round(num(p.wpm)) || 300)),
    heading: typeof p.heading === 'string' ? p.heading.slice(0, 200) : '',
    finished: Boolean(p.finished),
    updatedAt: new Date().toISOString(),
  };
}
