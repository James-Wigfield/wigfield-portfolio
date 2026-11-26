/* ============================================================================
   SPECTA SELECTA — release + update routes for the desktop app
   ----------------------------------------------------------------------------
   The desktop app's builds are published as GitHub Releases in a PRIVATE repo,
   so the installed app can't read them directly. This Worker holds a read-only
   GitHub token and hands out GitHub's short-lived signed download links.

   App side (Bearer = SPECTA_UPDATE_KEY, compiled into the app):
     GET  /api/specta-selecta/update/latest.json   → 200 the release's latest.json,
                                                     platform urls rewritten to ↓
                                                     204 no published release / no latest.json
                                                     401 bad key · 503 not configured · 502 GitHub
     GET  /api/specta-selecta/update/asset/:id      → 302 to GitHub's signed URL

   Portal side (Bearer = PORTAL_PASSWORD):
     GET  /api/specta-selecta/status                → { configured, github, releases }
     POST /api/specta-selecta/download/:id          → { url }  (fresh signed URL)
     POST /api/specta-selecta/test-update           → runs the update route with the
                                                     real key, server-side; the key
                                                     never reaches the browser

   Secrets: SPECTA_UPDATE_KEY, SPECTA_GITHUB_TOKEN (fine-grained, Contents read).
   Pure helpers are exported for tools/specta-selecta/update-route.test.mjs.
   ========================================================================== */

export const REPO = 'James-Wigfield/specta-selecta';
const GH_API = `https://api.github.com/repos/${REPO}`;
const PREFIX = '/api/specta-selecta/';
export const ASSET_ROUTE = `${PREFIX}update/asset/`;
const USER_AGENT = 'jameswigfield.com-worker';
const MAX_RELEASES = 10;

export async function handleSpectaSelectaApi(request, env, url, { requirePortalAuth, json }) {
  const rest = url.pathname.slice(PREFIX.length);

  // ── App side ──────────────────────────────────────────────────────────────
  if (rest === 'update/latest.json') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed');
    return handleUpdateLatest(request, env, url);
  }
  const assetMatch = /^update\/asset\/([^/]+)$/.exec(rest);
  if (assetMatch) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed');
    return handleAsset(request, env, assetMatch[1]);
  }

  // ── Portal side ───────────────────────────────────────────────────────────
  if (rest === 'status') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const denied = requirePortalAuth(request, env);
    if (denied) return denied;
    return json(await buildStatus(env));
  }
  const dlMatch = /^download\/([^/]+)$/.exec(rest);
  if (dlMatch) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const denied = requirePortalAuth(request, env);
    if (denied) return denied;
    if (!isAssetId(dlMatch[1])) return json({ error: 'Not an asset id' }, 400);
    if (!env.SPECTA_GITHUB_TOKEN) return json({ error: 'SPECTA_GITHUB_TOKEN isn’t set on the Worker.' }, 503);
    try {
      const link = await signedAssetLink(env, dlMatch[1]);
      if (link.notFound) return json({ error: 'No such file in the releases.' }, 404);
      if (!link.url) return json({ error: 'GitHub didn’t give a download link.' }, 502);
      return json({ url: link.url });
    } catch (e) {
      return json({ error: `GitHub: ${e.message}` }, 502);
    }
  }
  if (rest === 'test-update') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const denied = requirePortalAuth(request, env);
    if (denied) return denied;
    return json(await runUpdateTest(env, url.origin));
  }

  return json({ error: 'Not found' }, 404);
}

