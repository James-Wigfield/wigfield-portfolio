#!/usr/bin/env node
/* A tiny in-memory PostgREST stand-in for the Memory Rooms tables, so the
   Worker's "supabase" row store can be exercised locally with no live database
   (the build rules forbid running SQL against Supabase).

     node tools/memory-rooms/pgrest-stub.mjs                 # port 8797 (PGREST_PORT to change)
     npx wrangler dev --port 8796 --persist-to .wrangler/state-mr-supa \
       --var SUPABASE_URL:http://127.0.0.1:8797 --var MEMORIES_ROW_STORE:supabase
     MEMORIES_API=http://127.0.0.1:8796 node tools/memory-rooms/api-check.mjs

   Implements what workers/memory-rooms.js uses: GET with eq filters (arrays; supabase-js
   does maybeSingle client-side for GET) and POST upserts (`on_conflict=id`,
   Prefer: resolution=merge-duplicates → only the sent columns change). Enforces the
   schema rules from supabase/memory_rooms.sql that matter: check constraints, the
   media → spot foreign key, unique (spot_id, type, name), unique r2_key, defaults and
   the updated_at trigger. GET /__state dumps the tables. */

import http from 'node:http';

const PORT = Number(process.env.PGREST_PORT || 8797);
const tables = { memory_spots: [], memory_media: [] };
const now = () => new Date().toISOString();

const DEFAULTS = {
  memory_spots: () => ({ created_at: now(), updated_at: now(), status: 'captured', scene_version: 0, captured_at: now(), lat: null, lng: null, loc_accuracy_m: null, loc_source: null, place_label: null, scale_hint: null, frame_group: null, scene: null, trip_stop_id: null, deleted_at: null }),
  memory_media: () => ({ created_at: now(), sort: 0, width: null, height: null, bytes: null, content_type: null }),
};
const CHECKS = {
  memory_spots: (r) =>
    (!['james', 'justin'].includes(r.created_by) && 'memory_spots_created_by_check') ||
    (!['interior', 'exterior'].includes(r.kind) && 'memory_spots_kind_check') ||
    (!['captured', 'modelling', 'rendered'].includes(r.status) && 'memory_spots_status_check') ||
    ((r.lat == null) !== (r.lng == null) && 'memory_spots_check') ||
    (!r.title && 'title not null') ||
    (!r.note && 'note not null') ||
    null,
  memory_media: (r) => (!['photo', 'thumb', 'scan', 'model', 'render', 'compare'].includes(r.type) && 'memory_media_type_check') || null,
};

function pgError(res, status, code, message) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code, message, details: null, hint: null }));
}
const readBody = (req) =>
  new Promise((resolve) => {
    let s = '';
    req.on('data', (d) => (s += d));
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : null);
      } catch {
        resolve(null);
      }
    });
  });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/__state') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(tables, null, 2));
    }
    const m = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
    if (!m || !tables[m[1]]) return pgError(res, 404, 'PGRST205', `Could not find the table '${m?.[1]}'`);
    const table = m[1];
    const rows = tables[table];

    if (req.method === 'GET') {
      let out = rows;
      for (const [k, v] of url.searchParams) {
        if (k === 'select' || k === 'order' || k === 'limit') continue;
        const f = /^eq\.(.*)$/.exec(v);
        if (f) out = out.filter((r) => String(r[k]) === f[1]);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(out));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return pgError(res, 400, 'PGRST102', 'Empty or invalid json');
      const conflict = url.searchParams.get('on_conflict');
      const merge = /resolution=merge-duplicates/.test(String(req.headers.prefer || ''));
      for (const input of Array.isArray(body) ? body : [body]) {
        const existing = conflict && merge ? rows.find((r) => String(r[conflict]) === String(input[conflict])) : null;
        const next = existing ? { ...existing, ...input } : { ...DEFAULTS[table](), ...input };
        if (existing && table === 'memory_spots') next.updated_at = now(); // trigger
        const bad = CHECKS[table](next);
        if (bad) return pgError(res, 400, '23514', `new row violates check constraint "${bad}"`);
        if (table === 'memory_media') {
          if (!tables.memory_spots.some((s) => s.id === next.spot_id)) return pgError(res, 409, '23503', 'violates foreign key constraint "memory_media_spot_id_fkey"');
          const dup = rows.find((r) => r !== existing && ((r.spot_id === next.spot_id && r.type === next.type && r.name === next.name) || r.r2_key === next.r2_key));
          if (dup) return pgError(res, 409, '23505', 'duplicate key value violates unique constraint');
        }
        if (existing) Object.assign(existing, next);
        else if (rows.some((r) => r.id === next.id)) return pgError(res, 409, '23505', 'duplicate key value violates unique constraint "pkey"');
        else rows.push(next);
      }
      res.writeHead(201);
      return res.end();
    }
    return pgError(res, 405, 'PGRST000', 'method not in the stub');
  })
  .listen(PORT, '127.0.0.1', () => console.log(`memory-rooms PostgREST stub on http://127.0.0.1:${PORT}`));
