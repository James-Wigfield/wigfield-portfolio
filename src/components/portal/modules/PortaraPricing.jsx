import { useState } from 'react';
import Icon from '../icons';
import './PortaraPricing.css';

/* ============================================================================
   PORTARA — PRICING STRATEGY  (Portara section)
   ----------------------------------------------------------------------------
   A visual digest of the Gemini Deep Research competitor & pricing analysis
   (Documents/portal-documents/portara/pricing-analysis.md, July 2026): where
   Portara sits in the Australian custom-portal market, and the recommended
   commercial model — packaged fixed-price builds priced off an internal
   per-tool matrix, three maintenance subscriptions, prepaid AI credits and a
   $990 prototype gate. Self-contained: the constants below are the source of
   truth, rendered with the portal's Reading Room tokens via the shared .pt-* /
   .syl-* classes plus the .ppx-* chart styles (PortaraPricing.css). All charts
   are HTML/CSS, theme-aware, hover/keyboard tooltipped, and every chart has a
   table or direct-label twin so no value is colour- or hover-gated.
   ========================================================================== */

const PROJECT = {
  tag: 'Portara · Pricing strategy',
  title: 'What Portara should charge — and why',
  thesis:
    'Deep-research verdict: the Australian market splits into cheap-but-self-service no-code SaaS ' +
    '($29–$455/mo, you build it yourself) and expensive agencies ($30k–$150k builds). Portara should own the ' +
    'band between them — three fixed-price portal packages ($6.5k / $14.5k / $22k+) priced off an internal ' +
    'per-tool matrix, three maintenance subscriptions ($195 / $395 / $650 per month), prepaid AI credit packs ' +
    'at ~60–65% gross margin, and a $990 prototype that converts by crediting 100% against the build.',
  phase: 'Recommended model · v1',
};

const SIGNALS = [
  { value: '$6.5k–$22k', label: 'packaged portal builds — 3 fixed tiers', accent: true },
  { value: '$195–$650', label: 'monthly subscription tiers' },
  { value: '~60–65%', label: 'gross margin on AI credit packs' },
  { value: '12 mo', label: 'minimum subscription term' },
];

const VIEWS = ['Overview', 'Market', 'Packages & Build', 'Recurring & AI', 'Verticals', 'Risks & Terms'];

// ── Overview ─────────────────────────────────────────────────────────────────
const VERDICTS = [
  ['Per-tool build prices', '$500 / $1,200 / $2,500', 'change', '$750 / $1,650 / $3,200 — at $150–$200/hr agency rates a $500 tool buys ~3 hours, leaving zero margin for testing or fixes.'],
  ['Monthly subscriptions', 'loose $150–$500 points', 'keep & refine', '$195 / $395 / $650 tiers, each justified by its AI allowance and SLA responsiveness.'],
  ['AI usage re-billing', 'raw API cost + 40% markup', 'change', 'Bundled monthly allowance + prepaid $100 credit packs — kills bill shock and lifts effective markup past 100%.'],
  ['Interactive prototype', '~$450', 'change', '$990, 100% credited against the build within 30 days — $450 signals low-end freelance quality.'],
];

const SHIFTS = [
  'Sell packages, not line items — a 17-line-item proposal invites nickel-and-diming; present Starter / Growth / Scale and keep the per-tool matrix as an internal scoping calculator only.',
  'Reposition the prototype at $990 — it filters uncommitted leads, funds real UX discovery, and converts hard when offered as a 100% rebate against the final build.',
  'Move AI billing to prepaid credits — a bundled monthly allowance plus $100 top-up packs (2,000 credits) ends bill-shock risk while holding ~60%+ gross margin.',
  'Formalise subscriptions — $195 / $395 / $650 tiers on 12-month initial terms build the recurring-revenue base the maintenance benchmark (15–25% of build cost per year) says is standard.',
];

// ── Market — competitor landscape ─────────────────────────────────────────────
const BUILD_ROWS = [
  { label: 'No-code SaaS platforms', chip: 'self-built · $0 upfront',
    tip: 'Softr, SuiteDash, Budibase, Retool — no build fee, but your own staff assemble and maintain everything inside the platform’s limits.' },
  { label: 'Perth regional agencies', min: 5000, max: 20000,
    tip: 'Local agencies & freelancers. Small business sites and basic internal tools; fixed-price quotes with 30–50% deposits.' },
  { label: 'Portara packages', min: 6500, max: 22000, plus: true, accent: true,
    points: [{ v: 6500 }, { v: 14500 }, { v: 22000 }],
    tip: 'Recommended: Starter $6,500 · Growth $14,500 · Scale $22,000+. Fixed-price, scoped by the internal tool matrix.' },
  { label: 'AI automation agencies', min: 7500, max: 23000,
    tip: 'Rapid MVP agent builds; $38k–$150k+ for multi-agent enterprise deployments, plus $3k–$15k/mo retainers.' },
  { label: 'Productized dev shops', min: 7500, max: 25000,
    tip: 'Per sprint or fixed feature unit; sold as recurring monthly development subscriptions.' },
  { label: 'National web-app agencies', min: 30000, max: 150000, plus: true,
    tip: 'AppGurus, Appello, WP Creative, Taqwanology. Custom portals at $150–$300/hr blended rates; 600–1,200 hours for a mid-complexity portal.' },
];

