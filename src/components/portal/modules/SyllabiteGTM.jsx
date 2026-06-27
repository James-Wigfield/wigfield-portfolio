import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   SYLLABITE — GO-TO-MARKET & MONETISATION STRATEGY  (Syllabite section)
   ----------------------------------------------------------------------------
   A founder-level operating plan for taking Syllabite public, monetising the
   traffic and future-proofing the codebase — grounded in the venture's actual
   constraints (free-for-students, contextual ads + WA university sponsorships,
   no behavioural tracking of a 16–18 audience, a ~2-year student lifecycle).
   Self-contained: the constants below are the source of truth, rendered with
   the portal's Reading Room tokens via the shared .syl-* / .pt-* classes.
   This is a PLANNING DELIVERABLE — it documents how and in what order to do the
   work, not the work itself (no accounts created, no domains bought).
   ========================================================================== */

const PROJECT = {
  tag: 'Syllabite · Go-to-market & monetisation',
  title: 'Taking Syllabite public — and making it pay',
  thesis:
    'Keep the core 100% free; earn from the audience, not the student. Contextual ads now, direct ' +
    'WA-university sponsorships next, an optional AI practice-question pass later. Every call here is ' +
    'shaped by one hard fact: a student uses Syllabite for at most two ATAR years and then graduates — ' +
    'so the model favours annual, cohort-based value over recurring subscriptions.',
  phase: 'Planning · pre-launch',
};

const SIGNALS = [
  { value: 'Free', label: 'core — always, for students', accent: true },
  { value: '~2 yr', label: 'student lifecycle, then churn' },
  { value: '3', label: 'revenue lines, sequenced' },
  { value: 'WA', label: 'beachhead — ATAR' },
];

const VIEWS = ['Overview', 'Domains', 'Advertising', 'Paid Tiers', 'Marketing', 'Roadmap'];

// ── Overview ─────────────────────────────────────────────────────────────────
const NON_NEGOTIABLES = [
  'Contextual ads only — no behavioural tracking. The audience is 16–18, so Australian privacy law and Google’s teen-audience policies forbid personalised targeting.',
  'Never paywall the free core. The free product is the asset that creates the traffic and the subject-segmented audience that ads and sponsors pay for.',
  'Original content only — official syllabuses and past papers are structural blueprints, never regurgitated.',
  'Market as “independent” and “built to align with the syllabus” — never claim SCSA or TISC endorsement.',
  'The brand is always “Syllabite” — the “Syllabyte” spelling is trademarked elsewhere.',
];

// ── A. Domains & brand ───────────────────────────────────────────────────────
const DOMAIN_TRADEOFF = {
  name: 'syllabite.io  vs  syllabite.com.au',
  lacks: 'syllabite.io is generic and techie — little local trust with students, parents, schools or universities, and no Australian search signal.',
  edge: 'syllabite.com.au is unmistakably local: it earns trust with an AU school audience, strengthens AU search ranking, and matches the “independent Australian” positioning. Make it canonical.',
};
const DOMAIN_STEPS = [
  { name: 'Register the company first', tag: 'prereq',
    body: 'A .com.au requires an Australian presence (an ABN). Register the business name / a Pty Ltd with ASIC and get an ABN before you can buy the domain.' },
  { name: 'Buy .com.au; hold the others', tag: 'domains',
    body: 'Secure syllabite.com.au as primary. Keep syllabite.io (it already has the build) to redirect, and grab syllabite.com defensively.' },
  { name: '301-redirect the whole site', tag: 'seo',
    body: 'Redirect every syllabite.io URL to its .com.au equivalent path-for-path (not just the homepage) with permanent 301s, so all link equity transfers and there is no duplicate-content split.' },
  { name: 'Canonicalise + re-register in Search Console', tag: 'seo',
    body: 'Set rel="canonical" to the .com.au URLs sitewide, add both properties to Google Search Console, submit the .com.au sitemap, and point Analytics/AdSense at .com.au. Do this before traffic compounds — migrating later is far costlier.' },
];
const BRAND_PROTECT = [
  'Register the business name / a Pty Ltd with ASIC and obtain an ABN (also the gate to a .com.au).',
  'File a trademark for “Syllabite” with IP Australia — especially given the existing “Syllabyte” mark — in the education-software/services classes (≈ 9, 41, 42).',
  'Claim @syllabite on Instagram, TikTok, YouTube and X now, before launch noise makes them contested.',
  'Hold syllabite.com defensively even though .com.au is primary.',
];

