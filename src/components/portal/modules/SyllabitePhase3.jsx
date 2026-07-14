import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   SYLLABITE — PHASE 3 PLAN  (Syllabite section)
   ----------------------------------------------------------------------------
   The next stage after the live production site: free accounts that remove
   ads and unlock AI-generated custom interactive modules. Compares the three
   generation paths (BYO Claude via MCP, platform-keyed Claude API, BYO API
   key) and lays out the shared build plan. Reuses the .syl-* tokens from the
   Syllabite overview plus the .pres-flow pipeline chips.
   ========================================================================== */

const PROJECT = {
  tag: 'Syllabite · Phase 3 plan',
  title: 'Accounts, ad-free, and AI-generated study modules',
  thesis:
    'A free account removes ads and lets students generate their own interactive modules. ' +
    'Every generation path runs through one standardised Module Spec — Claude fills in a strict ' +
    'JSON schema and the site renders it with the existing widget library. Claude never writes ' +
    'code that ships.',
  phase: 'Phase 3 · planning',
};

const SIGNALS = [
  { value: 'B → A', label: 'recommended path', accent: true },
  { value: '~5¢', label: 'est. API cost / module' },
  { value: '1', label: 'schema renders everything' },
  { value: '0', label: 'AI-written code shipped' },
];

const VIEWS = ['Snapshot', 'The Options', 'Build Plan', 'Risks'];

const GUARDRAILS = [
  'Generated modules are labelled “AI-generated · not audited” and stay private to the account — the audited brand stays clean.',
  'Hard monthly generation quota per account plus a global spend cap; generation requires a verified sign-in.',
  'Same originality rules as hand-built content — the system prompt bans reproducing SCSA exam or syllabus text.',
  'Accounts stay minimal-PII (email only); signed-out users keep contextual-only ads — no behavioural tracking either way.',
];

// ── The three generation paths ───────────────────────────────────────────────
const OPTIONS = [
  {
    key: 'B',
    name: 'B · Platform-keyed generation',
    verdict: 'build first',
    hot: true,
    how:
      'A “Generate module” button on the site. The Worker calls the Claude API server-side with ' +
      'the Module Spec system prompt, validates the result and saves it to the account. ' +
      'Roughly 5 free generations a month.',
    pros: [
      'Zero-friction UX that actually matches a 16–18 audience',
      'Full control of prompts, quality and safety — ~5¢ a module on Haiku',
    ],
    cons: [
      'Syllabite pays for tokens — needs quotas, rate limits and a spend cap',
      'Prompt engineering and abuse handling sit on the platform',
    ],
  },
  {
    key: 'A',
    name: 'A · BYO Claude via MCP',
    verdict: 'build second',
    how:
      'The existing Worker exposes a remote MCP server. Users add it as a custom connector in ' +
      'their own claude.ai account and build modules conversationally — tools list syllabus ' +
      'topics and widgets, validate the spec, and publish to their account.',
    pros: [
      'Zero AI cost to Syllabite — generation runs on the user’s own plan',
      'Full conversational iteration; ideal for teachers and power users',
    ],
    cons: [
      'Custom connectors need a paid Claude plan — most students don’t have one',
      'High setup friction, and generation happens in a chat you don’t control',
    ],
  },
  {
    key: 'C',
    name: 'C · BYO API key',
    verdict: 'skip',
    how: 'Users paste their own Anthropic API key and the site drives generation with it.',
    pros: ['No platform cost and no Claude subscription needed'],
    cons: [
      'School students don’t have API keys or credit cards',
      'Key custody is a security liability for near-zero audience gain',
    ],
  },
];

const RECOMMENDATION =
  'B first, A second, drop C. Ship accounts plus quota-limited server-side generation — the ' +
  'version a Year 12 student can actually use. Generation, validation and saving all live behind ' +
  'the same Worker endpoints, so exposing them later as MCP tools (Option A) is a thin layer on ' +
  'top, not a second build — it becomes the teacher / power-user tier.';

const FLOW = [
  'Sign in',
  'Generate (topic + type)',
  'Worker · quota check',
  'Claude API',
  'Spec validator',
  'Supabase user_modules',
  'Rendered module',
];

// ── Build plan ───────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Step 1 · Accounts & ad-free', state: 'now',
    body: 'Supabase Auth (email OTP) on the existing shared project; a profiles row per user; signed-in sessions hide every ad slot. No generation yet — this ships value on day one.' },
  { label: 'Step 2 · Module Spec v1 + renderer', state: 'next',
    body: 'Define the JSON schema — lesson cards with KaTeX, multiple-choice and numeric quizzes, flashcards, and ~5 parameterised widgets ported from the lab library. One renderer, one validator, shared client- and Worker-side.' },
  { label: 'Step 3 · Generation service (Option B)', state: 'later',
    body: 'POST /api/generate on the existing Worker → Claude API → validate → user_modules table → a “My Modules” shelf. Monthly quota plus a Cloudflare AI Gateway spend cap.' },
  { label: 'Step 4 · MCP connector (Option A)', state: 'later',
    body: 'Expose the same validate / save endpoints as remote MCP tools, so teachers and power users can build modules from their own claude.ai account.' },
];

