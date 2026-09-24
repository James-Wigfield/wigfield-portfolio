/* ============================================================================
   PAPERS API — the RSVP reader's access to `papers` + `paper_sections`
   ----------------------------------------------------------------------------
   Same pattern as presentationsApi: the tables have RLS ON with NO policies,
   so everything goes through the Worker's /api/papers routes (workers/papers.js)
   with the portal password as a bearer token. Papers are WRITTEN by the portal
   MCP server; from here we only read them, save progress and manage the Bin.

   NB: /api/* only exists when the Worker runs — `npm run cf:dev` locally or the
   deployed site. Plain `npm run dev` (vite) 404s here and the library shows
   its empty state with the error.

   Every function returns Supabase's { data, error } shape (never throws).
   ========================================================================== */

import { getPortalKey } from '../auth';

const BASE = '/api/papers';

async function call(path, options = {}) {
  const key = getPortalKey();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (e) {
    return {
      data: null,
      error: { message: `Couldn’t reach the papers API (${e.message}). The /api layer needs the Worker — run \`npm run cf:dev\` locally, or use the deployed site.` },
    };
  }

  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    return { data: null, error: { message: body.error || `Request failed (${res.status})`, status: res.status } };
  }
  return { data: body.data ?? null, error: null };
}

// All papers, live and binned (split on deletedAt).
//   → data: [{ id, title, authors, year, source, status, sectionCount, wordCount,
//              mainWordCount, appendixWordCount, progress, createdAt, updatedAt, deletedAt }]
export function listPapers() {
  return call('');
}

// One paper with its ordered sections.
//   → data: { …paper, sections: [{ position, heading, level, part, blocks, wordCount }] }
export function getPaper(id) {
  return call(`/${encodeURIComponent(id)}`);
}

// Save reading progress. `keepalive` lets the final save survive an unmount/navigation.
//   progress: { index, total, pct, wpm, heading, finished }
export function saveProgress(id, progress, { keepalive = false } = {}) {
  return call(`/${encodeURIComponent(id)}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progress }),
    keepalive,
  });
}

// Soft delete (→ Bin), or permanent delete with { permanent: true }.
export function deletePaper(id, { permanent = false } = {}) {
  return call(`/${encodeURIComponent(id)}${permanent ? '?permanent=1' : ''}`, { method: 'DELETE' });
}

// Bring a paper back out of the Bin.
export function restorePaper(id) {
  return call(`/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}
