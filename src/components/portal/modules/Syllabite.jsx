import { useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   SYLLABITE — venture overview  (Syllabite section)
   ----------------------------------------------------------------------------
   A starter brief for the Syllabite EdTech venture: a free, gamified, strictly
   syllabus-aligned study platform for Australian Year 11/12 ATAR students.
   Self-contained (the constants below are the source of truth) and styled with
   the portal's Reading Room tokens via the .syl-* classes in portal.css. Built
   to be fleshed out into a real working tracker later.
   ========================================================================== */

const PROJECT = {
  tag: 'Syllabite · EdTech venture',
  title: 'Free, syllabus-aligned ATAR study — gamified',
  thesis:
    'Interactive, gamified, strictly syllabus-aligned study material for Year 11 & 12 ATAR students. ' +
    'It bridges the gap between premium localised resources and free global tools — 100% free for ' +
    'students, monetised through contextual advertising and direct university sponsorships.',
  phase: 'Phase 1 · validating the engine',
};

const SIGNALS = [
  { value: '$0', label: 'cost to students', accent: true },
  { value: 'Yr 11–12', label: 'ATAR focus' },
  { value: '4', label: 'incumbents to beat' },
  { value: '2', label: 'phases to production' },
];

const VIEWS = ['Snapshot', 'The Edge', 'Features', 'Roadmap', 'Content Audit'];

// ── The Edge — where each incumbent leaves room ──────────────────────────────
const RIVALS = [
  { name: 'Quizlet', lacks: 'Weak randomised algorithms behind a paywall.',
    edge: 'Scientifically-backed active recall, free.' },
  { name: 'Anki', lacks: 'Steep learning curve and an archaic UI.',
    edge: 'Frictionless, mobile-first experience.' },
  { name: 'Edrolo', lacks: 'Static video consumption at prohibitive pricing.',
    edge: 'Interactive micro-learning, zero financial barrier.' },
  { name: 'ATAR Notes', lacks: 'Unverified, static peer-to-peer PDFs.',
    edge: 'Algorithmic, strictly syllabus-mapped testing.' },
];

// ── Core features to develop ─────────────────────────────────────────────────
const FEATURES = [
  { name: 'ATAR-Optimised Spaced Repetition (A-SRE)', tag: 'engine', hot: true,
    body: 'Recall algorithm hard-coded to the Australian school year — frequency ramps up as state exam blocks approach.' },
  { name: 'Sprint Quizzes', tag: 'gamified',
    body: 'Hyper-compressed 3–5 minute testing modules with combo-multipliers and state-wide leaderboards.' },
  { name: 'Cross-Curriculum Equivalence Mapping', tag: 'content',
    body: 'Relational map of equivalent concepts across state lines (e.g. VCE vs HSC) to maximise content reuse.' },
  { name: 'AI-Powered ELI5 Remediation', tag: 'ai',
    body: 'A conversational layer that triggers on repeated failure of a concept and automatically simplifies the explanation.' },
  { name: 'Teacher Analytics Portals', tag: 'b2b',
    body: 'A frictionless dashboard for educators to generate class quiz links and instantly view cohort knowledge gaps.' },
];

// ── Roadmap ──────────────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Phase 1 · Validate', state: 'now',
    body: 'Test backend architecture, Markdown processing and spaced-repetition algorithms using university-level mathematics units.' },
  { label: 'Phase 2 · Production', state: 'next',
    body: 'Full pivot to the Australian ATAR market, beginning with quantitative subjects to scale content easily.' },
];

const GUARDRAILS = [
  'Original content only — official exams/syllabuses are structural blueprints, never regurgitated.',
  'Marketed as "independent" and "syllabus-aligned" — never claims official endorsement.',
  'Contextual advertising only — no behavioural tracking of a 16–18 audience.',
  'Brand is always "Syllabite" — the "Syllabyte" spelling is trademarked elsewhere.',
];

// ── Content audit — WA ATAR Computer Science (Year 11 & 12) ──────────────────
const AUDIT_STATS = [
  { value: '16', label: 'topics audited' },
  { value: '192', label: 'quiz answers verified', accent: true },
  { value: '48', label: 'interactive labs checked' },
  { value: '7', label: 'issues fixed' },
];

const AUDIT_VERDICT =
  'Technically accurate and aligned to the SCSA syllabus. An independent review — three parallel ' +
  'expert passes (Year 11, Year 12 and all 48 labs), with every flagged item re-verified by hand — ' +
  'found a single incorrect quiz answer, now fixed. Every other answer, lesson and lab checked out.';