// ── B. Advertising ───────────────────────────────────────────────────────────
const AD_PLACEMENT = [
  'Never inside the active quiz or learning flow, and never mid-question — the frictionless gamified loop is the product; ads sit around it, never in it.',
  'One or two unobtrusive slots per page: a footer unit, a between-content block on topic/overview pages, and the post-session results screen.',
  'Lazy-load below-the-fold units; no interstitials, pop-ups or auto-play. Label ad slots clearly.',
  'Keep density low — protecting the UX that differentiates Syllabite from Quizlet and Anki is worth more than a few extra impressions.',
];
const AD_SLOT_POINTS = [
  'One reusable AdSlot component, rendered everywhere from module metadata (state, subject, year, topic).',
  'Default behaviour: a contextual, non-personalised AdSense unit (cost-recovery fill).',
  'Override: a directly-sold university sponsorship keyed to that metadata, from a simple config/table (subject/topic → sponsor creative + link) — this is the “dedicated non-programmatic banner slot” the model requires.',
  'When you move to Ad Manager, expose the same metadata as GAM key-values (subject=physics, year=12) so direct campaigns target by module with no page changes.',
];

// ── C. Paid tiers ────────────────────────────────────────────────────────────
const PRICE_TRADEOFF = {
  name: 'Monthly subscription  vs  annual “exam-year pass”',
  lacks: 'A rolling monthly sub fights the lifecycle: churn is built-in at ~24 months, teens/parents resist recurring charges, and the compounding-LTV advantage of subscriptions never materialises.',
  edge: 'A one-time annual “Year 12 (or Year 11) Pass” is a single decision, matches how parents budget for the ATAR year, and expires naturally with the cohort. Lead with this; an optional single-subject pass can sit below it.',
};
const PREMIUM_INFRA = [
  { name: 'Accounts', tag: 'auth',
    body: 'Real user accounts (Supabase Auth) to attach entitlements to. Needed anyway for spaced-repetition progress, so build the accounts layer once and reuse it.' },
  { name: 'Payments', tag: 'stripe',
    body: 'Stripe — start with Checkout / Payment Links (minimal code; handles AU GST, cards, Apple/Google Pay). A one-time annual charge, not a rolling subscription.' },
  { name: 'Entitlements + gating', tag: 'access',
    body: 'A per-user entitlement record and a single canAccess("ai-questions") check, enforced server-side. Premium is an add-on flag — the core stays open.' },
  { name: 'Claude wrapper', tag: 'ai',
    body: 'A server-side endpoint (never client-side — protects the API key and lets you meter usage) that feeds module content + a prompt to Claude and returns original practice questions.' },
];
const PREMIUM_SEAMS = [
  'Introduce an accounts/session abstraction now (even while everyone is “free”) — the portal’s Supabase-shaped auth mock is exactly the right shape to grow into.',
  'Route all AI / content generation through a server endpoint today, not the client — so billing, auth and metering can be added server-side later without touching the UI.',
  'Gate premium behind ONE entitlement hook that currently returns true; don’t scatter premium checks through the codebase.',
  'Keep content as structured data (already true) so the generator can ingest it, and keep every generation cacheable per module.',
  'Add a thin billing module mirroring the auth mock, so Stripe drops in behind a stable interface.',
];

// ── D. Marketing ─────────────────────────────────────────────────────────────
const CHANNELS = [
  { name: 'SEO — the main engine', tag: 'organic', hot: true,
    body: 'Every topic page is a landing page for what students actually search: “WA Year 12 [subject] [topic] practice questions”, “[concept] explained ATAR”. Needs clean per-topic URLs, real meta titles/descriptions, a sitemap and fast mobile pages. It compounds for free, and the depth of syllabus-mapped content is the moat (.com.au also lifts local ranking).' },
  { name: 'School & teacher outreach', tag: 'wedge',
    body: 'The Teacher Analytics feature lets a teacher generate a class quiz link and see cohort gaps — so teachers distribute Syllabite to whole classes. Email and visit WA schools; teachers are a trusted, high-leverage B2B2C acquisition loop.' },
  { name: 'Short-form social', tag: 'social',
    body: 'Founder-produced study tips and exam hacks on TikTok / Instagram Reels / YouTube Shorts under @syllabite — where the students already are, at zero ad spend.' },
  { name: 'Referral & leaderboards', tag: 'viral',
    body: 'Lean on the state-wide leaderboards and sprint quizzes: students invite classmates to compete. A free product makes sharing frictionless.' },
];
const MARKET_TACTICS = [
  'Launch deep in one or two quantitative subjects (already built) rather than broad — depth ranks and retains better than breadth.',
  'Seed in the communities that already exist: r/atar, WA student Discords and ATAR forums.',
  'Recruit two or three WA teachers as design partners for credibility and a direct line to classes.',
  'Lead with the hook competitors can’t match: free, and made specifically for WA ATAR.',
  'Choose SEO and content over paid ads — the right play for a solo founder with time but little budget.',
];

