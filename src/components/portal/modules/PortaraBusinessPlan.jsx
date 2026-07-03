import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   PORTARA — BUSINESS PLAN  (Portara section)
   ----------------------------------------------------------------------------
   A founder-level plan for Portara: custom staff portals for businesses, an MCP
   wrapper so staff operate their portal THROUGH Claude, and Cloudflare agents
   that run portal tasks autonomously. Grounded in the actual build — the
   Portara repo (React Router 7 on Cloudflare Workers + Supabase) is a working
   Pillar-1 MVP; Pillars 2 and 3 exist today as vocabulary and a data model, not
   code. Self-contained: the constants below are the source of truth, rendered
   with the portal's Reading Room tokens via the shared .pt-* / .syl-* classes
   (the same design language as the Syllabite go-to-market tab).
   This is a PLANNING DELIVERABLE — it documents current state, gaps and the
   order to build in, not the work itself.
   ========================================================================== */

const PROJECT = {
  tag: 'Portara · Business plan',
  title: 'Custom portals — operated through Claude, run by agents',
  thesis:
    'Portara sells a business a custom staff portal, then layers two multipliers competitors don’t offer: ' +
    'an MCP wrapper so staff operate that portal in natural language through Claude, and Cloudflare agents ' +
    'that perform portal tasks autonomously. The portal is the wedge and the lock-in; MCP and agents are the ' +
    'differentiation. Today the portal foundation is real; the two harder pillars are still to be built.',
  phase: 'MVP · Pillar 1 built · Pillars 2–3 to come',
};

const SIGNALS = [
  { value: '3', label: 'pillars — portals · MCP · agents', accent: true },
  { value: '1 / 3', label: 'pillars with real code' },
  { value: 'MVP', label: 'portal foundation shipped' },
  { value: 'Workers', label: 'Cloudflare + Supabase stack' },
];

const VIEWS = ['Overview', 'Current Build', 'Three Pillars', 'Gaps', 'Infra & Setup', 'Roadmap'];

// ── Overview ─────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  'Every feature must work end-to-end on the portal alone before MCP or agents are layered on — a demo never depends on a pillar that isn’t built yet.',
  'Multi-tenant by design — every row carries a business_id and is isolated by Supabase RLS, so one client’s data is never visible to another.',
  'The portal is the wedge and the recurring-revenue base; MCP (operate-by-Claude) and autonomous agents are what nobody local can match — layer them, don’t lead with them.',
  'Commit the backend — the Supabase schema, RLS, RPCs and Edge Functions must live in the repo, or the product isn’t reproducible or safe to iterate on.',
  'Ship narrow and real for one paying client before templatising across sectors.',
];

// ── Current build ─────────────────────────────────────────────────────────────
const BUILT = [
  { name: 'Supabase SSR auth', tag: 'done', hot: true,
    body: 'Cookie-bound server client, login / logout / signup, and invite acceptance (welcome.tsx) — real, production-shaped auth plumbing.' },
  { name: 'Multi-tenant business context', tag: 'done',
    body: 'getBusinessContext() joins members → businesses and walls each tenant off; owner/admin gating is enforced on every sensitive mutation.' },
  { name: 'Team & RBAC admin', tag: 'done',
    body: 'Member management (invite via a Supabase Edge Function), custom roles, built-in-role protection and safe-delete checks (setup.users.tsx, setup.roles.tsx).' },
  { name: 'AI-“worker” console', tag: 'done',
    body: 'The most developed screen — full CRUD over the workers table with a tabbed modal (Current Task / Executions / Settings) and desk-slot allocation (office.workers.tsx).' },
  { name: 'Animated pixel-art office', tag: 'polish',
    body: 'A finished sprite-sheet floor where workers wander between desks with status dots — a charming visualisation of the (future) agent workforce.' },
];

