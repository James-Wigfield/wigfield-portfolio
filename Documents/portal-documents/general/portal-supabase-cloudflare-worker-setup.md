# Portal → Supabase via a Cloudflare Worker — Setup Runbook

> **Goal:** take the `/portal` from in-memory mock data to a real Supabase backend, with a
> **Cloudflare Worker** in front holding the secret key (the path James chose for practice).
> Follow top to bottom. Nothing here changes the portal UI — only the data/auth seam.
>
> **This site's reality (important):** the portal is a **static Vite + React SPA on Cloudflare
> Pages** (git auto-deploy → `dist`, SPA fallback in `public/_redirects`). It is *not* the SSR
> single-Worker stack in `cloudflare-workers-supabase-setup-guide.md` (that's the *work* app).
> So the right kind of Worker here is **Pages Functions** — see §4.

## Contents
0. Architecture (what we're building)
1. **Organising Supabase for many projects under one account** ← read this first
2. Create the database (schema + tables + RLS)
3. Get your keys
4. The Worker layer = Cloudflare Pages Functions
5. Flip the front-end onto the Worker
6. Local dev loop
7. Deploy
8. Adding the next project (Syllabite, …)
9. Checklist + gotchas
- Appendix A: Supabase Auth instead of the shared password
- Appendix B: a true standalone Worker (separate deploy)

---

## 0. Architecture

```
Browser (React SPA, Cloudflare Pages)
        │  fetch('/api/...')   — same origin, no CORS, no keys in the bundle
        ▼
Pages Function  =  your Cloudflare Worker   (functions/ in this repo)
        │  • validates an HttpOnly session cookie (_middleware.js)
        │  • holds SUPABASE_SERVICE_ROLE_KEY as a secret (never sent to the browser)
        ▼
Supabase (Postgres + PostgREST)   — schema "portal", RLS on
```

Why a Worker (vs the browser talking to Supabase directly): the secret service-role key stays
server-side, you get one place to enforce auth and shape responses, and the browser bundle ships
**zero** database credentials. The trade is one extra hop + a tiny bit more code — which is exactly
the practice you want.

| Concern | Choice for this portal |
|---|---|
| Worker flavour | **Pages Functions** (`/functions`) — Workers runtime that deploys *with* the Pages site |
| Supabase key used by the Worker | **service-role** (server-only secret; bypasses RLS) |
| Browser → Worker auth | shared password → **HMAC-signed HttpOnly cookie** (simple, single-user) |
| Many projects under one account | **one Supabase project, one schema per app** (see §1) |
| Local dev | `wrangler pages dev` + a Vite `/api` proxy (§6) |

---

## 1. Organising Supabase for many projects under one account

Supabase's hierarchy:

```
Account
└── Organisation(s)
    └── Project          ← one dedicated Postgres DB + Auth + Storage + REST API + its OWN url & keys
        └── Schema       ← a namespace inside that one database (public, auth, storage, + your own)
            └── Table
```

> "Database/warehouse per project" maps to one of two patterns. (Note: Supabase is an **OLTP**
> Postgres, not an analytics warehouse — if you ever need true BI warehousing that's a separate
> tool like BigQuery. For *app* databases, the two patterns below are the answer.)

### Pattern A — one Supabase project, **one schema per app**  ✅ recommended for you
Create a schema per venture inside a single Supabase project: `portal`, `syllabite`, `honours`, …

- **Pros:** stays on the **free tier** (free = max 2 *active projects* org-wide; schemas keep you at
  1); one URL + one key set to manage; one Worker can serve every app by switching schema; you can
  even JOIN across schemas if you ever need to.
- **Cons:** shared resource limits + shared Auth user pool; RLS must be written carefully; pausing
  / hitting limits affects everything.
- **Naming:** schema = the app slug; keep table names plain (`portal.tasks`, not `portal_tasks`) —
  the schema already namespaces them.

### Pattern B — one Supabase **project per app** (separate databases)
Each app gets its own Supabase project (own URL/keys/Auth/DB/backups).

- **Pros:** hard isolation, independent scaling + backups, separate auth user pools, clear blast
  radius.
- **Cons:** free tier caps you at ~2 active projects per org (beyond that you pay, or projects
  pause); more keys/Workers to juggle; no cross-project JOINs.
- **Use when:** an app goes production / multi-user / sensitive.

### The plan
Start everything as a **schema inside one umbrella project** (Pattern A). **Graduate** an app to its
**own project** (Pattern B) the moment it goes real — e.g. spin Syllabite into its own project when
it launches to students (its own auth pool + scaling + isolation). Migration is an export/import of
that one schema, and pointing that app's Worker at the new URL/key.

This runbook builds the **`portal`** schema under one umbrella project. §8 shows adding the next.

---

## 2. Create the database

### 2.1 Make the project
Supabase dashboard → **New project**. Pick a region close to you (Sydney `ap-southeast-2`), set a
strong DB password (save it), wait for it to provision.

### 2.2 Schema + tables + RLS
Dashboard → **SQL Editor** → paste and run. This mirrors `mockData.js` exactly (same columns,
same enum values as the JS `MILESTONE_STATUS` / `TASK_STATUS` / `TASK_PRIORITY` arrays).

```sql
-- ── schema (one per app) ─────────────────────────────────────────────
create schema if not exists portal;
grant usage on schema portal to anon, authenticated, service_role;
grant all on all tables in schema portal to service_role;
alter default privileges in schema portal grant all on tables to service_role;

-- ── shared updated_at trigger fn ─────────────────────────────────────
create or replace function portal.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── projects ─────────────────────────────────────────────────────────
create table portal.projects (
  id          text primary key default gen_random_uuid()::text,
  code        text,
  name        text not null,
  description text,
  supervisor  text,
  institution text,
  start_date  date,
  due_date    date,
  status      text not null default 'in_progress'
              check (status in ('not_started','in_progress','completed','blocked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── milestones (FK → projects) ───────────────────────────────────────
create table portal.milestones (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references portal.projects(id) on delete cascade,
  title       text not null,
  description text,
  due_date    date,
  status      text not null default 'not_started'
              check (status in ('not_started','in_progress','completed','blocked')),
  order_index int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on portal.milestones (project_id);

-- ── tasks (FK → milestones) ──────────────────────────────────────────
create table portal.tasks (
  id           text primary key default gen_random_uuid()::text,
  milestone_id text not null references portal.milestones(id) on delete cascade,
  title        text not null,
  status       text not null default 'todo'
               check (status in ('todo','in_progress','done')),
  priority     text not null default 'medium'
               check (priority in ('low','medium','high')),
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on portal.tasks (milestone_id);

-- ── updated_at triggers ──────────────────────────────────────────────
create trigger trg_projects_updated   before update on portal.projects
  for each row execute function portal.set_updated_at();
create trigger trg_milestones_updated before update on portal.milestones
  for each row execute function portal.set_updated_at();
create trigger trg_tasks_updated      before update on portal.tasks
  for each row execute function portal.set_updated_at();

-- ── RLS: lock everything. The Worker uses the service-role key, which
--    BYPASSES RLS, so it keeps full access; the anon/public key gets nothing.
--    (The Worker's cookie auth in §4 is the real gate.)
alter table portal.projects   enable row level security;
alter table portal.milestones enable row level security;
alter table portal.tasks      enable row level security;
-- no policies for anon/authenticated => the public key can read/write nothing.
```

### 2.3 Expose the schema to the API
The Worker uses `supabase-js` (the REST/PostgREST API), so the schema must be exposed:

Dashboard → **Project Settings → API** (Data API) → **Exposed schemas** → add `portal` → save.
(`service_role` bypasses RLS, but PostgREST still only routes to *exposed* schemas.)

### 2.4 Seed the honours project (so the tracker has data)
The portal opens to `DEFAULT_PROJECT_ID = 'proj_honours_2025'`, so seed at least that row. Easiest:
SQL Editor, inserting with the **exact ids from `mockData.js`** (keeps the FKs lined up):

```sql
insert into portal.projects (id, code, name, description, supervisor, institution,
                             start_date, due_date, status)
values ('proj_honours_2025','CITS4010',
        'Optimising PSMA PET Segmentation using the Mamba Architecture',
        'A 3D State Space Model approach to whole-body PSMA PET segmentation.',
        'Dr. Jake Kendrick','University of Western Australia',
        '2025-02-24','2025-10-27','in_progress');
-- then insert the milestones + tasks the same way (copy the rows out of
-- src/components/portal/data/mockData.js — the column names already match).
```

---

## 3. Get your keys
Dashboard → **Project Settings → API**:

- **Project URL** — `https://<ref>.supabase.co`  → goes in `SUPABASE_URL` (not secret).
- **service_role key** (under "Project API keys", the secret one) → `SUPABASE_SERVICE_ROLE_KEY`.
  **Server-only. Never put this in the browser / a `VITE_` var / git.**

You do **not** need the anon key for this path — the browser never talks to Supabase directly.

---

## 4. The Worker layer = Cloudflare Pages Functions

**Pages Functions are Cloudflare Workers.** Any file under `functions/` is compiled into a Worker
that runs on the same Pages deployment + domain. So `fetch('/api/x')` from the SPA hits your Worker
at the same origin (no CORS), and the Worker reads secrets from `context.env`. This is the idiomatic
Worker for a static Pages SPA. (Want a *separate* deploy instead? Appendix B.)

### 4.1 Install + config
```bash
npm install @supabase/supabase-js
npm install -D wrangler
```

Create **`wrangler.toml`** at the repo root (configures the Pages project + enables `nodejs_compat`,
which some libs want; `wrangler pages dev` also reads it):

```toml
name = "wigfield-portfolio"            # must match your Pages project name
pages_build_output_dir = "dist"
compatibility_date = "2026-01-31"
compatibility_flags = ["nodejs_compat"]
```

Your existing Pages git build is unchanged: build command `npm run build`, output `dist`. Pages will
auto-detect `functions/` and deploy it alongside.

### 4.2 Secrets
Create **`.dev.vars`** at the repo root (local only):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SESSION_SECRET=<paste a long random string>
PORTAL_PASSWORD=wiggy1
```

⚠️ **Fix `.gitignore`** — it currently ignores `*.local` but **not** `.dev.vars`. Add:

```gitignore
# Cloudflare
.dev.vars*
.wrangler/
```

(Generate a `SESSION_SECRET` with e.g. `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.)

### 4.3 Shared helpers — `functions/_lib.js`
(Underscore-prefixed files aren't turned into routes, so this is import-only.)

```js
import { createClient } from '@supabase/supabase-js';

// One client per request, scoped to this app's schema, using the service-role
// key. service_role bypasses RLS — the cookie gate in _middleware.js is the lock.
export function supa(env, schema = 'portal') {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema },
    auth: { persistSession: false },
  });
}

// PostgREST-shaped envelope so the front-end keeps its { data, error } contract.
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
export const ok = (data) => json({ data, error: null });
export const fail = (message, status = 400) => json({ data: null, error: { message } }, status);

// ── HMAC-signed session cookie (Web Crypto — built into Workers) ────────────
const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

export async function makeSessionCookie(env, days = 14) {
  const exp = Date.now() + days * 86400_000;
  const payload = `v1.${exp}`;
  const value = `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
  return `portal_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${days * 86400}`;
}

export async function verifySession(env, request) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)portal_session=([^;]+)/);
  if (!m) return false;
  const [v, exp, sig] = m[1].split('.');
  if (v !== 'v1' || !exp || !sig || Date.now() > Number(exp)) return false;
  return sig === await hmac(env.SESSION_SECRET, `${v}.${exp}`);
}