// ── E. Roadmap ───────────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Now · Launch + contextual ads', state: 'now',
    body: 'Finish Phase-2 ATAR content (quantitative first), ship SEO-ready routing/URLs/meta/sitemap, publish a privacy policy, move to .com.au (+ company/ABN), build the reusable AdSlot (contextual), get AdSense approved for non-personalised serving, and add privacy-respecting analytics (e.g. Plausible). Outcome: traffic + product validation; ads cover hosting.' },
  { label: 'Next · University sponsorships', state: 'next',
    body: 'Once WA traffic is meaningful (the proof sponsors need): set up Google Ad Manager, build a one-page audience kit (WA Year 11/12 reach by subject), and switch on AdSlot’s direct-sold mode against a sponsorship config. Module metadata is already wired from the “Now” phase. Outcome: high-margin B2B revenue — the core of the model.' },
  { label: 'Later · Paid AI tier', state: 'later',
    body: 'Add accounts (Supabase Auth) + progress persistence, the entitlement seam and canAccess hook, Stripe, and a server-side Claude wrapper with caching + rate-limits — then sell the annual exam-year pass for AI practice questions. Outcome: incremental per-user revenue, with the free core untouched.' },
];
const ACTIONS = [
  'Register the company / business name with ASIC and get an ABN.',
  'Buy syllabite.com.au (and syllabite.com defensively); keep syllabite.io to redirect.',
  'File the “Syllabite” trademark with IP Australia.',
  'Publish a privacy policy (contextual-ads, no-behavioural-tracking).',
  'Create accounts when each phase needs them: Google AdSense → later Ad Manager, then Stripe and an Anthropic (Claude) API key.',
  'Claim the @syllabite handles on Instagram, TikTok, YouTube and X.',
];

// Small helpers to keep the panels tidy ──────────────────────────────────────
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

