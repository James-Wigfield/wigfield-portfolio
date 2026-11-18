/* PROJECTOR LIFE — the honesty key: what the visualiser computes vs what is
   illustrated or approximate. Labelled dots on a ruled strip, no boxes. */

const SIMULATED = [
  'the life sims (Gray-Scott, Physarum, Particle Life, Lenia)',
  'gravity per surface (slide vs peel)',
  'creatures, falls and selection',
  'projector optics: throw, aspect, fall-off',
  'occlusion shadows',
  'coverage %',
];

const ILLUSTRATED = [
  "the room's look (a Blender light bake)",
  'wall colour estimated from the bake',
  'throw ratios are typical, not his lens',
  'gait families hand-written — selection tunes numbers; real Plate VII evolves gaits',
  'centred-lens projector (no lens shift, no keystone)',
];

export default function Honesty() {
  return (
    <section className="pjl-honesty" aria-label="Simulated versus illustrated">
      <div className="pjl-honesty__col">
        <div className="pjl-honesty__k">
          <span className="pjl-dot pjl-dot--sim" />
          simulated
        </div>
        <ul>
          {SIMULATED.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="pjl-honesty__col">
        <div className="pjl-honesty__k">
          <span className="pjl-dot pjl-dot--illus" />
          illustrated / approximate
        </div>
        <ul>
          {ILLUSTRATED.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