const PLACEHOLDERS = [
  'home.tsx is stub copy (“almost ready”) — there is no real per-business dashboard yet.',
  'Paid tiers appear in the UI (lib/plans.ts) but only the free “Hamlet” plan is enabled — no billing / Stripe anywhere.',
  'The worker “Executions” pane reads a worker_executions table that nothing in the codebase writes to — the monitoring UI is waiting on a producer that doesn’t exist.',
  'The Supabase schema, RLS policies, RPCs and the invite-user Edge Function live only in the hosted project — not committed to the repo, so the app isn’t reproducible from source.',
];

// ── Three pillars ──────────────────────────────────────────────────────────────
const PILLARS = [
  { name: 'Pillar 1 · Custom portals', tag: 'built · MVP', hot: true,
    body: 'A multi-tenant staff portal — auth, roles, invites, profiles and a themed shell — is real and coherent. The per-business dashboard is still a placeholder. This is the wedge, the lock-in and the recurring-revenue base.' },
  { name: 'Pillar 2 · MCP wrapper → Claude', tag: 'not started',
    body: 'A per-tenant MCP server (on the same Worker) that exposes portal actions as Claude tools, so staff operate the portal by talking to Claude. Today it exists only as a plan-perk string and onboarding copy — no MCP SDK, no server, no connector UI.' },
  { name: 'Pillar 3 · Autonomous Cloudflare agents', tag: 'not started',
    body: 'A runtime that drives the workers / worker_executions model — scheduling tasks, calling Claude, acting inside the portal and logging executions. The data model and monitoring UI are built; the runtime (Durable Objects / Agents SDK, Queues, Cron) does not exist yet.' },
];

const SEQUENCING = {
  name: 'Build all three pillars at once  vs  sequence portal → MCP → agents',
  lacks: 'Chasing MCP and autonomous agents now means selling a story you can’t demo — and neither works without a solid, reproducible portal underneath.',
  edge: 'Harden the portal and land a paying client first, then add MCP (operate-by-Claude), then agents (autonomous). Each pillar makes the next demoable and de-risks the one after it.',
};

// ── Gaps — what’s left to build ────────────────────────────────────────────────
const GAPS = [
  { name: 'Commit the backend to the repo', tag: 'infra', hot: true,
    body: 'Pull the Supabase schema, RLS policies, RPCs and the invite-user Edge Function into versioned migrations. Without this the product isn’t reproducible and every schema change is risky.' },
  { name: 'Real per-business dashboard', tag: 'pillar 1',
    body: 'Replace the home.tsx stub with configurable stat cards + charts reading each tenant’s data — CSV-import first, API integrations later, exactly as the go-to-market brief prescribes.' },
  { name: 'Billing', tag: 'pillar 1',
    body: 'Wire Stripe behind the existing plan tiers so Village / Citadel / Empire can actually be sold — a one-time setup fee plus a monthly, matching the strategy doc’s pricing.' },
  { name: 'MCP server + tool definitions', tag: 'pillar 2',
    body: 'Stand up a per-tenant MCP server exposing portal operations as Claude tools, scoped by business + role. The pixel-gif MCP Worker already proves this pattern works in your stack — reuse it.' },
  { name: 'Connector UI in /setup', tag: 'pillar 2',
    body: 'The Setup section (today only Users + Roles) needs an MCP-connector tab so businesses can connect Claude — the copy promising this already ships.' },
  { name: 'Agent runtime', tag: 'pillar 3',
    body: 'Add Durable Objects / the Cloudflare Agents SDK plus Queues + Cron to execute the workers model, call Claude, act in the portal and write worker_executions — turning the office console from a mock into a live control plane.' },
];

// ── Infra & setup — cross-referenced against the CF Workers + Supabase guide ────
const SETUP_DONE = [
  'Cloudflare Workers, not Pages — main: ./workers/app.ts, deployed with wrangler deploy.',
  'React Router v7 SSR request handler wired in workers/app.ts (the fetch handler that makes context.cloudflare.env work in loaders).',
  'nodejs_compat enabled; SUPABASE_URL committed in wrangler.jsonc vars; wrangler types run in postinstall.',
  'Supabase client fully wired — in fact a step beyond the guide: cookie-based SSR auth (@supabase/ssr), not just per-request createClient.',
];

