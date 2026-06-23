import Reveal from './Reveal';
import SectionHead from './SectionHead';

const GROUPS = [
  {
    label: 'Languages',
    items: ['Python', 'JavaScript', 'Java', 'Swift', 'SQL', 'HTML / CSS'],
  },
  {
    label: 'Frameworks & ML',
    items: ['React', 'PyTorch', 'Next.js', 'Redux', 'Node.js'],
  },
  {
    label: 'Automation & Platforms',
    items: ['n8n', 'Power Automate', 'Google Apps Script', 'SharePoint', 'Jotform', 'Git'],
  },
  {
    label: 'AI & Research',
    items: ['NLP', 'Computer Vision', 'Image Segmentation', 'State Space Models', 'Deep Learning', 'AI Agents'],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="hp-section hp-section--tint" aria-labelledby="skills-title">
      <div className="hp-wrap">
        <SectionHead n="03" eyebrow="Toolkit" title="What I work with" id="skills-title" />

        <div className="hp-spec">
          {GROUPS.map((g, i) => (
            <Reveal className="hp-spec__group" key={g.label} delay={i * 80}>
              <div className="hp-spec__label">
                {g.label} <b>/ {String(g.items.length).padStart(2, '0')}</b>
              </div>
              <div className="hp-spec__items">
                {g.items.map((it) => (
                  <span className="hp-spec__item" key={it}>{it}</span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
