# Portara — Master Context Document

> **What this is:** the single, canonical context document for the **Portara** business. Point any Claude instance here to give it the full picture — what Portara is, what's already built, what's missing, and what I'm trying to achieve. It is self-contained: you should not need any other file to get oriented.
>
> **Last grounded:** 2026-07-03, from a full read of the codebase + the go-to-market brief + the Cloudflare/Supabase setup guide. If you're reading this much later, re-verify the "Current build state" section against the actual repo before trusting it.
>
> **Name note:** the go-to-market brief calls this "DashFlo" — that name is **superseded**. The business is **Portara**. Treat the strategy in that brief as current; ignore the old name.

---

## 1. What Portara is (in one paragraph)

Portara builds businesses a **custom staff portal**, then layers two multipliers competitors don't offer: a **custom MCP wrapper** so staff operate that portal *through* Claude in natural language, and **Cloudflare agents** that perform portal tasks autonomously. The portal is the wedge and the recurring-revenue base; the MCP layer and the agents are the differentiation. Today the portal foundation is real and working; the two harder pillars exist only as vocabulary and a database model.

### The three pillars
1. **Custom portals** — a multi-tenant web app where a business's staff log in and get a dashboard + the day-to-day tools built for how *that* business runs. *(The original idea.)*
2. **Custom MCP wrappers** — a per-business MCP server, connected to Claude, exposing that portal's actions as tools so staff operate the portal by talking to Claude.
3. **Cloudflare agents** — autonomous agents that perform tasks *inside* these portals on the business's behalf.

---

## 2. Vision & positioning (the business side)

- **Market:** local Perth / WA small businesses, ~3–30 staff, data scattered across spreadsheets + one or two SaaS tools, no internal developers. Phase-1 sectors: **real estate agencies, pharmacies, trades** (electrical/plumbing/building/landscaping).
- **Positioning:** a local developer who builds you a simple, custom portal — direct access to the person building it, fixed pricing, no lock-in, no jargon. Sell by showing a prototype of *their own data* on screen.
- **Every client gets two things:** a **dashboard** (stat cards + a few charts) and a **staff portal** (login, roles, home page, shared resources, plus custom mini-tools).
- **The differentiator / lock-in:** the **custom tools** built per client (lead logger, quote→invoice tracker, roster, commission calculator, etc.) — reusable, configurable modules re-skinned per client, not rewritten.
- **Data strategy:** **CSV upload + manual entry first**; API integrations (Xero first, for trades) only once a paying client needs one. Every feature must demo end-to-end on CSV/manual data before any integration is built.
- **Pricing model (from the brief, tune for SMBs):** free 30-min audit → a low-cost clickable prototype of their real data (~$450, money-back, ~7 days) as the conversion driver → fixed setup + monthly. The brief's original $3,500 + $600/mo was scoped for mining/construction; for a small pharmacy or trades shop use a lighter tier (~$150–$300/mo) and validate against real willingness to pay.
- **Explicit non-goals (for now):** heavy ERP integrations (NetSuite, Pronto Xi), mining/construction compliance modules, complex logistics. Revisit only after the SMB MVP is validated and earning.

---

## 3. The three pillars in detail

### Pillar 1 — Custom portals *(the wedge; ≈ built as an MVP)*
A multi-tenant staff portal: auth, roles, invites, profiles, a themed shell, and per-business custom tools + a dashboard. Each business's data is walled off. This creates the account and the recurring revenue.

### Pillar 2 — MCP wrapper → Claude *(not started; concept only)*
A **per-tenant MCP server** (run on the same Cloudflare Worker) that exposes portal operations as Claude tools — scoped by the caller's business and role — so staff run the portal conversationally through Claude. Needs: an MCP server, tool definitions mapped to portal actions, per-tenant auth, and a connector UI in `/setup`. *(A remote-MCP-on-Workers pattern has already been proven elsewhere in the pixel-gif MCP Worker — reuse that shape.)*

### Pillar 3 — Autonomous Cloudflare agents *(not started; data model only)*
A **runtime** that drives the `workers` / `worker_executions` model — scheduling tasks, calling Claude, acting inside the portal, and logging executions. Needs: Durable Objects / the Cloudflare Agents SDK + Queues + Cron (all Workers-only features), plus a Claude API integration. The data model and a monitoring UI already exist; the runtime does not.

---

## 4. Current build state (as of 2026-07-03)

**Repo:** `C:/Users/james/Documents/business/portara` (standalone; one commit; `node_modules` not installed).

