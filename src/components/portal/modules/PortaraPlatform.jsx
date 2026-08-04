import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   PORTARA PLATFORM - architecture + dev workflow of the isolated-tenants repo
   ----------------------------------------------------------------------------
   Snapshot of how the NEW portara-repo works after the migration off the old
   single-worker app: one isolated Cloudflare Worker per client (Workers for
   Platforms), a tiny dispatch router on *.portara.com.au, the HQ control
   plane on portara.com.au, and the fleet CLI that stamps immutable core
   artifacts across every tenant. Ends with a tidy-up list for the repo.

   Source of truth: C:\Users\james\Documents\business\portara-repo
   (README.md runbook + CLAUDE.md invariants), reviewed 2026-08-01.
   Styled with the shared .pt-* / .bk-* classes in portal.css.
   ========================================================================== */

const HEAD = {
  kicker: 'Portara · platform architecture',
  title: 'Isolated Tenants on Cloudflare',
  thesis:
    'Every client gets their OWN Cloudflare Worker (Workers for Platforms), stamped from one ' +
    'versioned core artifact. Per-client differences are data (registry to KV to request header), ' +
    'never forked code. One fleet CLI builds, deploys, canaries and reconciles the lot.',
  statusLabel: 'Live today',
  status: 'portara.com.au · demos tenant',
};

const VIEWS = ['One-Pager', 'How It Works', 'Dev Workflow', 'Fleet CLI', 'Repo Map', 'Improvements'];

// ── One-Pager - the whole platform on one screen ─────────────────────────────
const OP_SUMMARY =
  'One codebase (apps/core) is built into immutable artifacts and stamped onto an isolated ' +
  'Cloudflare Worker per client. A 132-line dispatch worker routes *.portara.com.au via a KV map; ' +
  'portara.com.au is the HQ control plane. Per-client differences are registry DATA, never forked code.';

const OP_FLOW = [
  { n: 1, label: 'Browser · acme.portara.com.au' },
  { n: 2, label: 'dispatch · KV route map' },
  { n: 3, label: 'tenant-acme Worker · core artifact' },
  { n: 4, label: 'Supabase · scoped by businessId' },
];

const OP_MOVES = [
  { key: 'core',
    name: 'Ship core to everyone',
    tag: 'artifact',
    body: 'fleet build once, deploy to the canary cohort, soak, then stable. Rollback = redeploy the previous artifact id.' },
  { key: 'overlay',
    name: 'Custom code for ONE client',
    tag: 'overlay',
    body: 'tenants/<slug>/index.ts compiles into a slug-tagged artifact, pinned both ways - it can never stamp onto another tenant.' },
  { key: 'config',
    name: 'Branding, tools, flags',
    tag: 'not a deploy',
    body: 'fleet tenant settings (or the HQ form) writes the registry and re-projects KV. Live on the next request.' },
];

const OP_CHEATSHEET = `npm run fleet -- tenant dev demos && npm run dev:core     # local dev, real tenant
npm run fleet -- build                                    # immutable core artifact
npm run fleet -- deploy --artifact core-... --cohort canary   # soak, then stable
npm run fleet -- build --tenant demos                     # one-client overlay
npm run fleet -- tenant settings demos --tool +crm        # live config, no deploy
npm run fleet -- reconcile                                # registry vs reality`;

const OP_RULES = [
  'Code = artifacts; per-tenant differences = data',
  'The tenants table is the source of truth; KV is a projection',
  'Dispatch stays tiny - it is the only shared blast radius',
  'Every tenant query scopes by businessId',
  'Secrets never touch the repo',
  'Tenant portals deploy ONLY via the fleet CLI',
];

const OP_TIDY = [
  'Extract the 21 files duplicated between core and HQ into shared packages',
  'Fix the tenants.tools schema default (phantom "org" tool)',
  'Split the 612-line CLAUDE.md changelog into docs/ and refresh the README',
];

