# Handoff — Cloudflare Workers + Supabase setup (wigfield-portfolio)

> **For:** the next Claude instance continuing this work. **Date:** 2026-07-03.
> **Read this first, then check the "IMMEDIATE NEXT ACTION" section.**
>
> ⚠️ **Which repo:** this is about the **personal portfolio** repo — `wigfield-portfolio`
> (`C:/Users/james/Documents/personal-projects/wigfield-portfolio`). It is **not** the
> Portara business repo. (The doc just lives in the `portara` folder for convenience.
> For Portara-the-business context, see `portara-context.md` in this same folder.)

---

## The goal

Move the portfolio's hosting from **Cloudflare Pages** → **Cloudflare Workers**, and add a
**server-side `/api/*` layer wired to Supabase**, so James can store data and call other APIs
with secret keys server-side. **Without rewriting the app.**

- The repo is a plain **Vite SPA** (`BrowserRouter`, `vite build`, `public/_redirects`).
- The setup guide (`../general/cloudflare-workers-supabase-setup-guide.md`) describes a **React
  Router v7 SSR** stack — a *different* architecture. Fully following it would mean an SSR rewrite.
- **DECISION (chosen by James): the "light path"** — keep the Vite SPA exactly as-is; wrap it in a
  Worker that serves the built site as **Static Assets** + hosts `/api/*`. **A full SSR migration
  was explicitly rejected.** Do not rewrite the React app to SSR.

## Why Workers over Pages
One deploy unit that serves the site AND runs server code (secret keys stay server-side), plus
future access to Queues / Cron / Durable Objects that Pages can't do.

---

## Architecture as built

- **React app: UNCHANGED.**
- **`workers/app.js`** is the Worker entry. `run_worker_first: true` makes the Worker the front
  door for **every** request: it answers `/api/*` itself, and hands everything else to the static
  site via `env.ASSETS.fetch(request)` (real files served; non-file routes fall back to
  `index.html` for client-side routing).
- **Supabase is server-side only** — accessed inside `/api/*` using
  `createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)`. The secret key never reaches the browser.
- **Naming convention matches `mcp-pixel-gif`** (a sibling Worker in this repo): `SUPABASE_URL` is a
  non-secret `var` in `wrangler.jsonc`; `SUPABASE_SECRET_KEY` (the `sb_secret_...` key) is a secret.
- **Same Supabase project as pixel-gif:** `https://trcnbmxtudhbuswqmqxy.supabase.co`. The
  `SUPABASE_SECRET_KEY` in `.dev.vars` is the *same key* pixel-gif uses.

---

## Files created / changed (repo side — all done)

| File | State | Purpose |
|---|---|---|
| `wrangler.jsonc` | new | Worker config: `main: workers/app.js`, `nodejs_compat`, `assets` → `./dist` with `not_found_handling: single-page-application` + **`run_worker_first: true`**, `SUPABASE_URL` var (already set to the real project URL), observability on. |
| `workers/app.js` | new | Worker entry — serves assets + `/api/*`. Has a working `/api/health` route and a **commented** Supabase example. |
| `.dev.vars.example` | new | Secret template (`SUPABASE_SECRET_KEY`). |
| `.dev.vars` | created by James | Local secrets (gitignored). Holds the real `SUPABASE_SECRET_KEY`. |
| `.gitignore` | edited | Added `.wrangler/`, `.mf`, `.dev.vars*` (keeps `.dev.vars.example`). |
| `package.json` | edited | Added `wrangler` (^4) devDep + scripts: `cf:dev` (`vite build && wrangler dev`) and `deploy` (`vite build && wrangler deploy`). |

**Environment already installed:** `npm install` was run; **wrangler 4.107** is present.

---