### Stack
React Router **v7** (framework mode, **SSR**) deployed as a single **Cloudflare Worker** → **Supabase** (Postgres + Auth) via `@supabase/ssr` (cookie-based SSR auth) + `@supabase/supabase-js`. Tailwind v4, Vite 8, React 19, TypeScript 5.9, Wrangler 4. Icons via `react-icons`.

- **Entry:** `workers/app.ts` (`fetch` → React Router request handler). Routes in `app/routes.ts`: a `protected.tsx` layout wraps `/` (home), `/office` (+`/office/workers`), `/setup` (+`/setup/roles`), `/profile` (+`/profile/organisation`); auth pages (`/login`, `/signup`, `/logout`, `/welcome`) sit outside it.
- **Scripts:** `dev` (localhost:5173), `build`, `preview`, `deploy` (build + `wrangler deploy`), `typecheck`, `postinstall` (`wrangler types`).

### Built and solid (essentially all of Pillar 1)
- Supabase SSR auth: login / logout / signup (signup *founds a business*) / invite acceptance (`welcome.tsx`) — `app/lib/supabase.server.ts`.
- Multi-tenant business context: `getBusinessContext()` walls each tenant off; owner/admin gating throughout.
- Team management + RBAC: `setup.users.tsx` (invite via a Supabase Edge Function), `setup.roles.tsx` (custom roles, built-in-role protection).
- Profiles: `profile.personal.tsx`, `profile.organisation.tsx`.
- **AI-"worker" console** (`office.workers.tsx`, the most developed screen): full CRUD over the `workers` table + a tabbed modal (Current Task / Executions / Settings) + desk-slot allocation.
- Animated pixel-art "office floor" (`office.view.tsx`): a charming front-end visualisation of the (future) agent workforce.

### Placeholder / stub
- `home.tsx` — the per-business dashboard is stub copy ("almost ready"); **there is no real dashboard yet.**
- `lib/plans.ts` — paid tiers exist in the UI but only the free "Hamlet" plan is enabled; Village/Citadel/Empire are "coming soon". **No billing / Stripe anywhere.**
- The worker **"Executions" pane reads `worker_executions`, but nothing in the codebase writes to it** — the monitoring UI is waiting on a producer (the Pillar-3 runtime) that doesn't exist.

### Missing / not in the repo
- **MCP (Pillar 2):** zero code — only a plan-perk string + onboarding copy. No MCP SDK, server, or connector UI.
- **Agent runtime (Pillar 3):** zero code — no Durable Objects, Queues, Cron, Agents SDK, or Claude calls.
- **The Supabase backend itself:** schema, RLS policies, RPCs (`set_member_role`) and the `invite-user` Edge Function live **only in the hosted Supabase project** (`ojpljpnuyxhacpzhozno`), **not committed to the repo** → the project is not reproducible from source. **This is the #1 blocker for standing up a fresh/test instance.**
- `.dev.vars.example` / `.env.example` — whitelisted in `.gitignore` but never created.

### Honest overall completeness
**~25–30% of the full three-pillar vision — a solid Pillar-1 MVP.** Pillars 2 and 3 are aspirational: present as naming and a data model, absent as code.

### Inferred database schema (from query usage — verify against the hosted project)
```
businesses        (id, name, industry, company_size, website, phone, plan, created_at)
business_members  (id, user_id, business_id, role, display_name, avatar, email, created_at)
business_roles    (id, business_id, name, description, built_in, created_at)
workers           (id, business_id, name, title, objective, instructions, personality,
                   tone, skills, status, desk_slot, sprite, created_by, created_at, updated_at)
worker_executions (id, worker_id, task, status, outcome, started_at, finished_at)
-- RPC: set_member_role   -- Edge Function: invite-user
-- worker status lifecycle: not_onboarded → idle → working → halted
```

---

## 5. Infrastructure & setup status

The stack matches the reference "React Router 7 on Cloudflare Workers + Supabase" setup guide. Cross-referenced:

**Foundation in place ✅**
- Cloudflare **Workers**, not Pages (`main: ./workers/app.ts`, deploy via `wrangler deploy`).
- React Router v7 SSR request handler wired in `workers/app.ts`.
- `nodejs_compat` enabled; `SUPABASE_URL` committed in `wrangler.jsonc` `vars`; `wrangler types` in `postinstall`.
- Supabase fully wired — in fact a step beyond the guide (cookie-based SSR auth, not just per-request `createClient`).

