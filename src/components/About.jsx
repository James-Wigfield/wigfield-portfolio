import Reveal from './Reveal';
import SectionHead from './SectionHead';

const FACTS = [
  { k: 'Degree', v: 'B.Adv Computer Science (Hons)', sub: 'AI major · UWA · 2022–2026' },
  { k: 'GPA', v: '5.0 / 7.0' },
  { k: 'ATAR', v: '93.2', sub: 'Dux of the Year · Head Boy' },
  { k: 'Exchange', v: 'University of Leeds, UK', sub: 'Semester 1, 2025' },
  { k: 'Currently learning', v: 'React · Next.js · Redux', sub: 'Udemy, in progress' },
  { k: 'Based in', v: 'Perth, Western Australia' },
];

export default function About() {
  return (
    <section id="about" className="hp-section" aria-labelledby="about-title">
      <div className="hp-wrap">
        <SectionHead n="01" eyebrow="Profile" title="A bit about me" id="about-title" />

        <div className="hp-profile">
          <Reveal className="hp-profile__bio" dir="left">
            <p className="hp-profile__lead">
              I like turning messy, manual work into something that just <em>runs</em> — whether
              that's a segmentation model reading a PET scan or an AI agent quietly answering a
              delivery team's questions before they have to ask.
            </p>
            <p className="hp-profile__body">
              I'm in my final year of Computer Science at the University of Western Australia,
              majoring in Artificial Intelligence, with coursework spanning natural language
              processing, computer vision, and professional computing. My honours research sits with
              the UWA Medical Physics Research Group and Sir Charles Gairdner Hospital.
            </p>
            <p className="hp-profile__body">
              Alongside the degree I co-founded GoFlo Solutions, run IT at RKMRS, and recently joined
              SafeStyle as a software developer. I'm happiest somewhere between research and
              shipping — figuring out the hard part, then making it work in the real world.
            </p>
          </Reveal>

          <Reveal as="dl" className="hp-facts" dir="right" delay={120}>
            {FACTS.map((f) => (
              <div className="hp-facts__row" key={f.k}>
                <dt className="hp-facts__k">{f.k}</dt>
                <dd className="hp-facts__v">
                  {f.v}
                  {f.sub && <small>{f.sub}</small>}
                </dd>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