const ECONOMICS =
  'A generated module is roughly 3k input + 4k output tokens. On Haiku that is about 2–3¢; on ' +
  'Sonnet 7–10¢. A five-module monthly quota costs well under 50¢ per active creator — trivially ' +
  'covered if ad-free accounts later gain a paid tier with a bigger quota.';

// ── Risks ────────────────────────────────────────────────────────────────────
const RISKS = [
  { name: 'Quality gap vs hand-built modules', sev: 'High', hot: true,
    body: 'Generated modules will be blander than the audited ones — fine if framed honestly. Label them drafts, keep them private by default, and let the schema constrain the worst case to “boring”, never “broken”.' },
  { name: 'Cost abuse', sev: 'High',
    body: 'Free generation invites farming. Verified accounts only, a hard monthly quota, per-user rate limiting and a global monthly spend cap that fails closed.' },
  { name: 'Originality & IP', sev: 'Medium',
    body: 'The generator obeys the same rule as hand-built content: official material is a structural blueprint, never reproduced. Enforced in the system prompt, and user prompts asking to recreate past exams are refused.' },
  { name: 'Teen privacy', sev: 'Medium',
    body: 'Accounts collect email only, and there is no behavioural profiling of a 16–18 audience — ad removal must not become a tracking excuse. The Australian Privacy Act and AdSense policy both bind.' },
];

export default function SyllabitePhase3() {
  const [view, setView] = useState('Snapshot');

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
      <div className="syl-seg" role="tablist" aria-label="Phase 3 views">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── SNAPSHOT ────────────────────────────────────────────────────── */}
      {view === 'Snapshot' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-card syl-northstar">
            <span className="syl-kicker syl-kicker--accent">The real build</span>
            <p>
              Whichever option wins, the hard prerequisite is the same: a <strong>Module Spec</strong> —
              a declarative JSON format for lesson cards, KaTeX, quizzes and parameterised widgets drawn
              from the existing lab library. Claude generates the spec, a validator rejects anything
              malformed, and the site renders it. Generation stays safe, cheap and on-brand — the worst
              possible output is a bland module, never a broken one.
            </p>
          </div>

          <div className="pt-card syl-guardrails">
            <span className="syl-kicker">Operating guardrails</span>
            <ul className="syl-guardrails__list">
              {GUARDRAILS.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ── THE OPTIONS ─────────────────────────────────────────────────── */}
      {view === 'The Options' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">Three ways to put Claude in students&rsquo; hands — and the order to build them in.</p>

          <div className="syl-rivals">
            {OPTIONS.map((o) => (
              <div key={o.key} className={`pt-card syl-rival${o.hot ? ' syl-feature--hot' : ''}`}>
                <div className="syl-feature__top">
                  <h5 className="syl-rival__name">{o.name}</h5>
                  {o.hot
                    ? <span className="syl-phasechip">{o.verdict}</span>
                    : <span className="syl-tag">{o.verdict}</span>}
                </div>
                <p className="syl-rival__line syl-rival__line--lacks">{o.how}</p>
                {o.pros.map((p) => (
                  <p key={p} className="syl-rival__line syl-rival__line--edge">
                    <Icon name="arrowRight" size={14} className="syl-rival__arrow" />
                    {p}
                  </p>
                ))}
                {o.cons.map((c) => (
                  <p key={c} className="syl-rival__line syl-rival__line--lacks">✕ {c}</p>
                ))}
              </div>
            ))}
          </div>

          <div className="pt-card syl-northstar">
            <span className="syl-kicker syl-kicker--accent">Recommendation</span>
            <p><strong>{RECOMMENDATION}</strong></p>
          </div>

          <div className="pt-card syl-monet">
            <span className="syl-kicker">The recommended pipeline</span>
            <div className="pres-flow">
              {FLOW.map((step, i) => (
                <span key={step} className="pres-flow__item">
                  <span className="pres-flow__node">{step}</span>
                  {i < FLOW.length - 1 && <span className="pres-flow__arrow">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BUILD PLAN ──────────────────────────────────────────────────── */}
      {view === 'Build Plan' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-phases">
            {STEPS.map((p) => (
              <div key={p.label} className={`pt-card syl-phase syl-phase--${p.state}`}>
                <span className="syl-phase__marker" />
                <div>
                  <h5 className="syl-phase__label">{p.label}</h5>
                  <p className="syl-phase__body">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-card syl-monet">
            <span className="syl-kicker">Unit economics</span>
            <p>{ECONOMICS}</p>
          </div>
        </div>
      )}

      {/* ── RISKS ───────────────────────────────────────────────────────── */}
      {view === 'Risks' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-features">
            {RISKS.map((r, i) => (
              <div key={r.name} className={`pt-card syl-feature${r.hot ? ' syl-feature--hot' : ''}`}>
                <span className="syl-feature__n">{String(i + 1).padStart(2, '0')}</span>
                <div className="syl-feature__body">
                  <div className="syl-feature__top">
                    <h5 className="syl-feature__name">{r.name}</h5>
                    <span className="syl-tag">{r.sev}</span>
                  </div>
                  <p className="syl-feature__text">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
