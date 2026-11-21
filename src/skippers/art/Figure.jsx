import { ASPECT_THETA, MARKS } from './geometry';
import { NightView, Mark, Rhythm, TopBoat, HeadingArrow, FlagA, Horn } from './parts';

/* Renders a question's `figure` spec (see src/skippers/README.md) from the
   same parts the labs use. Unknown specs render nothing. */
export default function Figure({ spec }) {
  if (!spec) return null;
  switch (spec.kind) {
    case 'night': {
      const theta = ASPECT_THETA[spec.aspect] ?? 0;
      return (
        <svg viewBox="0 0 360 170" className="sk-svg" role="img" aria-label="A vessel's lights at night">
          <defs>
            <radialGradient id="skfig-sea" cx="50%" cy="0%" r="100%">
              <stop offset="0%" stopColor="#11263b" />
              <stop offset="100%" stopColor="#060f18" />
            </radialGradient>
          </defs>
          <rect width="360" height="170" rx="10" fill="url(#skfig-sea)" />
          <NightView vessel={spec.vessel} theta={theta} w={360} h={170} hull={false} scale={2.1} />
          <text x="12" y="20" className="sk-t sk-t--sea" style={{ fontSize: 10 }}>NIGHT · LIGHTS ONLY</text>
        </svg>
      );
    }
    case 'mark':
      return (
        <svg viewBox="0 0 200 170" className="sk-svg" role="img" aria-label={spec.topmark === false ? 'A mark with its topmark missing' : 'A navigation mark'} style={{ maxWidth: 220 }}>
          <rect width="200" height="170" rx="10" fill="var(--paper-2)" />
          <path d="M0 140 Q50 134 100 140 T200 140 V170 H0 Z" fill="var(--chart)" opacity="0.16" />
          <Mark type={spec.mark} x={100} y={142} scale={1} topmark={spec.topmark !== false} light={!!spec.light} lit={!!spec.light} />
        </svg>
      );
    case 'rhythm': {
      const m = MARKS[spec.mark];
      return <Rhythm rhythm={m.rhythm} color={m.light} w={360} />;
    }
    case 'encounter': {
      const boats = spec.boats ?? [];
      return (
        <svg viewBox="0 0 300 300" className="sk-svg" role="img" aria-label="Two vessels seen from above" style={{ maxWidth: 360 }}>
          <rect width="300" height="300" rx="10" fill="var(--paper-2)" />
          {boats.map((b) => (
            <g key={b.id}>
              <HeadingArrow x={b.x * 3} y={b.y * 3} heading={b.heading} len={34} />
              <TopBoat x={b.x * 3} y={b.y * 3} heading={b.heading} type={b.type} scale={0.75} label={b.id} />
            </g>
          ))}
          <g transform="translate(270 30)">
            <text x="0" y="-8" textAnchor="middle" className="sk-t sk-t--s">N</text>
            <path d="M0 -2 L4 10 L0 7 L-4 10 Z" fill="var(--ink-3)" />
          </g>
        </svg>
      );
    }
    case 'flag':
      return (
        <svg viewBox="0 0 120 100" className="sk-svg" role="img" aria-label="A blue and white swallow-tailed flag" style={{ maxWidth: 160 }}>
          <FlagA x={24} y={14} />
        </svg>
      );
    case 'horn':
      return <div style={{ maxWidth: 320 }}><Horn blasts={spec.blasts} /></div>;
    default:
      return null;
  }
}
