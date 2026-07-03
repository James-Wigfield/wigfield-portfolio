# DashFlo — Product & Build Brief (Phase 1 / MVP)

> **Document type:** Build spec — written to be consumed by Claude Code CLI
> **Product:** Lightweight operational dashboards + simple staff portals for small businesses
> **Market:** Perth / Western Australia — local small businesses
> **Phase 1 targets:** Real estate agencies, pharmacies, trades businesses
> **Status:** MVP. Keep everything as simple as possible. Prefer boring, proven tools.

---

## 1. What we're building (plain English)

DashFlo gives a small business **one web portal** where staff log in and see the numbers that matter — sales, jobs, stock, leads — pulled from the tools they already use, plus a few **custom mini-tools** built for how that specific business actually runs.

Think **"intranet + live dashboard"**, not enterprise software. The owner gets visibility without logging into five different systems; staff get a single home base with the day-to-day tools they need.

Two things every client gets:
1. **A dashboard** — basic stats and charts (sales, revenue, activity, whatever data they have).
2. **A staff portal** — login, roles, a home page, shared links/docs, and any custom tools we build for them.

---

## 2. Who it's for (Phase 1)

Local Perth small businesses, roughly 3–30 staff, with data scattered across spreadsheets and one or two SaaS tools, no internal developers, and an owner who wants clarity without complexity.

| Sector | Typical data they have | What they'd want to see / do |
|---|---|---|
| **Real estate agencies** | Listings, sales/settlements, commissions, leads, rent roll | Sales board, agent leaderboard, commission tracker, lead pipeline, property status board |
| **Pharmacies** | POS/sales data, scripts dispensed, stock levels, rosters | Daily/weekly sales, top products, low-stock alerts, staff roster, simple ordering checklist |
| **Trades businesses** (electrical, plumbing, building, landscaping) | Jobs, quotes, invoices (often Xero), timesheets, materials | Job status board, quote→invoice tracker, revenue by month, timesheet logger, materials/job-cost tally |

**Common traits to design around:** non-technical users, mobile + desktop, want it fast, distrust "salesy SaaS." Build for clarity over features.

---

## 3. MVP scope

### 3.1 The dashboard
- A handful of **stat cards** (e.g. sales this week, jobs open, leads new) + **2–4 charts** (line/bar).
- Data comes in via **CSV upload first**, API integration later (see §5).
- Date-range filter, simple, readable, mobile-friendly.

### 3.2 The staff portal layer
- **Auth** (email/password + magic link) via Supabase.
- **Roles**: at minimum `owner/admin` and `staff` (gate which tools/pages each sees).
- **Home page**: welcome, key stats, announcements, quick links.
- **Shared resources**: links and file storage (e.g. price lists, SOPs, forms).

### 3.3 Custom tools (the differentiator)
Small, per-client mini-apps built on top of the portal. Each is a self-contained module reading/writing to that client's Supabase tables. Phase-1 examples:

- **Lead / enquiry logger** (real estate, trades) — capture, assign, track status.
- **Quote → invoice tracker** (trades) — status pipeline + revenue rollup.
- **Low-stock checklist / reorder list** (pharmacy, trades).
- **Staff roster / timesheet logger** (all).
- **Commission calculator** (real estate).
- **Announcements board** (all).

> Custom tools are where the value and the lock-in live. Build them as reusable, configurable modules so they can be re-skinned per client rather than rewritten.

---

## 4. Tech stack (keep it simple)

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | Next.js (React) + Tailwind | Single app, server components where helpful |
| **Charts** | Recharts or Chart.js | Don't over-engineer; bar + line cover 90% |
| **Backend / DB / Auth** | **Supabase** (PostgreSQL) | One platform for DB, auth, storage, row-level security |
| **Data in (Phase 1)** | CSV upload + manual entry | Fastest path to a working demo |
| **Data in (Phase 2)** | APIs: **Xero** first (trades), then POS/CRM | Only build an integration once a paying client needs it |
| **Hosting** | Vercel (frontend) + Supabase (data) | Cheap, fast to ship |
| **Multi-tenancy** | One Supabase project, `org_id` on every row + RLS | Each client's data isolated by row-level security |

**Principle:** every feature should work end-to-end with CSV/manual data before any third-party API is wired up. Demos must never depend on an integration that isn't built yet.

