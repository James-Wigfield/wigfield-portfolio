/* ============================================================================
   RSVP PAPERS — a tiny in-memory PostgREST stand-in for local end-to-end runs
   ----------------------------------------------------------------------------
   Both Workers talk to Supabase through supabase-js, which is just PostgREST
   over HTTP. Pointing SUPABASE_URL at this server lets the whole MCP → DB →
   Worker → browser path run locally WITHOUT touching the live project (the
   brief: no SQL against live Supabase). It implements exactly the subset the
   portal code uses:

     GET/HEAD  /rest/v1/<table>?select=…&<col>=eq.<v>&<col>=is.null&order=<col>.asc|desc&limit=n
     POST      /rest/v1/<table>              (object or array; Prefer: return=representation)
     PATCH     /rest/v1/<table>?<filters>    (Prefer: return=representation)
     DELETE    /rest/v1/<table>?<filters>
     Accept: application/vnd.pgrst.object+json → single-object semantics (PGRST116 on 0/2+ rows)
     Prefer: count=exact → Content-Range: 0-N/N

   Plus the schema rules that matter for the tests: uuid/bigserial ids,
   defaults, `unique (paper_id, position)` → 23505, FK paper_id → 23503,
   ON DELETE CASCADE, and the updated_at touch trigger.

     node tools/rsvp/pgrest-stub.mjs           # port 8790 (PGREST_PORT to change)
     GET  /__state   → dump tables    POST /__reset → wipe
   ========================================================================== */
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PGREST_PORT || 8790);
const QUIET = process.env.PGREST_QUIET === '1';

const tables = { papers: [], paper_sections: [], presentations: [] };
let serial = 1;

const now = () => new Date().toISOString();

const DEFAULTS = {
  papers: () => ({ id: randomUUID(), title: null, authors: [], year: null, source: null, status: 'uploading', section_count: 0, word_count: 0, main_word_count: 0, appendix_word_count: 0, progress: null, created_by: 'claude', created_at: now(), updated_at: now(), deleted_at: null }),
  paper_sections: () => ({ id: serial++, paper_id: null, position: null, heading: '', level: 1, part: 'main', blocks: [], word_count: 0, created_at: now() }),
  presentations: () => ({ id: randomUUID(), title: null, date_label: null, deck: null, created_by: 'claude', created_at: now(), updated_at: now() }),
};

function pgError(res, status, code, message, details = '') {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code, message, details, hint: null }));
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(\w+)\.(.*)$/s.exec(v);
    if (!m) continue;
    const [, op, raw] = m;
    out = out.filter((r) => {
      const cell = r[k];
      switch (op) {
        case 'eq': return String(cell) === raw;
        case 'neq': return String(cell) !== raw;
        case 'is': return raw === 'null' ? cell == null : raw === 'true' ? cell === true : raw === 'false' ? cell === false : false;
        case 'in': return raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).includes(String(cell));
        case 'gt': return Number(cell) > Number(raw);
        case 'gte': return Number(cell) >= Number(raw);
        case 'lt': return Number(cell) < Number(raw);
        case 'lte': return Number(cell) <= Number(raw);
        default: return true;
      }
    });
  }
  return out;
}

function applyOrder(rows, params) {
  const order = params.get('order');
  if (!order) return rows;
  const keys = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' }; });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = a[col]; const y = b[col];
      if (x === y) continue;
      const cmp = x == null ? 1 : y == null ? -1 : x < y ? -1 : 1;
      return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function project(rows, select) {
  if (!select || select === '*') return rows;
  const cols = select.split(',').map((s) => s.trim()).filter(Boolean);
  if (cols.includes('*')) return rows;
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (d) => { s += d; });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : null); } catch { resolve(null); } });
  });
}