const MONTHLY_ROWS = [
  { label: 'No-code SaaS platforms', min: 29, max: 455,
    tip: 'Softr $75–$410 · SuiteDash $29–$150 · Budibase $29–$455 (+$7.50/user). Per-seat models cost a 20-staff SMB $250–$450/mo before any dev work.' },
  { label: 'Perth regional agencies', min: 100, max: 500,
    tip: 'Basic hosting-and-maintenance retainers on small business builds.' },
  { label: 'Portara subscriptions', min: 195, max: 650, accent: true,
    points: [{ v: 195 }, { v: 395 }, { v: 650 }],
    tip: 'Recommended: Essential $195 · Growth $395 · Scale $650 — hosting, maintenance, SLA and bundled AI credit allowances.' },
  { label: 'National web-app agencies', min: 500, max: 2000, plus: true,
    tip: 'Ongoing maintenance and support on $30k+ custom builds.' },
  { label: 'Productized dev shops', min: 3000, max: 8000,
    tip: 'Unlimited-dev / sprint subscription retainers.' },
  { label: 'AI agency retainers', min: 3000, max: 15000,
    tip: 'Ongoing optimisation retainers behind custom agent deployments.' },
];

const COMPETITOR_TABLE = [
  ['National web-app agencies', '$30k – $150k+', '$500 – $2,000+', 'T&M or milestone fixed-price · $150–$300/hr'],
  ['Perth agencies & freelancers', '$5k – $20k', '$100 – $500', 'Fixed-price quotes · 30–50% upfront deposits'],
  ['Productized dev shops', '$7.5k – $25k /sprint', '$3k – $8k retainer', 'Recurring monthly dev subscriptions'],
  ['Softr', '$0 (self-built)', '$75 – $410', 'Tiered SaaS — user + record caps; API/SQL locked to top tiers'],
  ['SuiteDash', '$0 (self-built)', '$29 – $150', 'Flat-rate SaaS — unlimited users, rigid pre-built modules'],
  ['Budibase', '$0 (self-built)', '$29 – $455 + $7.50/user', 'Cloud tiers + per-creator and per-end-user seats'],
  ['Retool', '$0 (self-built)', '$18/builder + $11/user', 'Per-seat + metered AI usage credits'],
  ['AI automation agencies', '$7.5k – $23k MVP', '$3k – $15k retainer', 'Custom scoped build + 10–30% token markup'],
  ['Portara (recommended)', '$6.5k – $22k+ packages', '$195 – $650 tiers', 'Fixed packages + subscriptions + prepaid AI credits'],
];

// ── Packages & build ──────────────────────────────────────────────────────────
const TIERS = [
  {
    name: 'Core Operational Portal', price: '$6,500', sub: '+ $195/mo Essential subscription',
    who: 'Basic operational alignment for a first portal.',
    items: ['Up to 5 essential tools', 'Staff Dashboard · Customer Directory', 'Job Tracker · Document Vault', 'Team Roster'],
  },
  {
    name: 'Business Growth Portal', price: '$14,500', sub: '+ $395/mo Growth subscription', target: true,
    who: 'Comprehensive workflow automation — the tier proposals should anchor on.',
    items: ['Up to 10 tools (Core + 5)', 'Quotes & Estimates · Commission Calculator', 'Automated client notifications · inventory', 'Conversational MCP AI assistant'],
  },
  {
    name: 'Full Enterprise Platform', price: '$22,000+', sub: '+ $650/mo Scale subscription',
    who: 'Fully bespoke operational setup for multi-site groups.',
    items: ['16+ tools', 'Multi-agent autonomous background workers', 'Bi-directional APIs — Xero, MYOB, Fred Dispense, CRMs', 'Multi-role permission matrices'],
  },
];

const TOOL_DUMBBELL = [
  { label: 'Low-complexity tool', from: 500, to: 750, delta: '+50%',
    tip: 'Basic CRUD, static forms, standard database tables. ~4–5 hours of dev + testing at the new price.' },
  { label: 'Medium-complexity tool', from: 1200, to: 1650, delta: '+38%',
    tip: 'Dynamic calculations, multi-role filtering, PDF generation, webhook triggers. ~9–11 hours.' },
  { label: 'High-complexity tool', from: 2500, to: 3200, delta: '+28%',
    tip: 'Bi-directional API sync (Xero, MYOB, CRMs), state-machine logic, real-time messaging. Protects margin on 20+ hour integrations.' },
  { label: 'Interactive prototype', from: 450, to: 990, delta: '+120%',
    tip: 'Figma prototype + discovery phase; 100% credited against the build if executed within 30 days.' },
];