// ── How It Works - the two request paths ────────────────────────────────────
const ARCH = {
  tenant: {
    label: 'Client portal request',
    nodes: [
      'Browser · acme.portara.com.au',
      'portara-dispatch · KV lookup (~130 lines)',
      'tenant-acme Worker · isolated, runs core artifact',
      'Supabase · every query scoped by businessId',
    ],
    note:
      'Dispatch strips inbound x-portara-* headers, injects the trusted x-portara-tenant header, ' +
      'and forwards into the "portara-tenants" namespace. Suspended tenant = 503 at the edge.',
  },
  hq: {
    label: 'Staff / control plane',
    nodes: [
      'Browser · portara.com.au',
      'portara-hq Worker · marketing site + staff portal',
      'tenants registry (Supabase) · SOURCE OF TRUTH',
      'projections · KV route map + Worker script tags',
    ],
    note:
      'HQ /portal/crm onboards clients, edits settings and seats members. Every mutation writes ' +
      'the registry FIRST, then projects to KV - live on the next request, no redeploy.',
  },
};

const PIECES = [
  {
    key: 'artifact', rec: true,
    name: 'Code = immutable artifacts',
    tag: 'Invariant 1',
    body: 'apps/core is built ONCE into core-YYYYMMDD-HHmm and stamped onto every tenant Worker. Per-client differences (branding, tools, flags, plan) ride as registry data, never forked code.',
    points: [
      'Canary cohort first, then stable; "held" tenants are never touched',
      'Rollback = deploy the previous artifact id',
      'Only per-tenant code path: tenants/<slug>/ overlays, pinned both ways',
    ],
  },
  {
    key: 'isolation', rec: true,
    name: 'Isolation is the product',
    tag: 'Invariant 4',
    body: 'Tenant Workers run untrusted in the namespace: no shared cache, no public route, reachable only through dispatch. Blast radius of any bug = one client.',
    points: [
      'Business data lives in per-tenant tables (<slug>_jobs, <slug>_leads, ...)',
      'Skeleton tables (members, roles) shared with RLS on businessId',
      'Growth path: data_plane.mode = "dedicated" (own Supabase project)',
    ],
  },
];

const INVARIANTS = [
  { n: 1, title: 'Code is versioned artifacts; per-tenant differences are data', body: 'Registry to KV to x-portara-tenant header at request time. Never fork core per client.' },
  { n: 2, title: 'The tenants table is the source of truth', body: 'KV entries and script tags are projections. Mutate the registry first, then project. fleet reconcile audits drift.' },
  { n: 3, title: 'apps/dispatch stays tiny', body: 'It is the only shared blast radius (~130 lines). Features go in core or the control plane, never here.' },
  { n: 4, title: 'Every tenant query scopes by businessId', body: 'From getTenant(request) in core. No business switcher exists in tenant portals.' },
  { n: 5, title: 'Secrets never touch the repo', body: '.env for the CLI, wrangler secrets for workers, WfP secrets API per tenant. Nothing in platform.config.json or wrangler vars.' },
];

// ── Dev Workflow ─────────────────────────────────────────────────────────────
const RAIL = [
  { n: 1, label: 'Edit apps/core' },
  { n: 2, label: 'typecheck' },
  { n: 3, label: 'fleet build' },
  { n: 4, label: 'deploy canary' },
  { n: 5, label: 'soak' },
  { n: 6, label: 'deploy stable' },
];

const WORKFLOWS = [
  {
    key: 'core', rec: true,
    name: 'A · Core change (ships to every client)',
    tag: 'The daily loop',
    body: 'One codebase, one artifact, whole fleet. The artifact id is the unit of deploy AND rollback.',
    points: [
      'npm run typecheck, then npm run fleet -- build',
      'fleet deploy --artifact core-... --cohort canary, soak, then --cohort stable',
      'NEVER wrangler deploy apps/core - tenant portals ship only via fleet',
    ],
  },
  {
    key: 'overlay', rec: false,
    name: 'B · Custom code for ONE client',
    tag: 'Overlay',
    body: 'tenants/<slug>/index.ts adds portal-area tools, widgets, a dashboard override and MCP tools on top of core. The deployer refuses to stamp an overlay onto any other tenant.',
    points: [
      'npx tsc -p tenants/tsconfig.json (vite does not typecheck overlays)',
      'fleet build --tenant <slug>, then fleet deploy --artifact core-...-<slug> --tenant <slug>',
      'Overlay data goes through the /api/records bridge - never direct DB access',
    ],
  },
  {
    key: 'platform', rec: false,
    name: 'C · Platform surfaces (HQ, dispatch, email, triggers)',
    tag: 'wrangler direct',
    body: 'The four platform workers are not artifacts - they deploy with wrangler from their own dirs.',
    points: [
      'HQ / email-ingest / trigger-runner: npm run deploy --workspace @portara/<name> (plain wrangler deploy ships HQ a stale build)',
      'dispatch: npx wrangler deploy in apps/dispatch',
      'Export CLOUDFLARE_API_TOKEN from .env first - wrangler OAuth is on another account',
    ],
  },
];