// ── GET …/update/latest.json ─────────────────────────────────────────────────
export async function handleUpdateLatest(request, env, url) {
  if (!env.SPECTA_UPDATE_KEY) return plain(503, 'Update route not configured (SPECTA_UPDATE_KEY).');
  if (!(await bearerMatches(request, env.SPECTA_UPDATE_KEY))) return plain(401, 'Unauthorized');
  if (!env.SPECTA_GITHUB_TOKEN) return plain(503, 'Update route not configured (SPECTA_GITHUB_TOKEN).');

  // Tauri fills these in; they're informational only.
  const target = url.searchParams.get('target');
  const arch = url.searchParams.get('arch');
  const current = url.searchParams.get('current');
  if (target || arch || current) console.log(`specta-selecta update check: ${target || '?'}/${arch || '?'} from ${current || '?'}`);

  let release;
  try {
    release = await ghJson(env, '/releases/latest', { allow404: true });
  } catch (e) {
    return plain(502, `GitHub: ${e.message}`);
  }
  if (!release) return noUpdate();

  const manifestAsset = (release.assets || []).find((a) => a.name === 'latest.json');
  if (!manifestAsset) return noUpdate();

  let manifest;
  try {
    manifest = await readAssetJson(env, manifestAsset.id);
  } catch (e) {
    return plain(502, `GitHub: ${e.message}`);
  }

  const { manifest: rewritten, unmatched } = rewriteLatestJson(manifest, url.origin, release.assets);
  if (unmatched.length) console.log(`specta-selecta: latest.json names files the release lacks: ${unmatched.join(', ')}`);

  return new Response(request.method === 'HEAD' ? null : JSON.stringify(rewritten), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// ── GET …/update/asset/:id ───────────────────────────────────────────────────
async function handleAsset(request, env, id) {
  if (!env.SPECTA_UPDATE_KEY) return plain(503, 'Update route not configured (SPECTA_UPDATE_KEY).');
  if (!(await bearerMatches(request, env.SPECTA_UPDATE_KEY))) return plain(401, 'Unauthorized');
  if (!env.SPECTA_GITHUB_TOKEN) return plain(503, 'Update route not configured (SPECTA_GITHUB_TOKEN).');
  if (!isAssetId(id)) return plain(400, 'Not an asset id');

  try {
    const link = await signedAssetLink(env, id);
    if (link.notFound) return plain(404, 'Not found');
    if (link.url) {
      return new Response(null, { status: 302, headers: { location: link.url, 'cache-control': 'no-store' } });
    }
    // GitHub answered with the bytes themselves: stream them through.
    const headers = new Headers({ 'cache-control': 'no-store' });
    for (const h of ['content-type', 'content-length', 'content-disposition']) {
      const v = link.response.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(link.response.body, { status: 200, headers });
  } catch (e) {
    return plain(502, `GitHub: ${e.message}`);
  }
}

// ── status (portal) ──────────────────────────────────────────────────────────
async function buildStatus(env) {
  const configured = { updateKey: Boolean(env.SPECTA_UPDATE_KEY), githubToken: Boolean(env.SPECTA_GITHUB_TOKEN) };
  if (!configured.githubToken) {
    return { configured, github: { ok: false, error: 'SPECTA_GITHUB_TOKEN isn’t set on the Worker.' }, releases: [] };
  }
  try {
    const list = await ghJson(env, '/releases?per_page=20');
    const releases = (Array.isArray(list) ? list : [])
      .filter((r) => !r.draft && !r.prerelease)
      .slice(0, MAX_RELEASES)
      .map(mapRelease);
    return { configured, github: { ok: true }, releases };
  } catch (e) {
    return { configured, github: { ok: false, error: e.message }, releases: [] };
  }
}

export function mapRelease(r) {
  return {
    version: String(r.tag_name || '').replace(/^v/i, ''),
    tag: r.tag_name,
    publishedAt: r.published_at,
    notes: r.body || '',
    assets: (r.assets || []).map((a) => ({ id: a.id, name: a.name, size: a.size, kind: assetKind(a.name) })),
  };
}

// ── test-update (portal) ─────────────────────────────────────────────────────
// Runs the real handler in-process with the real key, so the key never leaves
// the Worker. Also proves a request with no key is refused.
async function runUpdateTest(env, origin) {
  const route = `${origin}${PREFIX}update/latest.json?target=darwin&arch=aarch64&current=0.0.0`;
  const fakeUrl = new URL(route);
  const headers = env.SPECTA_UPDATE_KEY ? { authorization: `Bearer ${env.SPECTA_UPDATE_KEY}` } : {};
  const res = await handleUpdateLatest(new Request(route, { headers }), env, fakeUrl);
  const refused = await handleUpdateLatest(new Request(route), env, fakeUrl);

  const out = { status: res.status, version: null, platforms: [], rewrittenOk: null, refusesNoKey: refused.status === 401 };
  if (res.status === 200) {
    const body = await res.json();
    out.version = body.version ?? null;
    out.platforms = Object.keys(body.platforms || {});
    out.rewrittenOk = out.platforms.length > 0 && urlsAllRewritten(body, origin);
  } else if (res.status !== 204) {
    out.error = (await res.text()).slice(0, 300);
  }
  return out;
}

// ── pure helpers (unit-tested) ───────────────────────────────────────────────

/** What a release file is, from its name. */
export function assetKind(name = '') {
  const n = name.toLowerCase();
  if (n === 'latest.json') return 'latest-json';
  if (n.endsWith('.sig')) return 'signature';
  if (n.endsWith('.dmg')) return 'mac-dmg';
  if (n.endsWith('.app.tar.gz')) return 'mac-update';
  if (n.endsWith('-setup.exe')) return 'win-installer';
  return 'other';
}

/**
 * Point every platforms[*].url at our asset route. Everything else (version,
 * notes, pub_date, every signature) is left exactly as it was. A url is matched
 * to a release asset by its browser_download_url, then by its file name.
 * Platforms whose file isn't in the release are dropped (and reported), so the
 * app is never handed a GitHub URL it can't open.
 */
export function rewriteLatestJson(manifest, origin, assets = []) {
  const out = { ...manifest };
  const unmatched = [];
  if (manifest && manifest.platforms && typeof manifest.platforms === 'object') {
    out.platforms = {};
    for (const [platform, entry] of Object.entries(manifest.platforms)) {
      const asset = findAsset(entry && entry.url, assets);
      if (!asset) {
        unmatched.push(platform);
        continue;
      }
      out.platforms[platform] = { ...entry, url: `${origin}${ASSET_ROUTE}${asset.id}` };
    }
  }
  return { manifest: out, unmatched };
}

function findAsset(rawUrl, assets) {
  if (!rawUrl) return null;
  const byUrl = assets.find((a) => a.browser_download_url === rawUrl);
  if (byUrl) return byUrl;
  let name = String(rawUrl).split('?')[0].split('/').pop() || '';
  try { name = decodeURIComponent(name); } catch { /* keep raw */ }
  return assets.find((a) => a.name === name) || assets.find((a) => a.name === name.replace(/ /g, '.')) || null;
}

/** True when every platform url is <origin>/api/specta-selecta/update/asset/<digits>. */
export function urlsAllRewritten(manifest, origin) {
  const re = new RegExp(`^${escapeRe(origin + ASSET_ROUTE)}\\d+$`);
  return Object.values(manifest.platforms || {}).every((p) => p && re.test(p.url));
}

export function isAssetId(id) {
  return /^\d{1,15}$/.test(String(id));
}

/** Constant-time check of `Authorization: Bearer <key>`. */
export async function bearerMatches(request, expected) {
  const header = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m || !expected) return false;
  return timingSafeEqualStrings(m[1], expected);
}

// Hash both sides first so the buffers are always equal length (no length leak),
// then compare in constant time. crypto.subtle.timingSafeEqual is Workers-only;
// the XOR loop is the fallback for Node (unit tests).
export async function timingSafeEqualStrings(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(ha, hb);
  }
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

// ── GitHub ───────────────────────────────────────────────────────────────────

function ghHeaders(env, accept = 'application/vnd.github+json') {
  return {
    authorization: `Bearer ${env.SPECTA_GITHUB_TOKEN}`,
    accept,
    'x-github-api-version': '2022-11-28',
    'user-agent': USER_AGENT,
  };
}

async function ghJson(env, path, { allow404 = false } = {}) {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders(env) });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(await ghReason(res));
  return res.json();
}