const MATRIX_TABLE = [
  ['Low', '$750', '~4–5 h', 'Basic CRUD operations, static forms, standard database tables'],
  ['Medium', '$1,650', '~9–11 h', 'Dynamic calculations, multi-role data filtering, PDF generation, webhook triggers'],
  ['High', '$3,200', '~18–21 h', 'Bi-directional API sync (Xero, MYOB, CRMs), state-machine logic, real-time messaging, custom canvas UI'],
  ['Prototype', '$990', 'discovery', 'Interactive Figma prototype + UX discovery — 100% credited toward the build within 30 days'],
];

const BUILD_GUARDS = [
  'The matrix is an internal scoping calculator — never shown to clients. Seventeen itemised line items make buyers strip tools out (“remove the Commission Calculator”) and gut the portal’s usefulness.',
  'Minimum initial build threshold: $5,000 for any portal deployment — blocks unviable 2–3-tool cherry-picked projects.',
  'Legacy Integration Surcharge: +$1,500 when an API has no modern REST/GraphQL endpoints or documentation — assessed during the $990 prototype’s technical feasibility audit.',
  'At a $150/hr cost baseline the old $500 low tier bought 3.3 hours all-in; the re-priced matrix restores margin as long as builds lean on pre-engineered modules, reusable Cloudflare Worker endpoints and standard UI components.',
];

// ── Recurring & AI ────────────────────────────────────────────────────────────
const SUB_TABLE = [
  ['Essential', '$195 /mo', 'up to 5', '—', 'Cloudflare hosting, SSL, daily backups, security patches, 99.5% uptime SLA'],
  ['Growth', '$395 /mo', 'up to 12', '$30 /mo credits', '+ priority bug support and MCP AI assistant maintenance'],
  ['Scale', '$650 /mo', '12+', '$60 /mo credits', '+ high-performance hosting, multi-agent execution monitoring, SLA support, 1 h/mo minor UI updates'],
];

const MAINT_TABLE = [
  ['$15,000 build', '$2,250 – $3,750 /yr', '$187.50 – $312.50 /mo'],
  ['$25,000 build', '$3,750 – $6,250 /yr', '$312.50 – $520.83 /mo'],
];

const AI_RULES = [
  'Every subscription bundles a monthly quota of AI Action Credits (e.g. 2,500). One credit = one standardised action: a quote summary generated, a roster cost recalculated, a job ticket parsed.',
  'On exhaustion, background agents pause gracefully — no silent spend. A prepaid $100 top-up pack adds 2,000 credits, triggered only by client opt-in or pre-authorisation.',
  'Automated alerts fire at 80% of quota, so a top-up is never a surprise invoice.',
  'Cost floor: mid-tier model tokens run ≈ $2.50–$3.00 USD per million input / $15 USD per million output, and prompt caching cuts repeat input cost by up to 90% — a $100 pack costs Portara ~$35–$40 to serve.',
  'Hard bounds at the API gateway — max tool-iterations per task and per-client dollar caps — stop runaway agent loops, the one risk the analysis rates CRITICAL.',
];

// ── Verticals ─────────────────────────────────────────────────────────────────
const CAPEX_ROWS = [
  { label: 'Trade services', min: 5000, max: 15000,
    tip: 'Plumbers, electricians, builders (3–30 staff). Moderate capex tolerance — the portal must kill field paperwork, speed up dispatch, or stop lost billing.' },
  { label: 'Community pharmacies', min: 8000, max: 20000,
    tip: 'Dispense + retail (3–30 staff). Budgets for admin portals covering rostering, intern compliance and multi-store handover logs.' },
  { label: 'Real estate agencies', min: 10000, max: 25000,
    tip: 'PM & sales (3–30 staff). Highest willingness-to-pay — commission automation, PM onboarding, automated vendor reporting.' },
  { label: 'Portara packages', min: 6500, max: 22000, accent: true,
    points: [{ v: 6500 }, { v: 14500 }, { v: 22000 }],
    tip: 'Starter $6,500 · Growth $14,500 · Scale $22,000 — every package lands inside at least one sector’s stated budget band.' },
];

const OPEX_ROWS = [
  { label: 'Trade services', min: 300, max: 1200,
    tip: 'ServiceM8 / Tradify / Fergus ($150–$400) + Xero or MYOB ($60–$150) and add-ons.' },
  { label: 'Real estate agencies', min: 800, max: 2500,
    tip: 'Rex / VaultRE / MRI CRMs plus inspection and trust-accounting tools.' },
  { label: 'Community pharmacies', min: 1000, max: 3500,
    tip: 'Certified practice management systems — Fred IT, Minfos, Corum.' },
  { label: 'Portara subscriptions', min: 195, max: 650, accent: true,
    points: [{ v: 195 }, { v: 395 }, { v: 650 }],
    tip: 'Essential $195 · Growth $395 · Scale $650 — a fraction of what each sector already pays for software every month.' },
];

