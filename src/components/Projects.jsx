import Reveal from './Reveal';
import SectionHead from './SectionHead';

const PROJECTS = [
  {
    title: 'NLP Sentiment Analysis',
    kind: 'Research',
    desc: 'A deep-learning model classifying text sentiment in PyTorch, built around a Variational Siamese Auto-Encoder (VSAE) — with a focus on data normalisation, tokenisation, and bespoke architecture design for high validation accuracy.',
    stack: ['PyTorch', 'NLP', 'VSAE'],
  },
  {
    title: 'RKMRS AI Staff Agent',
    kind: 'Production',
    desc: 'A custom AI agent that answers internal staff queries, dramatically cutting time spent on manual information retrieval. Integrated into the Staff Portal for a single, seamless interface.',
    stack: ['AI Agent', 'Python', 'API'],
  },
  {
    title: 'Digital Staff Portal',
    kind: 'Production',
    desc: 'A centralised portal that replaced 100% of paper-based workflows at RKMRS — dynamic, logic-based digital forms built on Jotform and SharePoint, eliminating manual paperwork across the organisation.',
    stack: ['SharePoint', 'Jotform', 'Logic forms'],
  },
  {
    title: 'Driver PWA',
    kind: 'Production',
    desc: 'A Progressive Web App for delivery drivers — instant mobile access to forms, the AI agent, and key resources in the field. Mobile-first so it holds up under any conditions.',
    stack: ['PWA', 'JavaScript', 'Mobile-first'],
  },
  {
    title: 'GoFlo Automation Pipelines',
    kind: 'Client work',
    desc: 'Multi-step automation pipelines for small-business clients, connecting tools that were never designed to talk to each other. Each one scoped, architected, and delivered end-to-end.',
    stack: ['n8n', 'Power Automate', 'Apps Script'],
  },
];

export default function Projects() {
  return (
    <section id="projects" className="hp-section" aria-labelledby="projects-title">
      <div className="hp-wrap">
        <SectionHead n="04" eyebrow="Selected Work" title="Things I've shipped" id="projects-title" />

        <div className="hp-index">
          {PROJECTS.map((p, i) => (
            <Reveal as="article" className="hp-index__row" key={p.title} delay={i * 60}>
              <div className="hp-index__num">{String(i + 1).padStart(2, '0')}</div>
              <div className="hp-index__main">
                <h3 className="hp-index__title">
                  {p.title}
                  <span className="hp-index__kind">{p.kind}</span>
                </h3>
                <p className="hp-index__desc">{p.desc}</p>
              </div>
              <div className="hp-index__stack">
                {p.stack.map((s) => <span key={s}>{s}</span>)}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