const SETUP_TODO = [
  'Queues, Cron triggers and Durable Objects are all still commented out in wrangler.jsonc — these Workers-only features are exactly what the Pillar-3 agent runtime needs.',
  'Follow the guide’s secret convention: move secrets into .dev.vars locally + wrangler secret put in prod, and create the whitelisted .dev.vars.example / .env.example (referenced in .gitignore but never made).',
  'Commit schema / migrations so the database is reproducible from source.',
  'The committed SUPABASE_ANON_KEY is a publishable key (safe with RLS) — but the guide’s model keeps secrets out of committed config; rotate if a privileged key was ever committed.',
];

// ── Roadmap ──────────────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Now · Harden Pillar 1 + first paying client', state: 'now',
    body: 'Commit the Supabase schema/RLS into the repo, build a real configurable dashboard (CSV-first), wire Stripe behind the plan tiers, and adopt the guide’s secret hygiene. Land one Perth SMB on the free-audit → low-cost-prototype → fixed setup + monthly path from the go-to-market brief. Outcome: a reproducible, sellable portal product.' },
  { label: 'Next · Pillar 2 — MCP wrapper', state: 'next',
    body: 'Stand up a per-tenant MCP server on the Worker exposing portal actions as Claude tools, scoped by business + role, and add a connector tab to /setup. Outcome: staff operate their portal through Claude — the first differentiator, and a natural upsell on top of the portal.' },
  { label: 'Later · Pillar 3 — autonomous agents', state: 'later',
    body: 'Add a Durable-Object / Agents-SDK runtime plus Queues + Cron that executes the workers model, calls Claude, acts in the portal and logs worker_executions. Outcome: the office console becomes a live autonomous workforce — the full three-pillar product.' },
];

const ACTIONS = [
  'Decide the first paying client / sector to build Pillar-1 depth around (the brief suggests real estate, pharmacy or trades).',
  'Provision an Anthropic (Claude) API key — needed the moment Pillar 2 or 3 work begins.',
  'Move Supabase secrets out of wrangler.jsonc into Wrangler secrets; rotate the key if it was ever more than publishable.',
  'Register the business name / ABN if selling under “Portara”, and lock the domain + handles.',
];

