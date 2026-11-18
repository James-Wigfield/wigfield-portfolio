import { VBar, VCalm, VGallery, VGame, VHaunt, VNight, VShop, VTeach } from './vignettes';
import './apps.css';

/* ============================================================================
   PROJECTOR LIFE — Applications tab: what a room that's alive is for.
   Eight cards, each a tiny animated scene + ≤ 3 bullets + which plan phase
   unlocks it. Desktop: a ruled grid; phone: a swipeable row (no long scroll).
   ========================================================================== */

const APPS = [
  {
    id: 'night',
    V: VNight,
    title: 'Loft ceiling night-light',
    line: 'An ecosystem on the roof above the bed.',
    bullets: ['Creatures hang, swing and sleep on the roof facets', 'Slow, dim palettes; a sleep timer fades to black', 'Steeper roof = more swinging'],
    phase: 'phases 3–4',
    rig: '1 short throw, aimed up',
  },
  {
    id: 'bar',
    V: VBar,
    title: 'Bar & venue walls',
    line: 'Coral that drips like rain on glass.',
    bullets: ['Gray-Scott drifts down the back wall', 'The music’s tempo sets the sim speed', 'Pure black = no grey box on the wall'],
    phase: 'phases 1–3',
    rig: '1 short throw',
  },
  {
    id: 'gallery',
    V: VGallery,
    title: 'Gallery installation',
    line: 'A room-sized living specimen.',
    bullets: ['Every surface its own habitat; lineages drift over the show', 'Visitors seed life by touch or shadow', 'Claude names new species on the wall label'],
    phase: 'phases 4–6',
    rig: '2 projectors + camera',
  },
  {
    id: 'teach',
    V: VTeach,
    title: 'Teaching gravity & evolution',
    line: 'One gravity, three habitats, watch them split.',
    bullets: ['Press, slide, peel: the same g on floor, wall, roof', 'Trait histograms drift apart live', 'Pause, step, reseed — it’s a lab'],
    phase: 'phases 2–4',
    rig: '1–2 projectors',
  },
  {
    id: 'haunt',
    V: VHaunt,
    title: 'Escape room · haunted house',
    line: 'Something is on the ceiling.',
    bullets: ['Creatures drop when you walk under (camera shadows)', 'Puzzle: keep the colony alive to open the door', 'Masks keep light off faces and doors'],
    phase: 'phase 6',
    rig: 'projector + camera',
  },
  {
    id: 'calm',
    V: VCalm,
    title: 'Calm · sensory room',
    line: 'Slow light that breathes.',
    bullets: ['Reaction–diffusion blooms at breathing pace', 'Warm palettes, low brightness, nothing sudden', 'Works from phase 1: no physics needed'],
    phase: 'phase 1',
    rig: '1 projector',
  },
  {
    id: 'game',
    V: VGame,
    title: 'Room-scale evolution game',
    line: 'Your species against mine.',
    bullets: ['Each player seeds a lineage; surfaces pick the winners', 'Phones or Claude call introduce_species', 'Claude narrates the census'],
    phase: 'phase 5',
    rig: '2 projectors',
  },
  {
    id: 'shop',
    V: VShop,
    title: 'Shop window at night',
    line: 'Life that circles the product.',
    bullets: ['Slime-mould veins grow towards the product', 'Projects through the glass; the kit stays inside', 'Masks keep the product lit, or dark'],
    phase: 'phases 1–3',
    rig: '1 short throw',
  },
];

export default function ApplicationsTab() {
  return (
    <div className="pjl-apps">
      <header className="pjl-stand pjl-stand--apps">
        <div className="pjl-stand__tag">
          <span className="pjl-dot pjl-dot--live" />
          applications
        </div>
        <div className="pjl-stand__lead">Where a room that is alive earns its keep.</div>
      </header>
      <ol className="pjl-apps__grid">
        {APPS.map((a, i) => (
          <li key={a.id} className="pjl-app">
            <div className="pjl-app__vig">
              <a.V />
            </div>
            <div className="pjl-app__body">
              <div className="pjl-app__n">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="pjl-app__title">{a.title}</h3>
              <div className="pjl-app__line">{a.line}</div>
              <ul className="pjl-app__bullets">
                {a.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <dl className="pjl-app__facts">
                <div>
                  <dt>
                    <span className="pjl-dot pjl-dot--live" />
                    unlocks
                  </dt>
                  <dd>{a.phase}</dd>
                </div>
                <div>
                  <dt>
                    <span className="pjl-dot pjl-dot--hollow" />
                    rig
                  </dt>
                  <dd>{a.rig}</dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
