import Reveal from './Reveal';
import SectionHead from './SectionHead';

const ROLES = [
  {
    role: 'Junior Software Developer',
    org: 'SafeStyle',
    place: 'Perth, AU',
    period: 'Feb 2026 — Present',
    current: true,
    points: [
      'Building and maintaining production software as part of a commercial engineering team.',
    ],
    tags: ['Software Engineering'],
  },
  {
    role: 'Co-Founder & Lead Automation Engineer',
    org: 'GoFlo Solutions',
    place: 'Perth, AU',
    period: 'Aug 2025 — Present',
    current: true,
    points: [
      'Co-founded an AI automation agency, leading technical scoping, architecture, and deployment of workflow solutions for small-business clients.',
      'Designed custom automation across Google Apps Script, n8n, Power Automate, and JavaScript to connect fragmented business software.',
      'Owned the full SDLC per project — requirements, rapid prototyping, and delivery within strict timelines.',
    ],
    tags: ['n8n', 'Power Automate', 'Apps Script', 'JavaScript'],
  },
  {
    role: 'IT Manager',
    org: 'Rockingham Kwinana Mobility',
    place: 'Rockingham, AU',
    period: 'Feb 2024 — Present',
    current: true,
    points: [
      'Engineered a centralised Staff Portal, migrating 100% of paper-based forms to dynamic, logic-driven digital workflows via Jotform and SharePoint.',
      'Developed a custom AI agent to answer internal staff queries, cutting information-retrieval time significantly.',
      'Built a Progressive Web App giving delivery drivers mobile-first access to forms, the AI agent, and key resources in the field.',
    ],
    tags: ['SharePoint', 'Jotform', 'PWA', 'AI Agent'],
  },
  {
    role: 'Location Team Leader',
    org: 'Ace Cinemas',
    place: 'Rockingham, AU',
    period: 'Jun 2019 — Jan 2025',
    current: false,
    points: [
      'Led a team across a high-volume retail and entertainment venue over a 5+ year tenure, owning conflict resolution, training, and daily operations.',
    ],
    tags: ['Leadership', 'Operations', 'Training'],
  },
];

export default function Experience() {
  return (
    <section id="work" className="hp-section hp-section--tint" aria-labelledby="work-title">
      <div className="hp-wrap">
        <SectionHead n="02" eyebrow="Field Work" title="Where I've been building" id="work-title" />

        <div className="hp-log">
          {ROLES.map((r, i) => (
            <Reveal as="article" className="hp-log__row" key={r.org} delay={i * 70}>
              <div className="hp-log__when">
                {r.period}
                {r.current && <span className="hp-log__now">Active</span>}
              </div>
              <div className="hp-log__what">
                <h3 className="hp-log__role">
                  {r.role}
                  <span className="hp-log__org">
                    {r.org} <span className="hp-log__org-place">· {r.place}</span>
                  </span>
                </h3>
                <ul className="hp-log__points">
                  {r.points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
                <div className="hp-tags hp-log__tags">
                  {r.tags.map((t) => <span key={t} className="hp-tag">{t}</span>)}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