/**
 * Ask GitHub for an asset without following the redirect, and read Location:
 * that's the short-lived signed URL. It is never followed with the token on.
 *   → { url } | { response } (GitHub sent the bytes) | { notFound: true }
 */
export async function signedAssetLink(env, id) {
  const res = await fetch(`${GH_API}/releases/assets/${id}`, {
    headers: ghHeaders(env, 'application/octet-stream'),
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error(`${res.status} with no Location`);
    return { url: location };
  }
  if (res.status === 404) return { notFound: true };
  if (res.ok) return { response: res };
  throw new Error(await ghReason(res));
}

async function readAssetJson(env, id) {
  const link = await signedAssetLink(env, id);
  if (link.notFound) throw new Error('latest.json went missing');
  let res = link.response;
  if (link.url) {
    // The signed URL carries its own auth: fetch it WITHOUT the token.
    res = await fetch(link.url, { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) throw new Error(`latest.json download ${res.status}`);
  }
  try {
    return JSON.parse(await res.text());
  } catch {
    throw new Error('latest.json isn’t valid JSON');
  }
}

async function ghReason(res) {
  let msg = '';
  try { msg = (await res.json()).message || ''; } catch { /* not JSON */ }
  return `${res.status}${msg ? ` ${msg}` : ''}`.slice(0, 200);
}

// ── small responses ──────────────────────────────────────────────────────────

function plain(status, text) {
  return new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

function noUpdate() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