const LOCAL_DEV = `# point dev:core at a real tenant (writes apps/core/.dev.vars from the registry)
npm run fleet -- tenant dev demos
npm run dev:core        # tenant portal on localhost, header stand-in included
npm run dev:hq          # control plane on localhost`;

const SHIP_CORE = `npm run typecheck
npm run fleet -- build                                    # -> core-YYYYMMDD-HHmm
npm run fleet -- deploy --artifact core-... --cohort canary
npm run fleet -- deploy --artifact core-... --cohort stable   # after soak`;

const CONFIG_NOT_CODE =
  'Branding, tool toggles, flags and plan changes are NOT deploys. "fleet tenant settings" or the ' +
  'HQ settings form writes the registry and rewrites KV - the portal picks it up on the next ' +
  'request. Kill switches work the same way (flags.extensions:false reverts a portal to pure core).';

// ── Fleet CLI ────────────────────────────────────────────────────────────────
const CLI = [
  { cmd: 'fleet build [--tenant <slug>]', tag: 'artifact',
    body: 'Builds core into an immutable artifact (overlay builds carry the client slug in the id). fleet artifacts lists them - every one is a rollback target.' },
  { cmd: 'fleet deploy --artifact <id> --cohort canary|stable | --tenant <slug>', tag: 'ship',
    body: 'Stamps the artifact across the cohort (canary first, held never) or onto one tenant. Overlay artifacts are pinned to their tenant both ways.' },
  { cmd: 'fleet tenant provision <slug> --name "..." --plan starter', tag: 'onboard ~2 min',
    body: 'Registry row, business + roles in the data plane, stamp latest artifact, KV route flip, smoke test. Idempotent - resumes if HQ reserved the tenant first.' },
  { cmd: 'fleet tenant settings <slug> --tool +crm --branding accent=#0ea5e9', tag: 'live, no deploy',
    body: 'Bumps config_version, writes the registry, rewrites the KV entry. Same path as the HQ settings form.' },
  { cmd: 'fleet tenant suspend | resume | decommission --yes', tag: 'lifecycle',
    body: 'Suspend = instant 503 at the edge. Decommission unroutes and deletes the Worker but retains data (dropping <slug>_* tables is a separate, deliberate act).' },
  { cmd: 'fleet status / fleet reconcile', tag: 'visibility',
    body: 'status = registry view (status, plan, cohort, version pins). reconcile = drift audit: registry vs deployed scripts vs KV.' },
  { cmd: 'fleet tenant dev <slug> / sync / show / fleet setup', tag: 'utility',
    body: 'dev writes apps/core/.dev.vars for local work; sync re-projects registry to KV; show dumps one tenant; setup is the one-time platform wiring.' },
];

// ── Repo Map ─────────────────────────────────────────────────────────────────
const TREE = `portara-repo/
  apps/
    core/            tenant portal template - built once, stamped everywhere
    dispatch/        front door router (~130 lines: KV lookup + header inject)
    control-plane/   portara.com.au - marketing + HQ staff portal + CRM
    email-ingest/    agent inbox worker (catch-all -> worker_emails)
    trigger-runner/  cron worker - drains due triggers every minute
  fleet/             ops CLI - build / deploy / provision / reconcile
  packages/
    tenant-config/   the shared contract: config shape, header codec,
                     extension API, records client, trigger schedules
  tenants/
    _example/        overlay starter
    demos/           sales-demo overlay (5 tools, dashboard, 23 MCP tools)
  supabase/
    migrations/      0001-0021, applied to PortaraDB (ap-southeast-2)
  platform.config.json                     account ids, KV id, namespace (no secrets)
  README.md / CLAUDE.md / architecture.md  runbook / working notes / rationale`;