const AUDIT_FIXES = [
  { name: 'Binary-search comparison count', sev: 'High', hot: true,
    body: 'A Year 12 quiz marked the worst case as 3 — the number of times the list halves. The true worst case is 4 comparisons, as the lab itself demonstrates. The answer and explanation were corrected.' },
  { name: 'API / external modules', sev: 'Coverage',
    body: 'The one examinable Year 11 dot point with no coverage anywhere. Added a dedicated lesson card and quiz question on what an API is and why it is used.' },
  { name: 'Password-strength readout', sev: 'Medium',
    body: 'The strength lab showed real entropy bits beside a “cracked instantly” verdict for known-weak passwords. It now reports effective (zero-bit) strength consistently.' },
  { name: 'SQL string quoting', sev: 'Low',
    body: 'A lesson quoted a text value with double quotes; switched to the exam-standard single quotes.' },
  { name: 'Australian Privacy Principles', sev: 'Low',
    body: 'Added the missing APP8 (overseas disclosure) to the Year 12 data-handling duties.' },
  { name: 'CIA-triad diagram', sev: 'Low',
    body: 'Two vertex labels were clipped below the canvas; the figure bounds were fixed so all three render.' },
  { name: 'Incident scenario wording', sev: 'Low',
    body: 'Reworded a ransomware case so its authentication mapping reads unambiguously.' },
];

const AUDIT_COVERAGE = [
  'Gap closed — API / external modules (Year 11), the only examinable topic that had been missing from the course.',
  'By design, not gaps — several dot points the Year 12 syllabus re-lists are already taught in Year 11, which Year 12 assumes as prior knowledge: operators & precedence, modem / transmission media / wireless access points, bandwidth & network-diagram conventions, the data dictionary, data-quality factors, the four-phase development framework, and ORDER BY.',
];

export default function Syllabite() {
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
      <div className="syl-seg" role="tablist" aria-label="Syllabite views">
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
            <span className="syl-kicker syl-kicker--accent">The wedge</span>
            <p>
              Premium localised resources are expensive; free global tools aren&rsquo;t aligned to the
              Australian syllabus. Syllabite takes the <strong>middle</strong> — premium-grade, strictly
              ATAR-aligned material that stays <strong>free</strong> for every student.
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

      {/* ── THE EDGE ────────────────────────────────────────────────────── */}
      {view === 'The Edge' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">Where each incumbent leaves room — and the line Syllabite takes.</p>
          <div className="syl-rivals">
            {RIVALS.map((r) => (
              <div key={r.name} className="pt-card syl-rival">
                <h5 className="syl-rival__name">{r.name}</h5>
                <p className="syl-rival__line syl-rival__line--lacks">{r.lacks}</p>
                <p className="syl-rival__line syl-rival__line--edge">
                  <Icon name="arrowRight" size={14} className="syl-rival__arrow" />
                  {r.edge}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      {view === 'Features' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">Combining cognitive science with modern digital consumption habits.</p>
          <div className="syl-features">
            {FEATURES.map((f, i) => (
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
        </div>
      )}

      {/* ── ROADMAP ─────────────────────────────────────────────────────── */}
      {view === 'Roadmap' && (
        <div className="syl-panel" role="tabpanel">
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
          <div className="pt-card syl-monet">
            <span className="syl-kicker">Monetisation</span>
            <p>
              Free for students. Revenue comes from <strong>contextual advertising</strong> (served on
              page content, never behaviour) and dedicated <strong>university sponsorship</strong> banner
              slots — a B2B layer that keeps the student experience clean and compliant.
            </p>
          </div>
        </div>
      )}

      {/* ── CONTENT AUDIT ───────────────────────────────────────────────── */}
      {view === 'Content Audit' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            A deep accuracy &amp; syllabus-alignment audit of every Year 11 &amp; 12 Computer Science
            module — lessons, quizzes and interactive labs — checked against the official SCSA syllabus.
          </p>

          <div className="syl-signals">
            {AUDIT_STATS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-card syl-northstar">
            <span className="syl-kicker syl-kicker--accent">Verdict</span>
            <p>{AUDIT_VERDICT}</p>
          </div>

          <div>
            <span className="syl-kicker">Issues found &amp; fixed</span>
            <div className="syl-features">
              {AUDIT_FIXES.map((f, i) => (
                <div key={f.name} className={`pt-card syl-feature${f.hot ? ' syl-feature--hot' : ''}`}>
                  <span className="syl-feature__n">{String(i + 1).padStart(2, '0')}</span>
                  <div className="syl-feature__body">
                    <div className="syl-feature__top">
                      <h5 className="syl-feature__name">{f.name}</h5>
                      <span className="syl-tag">{f.sev}</span>
                    </div>
                    <p className="syl-feature__text">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-card syl-guardrails">
            <span className="syl-kicker">Syllabus coverage</span>
            <ul className="syl-guardrails__list">
              {AUDIT_COVERAGE.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