## Verified so far
- `eslint` clean on the new/changed files; `vite build` OK.
- `npx wrangler deploy --dry-run` OK — read 83 files from `dist`, bindings (`ASSETS`, `SUPABASE_URL`) resolve.
- James ran `npm run cf:dev` locally: **the site loads fine.**
- **Bug found + fixed:** `/api/health` first returned a **black page** = the SPA's `index.html` was
  being served for `/api/*` (the site's theme is dark, so an unmatched route looks black). Cause: the
  route-scoped `run_worker_first: ["/api/*"]` wasn't taking effect. **Fixed by switching to
  `run_worker_first: true`** (Worker fronts all requests). This fix has **not yet been re-verified**
  because James is restarting his PC.

---

## ⚠️ IMMEDIATE NEXT ACTION (do this first)

Re-verify the `run_worker_first: true` fix (config changes require a dev-server restart):

1. `npm run cf:dev`
2. Open `http://localhost:8787/api/health`
3. **Expect JSON:** `{"ok":true,"supabaseConfigured":true}` — **not** a black page.

- If you see the JSON → local is confirmed working; proceed to deployment.
- If it's **still a black page** → `/api/*` is still hitting the SPA. Investigate Workers Static
  Assets routing precedence (Worker vs `not_found_handling`); consider testing that `/api/health`
  content-type is `application/json`, and confirm `run_worker_first: true` is in the live config.

---

## Remaining steps (in order)

1. *(done above)* Verify `/api/health` locally.
2. **Log in to Cloudflare (interactive, one-time):** `npx wrangler login`
3. **Store the production secret (interactive):** `npx wrangler secret put SUPABASE_SECRET_KEY`
   — paste the same `sb_secret_...` key that's in `.dev.vars`.
4. **Deploy:** `npm run deploy` → prints a `https://wigfield-portfolio.<subdomain>.workers.dev` URL.
   Test the site **and** `/api/health` there (safe — not the real domain yet).
5. **Custom domain (LAST, only when happy):** Cloudflare dashboard → the Worker → Settings →
   Domains & Routes → add the portfolio domain; then retire/repoint the old **Pages** project.
   **This is the only step that changes what live visitors see.** Until then, the current Pages
   deploy stays live and untouched.

---

## NOT done yet — the next project chunk (data layer)

The portal's data is still the **in-memory MOCK** — nothing is persisted yet.
- `src/components/portal/data/portalApi.js` — every function returns Supabase's `{data,error}`
  shape and has a `// SUPABASE:` comment showing the real query. `auth.js` is also mock.
- To make it real:
  1. **Create the portfolio's own tables in Supabase** — schema mirroring `mockData.js`
     (`projects`, `milestones`, `tasks`), with **RLS**.
     ⚠️ Shares the SAME Supabase project as pixel-gif → **use distinct table names (or a separate
     schema)** so nothing collides with pixel-gif's sprite tables.
  2. **Add `/api/*` routes** in `workers/app.js` using
     `createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)` (uncomment the example there).
  3. **Switch `portalApi.js`** from the in-memory store to `fetch('/api/...')` calls — keep the
     `{data,error}` return shape so the UI needs **zero** changes.
  4. Decide the auth gate (the portal currently uses a mock password in `auth.js`).

---

## Command reference

```bash
npm run dev        # normal Vite dev server (React work; no Worker/api)
npm run cf:dev     # Cloudflare Worker locally (vite build + wrangler dev) → http://localhost:8787
npm run build      # vite build → dist/
npm run deploy     # vite build + wrangler deploy  (needs wrangler login first)
npx wrangler login                              # one-time auth
npx wrangler secret put SUPABASE_SECRET_KEY     # prod secret
```

## Key facts
- Repo: `C:/Users/james/Documents/personal-projects/wigfield-portfolio`
- Local Worker URL: `http://localhost:8787` (health: `/api/health`)
- Supabase project: `https://trcnbmxtudhbuswqmqxy.supabase.co` (shared with pixel-gif)
- Secret var name: `SUPABASE_SECRET_KEY` (the `sb_secret_...` key)
- Constraint: **light path only — do NOT rewrite the SPA to SSR.**
- Constraint: editing `wrangler.jsonc` requires **restarting** `wrangler dev`.