// Small helpers to keep the panels tidy (mirrors SyllabiteGTM) ─────────────────
function Northstar({ kicker, accent, children }) {
  return (
    <div className="pt-card syl-northstar">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <p>{children}</p>
    </div>
  );
}
function BulletCard({ kicker, accent, items }) {
  return (
    <div className="pt-card syl-guardrails">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <ul className="syl-guardrails__list">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
function FeatureList({ items }) {
  return (
    <div className="syl-features">
      {items.map((f, i) => (
        <div key={f.name} className={`pt-card syl-feature${f.hot ? ' syl-feature--hot' : ''}`}>
          <span className="syl-feature__n">{String(i + 1).padStart(2, '0')}</span>
          <div className="syl-feature__body">
            <div className="syl-feature__top">
              <h5 className="syl-feature__name">{f.name}</h5>
              <span className="syl-tag">{f.tag}</span>
            </div>
            <p className="syl-feature__text">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function Tradeoff({ t }) {
  return (
    <div className="syl-rivals">
      <div className="pt-card syl-rival">
        <h5 className="syl-rival__name">{t.name}</h5>
        <p className="syl-rival__line syl-rival__line--lacks">{t.lacks}</p>
        <p className="syl-rival__line syl-rival__line--edge">
          <Icon name="arrowRight" size={14} className="syl-rival__arrow" />
          {t.edge}
        </p>
      </div>
    </div>
  );
}

export default function PortaraBusinessPlan() {
  const [view, setView] = useState('Overview');

  return (
    <div className="pt-module syl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card syl-head">
        <div className="syl-head__meta">
          <p className="syl-head__tag">{PROJECT.tag}</p>
          <h3 className="syl-head__title">{PROJECT.title}</h3>
          <p className="syl-head__thesis">{PROJECT.thesis}</p>
        </div>
        <div className="syl-head__phase">
          <span className="syl-head__phase-label">Status</span>
          <span className="syl-phasechip">{PROJECT.phase}</span>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="syl-seg" role="tablist" aria-label="Business plan sections">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {view === 'Overview' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>
          <Northstar kicker="The model" accent>
            Sell a business a custom staff portal, then charge for two multipliers on top: an <strong>MCP
            wrapper</strong> so staff run the portal by talking to Claude, and <strong>Cloudflare agents</strong>
            that perform portal tasks autonomously. The portal creates the account and the recurring revenue;
            MCP and agents are the differentiation that no local shop can match.
          </Northstar>
          <Northstar kicker="Where it stands">
            The portal foundation is real and good — auth, multi-tenancy, RBAC, invites, a themed shell and a
            full AI-worker console. The two hard pillars — MCP and autonomous agents — exist today only as
            vocabulary and a database model. Honestly, the build is a solid <strong>Pillar-1 MVP</strong>,
            roughly a quarter of the stated vision.
          </Northstar>
          <BulletCard kicker="Operating principles" items={PRINCIPLES} />
        </div>
      )}

      {/* ── CURRENT BUILD ───────────────────────────────────────────────── */}
      {view === 'Current Build' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            A single React Router 7 app on Cloudflare Workers with Supabase for auth + data. One commit — an
            early MVP, but a coherent one. Here’s what’s genuinely built versus what’s still placeholder.
          </p>
          <div>
            <span className="syl-kicker syl-kicker--accent">Built &amp; solid</span>
            <FeatureList items={BUILT} />
          </div>
          <BulletCard kicker="Placeholder or missing" items={PLACEHOLDERS} />
        </div>
      )}

      {/* ── THREE PILLARS ───────────────────────────────────────────────── */}
      {view === 'Three Pillars' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The whole product is three pillars stacked on one portal. Only the first has code today.
          </p>
          <FeatureList items={PILLARS} />
          <div>
            <span className="syl-kicker">The sequencing call</span>
            <Tradeoff t={SEQUENCING} />
          </div>
        </div>
      )}

      {/* ── GAPS ────────────────────────────────────────────────────────── */}
      {view === 'Gaps' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            What’s left to build, tagged by pillar — ordered so each item unblocks the next.
          </p>
          <FeatureList items={GAPS} />
        </div>
      )}

      {/* ── INFRA & SETUP ───────────────────────────────────────────────── */}
      {view === 'Infra & Setup' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Cross-referenced against the Cloudflare Workers + Supabase setup guide: the HTTP/SSR/auth
            foundation it prescribes is done — the background-processing capabilities it highlights are not.
          </p>
          <BulletCard kicker="Foundation in place (per the setup guide)" accent items={SETUP_DONE} />
          <BulletCard kicker="Still to wire up" items={SETUP_TODO} />
          <div className="pt-card syl-monet">
            <span className="syl-kicker">The key insight</span>
            <p>
              Queues, Cron triggers and Durable Objects are <strong>Workers-only</strong> features the guide
              calls out — and they’re precisely the runtime Pillar 3 (autonomous agents) needs. The stack was
              chosen correctly for the full vision; those capabilities just haven’t been switched on yet.
            </p>
          </div>
        </div>
      )}

      {/* ── ROADMAP ─────────────────────────────────────────────────────── */}
      {view === 'Roadmap' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Three phases, each unlocking the next — hardening the portal, then MCP, then agents.
          </p>
          <div className="syl-phases">
            {PHASES.map((p) => (
              <div key={p.label} className={`pt-card syl-phase syl-phase--${p.state}`}>
                <span className="syl-phase__marker" />
                <div>
                  <h5 className="syl-phase__label">{p.label}</h5>
                  <p className="syl-phase__body">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
          <BulletCard kicker="Requires your action (not build work)" accent items={ACTIONS} />
        </div>
      )}
    </div>
  );
}