export default function SyllabiteGTM() {
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
      <div className="syl-seg" role="tablist" aria-label="Strategy sections">
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
            Keep the core 100% free and earn from the audience, not the student. Money comes in three
            sequenced lines — contextual ads, then direct WA-university sponsorships, then an optional AI
            practice-question pass. The free product is the asset: it builds the traffic and the
            subject-segmented audience that ads and sponsors pay for. Paywalling the core would destroy that.
          </Northstar>
          <Northstar kicker="The 2-year clock">
            A student uses Syllabite for at most two ATAR years, then churns by design — which caps lifetime
            value and makes high-churn monthly subscriptions a poor fit. So: monetise the cohort while you
            have their attention (ads and sponsorship scale with attention, not tenure), and price any paid
            tier as an annual “exam-year pass”, never a rolling subscription.
          </Northstar>
          <BulletCard kicker="Non-negotiables" items={NON_NEGOTIABLES} />
        </div>
      )}

      {/* ── DOMAINS (A) ─────────────────────────────────────────────────── */}
      {view === 'Domains' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The build lives on syllabite.io; syllabite.com.au and the company name are available in
            Australia. The audience is exclusively Australian (WA) students — so localness is an asset, not a detail.
          </p>
          <Northstar kicker="Recommendation" accent>
            Make <strong>syllabite.com.au</strong> the primary, canonical domain and 301-redirect
            <strong> syllabite.io → syllabite.com.au</strong>. A .com.au is the trust and local-SEO signal an
            Australian school audience responds to; .io stays purely as a redirect.
          </Northstar>
          <Tradeoff t={DOMAIN_TRADEOFF} />
          <div>
            <span className="syl-kicker">Migration — do it before traffic compounds</span>
            <FeatureList items={DOMAIN_STEPS} />
          </div>
          <BulletCard kicker="Brand protection — worth doing now" items={BRAND_PROTECT} />
        </div>
      )}

      {/* ── ADVERTISING (B) ─────────────────────────────────────────────── */}
      {view === 'Advertising' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The near-term revenue line, and the foundation the medium-term sponsorship business is built on.
          </p>
          <Northstar kicker="Recommendation">
            Start with <strong>Google AdSense</strong> — fast, free and no traffic minimum — for contextual
            fill. Graduate to <strong>Google Ad Manager</strong> once direct university deals exist: GAM
            serves your direct-sold sponsorships first and backfills unsold space with AdSense.
          </Northstar>
          <Northstar kicker="Hard constraint — contextual & non-personalised only" accent>
            The audience is 16–18, so AU privacy law and Google’s policies for users under the age of consent
            prohibit behavioural targeting. Tag the audience accordingly and serve non-personalised ads (npa)
            keyed to page content only. This is the platform’s stated model — and it is non-optional, not a preference.
          </Northstar>
          <BulletCard kicker="UX-safe placement" items={AD_PLACEMENT} />
          <div className="pt-card syl-monet">
            <span className="syl-kicker">The honest traffic maths</span>
            <p>
              Contextual, non-personalised education RPMs are modest. AdSense meaningfully covers hosting and
              tooling only at real scale — think tens to hundreds of thousands of monthly pageviews — so treat
              it as cost-recovery and proof-of-audience, not the business. The real upside is sponsorship.
            </p>
          </div>
          <BulletCard kicker="Build this now — a reusable AdSlot (the groundwork for module-targeted sponsorships)" items={AD_SLOT_POINTS} />
        </div>
      )}

      {/* ── PAID TIERS (C) ──────────────────────────────────────────────── */}
      {view === 'Paid Tiers' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            A future, additive layer — an AI practice-question pass, never a paywall on the free core.
          </p>
          <Tradeoff t={PRICE_TRADEOFF} />
          <Northstar kicker="Recommendation — price to the lifecycle" accent>
            Sell a one-time annual “Year 12 (or Year 11) Pass” that covers the exam year, with an optional
            cheaper single-subject pass — not a rolling subscription. Keep it genuinely affordable (the mission
            is access) while pricing it comfortably above per-user cost.
          </Northstar>
          <div>
            <span className="syl-kicker">What it takes to ship the AI tier</span>
            <FeatureList items={PREMIUM_INFRA} />
          </div>
          <BulletCard kicker="Architect now — the seams that avoid a rewrite" accent items={PREMIUM_SEAMS} />
          <div className="pt-card syl-monet">
            <span className="syl-kicker">Claude cost & pricing</span>
            <p>
              Each generation costs tokens (module content + prompt in, questions out). The lever is
              <strong> caching</strong>: generate a question set once per module and reuse it across users, so
              marginal cost per user collapses to near-zero on cache hits. Add rate-limits, use a cheaper model
              (e.g. Haiku) where quality allows, and price the annual pass at several times the expected
              heavy-user API cost — so even power users are profitable. Caching is what turns AI from a
              cost-centre into margin.
            </p>
          </div>
        </div>
      )}

      {/* ── MARKETING (D) ───────────────────────────────────────────────── */}
      {view === 'Marketing' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Reaching WA ATAR students as a solo founder — low-cost, organic-first, timed to the school year.
          </p>
          <div>
            <span className="syl-kicker">Channels, ranked by return</span>
            <FeatureList items={CHANNELS} />
          </div>
          <div className="pt-card syl-monet">
            <span className="syl-kicker">Timing — ride the academic year</span>
            <p>
              The WA school year runs February–December with ATAR exams in October–November. Push hardest in
              <strong> Term 1</strong> (February — when students set up study habits) and again across
              <strong> Terms 3–4</strong> (August–October — peak exam-crunch demand). Use the December–January
              summer to build content, not to acquire. The marketing cadence should mirror the A-SRE engine’s
              own ramp toward the exam blocks.
            </p>
          </div>
          <BulletCard kicker="Low-cost solo-founder tactics" items={MARKET_TACTICS} />
        </div>
      )}

      {/* ── ROADMAP (E) ─────────────────────────────────────────────────── */}
      {view === 'Roadmap' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Three phases, each unlocking the next — with the technical and business prerequisites for each.
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