const SECTOR_TABLE = [
  ['Trade services', 'ServiceM8 · Tradify · Fergus + Xero/MYOB', '$300 – $1,200 /mo', '$5k – $15k', 'Kill field paperwork, faster job dispatch, no lost billing'],
  ['Real estate agencies', 'Rex · VaultRE · MRI + trust accounting', '$800 – $2,500 /mo', '$10k – $25k', 'Commission automation, PM onboarding, vendor reporting'],
  ['Community pharmacies', 'Fred IT · Minfos · Corum', '$1,000 – $3,500 /mo', '$8k – $20k', 'Shift rostering, intern compliance, multi-store handover logs'],
];

// ── Risks & terms ─────────────────────────────────────────────────────────────
const RISKS = [
  { mode: 'Autonomous agent looping & compute spikes', sev: 'critical',
    cause: 'Uncapped multi-agent reasoning loops in Cloudflare Workers generating thousands of LLM calls in the background.',
    fix: 'Strict execution bounds: max ~5 tool executions per task and hard per-client dollar caps at the API gateway.' },
  { mode: 'The API integration complexity trap', sev: 'high',
    cause: 'Underestimating legacy APIs (pharmacy dispense software, Xero OAuth edge cases) on $3,200 High-tier tools.',
    fix: 'Mandatory API feasibility audit inside the $990 prototype; +$1,500 Legacy Integration Surcharge where no modern endpoints exist.' },
  { mode: 'Scope creep via maintenance tiers', sev: 'high',
    cause: 'Clients pushing new features through as “monthly maintenance”.',
    fix: 'Contracts define maintenance as uptime, security updates and bug fixes on delivered code; all functional change goes through paid Change Orders.' },
  { mode: 'AI overages & client bill shock', sev: 'high',
    cause: 'Unpredictable usage invoices ($50 → $500 months) driving disputes and cancellations.',
    fix: 'Prepaid credit model with 80% alerts and opt-in top-ups — clients can never be surprise-billed.' },
  { mode: 'Unbundled cherry-picking', sev: 'medium',
    cause: 'Clients selecting 2–3 cheap tools off an itemised proposal, producing unviable projects.',
    fix: '$5,000 minimum initial build and package-only proposals.' },
];

const TERMS = [
  '40% non-refundable deposit on contract execution, before engineering allocation.',
  '35% at staging deployment + feature-complete client review; final 25% at production launch, UAT sign-off and domain pointing.',
  '12-month minimum on all subscriptions, then month-to-month with 30-day written cancellation notice — the initial term amortises provisioning and onboarding.',
  'Scope change protocol: anything outside the signed SOW triggers a Change Order — minor work at $165/hr (2-hour minimum block), major features priced via the tool matrix as milestone addendums.',
];