const TREE_NOTES = [
  { file: 'npm workspaces', tag: 'clean',
    body: 'packages/* + apps/* + fleet, one lockfile, shared tsconfig.base.json. Everything runs from the root: npm run fleet -- <cmd>, npm run typecheck, npm run dev:core.' },
  { file: 'supabase/migrations', tag: 'sequential',
    body: '21 numbered migrations, each a documented feature step (registry, RLS hardening, MCP OAuth, worker triggers, agent runtime). 0007 was superseded by 0015 (per-tenant record tables) - history preserved, nothing renumbered.' },
  { file: 'apps/core/package.json', tag: 'enforced',
    body: 'Deliberately has NO deploy script - "tenant portals ship only via the fleet CLI" is enforced by structure, not convention. Provision flips the KV route last on the way in; decommission deletes it first on the way out.' },
  { file: 'root', tag: 'tidy',
    body: 'No stray scripts or temp files at the root. The only sprawl is documentation (see Improvements).' },
];

// ── Improvements ─────────────────────────────────────────────────────────────
const VERDICT =
  'The structure is fundamentally sound - clean workspaces, a 132-line dispatch, sequential migrations, ' +
  'a clutter-free root, and core has no deploy script so "tenant deploys only via fleet" is structurally ' +
  'enforced. Everything below is hygiene, not surgery, and none of it violates the platform invariants.';

const IMPROVEMENTS = [
  { n: 1, tag: 'structure', hot: true,
    title: '21 byte-identical files duplicated between core and HQ',
    body: 'apps/core/app and apps/control-plane/app share 21 identical files (all of office3d/, agent-trace, confidence, the agent lib, mcp helpers) plus ~35 same-name-but-diverged ones - the classic silent-drift setup. A packages/portal-ui + packages/agent-core would fit the existing packages/* pattern and touches no invariant.' },
  { n: 2, tag: 'structure', hot: true,
    title: 'Remove the "keep in lockstep" mirror',
    body: 'HQ registry.server.ts re-implements runtimeConfigFor() and tenantMapEntryFor() verbatim from fleet/src/registry.ts, with a comment demanding they stay in lockstep. Both packages already depend on @portara/tenant-config - move the two pure functions there and the requirement disappears.' },
  { n: 3, tag: 'bug risk',
    title: 'Schema default disagrees with the code',
    body: 'Migration 0001 defaults tenants.tools to ["dashboard","office","org"], but DEFAULT_TOOLS dropped "org" (settings are deliberately not a tool). Any row inserted outside fleet provision gets a phantom org tool. One tiny migration fixes the default.' },
  { n: 4, tag: 'docs drift',
    title: 'README contradicts the code in five places',
    body: 'Tools documented at /t/<id> (they mount at /portal/<id>; the same paragraph says both), the component table misses email-ingest and trigger-runner, migrations described as "0001-0003" (there are 21), a finished 2026-07-24 setup checklist still tells you to scrub a deleted .env.example, and a "docs/" reference points at a folder that does not exist.' },
  { n: 5, tag: 'docs',
    title: 'CLAUDE.md is a 612-line dated changelog',
    body: 'Lines 1-55 (invariants, style, commands) are gold; the other ~550 are an append-only environment-state log. Split: keep CLAUDE.md lean, move history to docs/devlog.md, and put the 44 KB architecture doc in docs/ too. Root becomes code + config only.' },
  { n: 6, tag: 'ci gap',
    title: 'Overlay typecheck is manual, and there is no CI',
    body: 'tenants/ is not a workspace, so npm run typecheck silently skips overlays - type errors surface at runtime unless someone remembers npx tsc -p tenants/tsconfig.json. Add "typecheck:tenants" at the root, then one GitHub Action running typecheck on push. Cheap insurance for a two-person repo.' },
  { n: 7, tag: 'hygiene',
    title: 'Env vars are undocumented and .gitignore is thin',
    body: 'fleet/src/env.ts and platform.config.json still point users at the deleted .env.example, so the required vars (SUPABASE_SERVICE_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_AI_GATEWAY_TOKEN) are only discoverable from error messages. Ship a placeholder-only .env.example again. .gitignore also misses .env.* variants (.env.local would commit today) and editor/OS noise.' },
  { n: 8, tag: 'ops',
    title: 'Deploy gotchas live only in CLAUDE.md',
    body: 'Wrangler OAuth points at a different account (export CLOUDFLARE_API_TOKEN before platform worker deploys) and HQ must ship via npm run deploy (plain wrangler deploy serves a stale build). Promote both into the README runbook. Bonus sweep: fleet build error text mentions a "fleet release" command that does not exist.' },
];