function validateInsert(table, row, res) {
  if (table === 'paper_sections') {
    if (!tables.papers.some((p) => p.id === row.paper_id)) {
      pgError(res, 409, '23503', 'insert or update on table "paper_sections" violates foreign key constraint "paper_sections_paper_id_fkey"');
      return false;
    }
    if (tables.paper_sections.some((s) => s.paper_id === row.paper_id && s.position === row.position)) {
      pgError(res, 409, '23505', 'duplicate key value violates unique constraint "paper_sections_paper_id_position_key"', `Key (paper_id, position)=(${row.paper_id}, ${row.position}) already exists.`);
      return false;
    }
    if (!(row.level >= 1 && row.level <= 3)) { pgError(res, 400, '23514', 'new row violates check constraint "paper_sections_level_check"'); return false; }
    if (!['main', 'appendix'].includes(row.part)) { pgError(res, 400, '23514', 'new row violates check constraint "paper_sections_part_check"'); return false; }
  }
  if (table === 'papers') {
    if (!row.title) { pgError(res, 400, '23502', 'null value in column "title" violates not-null constraint'); return false; }
    if (!['uploading', 'complete'].includes(row.status)) { pgError(res, 400, '23514', 'new row violates check constraint "papers_status_check"'); return false; }
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const t0 = Date.now();
  const done = (status) => { if (!QUIET) console.error(`${req.method.padEnd(6)} ${url.pathname}${url.search.slice(0, 80)} → ${status} (${Date.now() - t0}ms)`); };

  if (url.pathname === '/__state') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(tables)); return done(200); }
  if (url.pathname === '/__reset') { for (const k of Object.keys(tables)) tables[k] = []; serial = 1; res.writeHead(204); res.end(); return done(204); }

  const m = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
  if (!m) { pgError(res, 404, 'PGRST000', 'not found'); return done(404); }
  const table = m[1];
  if (!tables[table]) { pgError(res, 404, 'PGRST205', `Could not find the table 'public.${table}' in the schema cache`); return done(404); }

  const params = url.searchParams;
  const prefer = String(req.headers.prefer || '');
  const wantObject = String(req.headers.accept || '').includes('application/vnd.pgrst.object+json');
  const wantRepr = /return=representation/.test(prefer);
  const wantCount = /count=exact/.test(prefer);

  const respondRows = (rows, status = 200, total = null) => {
    const projected = project(rows, params.get('select'));
    const headers = { 'content-type': 'application/json' };
    if (wantCount) headers['content-range'] = projected.length ? `0-${projected.length - 1}/${total ?? projected.length}` : `*/${total ?? 0}`;
    if (wantObject) {
      if (projected.length !== 1) {
        headers['content-type'] = 'application/json';
        res.writeHead(406, headers);
        res.end(JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${projected.length} rows`, hint: null }));
        return done(406);
      }
      res.writeHead(status, headers);
      res.end(JSON.stringify(projected[0]));
      return done(status);
    }
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(projected));
    return done(status);
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = applyOrder(applyFilters(tables[table], params), params);
    const total = rows.length;
    const offset = Number(params.get('offset') || 0);
    const limit = params.get('limit') ? Number(params.get('limit')) : null;
    if (offset) rows = rows.slice(offset);
    if (limit != null) rows = rows.slice(0, limit);
    return respondRows(rows, 200, total);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (body == null) { pgError(res, 400, 'PGRST102', 'Empty or invalid json'); return done(400); }
    const list = Array.isArray(body) ? body : [body];
    const created = [];
    for (const input of list) {
      const row = { ...DEFAULTS[table](), ...input };
      if (!validateInsert(table, row, res)) return done(res.statusCode);
      created.push(row);
    }
    tables[table].push(...created);           // all-or-nothing, like one INSERT statement
    if (wantRepr) return respondRows(created, 201);
    res.writeHead(201, wantCount ? { 'content-range': `*/${created.length}` } : {});
    res.end();
    return done(201);
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req);
    if (body == null) { pgError(res, 400, 'PGRST102', 'Empty or invalid json'); return done(400); }
    const rows = applyFilters(tables[table], params);
    for (const r of rows) {
      Object.assign(r, body);
      if (table !== 'paper_sections') r.updated_at = now(); // the touch trigger
    }
    if (wantRepr) return respondRows(rows, 200);
    res.writeHead(204); res.end(); return done(204);
  }

  if (req.method === 'DELETE') {
    const rows = applyFilters(tables[table], params);
    const ids = new Set(rows.map((r) => r.id));
    tables[table] = tables[table].filter((r) => !ids.has(r.id));
    if (table === 'papers') tables.paper_sections = tables.paper_sections.filter((s) => !ids.has(s.paper_id)); // cascade
    if (wantRepr) return respondRows(rows, 200);
    res.writeHead(204); res.end(); return done(204);
  }

  pgError(res, 405, 'PGRST000', 'method not allowed');
  return done(405);
});

server.listen(PORT, '127.0.0.1', () => console.error(`pgrest-stub listening on http://127.0.0.1:${PORT}  (GET /__state, POST /__reset)`));