// ── Formatting + chart primitives ────────────────────────────────────────────
const fmtK = (v) => {
  if (v >= 1000) {
    const k = v / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `$${v}`;
};
const fmtFull = (v) => `$${v.toLocaleString('en-AU')}`;

/* Horizontal range chart (HTML/CSS). Emphasis form: the accent row is the
   subject, grey rows are market context — every row is text-labelled and
   carries its min–max as a direct label, so nothing rides on colour alone. */
function RangeChart({ title, note, domain, log = false, ticks, rows, legend, caption }) {
  const [d0, d1] = domain;
  const lo = log ? Math.log10(d0) : d0;
  const hi = log ? Math.log10(d1) : d1;
  const pos = (v) => (((log ? Math.log10(v) : v) - lo) / (hi - lo)) * 100;
  const tickMod = (t) => (pos(t) < 2 ? ' ppx-ticks__t--first' : pos(t) > 98 ? ' ppx-ticks__t--last' : '');

  return (
    <figure className="pt-card ppx-viz">
      <figcaption className="ppx-viz__head">
        <span className="syl-kicker">{title}</span>
        <span className="ppx-viz__note">{note}</span>
      </figcaption>
      <div className="ppx-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className={`ppx-ticks__t${tickMod(t)}`} style={{ left: `${pos(t)}%` }}>{fmtK(t)}</span>
        ))}
      </div>
      <div className="ppx-rows">
        {rows.map((r) => {
          const hasBar = r.max != null;
          const p0 = hasBar ? pos(r.min) : 0;
          const p1 = hasBar ? pos(r.max) : 0;
          const rangeText = hasBar ? `${fmtK(r.min)}–${fmtK(r.max)}${r.plus ? '+' : ''}` : r.chip;
          const flip = hasBar && p1 > 72;
          const tipx = hasBar ? Math.min(80, Math.max(20, (p0 + p1) / 2)) : 25;
          return (
            <div key={r.label} className="ppx-row">
              <span className="ppx-row__label">
                {r.label}
                {r.accent && <span className="ppx-row__you">Portara</span>}
              </span>
              <div
                className={`ppx-row__track${r.accent ? ' ppx-row__track--accent' : ''}`}
                tabIndex={0}
                aria-label={`${r.label}: ${rangeText}. ${r.tip}`}
                style={{ '--tipx': `${tipx}%` }}
              >
                {ticks.map((t) => <i key={t} className="ppx-gridline" style={{ left: `${pos(t)}%` }} />)}
                {hasBar ? (
                  <>
                    <span className="ppx-bar" style={{ left: `${p0}%`, width: `${Math.max(p1 - p0, 0.8)}%` }} />
                    {(r.points || []).map((p) => (
                      <i key={p.v} className="ppx-point" style={{ left: `${pos(p.v)}%` }} />
                    ))}
                    <span
                      className={`ppx-bar__val${flip ? ' ppx-bar__val--flip' : ''}`}
                      style={flip ? { right: `${100 - p0}%` } : { left: `${p1}%` }}
                    >
                      {rangeText}
                    </span>
                  </>
                ) : (
                  <span className="ppx-nobar">{r.chip}</span>
                )}
                <span className="ppx-tip">
                  <strong>{r.label}</strong>
                  <span>{r.tip}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {legend && (
        <div className="ppx-legend">
          {legend.map((l) => (
            <span key={l.label} className="ppx-legend__item">
              <i className={`ppx-legend__swatch ppx-legend__swatch--${l.tone}`} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {caption && <p className="ppx-viz__cap">{caption}</p>}
    </figure>
  );
}

/* Dumbbell: before → after per item, one hue in two validated shades. */
function Dumbbell({ title, note, domain, ticks, rows, caption }) {
  const [d0, d1] = domain;
  const pos = (v) => ((v - d0) / (d1 - d0)) * 100;
  const tickMod = (t) => (pos(t) < 2 ? ' ppx-ticks__t--first' : pos(t) > 98 ? ' ppx-ticks__t--last' : '');

  return (
    <figure className="pt-card ppx-viz">
      <figcaption className="ppx-viz__head">
        <span className="syl-kicker">{title}</span>
        <span className="ppx-viz__note">{note}</span>
      </figcaption>
      <div className="ppx-ticks ppx-ticks--dumb" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className={`ppx-ticks__t${tickMod(t)}`} style={{ left: `${pos(t)}%` }}>{fmtK(t)}</span>
        ))}
      </div>
      <div className="ppx-rows">
        {rows.map((r) => {
          const pf = pos(r.from);
          const pt = pos(r.to);
          return (
            <div key={r.label} className="ppx-row ppx-row--dumb">
              <span className="ppx-row__label">{r.label}</span>
              <div
                className="ppx-row__track"
                tabIndex={0}
                aria-label={`${r.label}: draft ${fmtFull(r.from)} to recommended ${fmtFull(r.to)} (${r.delta}). ${r.tip}`}
                style={{ '--tipx': `${Math.min(80, Math.max(20, (pf + pt) / 2))}%` }}
              >
                {ticks.map((t) => <i key={t} className="ppx-gridline" style={{ left: `${pos(t)}%` }} />)}
                <span className="ppx-dumb__link" style={{ left: `${pf}%`, width: `${pt - pf}%` }} />
                <i className="ppx-dumb__dot ppx-dumb__dot--from" style={{ left: `${pf}%` }} />
                <i className="ppx-dumb__dot ppx-dumb__dot--to" style={{ left: `${pt}%` }} />
                <span className="ppx-dumb__val ppx-dumb__val--from" style={{ right: `${100 - pf}%` }}>{fmtFull(r.from)}</span>
                <span className="ppx-dumb__val ppx-dumb__val--to" style={{ left: `${pt}%` }}>{fmtFull(r.to)}</span>
                <span className="ppx-tip">
                  <strong>{r.label}</strong>
                  <span>{r.tip}</span>
                </span>
              </div>
              <span className="ppx-row__delta">{r.delta}</span>
            </div>
          );
        })}
      </div>
      <div className="ppx-legend">
        <span className="ppx-legend__item"><i className="ppx-legend__swatch ppx-legend__swatch--dot ppx-legend__swatch--soft" />Draft price</span>
        <span className="ppx-legend__item"><i className="ppx-legend__swatch ppx-legend__swatch--dot ppx-legend__swatch--deep" />Recommended price</span>
      </div>
      {caption && <p className="ppx-viz__cap">{caption}</p>}
    </figure>
  );
}

/* Single 100% stacked bar with 2px surface gaps; legend carries the detail. */
function SplitBar({ title, note, aria, segments, caption }) {
  return (
    <figure className="pt-card ppx-viz">
      <figcaption className="ppx-viz__head">
        <span className="syl-kicker">{title}</span>
        <span className="ppx-viz__note">{note}</span>
      </figcaption>
      <div className="ppx-split" role="img" aria-label={aria}>
        {segments.map((s) => (
          <span key={s.label} className={`ppx-split__seg ppx-split__seg--${s.tone}`} style={{ flexGrow: s.pct, flexBasis: 0 }}>
            <span className="ppx-split__segval">{s.inline}</span>
          </span>
        ))}
      </div>
      <div className="ppx-legend">
        {segments.map((s) => (
          <span key={s.label} className="ppx-legend__item">
            <i className={`ppx-legend__swatch ppx-legend__swatch--${s.tone}`} />
            {s.label}
          </span>
        ))}
      </div>
      {caption && <p className="ppx-viz__cap">{caption}</p>}
    </figure>
  );
}

function DataTable({ head, rows, hotIndex }) {
  return (
    <div className="ppx-tablewrap">
      <table className="ppx-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className={i === hotIndex ? 'ppx-table__hot' : undefined}>
              {r.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Small helpers shared with the other syl-styled tabs ─────────────────────────
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

export default function PortaraPricing() {
  const [view, setView] = useState('Overview');

  // Print → Save as PDF. All six sections are always in the DOM (the inactive
  // ones hidden by .ppx-sec--off, which @media print reveals), so the browser's
  // print pipeline captures the full document — Ctrl+P works identically.
  const exportPdf = () => {
    const prev = document.title;
    document.title = 'portara-pricing-strategy';
    window.print();
    document.title = prev;
  };

  const sec = (v) => `ppx-sec${view === v ? '' : ' ppx-sec--off'}`;

  return (
    <div className="pt-module syl ppx">
      {/* While this module is mounted, printed pages get document margins —
          overriding the portal-wide full-bleed @page that Wall Art needs.
          A mounted <style> outranks bundled CSS and unmounts with the tab. */}
      <style>{'@media print { @page { size: A4 portrait; margin: 11mm 10mm 13mm; } }'}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card syl-head">
        <div className="syl-head__meta">
          <p className="syl-head__tag">{PROJECT.tag}</p>
          <h3 className="syl-head__title">{PROJECT.title}</h3>
          <p className="syl-head__thesis">{PROJECT.thesis}</p>
          <p className="ppx-src">Source: Gemini Deep Research · Documents/portal-documents/portara/pricing-analysis.md · July 2026 · all figures AUD</p>
        </div>
        <div className="syl-head__phase">
          <span className="syl-head__phase-label">Status</span>
          <span className="syl-phasechip">{PROJECT.phase}</span>
          <button className="ppx-export" onClick={exportPdf} title="Print all six sections to a PDF">
            <Icon name="printer" size={14} />
            Export PDF
          </button>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="syl-seg" role="tablist" aria-label="Pricing strategy sections">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      <section className={sec('Overview')}>
        <h4 className="ppx-print-title" aria-hidden="true">Overview</h4>
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>
          <Northstar kicker="The market gap" accent>
            SMB buyers face a binary today: no-code SaaS at $29–$455/month that <strong>they must build and
            babysit themselves</strong>, or agencies at $30k–$150k+ that most 3–30-staff businesses can’t
            justify. Portara’s packages ($6.5k–$22k) with managed subscriptions ($195–$650/mo) occupy the band
            in between — fully managed, fit-for-purpose, and still inside a rational 12-month-ROI capex
            decision for trades, real estate and pharmacy.
          </Northstar>
          <Northstar kicker="The recommended model">
            Price every tool internally on a three-tier complexity matrix (<strong>$750 / $1,650 /
            $3,200</strong>), but sell only three named packages (<strong>$6,500 / $14,500 / $22,000+</strong>).
            Attach a maintenance subscription (<strong>$195 / $395 / $650</strong>, 12-month initial term), bill
            AI usage as bundled credits with prepaid $100 top-up packs, and open every deal with a
            <strong> $990 prototype</strong> credited 100% against the build.
          </Northstar>
          <div>
            <span className="syl-kicker">What the research changed vs the draft model</span>
            <DataTable
              head={['Element', 'Draft', 'Verdict', 'Recommended']}
              rows={VERDICTS.map(([el, draft, verdict, rec]) => [
                el,
                <span className="ppx-num" key="d">{draft}</span>,
                <span className="syl-tag" key="v">{verdict}</span>,
                rec,
              ])}
            />
          </div>
          <BulletCard kicker="Four immediate shifts" accent items={SHIFTS} />
        </div>
      </section>

      {/* ── MARKET ──────────────────────────────────────────────────────── */}
      <section className={sec('Market')}>
        <h4 className="ppx-print-title" aria-hidden="true">Market</h4>
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Every provider category in the Australian landscape, converted to AUD, on two axes that matter:
            what a build costs upfront, and what clients keep paying monthly. Portara’s recommended bands are
            highlighted; both charts share the full table below.
          </p>
          <RangeChart
            title="Upfront build / setup cost by provider"
            note="AUD · log scale"
            domain={[3000, 200000]} log
            ticks={[5000, 10000, 25000, 50000, 100000]}
            rows={BUILD_ROWS}
            legend={[
              { tone: 'main', label: 'Portara (recommended)' },
              { tone: 'ctx', label: 'Market benchmark' },
            ]}
            caption="Dots on the Portara bar mark the three packages — Starter $6,500 · Growth $14,500 · Scale $22,000+. Portara prices above self-service platforms but far below the $30k floor where national agencies start."
          />
          <RangeChart
            title="Ongoing monthly cost by provider"
            note="AUD / month · log scale"
            domain={[20, 20000]} log
            ticks={[50, 100, 500, 1000, 5000, 10000]}
            rows={MONTHLY_ROWS}
            legend={[
              { tone: 'main', label: 'Portara (recommended)' },
              { tone: 'ctx', label: 'Market benchmark' },
            ]}
            caption="Dots mark the three subscription tiers — $195 · $395 · $650. Portara sits just above raw SaaS licensing but an order of magnitude under productized and AI-agency retainers."
          />
          <div>
            <span className="syl-kicker">Full competitor pricing table</span>
            <DataTable
              head={['Provider', 'Build / setup (AUD)', 'Ongoing (AUD/mo)', 'Commercial model']}
              rows={COMPETITOR_TABLE.map(([a, b, c, d]) => [
                a,
                <span className="ppx-num" key="b">{b}</span>,
                <span className="ppx-num" key="c">{c}</span>,
                d,
              ])}
              hotIndex={COMPETITOR_TABLE.length - 1}
            />
          </div>
          <div className="pt-card syl-monet">
            <span className="syl-kicker">Why the middle band is winnable</span>
            <p>
              No-code platforms look cheap but push the real cost onto the client — internal staff hours
              configuring workflows, managing user/record caps, and stitching together disconnected automation
              tools. Agencies remove that burden but start at $30,000. A fully managed custom portal at
              $6.5k–$22k is the price no-code buyers can reach <em>up</em> to and agency-priced buyers can
              reach <em>down</em> to — and neither group is being served there today.
            </p>
          </div>
        </div>
      </section>

      {/* ── PACKAGES & BUILD ────────────────────────────────────────────── */}
      <section className={sec('Packages & Build')}>
        <h4 className="ppx-print-title" aria-hidden="true">Packages &amp; Build</h4>
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Two layers: an internal per-tool complexity matrix that does the scoping math, and three named
            packages that do the selling. Buyers see packages; the matrix never leaves the building.
          </p>
          <div className="ppx-tiers">
            {TIERS.map((t) => (
              <div key={t.name} className={`pt-card ppx-tier${t.target ? ' ppx-tier--target' : ''}`}>
                {t.target && <span className="ppx-tier__flag">Target tier</span>}
                <h5 className="ppx-tier__name">{t.name}</h5>
                <p className="ppx-tier__price">{t.price}<span>fixed build</span></p>
                <p className="ppx-tier__sub">{t.sub}</p>
                <p className="ppx-tier__who">{t.who}</p>
                <ul className="ppx-tier__list">
                  {t.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <Dumbbell
            title="Internal tool matrix — draft vs recommended pricing"
            note="AUD per tool"
            domain={[0, 4000]}
            ticks={[0, 1000, 2000, 3000, 4000]}
            rows={TOOL_DUMBBELL}
            caption="Every draft price moved up. The research’s core margin argument: at $150–$200/hr local rates, a $500 tool bought ~3 hours of combined dev, design and testing — zero slack for bugs. The $990 prototype doubles as lead qualification and converts via a 100% build credit."
          />
          <div>
            <span className="syl-kicker">The matrix as scope contract</span>
            <DataTable
              head={['Tier', 'Price', 'Hours covered', 'Scope boundary']}
              rows={MATRIX_TABLE.map(([a, b, c, d]) => [
                a,
                <span className="ppx-num" key="b">{b}</span>,
                <span className="ppx-num" key="c">{c}</span>,
                d,
              ])}
            />
          </div>
          <BulletCard kicker="Packaging guardrails" items={BUILD_GUARDS} />
        </div>
      </section>

      {/* ── RECURRING & AI ──────────────────────────────────────────────── */}
      <section className={sec('Recurring & AI')}>
        <h4 className="ppx-print-title" aria-hidden="true">Recurring &amp; AI</h4>
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Recurring revenue comes from two engines: maintenance subscriptions pegged to the industry-standard
            15–25%-of-build benchmark, and AI usage sold as prepaid credits instead of a raw percentage markup.
          </p>
          <div>
            <span className="syl-kicker syl-kicker--accent">Subscription tiers</span>
            <DataTable
              head={['Tier', 'Price', 'Tools', 'AI allowance', 'Includes']}
              rows={SUB_TABLE.map(([a, b, c, d, e]) => [
                a,
                <span className="ppx-num" key="b">{b}</span>,
                <span className="ppx-num" key="c">{c}</span>,
                <span className="ppx-num" key="d">{d}</span>,
                e,
              ])}
            />
          </div>
          <div className="pt-card syl-monet">
            <span className="syl-kicker">The 15–25% maintenance benchmark</span>
            <p>
              Industry standard: annual maintenance, hosting and support should equal <strong>15–25% of the
              original build cost</strong>. The recommended tiers sit exactly on that band — which makes them
              defensible in a negotiation rather than arbitrary.
            </p>
            <DataTable
              head={['Example build', '15–25% per year', 'Monthly recurring revenue']}
              rows={MAINT_TABLE.map(([a, b, c]) => [
                a,
                <span className="ppx-num" key="b">{b}</span>,
                <span className="ppx-num" key="c">{c}</span>,
              ])}
            />
          </div>
          <SplitBar
            title="Anatomy of a $100 AI credit top-up pack"
            note="2,000 action credits per pack"
            aria="Of a $100 credit pack, roughly $37.50 is direct API compute cost and $62.50 is Portara gross margin."
            segments={[
              { pct: 37.5, tone: 'ctx', inline: '~$37.50', label: 'Direct API compute cost (~$35–$40)' },
              { pct: 62.5, tone: 'main', inline: '~$62.50', label: 'Portara gross margin (~60–65%)' },
            ]}
            caption="Packaging raw token usage into standardised credits abstracts token volatility, caps the client’s exposure, and holds a 100–250% effective markup — versus the draft model’s fragile flat 40% pass-through."
          />
          <BulletCard kicker="How the credit model works" accent items={AI_RULES} />
        </div>
      </section>

      {/* ── VERTICALS ───────────────────────────────────────────────────── */}
      <section className={sec('Verticals')}>
        <h4 className="ppx-print-title" aria-hidden="true">Verticals</h4>
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The three target WA sectors — trades, real estate, pharmacy — each carry a stated budget band for a
            custom portal and an existing monthly software bill. Portara’s pricing lands inside both.
          </p>
          <RangeChart
            title="Capex budget for a custom staff portal, by sector"
            note="AUD · linear scale"
            domain={[0, 28000]}
            ticks={[0, 5000, 10000, 15000, 20000, 25000]}
            rows={CAPEX_ROWS}
            legend={[
              { tone: 'main', label: 'Portara packages' },
              { tone: 'ctx', label: 'Sector budget band' },
            ]}
            caption="Dots mark Starter $6,500 · Growth $14,500 · Scale $22,000. Starter fits every sector’s band; Growth targets real estate and pharmacy; Scale stretches only the top of the real-estate band."
          />
          <RangeChart
            title="What these sectors already spend on software monthly"
            note="AUD / month · linear scale"
            domain={[0, 3800]}
            ticks={[0, 1000, 2000, 3000]}
            rows={OPEX_ROWS}
            legend={[
              { tone: 'main', label: 'Portara subscriptions' },
              { tone: 'ctx', label: 'Current sector spend' },
            ]}
            caption="A $195–$650 subscription is a marginal add to bills these businesses already pay — pharmacies spend up to $3,500/month on practice management alone."
          />
          <div>
            <span className="syl-kicker">Sector profiles</span>
            <DataTable
              head={['Sector (3–30 staff)', 'Core systems', 'Software spend', 'Portal budget', 'What unlocks the sale']}
              rows={SECTOR_TABLE.map(([a, b, c, d, e]) => [
                a, b,
                <span className="ppx-num" key="c">{c}</span>,
                <span className="ppx-num" key="d">{d}</span>,
                e,
              ])}
            />
          </div>
          <div className="pt-card syl-monet">
            <span className="syl-kicker">The ROI pitch that closes it</span>
            <p>
              For an SMB doing $1M–$5M revenue, an $8k–$18k portal is a rational asset purchase if it saves
              5–10 admin hours a week. At $35–$45/hr (plus super), <strong>8 hours saved weekly ≈ $18,000/year
              in labour</strong> — full payback inside 12 months, with the $250–$450/mo subscription sitting
              comfortably inside a normal SMB IT budget.
            </p>
          </div>
        </div>
      </section>

      {/* ── RISKS & TERMS ───────────────────────────────────────────────── */}
      <section className={sec('Risks & Terms')}>
        <h4 className="ppx-print-title" aria-hidden="true">Risks &amp; Terms</h4>
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The hybrid model (custom builds + SaaS subscriptions + autonomous AI) has five known failure modes,
            each with a contractual or technical mitigation — plus the milestone and term structure that
            protects cash flow.
          </p>
          <SplitBar
            title="Milestone billing structure"
            note="% of fixed build price"
            aria="Milestone billing: 40% deposit at project initiation, 35% at staging deployment, 25% at production launch."
            segments={[
              { pct: 40, tone: 's1', inline: '40%', label: 'M1 · Deposit — contract execution, non-refundable' },
              { pct: 35, tone: 's2', inline: '35%', label: 'M2 · Staging deployment + feature-complete review' },
              { pct: 25, tone: 's3', inline: '25%', label: 'M3 · Production launch + UAT sign-off' },
            ]}
            caption="Standard Australian agency practice runs 30–50% deposits; 40% keeps Portara cash-flow positive through the build without scaring conservative SMB buyers."
          />
          <BulletCard kicker="Contract terms" accent items={TERMS} />
          <div>
            <span className="syl-kicker">Failure modes & mitigations</span>
            <DataTable
              head={['Failure mode', 'Severity', 'Root cause', 'Mitigation']}
              rows={RISKS.map((r) => [
                r.mode,
                <span className={`ppx-sev ppx-sev--${r.sev}`} key="s">{r.sev}</span>,
                r.cause,
                r.fix,
              ])}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