// ── Code block helper (mirrors BackendSetup / WorkersDeployPlaybook) ─────────
function Code({ file, label, children }) {
  return (
    <div className="bk-code">
      <div className="bk-code__bar">
        <span className="bk-code__file">{file}</span>
        {label && <span className="bk-code__lang">{label}</span>}
      </div>
      <pre className="bk-code__body">{children}</pre>
    </div>
  );
}

export default function PortaraPlatform() {
  const [view, setView] = useState('One-Pager');

  return (
    <div className="pt-module bk">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card bk-head">
        <div className="bk-head__meta">
          <p className="bk-head__kicker">{HEAD.kicker}</p>
          <h3 className="bk-head__title">{HEAD.title}</h3>
          <p className="bk-head__thesis">{HEAD.thesis}</p>
        </div>
        <div className="bk-head__status">
          <span className="bk-head__status-label">{HEAD.statusLabel}</span>
          <span className="bk-statuschip">{HEAD.status}</span>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="bk-seg" role="tablist" aria-label="Platform views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`bk-seg__tab${v === view ? ' bk-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── ONE-PAGER ───────────────────────────────────────────────────── */}
      {view === 'One-Pager' && (
        <div className="bk-panel" role="tabpanel">

          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">The platform in 30 seconds</span>
            <p>{OP_SUMMARY}</p>
          </div>

          <div className="pt-card bk-railwrap">
            <span className="bk-kicker">Every client request</span>
            <div className="bk-rail">
              {OP_FLOW.map((s) => (
                <div key={s.n} className="bk-rail__step">
                  <span className="bk-rail__n">{s.n}</span>
                  <span className="bk-rail__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <span className="bk-kicker">The three moves</span>
          <div className="bk-paths">
            {OP_MOVES.map((p) => (
              <div key={p.key} className="pt-card bk-path">
                <div className="bk-path__top">
                  <h5 className="bk-path__name">{p.name}</h5>
                  <span className="bk-path__tag">{p.tag}</span>
                </div>
                <p className="bk-path__body">{p.body}</p>
              </div>
            ))}
          </div>

          <span className="bk-kicker">Command cheat sheet</span>
          <Code file="terminal" label="the 6 that matter">{OP_CHEATSHEET}</Code>

          <div className="bk-arch">
            <div className="pt-card bk-archcol bk-archcol--good">
              <span className="bk-archcol__label">Rules that never bend</span>
              <ul className="bk-path__points">
                {OP_RULES.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <div className="pt-card bk-archcol bk-archcol--good">
              <span className="bk-archcol__label">Top three tidy-ups</span>
              <ul className="bk-path__points">
                {OP_TIDY.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="bk-archcol__note">Full list with file paths on the Improvements tab.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      {view === 'How It Works' && (
        <div className="bk-panel" role="tabpanel">

          <div className="bk-arch">
            {[ARCH.tenant, ARCH.hq].map((a) => (
              <div key={a.label} className="pt-card bk-archcol bk-archcol--good">
                <span className="bk-archcol__label">{a.label}</span>
                <div className="bk-archcol__flow">
                  {a.nodes.map((n, i) => (
                    <div key={n} className="bk-archcol__step">
                      <div className={`bk-node${i === a.nodes.length - 1 ? ' bk-node--end' : ''}`}>{n}</div>
                      {i < a.nodes.length - 1 && <span className="bk-arrow"><Icon name="arrowDown" size={14} /></span>}
                    </div>
                  ))}
                </div>
                <p className="bk-archcol__note">{a.note}</p>
              </div>
            ))}
          </div>

          <span className="bk-kicker">The two ideas everything hangs off</span>
          <div className="bk-paths">
            {PIECES.map((p) => (
              <div key={p.key} className={`pt-card bk-path${p.rec ? ' bk-path--rec' : ''}`}>
                <div className="bk-path__top">
                  <h5 className="bk-path__name">{p.name}</h5>
                  <span className={`bk-path__tag${p.rec ? ' bk-path__tag--rec' : ''}`}>{p.tag}</span>
                </div>
                <p className="bk-path__body">{p.body}</p>
                <ul className="bk-path__points">
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <span className="bk-kicker">The five invariants (never violate)</span>
          <div className="bk-steps">
            {INVARIANTS.map((s) => (
              <div key={s.n} className="pt-card bk-step">
                <span className="bk-step__n">{s.n}</span>
                <div className="bk-step__body">
                  <h5 className="bk-step__title">{s.title}</h5>
                  <p className="bk-step__text">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DEV WORKFLOW ────────────────────────────────────────────────── */}
      {view === 'Dev Workflow' && (
        <div className="bk-panel" role="tabpanel">

          <div className="pt-card bk-railwrap">
            <span className="bk-kicker">The daily loop</span>
            <div className="bk-rail">
              {RAIL.map((s) => (
                <div key={s.n} className="bk-rail__step">
                  <span className="bk-rail__n">{s.n}</span>
                  <span className="bk-rail__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <span className="bk-kicker">Three kinds of change, three pipelines</span>
          <div className="bk-paths">
            {WORKFLOWS.map((p) => (
              <div key={p.key} className={`pt-card bk-path${p.rec ? ' bk-path--rec' : ''}`}>
                <div className="bk-path__top">
                  <h5 className="bk-path__name">{p.name}</h5>
                  <span className={`bk-path__tag${p.rec ? ' bk-path__tag--rec' : ''}`}>{p.tag}</span>
                </div>
                <p className="bk-path__body">{p.body}</p>
                <ul className="bk-path__points">
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <span className="bk-kicker">Local dev</span>
          <Code file="terminal" label="local">{LOCAL_DEV}</Code>

          <span className="bk-kicker">Ship a core update to the fleet</span>
          <Code file="terminal" label="ship">{SHIP_CORE}</Code>

          <div className="pt-card bk-warn">
            <span className="bk-kicker bk-kicker--accent">Config is not code</span>
            <p>{CONFIG_NOT_CODE}</p>
          </div>
        </div>
      )}

      {/* ── FLEET CLI ───────────────────────────────────────────────────── */}
      {view === 'Fleet CLI' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">One CLI runs the whole fleet</span>
            <p>Everything from the repo root: <code>npm run fleet -- &lt;cmd&gt;</code> (note the <code>--</code>). Tenant portals deploy ONLY through this - never wrangler directly.</p>
          </div>

          {CLI.map((c) => (
            <div key={c.cmd} className="bk-change">
              <div className="bk-change__head">
                <span className="bk-change__file">{c.cmd}</span>
                <span className="bk-tag">{c.tag}</span>
              </div>
              <p className="bk-change__body">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── REPO MAP ────────────────────────────────────────────────────── */}
      {view === 'Repo Map' && (
        <div className="bk-panel" role="tabpanel">
          <Code file="portara-repo/" label="monorepo">{TREE}</Code>

          {TREE_NOTES.map((f) => (
            <div key={f.file} className="bk-change">
              <div className="bk-change__head">
                <span className="bk-change__file">{f.file}</span>
                <span className="bk-tag">{f.tag}</span>
              </div>
              <p className="bk-change__body">{f.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── IMPROVEMENTS ────────────────────────────────────────────────── */}
      {view === 'Improvements' && (
        <div className="bk-panel" role="tabpanel">
          <div className="pt-card bk-finding">
            <span className="bk-kicker bk-kicker--accent">Verdict first</span>
            <p>{VERDICT}</p>
          </div>

          <div className="bk-steps">
            {IMPROVEMENTS.map((g) => (
              <div key={g.n} className={`pt-card bk-step${g.hot ? ' bk-step--hot' : ''}`}>
                <span className="bk-step__n">{g.n}</span>
                <div className="bk-step__body">
                  <div className="bk-change__head">
                    <h5 className="bk-step__title">{g.title}</h5>
                    <span className="bk-tag">{g.tag}</span>
                  </div>
                  <p className="bk-step__text">{g.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