---

## 5. Starter data model

Multi-tenant by `org_id`. Enforce isolation with Supabase Row-Level Security (RLS).

```sql
-- organisations (one per client business)
orgs            (id, name, sector, created_at)

-- users / staff, linked to an org
profiles        (id -> auth.users, org_id -> orgs, full_name, role, created_at)
                -- role: 'admin' | 'staff'

-- generic metrics feed (powers dashboard stat cards & charts)
metrics         (id, org_id, metric_key, label, value, recorded_at)
                -- e.g. metric_key='sales_total', value=4200, recorded_at=date

-- imported raw rows (from CSV uploads) before/instead of processing
data_imports    (id, org_id, source, filename, row_count, imported_at)
import_rows     (id, import_id, org_id, payload jsonb)

-- custom tool: leads/enquiries
leads           (id, org_id, name, contact, source, status, assigned_to, notes, created_at)

-- custom tool: jobs / quotes (trades)
jobs            (id, org_id, title, client, status, quote_amount, invoiced_amount, created_at)
                -- status: 'quote' | 'approved' | 'in_progress' | 'invoiced' | 'paid'

-- custom tool: shared resources / links
resources       (id, org_id, title, url, file_path, created_at)

-- announcements
announcements   (id, org_id, title, body, author_id, created_at)
```

> Keep `metrics` deliberately generic: any sector's dashboard cards/charts read from it, so adding a new client = loading their numbers, not rebuilding the dashboard.

---

## 6. Suggested app structure

```
/app
├── /login                      — Supabase auth
├── /dashboard                  — stat cards + charts (reads `metrics`)
├── /tools
│   ├── /leads                  — lead/enquiry logger
│   ├── /jobs                   — quote→invoice tracker
│   ├── /roster                 — staff roster / timesheets
│   └── /resources              — shared links & files
├── /import                     — CSV upload (admin only)
├── /admin                      — manage staff, roles, org settings
└── /home                       — portal landing: stats + announcements + quick links
/lib
├── supabase.ts                 — client + typed queries
├── auth.ts                     — session + role guards
└── charts.ts                   — shared chart helpers
```

---

## 7. Build phases

- **Phase 0 — Template:** Auth, orgs, roles, RLS, empty dashboard shell, CSV import. This becomes the reusable base for every client.
- **Phase 1 — First client demo:** Load a real client's data via CSV, configure their dashboard cards/charts, ship one custom tool relevant to their sector.
- **Phase 2 — Productionise:** Real domain, polish, mobile pass, add a second custom tool, first paid integration (likely Xero for a trades client).
- **Phase 3 — Repeat & templatise:** Onboard the next client by cloning the template, swapping data + branding. Track which custom tools get reused to find the productisable ones.

---

## 8. Go-to-market (simple, local)

**Positioning:** A local Perth developer who builds you a simple, custom portal — direct access to the person building it, fixed pricing, no lock-in, no jargon.

**Phase-1 approach:**
- Reach out directly to local real estate agencies, pharmacies, and trades businesses (walk-in, referral, local networking, LinkedIn).
- Lead with a **visual prototype of their own data** — small businesses get it instantly when they see their own sales/jobs on screen.

**Productised hook (carried from the strategy doc — tune the numbers down for small businesses):**
- **Free 30-min audit** — quick look at where their data lives and what they'd want to see. Soft top-of-funnel.
- **Low-cost prototype** (~$450, money-back) — a clickable dashboard built with a sample of their real data within ~7 days. The conversion driver.
- **Fixed setup + monthly** — clear pricing covering build, hosting, support. *Note: the original $3,500 + $600/mo was scoped for mining/construction clients; for a 5-person pharmacy or trades shop, consider a lighter tier (e.g. smaller setup + $150–$300/mo) and validate against what these businesses will actually pay.*

---

## 9. Out of scope for now (non-goals)

- Heavy ERP integration (NetSuite, Pronto Xi) — not relevant to this segment.
- Mining/construction compliance modules (WHS incident trackers, digital SWMS, AASB 16 lease accounting).
- Complex multi-depot logistics / haulage rate calculators.
- Anything requiring a custom API integration before there's a paying client asking for it.

> These live in the full market-analysis doc. Revisit only after the small-business MVP is validated and generating revenue.