export const clearCookie = () =>
  'portal_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
```

### 4.4 Auth gate — `functions/api/_middleware.js`
Runs before every `/api/*` route. Lets login/logout through, requires a valid cookie for the rest.

```js
import { verifySession, fail } from '../_lib.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);
  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') return next();
  if (!(await verifySession(env, request))) return fail('unauthorized', 401);
  return next();
}
```

### 4.5 Login / logout — `functions/api/auth/login.js` + `logout.js`
```js
// functions/api/auth/login.js
import { makeSessionCookie, ok, fail } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const { password } = await request.json().catch(() => ({}));
  if (!password || password !== env.PORTAL_PASSWORD) return fail('invalid credentials', 401);
  const res = ok({ session: true });
  res.headers.set('Set-Cookie', await makeSessionCookie(env));
  return res;
}
```
```js
// functions/api/auth/logout.js
import { ok, clearCookie } from '../../_lib.js';

export async function onRequestPost() {
  const res = ok({ session: false });
  res.headers.set('Set-Cookie', clearCookie());
  return res;
}
```

### 4.6 Data API — `functions/api/[[path]].js`
A catch-all router covering every operation in `portalApi.js`. (More specific routes like
`auth/login.js` are matched before this catch-all, and `_middleware.js` runs before both.)

```js
import { supa, ok, fail } from './_lib.js';

export async function onRequest({ request, env, params }) {
  const [resource, id] = params.path || [];     // e.g. ['tasks','abc']
  const url = new URL(request.url);
  const method = request.method;
  const db = supa(env, 'portal');               // ← this app's schema

  try {
    // projects ----------------------------------------------------------
    if (resource === 'projects' && id && method === 'GET') {
      const r = await db.from('projects').select('*').eq('id', id).single();
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    // milestones --------------------------------------------------------
    if (resource === 'milestones' && !id && method === 'GET') {
      const r = await db.from('milestones').select('*')
        .eq('project_id', url.searchParams.get('project_id'))
        .order('order_index', { ascending: true });
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    if (resource === 'milestones' && id && method === 'PATCH') {
      const r = await db.from('milestones').update(await request.json())
        .eq('id', id).select().single();
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    // tasks -------------------------------------------------------------
    if (resource === 'tasks' && !id && method === 'GET') {
      const r = await db.from('tasks').select('*, milestones!inner(project_id)')
        .eq('milestones.project_id', url.searchParams.get('project_id'));
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    if (resource === 'tasks' && !id && method === 'POST') {
      const r = await db.from('tasks').insert(await request.json()).select().single();
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    if (resource === 'tasks' && id && method === 'PATCH') {
      const r = await db.from('tasks').update(await request.json())
        .eq('id', id).select().single();
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    if (resource === 'tasks' && id && method === 'DELETE') {
      const r = await db.from('tasks').delete().eq('id', id).select().single();
      return r.error ? fail(r.error.message) : ok(r.data);
    }
    return fail('not found', 404);
  } catch (e) {
    return fail(e.message || 'server error', 500);
  }
}
```

> The `tasks` GET adds a nested `milestones` field (used only to filter by project) — the UI ignores
> it. The DB triggers set `updated_at`, so the Worker doesn't.

Tree so far:
```
functions/
├── _lib.js
└── api/
    ├── _middleware.js
    ├── [[path]].js
    └── auth/
        ├── login.js
        └── logout.js
```

---

## 5. Flip the front-end onto the Worker
Do this **after** §2–4 are up. Two files change; the components above them don't.

**`src/components/portal/data/portalApi.js`** — replace the mock with `fetch` calls (keeps the
`{ data, error }` contract, so `Overview.jsx` / `HonoursTracker.jsx` are untouched):

```js
const API = '/api';

async function request(path, options) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event('portal:unauthorized'));
      return { data: null, error: body.error ?? { message: res.statusText } };
    }
    return body;                                  // already { data, error }
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

export const DEFAULT_PROJECT_ID = 'proj_honours_2025';

export const getProject     = (id = DEFAULT_PROJECT_ID) => request(`/projects/${id}`);
export const listMilestones = (id = DEFAULT_PROJECT_ID) => request(`/milestones?project_id=${id}`);
export const updateMilestone = (id, patch) => request(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const listTasks      = (id = DEFAULT_PROJECT_ID) => request(`/tasks?project_id=${id}`);
export const insertTask     = (t) => request('/tasks', { method: 'POST', body: JSON.stringify(t) });
export const updateTask     = (id, patch) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const deleteTask     = (id) => request(`/tasks/${id}`, { method: 'DELETE' });
```

> `insertTask` now sends only `{ milestone_id, title, priority, due_date }` — the DB defaults the
> id/status/timestamps. (`HonoursTracker.jsx` already calls it with those fields.)

**`src/components/portal/auth.js`** — call the Worker; keep a UI-only flag (the real gate is the
HttpOnly cookie the browser can't read):

```js
const FLAG = 'portal_auth';

export async function signIn(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) { sessionStorage.setItem(FLAG, '1'); return { data: { session: true }, error: null }; }
  return { data: null, error: { message: 'Invalid credentials' } };
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  sessionStorage.removeItem(FLAG);
}

export function getSession() { return sessionStorage.getItem(FLAG) ? { active: true } : null; }
export function isAuthenticated() { return getSession() !== null; }
```

`Portal.jsx` already `await`s `signIn`; `signOut` stays fire-and-forget. (Optional polish: listen for
the `portal:unauthorized` event in `Portal.jsx` to bounce back to the gate when the cookie expires.)

---

## 6. Local dev loop
The Worker only runs under Wrangler, so run two processes and let Vite proxy `/api` to it.

Add a proxy to **`vite.config.js`**:
```js
server: { proxy: { '/api': 'http://127.0.0.1:8788' } }
```

Then:
```bash
# once, so wrangler has a dir to serve:
npm run build

# terminal A — the Worker (serves functions/, loads .dev.vars)  → :8788
npx wrangler pages dev

# terminal B — the SPA with HMR; /api is proxied to :8788       → :5173
npm run dev
```
Open `http://localhost:5173/portal`. App changes hot-reload via Vite; function/`.dev.vars` changes
hot-reload via Wrangler. (Quick smoke test without HMR: just `npm run build && npx wrangler pages dev`
and use `:8788`.)

---

## 7. Deploy
1. **Commit** `functions/`, `wrangler.toml`, and the edited `portalApi.js` / `auth.js` / `vite.config.js`
   / `.gitignore`. Push — the Pages git build runs `npm run build` and auto-deploys `dist` **and**
   `functions/`.
2. **Production secrets** — Cloudflare dashboard → your Pages project → **Settings → Environment
   variables**: add `SUPABASE_URL` (plain), and `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
   `PORTAL_PASSWORD` as **encrypted** secrets (set them for **Production**, and Preview if you use
   preview branches). CLI equivalent: `npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm **Settings → Functions → Compatibility flags** includes `nodejs_compat` (the
   `wrangler.toml` sets it; double-check it took).
4. Re-deploy if you added secrets after the first build. Visit `/portal`, log in, add a task, refresh
   — it persists. ✅

---

## 8. Adding the next project (Syllabite, …)
Staying on Pattern A (schema per app):

1. **DB:** `create schema syllabite;` + its grants + tables (copy §2.2's pattern), then **expose**
   `syllabite` in Project Settings → API.
2. **Worker:** add `functions/api/syllabite/[[path]].js` that calls `supa(env, 'syllabite')` and routes
   that app's resources. (Same key/URL — only the schema differs.)
3. **Front-end:** a `syllabiteApi.js` hitting `/api/syllabite/...`.

**Graduate to its own project** when it goes real (multi-user / production): create a new Supabase
project, move the `syllabite` schema across (`pg_dump`/import), and point that app's Worker at the new
`SUPABASE_URL` + key (add a second pair of env vars, e.g. `SYLLABITE_SUPABASE_URL/_KEY`). Now it has
its own auth pool, scaling, and backups.

---

## 9. Checklist + gotchas
- [ ] Supabase project created; `portal` schema + tables + RLS run (§2.2)
- [ ] `portal` added to **Exposed schemas** (§2.3) — easy to forget; queries 404 without it
- [ ] honours project seeded so `proj_honours_2025` exists (§2.4)
- [ ] `npm i @supabase/supabase-js`; `wrangler.toml` with `nodejs_compat`
- [ ] `.dev.vars` filled; **`.dev.vars*` added to `.gitignore`** (it isn't covered today)
- [ ] `functions/` files in place
- [ ] `portalApi.js` + `auth.js` flipped to `fetch`
- [ ] prod secrets set in the Pages dashboard
- **Never** expose the service-role key to the browser (no `VITE_` var, no commit).
- RLS is ON with **no anon policies** → the public key can't touch the data; the Worker (service-role)
  + cookie gate is the path. Don't add permissive anon policies unless you mean to.
- Supabase footgun (from the work guide): don't chain `.or()`/`.and()` onto `.update()`/`.delete()` —
  use plain `.eq()` filters on mutations.
- This is single-user auth by design. For real multi-user, use Supabase Auth (Appendix A).

---

## Appendix A — Supabase Auth instead of the shared password
Swap the password gate for real users: in the browser create a client with the **anon** key and call
`supabase.auth.signInWithPassword({ email, password })` to get a JWT; send that JWT to the Worker
(`Authorization: Bearer …`); the Worker verifies it (via the project JWKS / JWT secret) before using
service-role. More moving parts (JWT refresh, user table, RLS keyed on `auth.uid()`), but it's the
right model once more than one person logs in. The existing `auth.js` comments already sketch the
`supabase.auth` surface.

## Appendix B — a true standalone Worker (separate deploy)
If you specifically want a Worker deployed on its own (not bundled with Pages): scaffold with
`npm create cloudflare@latest portal-api -- --type=hello-world`, move the §4 handler logic into its
`fetch` export (route on `URL`/method instead of file paths), set secrets with
`npx wrangler secret put …`, deploy with `npx wrangler deploy`, give it a route/subdomain (e.g.
`api.jameswigfield.com`), and point the SPA's `API` base at that origin — now you must handle **CORS**
in the Worker. For this portal that's strictly more work than Pages Functions for no benefit, but it's
the genuine "standalone Worker" exercise if you want it.
```