**Still to wire up ❌**
- **Queues, Cron triggers, Durable Objects** — all commented out in `wrangler.jsonc`. These Workers-only features are exactly what the **Pillar-3 agent runtime** needs. (The stack was chosen correctly; these capabilities just aren't switched on.)
- **Secret hygiene** — the guide keeps secrets in `.dev.vars` locally + `wrangler secret put` in prod. Portara instead commits a **publishable** anon key as a plaintext `var`. That key is safe to expose *if* RLS is correct, but a privileged key must never be committed. Create the whitelisted `.dev.vars.example` / `.env.example`.
- **Schema/migrations** — commit them so the DB is reproducible.

---

## 6. Gap analysis — what's left, by pillar

| # | Gap | Pillar |
|---|---|---|
| 1 | **Commit the backend** — pull schema, RLS, RPCs and the `invite-user` function into versioned migrations in the repo | infra (unblocks everything) |
| 2 | **Real per-business dashboard** — replace the `home.tsx` stub with configurable stat cards + charts reading each tenant's data (CSV-first) | 1 |
| 3 | **Billing** — wire Stripe behind the plan tiers so paid plans can actually be sold | 1 |
| 4 | **MCP server + tool definitions** — per-tenant MCP server exposing portal actions as Claude tools, scoped by business + role | 2 |
| 5 | **Connector UI in `/setup`** — an MCP-connector tab (the copy promising it already ships) | 2 |
| 6 | **Agent runtime** — Durable Objects / Agents SDK + Queues + Cron to execute the `workers` model, call Claude, act in the portal, write `worker_executions` | 3 |

---

## 7. Roadmap

- **Now — harden Pillar 1 + land the first paying client.** Commit the Supabase schema/RLS into the repo, build a real configurable dashboard (CSV-first), wire Stripe behind the plan tiers, adopt the guide's secret hygiene. Land one Perth SMB via the free-audit → prototype → fixed setup + monthly path. **Outcome: a reproducible, sellable portal product.**
- **Next — Pillar 2, the MCP wrapper.** A per-tenant MCP server on the Worker exposing portal actions as Claude tools, scoped by business + role, plus a connector tab in `/setup`. **Outcome: staff operate their portal through Claude — the first differentiator and a natural upsell.**
- **Later — Pillar 3, autonomous agents.** A Durable-Object / Agents-SDK runtime + Queues + Cron that executes the `workers` model, calls Claude, acts in the portal and logs executions. **Outcome: the office console becomes a live autonomous workforce — the full product.**

---

## 8. What I want to achieve right now (immediate priority)

**Set the agent side (Pillar 3) and the MCP side (Pillar 2) completely aside for now.** The near-term goal is to stand up a **working test portal (Pillar 1)** I can sign up to and click around locally, and to make the backend **reproducible from source**.

Concretely, from clone → running test portal:
1. `npm install` (the checkout has no `node_modules`).
2. **Reproduce the backend as committed SQL migrations** — the tables, RLS, the `set_member_role` RPC (and the `invite-user` Edge Function if invites are in scope) — so the DB no longer lives only in the hosted project. *(This is the real blocker: the app boots but every query fails without it.)*
3. Point config at a Supabase project (reuse the existing one, or a fresh one for testing).
4. `npm run dev` → confirm **signup → login → portal** works locally.
5. Deploy later with `npm run deploy` when ready.

**Do not** build the MCP server or the agent runtime yet. Prefer boring, proven tools. Flag ambiguities rather than guessing.

---

## 9. Operating principles / constraints

- **Portal-first, always demoable:** every feature works end-to-end on the portal alone (CSV/manual data) before MCP or agents are layered on. A demo never depends on an unbuilt pillar.
- **Multi-tenant by design:** every row carries a `business_id` and is isolated by Supabase **RLS**; one client's data is never visible to another.
- **The portal is the wedge and the lock-in;** MCP and agents are the differentiation — layer them, don't lead with them.
- **Commit the backend:** schema, RLS, RPCs and Edge Functions must live in the repo, or the product isn't reproducible or safe to iterate.
- **Ship narrow and real** for one paying client before templatising across sectors.
- **Keep it simple** — prefer proven tools; don't over-engineer.

---

## 10. Pointers

- **Code:** `C:/Users/james/Documents/business/portara`
- **Supabase project ref:** `ojpljpnuyxhacpzhozno` (URL + publishable anon key are in `wrangler.jsonc`).
- **Go-to-market brief:** `Documents/portal-documents/general/updated-go-to-market.md` *(uses the old "DashFlo" name)*.
- **Stack setup guide:** `Documents/portal-documents/general/cloudflare-workers-supabase-setup-guide.md`.
- **Interactive business plan:** the **Portara → Business Plan** tab in the personal-portfolio management portal (`src/components/portal/modules/PortaraBusinessPlan.jsx`).
