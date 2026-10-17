import { useScene } from '../sceneKit';
import { Caption, TurnArrow, Brush, Place } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · ADVANCED GRINDER CLEAN — blockages only   (IB p.24)
   ----------------------------------------------------------------------------
   The burr stack as an exploded side elevation, in the IB's order: nut,
   spring washer, flat washer, lower burr, grind fan, metal washer, felt
   washer — with the GRIND SIZE dial reading 1 → 25 → 16 across the chunks.
     apart    the nut loosens (clockwise, 10 mm socket) and the parts lift
              out one by one into a labelled column
     clear    the brush clears the exit chute
     rebuild  felt → metal → fan → lower burr (drive pin to cavity) → flat →
              spring → nut tightened anti-clockwise
     close    top burr in and locked, dial to 16
   ========================================================================== */

// Assembled y for each part; exploded slot on the right.
const PARTS = [
  { id: 'nut', label: 'nut', y: 102, art: 'nut' },
  { id: 'spring', label: 'spring washer', y: 110, art: 'spring' },
  { id: 'flat', label: 'flat washer', y: 116, art: 'flat' },
  { id: 'lower', label: 'lower burr', y: 120, art: 'lower' },
  { id: 'fan', label: 'grind fan', y: 150, art: 'fan' },
  { id: 'metal', label: 'metal washer', y: 160, art: 'metal' },
  { id: 'felt', label: 'felt washer', y: 166, art: 'felt' },
];
const SLOT = (i) => ({ x: 250, y: 34 + i * 24 });
const CX = 120;

function Art({ kind }) {
  switch (kind) {
    case 'nut':
      return <path className="bxi-s-steel2" d="M-9 -5 h18 l3 5 l-3 5 h-18 l-3 -5 Z" />;
    case 'spring':
      return <path className="bxi-s-accentline" d="M-14 0 q3.5 -4 7 0 t7 0 t7 0 t7 0" />;
    case 'flat':
      return <rect className="bxi-s-steel" x="-14" y="-2" width="28" height="4" rx="1" />;
    case 'lower':
      return (
        <g>
          <path className="bxi-s-steel" d="M-26 26 L26 26 L12 0 L-12 0 Z" />
          <path className="bxi-s-thin" d="M-18 20 L-6 4 M-6 24 L2 4 M6 24 L10 4 M18 20 L14 6" />
          <rect className="bxi-s-dark" x="-2" y="20" width="4" height="7" />
        </g>
      );
    case 'fan':
      return <path className="bxi-s-dark" d="M-22 -2 h44 v4 h-44 Z M-4 -7 h8 v14 h-8 Z" />;
    case 'metal':
      return <rect className="bxi-s-steel2" x="-16" y="-1.5" width="32" height="3" rx="1" />;
    default:
      return <rect className="bxi-s-cloth" x="-16" y="-1.5" width="32" height="3" rx="1" />;
  }
}

const DIAL = { apart: [1, 25], clear: [25, 25], rebuild: [25, 25], close: [25, 16] };

export default function SceneAdvanced({ chunk = 'apart' }) {
  const exploded = chunk === 'apart' || chunk === 'clear';
  const [d0, d1] = DIAL[chunk];
  const api = useScene(
    (tl, q) => {
      const parts = PARTS.map((p) => q(`.bxi-ad-${p.id}`));
      // Offsets between the assembled spot and the exploded slot.
      const toAssembled = (p, i) => ({ x: CX - SLOT(i).x, y: p.y - SLOT(i).y });
      const toSlot = (p, i) => ({ x: SLOT(i).x - CX, y: SLOT(i).y - p.y });
      if (chunk === 'apart') {
        // Rests exploded; starts assembled.
        PARTS.forEach((p, i) => tl.set(parts[i], { ...toAssembled(p, i), rotation: 0 }, 0));
        tl.set(q('.bxi-ad-top'), { opacity: 1, y: 0 }, 0);
        tl.set(q('.bxi-ad-d25'), { opacity: 0 }, 0);
        tl.set(q('.bxi-ad-d0'), { opacity: 1 }, 0);
        tl.to(q('.bxi-ad-d0'), { opacity: 0, duration: 0.2 }, 1.9);
        tl.to(q('.bxi-ad-d25'), { opacity: 1, duration: 0.2 }, 1.9);
        tl.fromTo(q('.bxi-ad-turn'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.4);
        tl.to(parts[0], { rotation: 120, svgOrigin: `${CX} ${PARTS[0].y}`, duration: 0.6 }, 0.5);
        tl.to(q('.bxi-ad-turn'), { opacity: 0, duration: 0.2 }, 1.2);
        tl.to(q('.bxi-ad-top'), { y: -40, opacity: 0, duration: 0.6 }, 2.2);
        PARTS.forEach((p, i) => tl.to(parts[i], { x: 0, y: 0, rotation: 0, duration: 0.55, ease: 'power2.inOut' }, 2.9 + i * 0.35));
        return;
      }
      if (chunk === 'clear') {
        tl.fromTo(q('.bxi-ad-brush'), { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.2);
        tl.to(q('.bxi-ad-brush'), { y: 18, duration: 0.25, yoyo: true, repeat: 5 }, 0.6);
        tl.fromTo(q('.bxi-ad-crumb'), { opacity: 1, y: 0 }, { opacity: 0, y: 30, duration: 0.6, stagger: 0.1 }, 0.8);
        return;
      }
      if (chunk === 'rebuild') {
        // Rests assembled; starts exploded.
        PARTS.forEach((p, i) => tl.set(parts[i], { ...toSlot(p, i), rotation: 0 }, 0));
        tl.set(q('.bxi-ad-pin, .bxi-ad-tighten'), { opacity: 0 }, 0);
        [...PARTS].reverse().forEach((p, k) => {
          const i = PARTS.length - 1 - k;
          tl.to(parts[i], { x: 0, y: 0, duration: 0.55, ease: 'power2.inOut' }, 0.3 + k * 0.4);
        });
        const t = 0.3 + PARTS.length * 0.4;
        tl.fromTo(q('.bxi-ad-pin'), { opacity: 0 }, { opacity: 1, duration: 0.2, repeat: 3, yoyo: true }, 0.3 + 3 * 0.4 + 0.3);
        tl.to(q('.bxi-ad-pin'), { opacity: 1, duration: 0.2 }, t - 0.2);
        tl.to(q('.bxi-ad-tighten'), { opacity: 1, duration: 0.2 }, t);
        tl.fromTo(parts[0], { rotation: 0 }, { rotation: -120, svgOrigin: `${CX} ${PARTS[0].y}`, duration: 0.7 }, t + 0.1);
        tl.to(parts[0], { rotation: 0, duration: 0.01 }, t + 0.85);
        return;
      }
      // close
      tl.fromTo(q('.bxi-ad-top'), { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.2);
      tl.set(q('.bxi-ad-d1'), { opacity: 0 }, 0);
      tl.set(q('.bxi-ad-d0'), { opacity: 1 }, 0);
      tl.to(q('.bxi-ad-d0'), { opacity: 0, duration: 0.2 }, 1.1);
      tl.to(q('.bxi-ad-d1'), { opacity: 1, duration: 0.2 }, 1.1);
    },
    { name: `advanced-${chunk}`, rebuild: chunk },
  );

  return (
    <Stage
      {...api}
      name={`Advanced grinder · ${chunk}`}
      label={`Exploded burr stack, ${chunk} stage: nut, spring washer, flat washer, lower burr, grind fan, metal washer, felt washer; grind size dial ${d1}.`}
    >
      {/* Burr carrier + chute */}
      <path className="bxi-s-faint" d="M78 96 V186 H162 V96" strokeWidth="2" />
      <rect className="bxi-s-dark" x="150" y="168" width="34" height="12" rx="3" />
      <Caption x={190} y={196}>exit chute</Caption>
      {chunk === 'clear' && (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={i} className="bxi-p-crumb bxi-ad-crumb" cx={160 + i * 6} cy={174} r="2" style={{ opacity: 0 }} />
          ))}
          <Place x={0} y={0} className="bxi-ad-brush">
            <Brush x={168} y={150} r={-80} s={0.7} />
          </Place>
        </>
      )}

      {/* The stack */}
      {PARTS.map((p, i) => (
        <Place key={p.id} x={exploded ? SLOT(i).x : CX} y={exploded ? SLOT(i).y : p.y} className={`bxi-ad-${p.id}`}>
          <Art kind={p.art} />
        </Place>
      ))}
      {exploded &&
        PARTS.map((p, i) => (
          <text key={p.id} className="bxi-s-label" x={SLOT(i).x + 32} y={SLOT(i).y + 3}>
            {String(i + 1).padStart(2, '0')} {p.label}
          </text>
        ))}
      <g className="bxi-ad-pin" style={{ opacity: chunk === 'rebuild' ? 1 : 0 }}>
        <Caption x={154} y={140} tone="accent">drive pin → cavity</Caption>
      </g>
      <g className="bxi-ad-turn" style={{ opacity: 0 }}>
        <TurnArrow x={CX} y={PARTS[0].y} r={16} />
        <Caption x={CX + 22} y={PARTS[0].y - 12}>10 mm, clockwise: loosen</Caption>
      </g>
      <g className="bxi-ad-tighten" style={{ opacity: chunk === 'rebuild' ? 1 : 0 }}>
        <TurnArrow x={CX} y={PARTS[0].y} r={16} ccw />
        <Caption x={CX + 22} y={PARTS[0].y - 12}>anti-clockwise: tighten</Caption>
      </g>
      <g className="bxi-ad-top" style={{ opacity: chunk === 'close' ? 1 : 0 }}>
        <ellipse className="bxi-s-steel" cx={CX} cy="86" rx="30" ry="7" />
        <path className="bxi-s-ink" d={`M${CX - 22} 86 Q${CX - 22} 62 ${CX} 62 Q${CX + 22} 62 ${CX + 22} 86`} />
        <Caption x={CX} y={56} anchor="middle">top burr</Caption>
      </g>

      {/* GRIND SIZE readout */}
      <circle className="bxi-s-steel" cx="34" cy="40" r="22" />
      <circle className="bxi-s-face" cx="34" cy="40" r="16" />
      {d0 !== d1 && <text className="bxi-s-big bxi-ad-d0" x="34" y="45" textAnchor="middle" style={{ opacity: 0 }}>{d0}</text>}
      {chunk === 'apart' ? (
        <text className="bxi-s-big bxi-ad-d25" x="34" y="45" textAnchor="middle">25</text>
      ) : (
        <text className="bxi-s-big bxi-ad-d1" x="34" y="45" textAnchor="middle">{d1}</text>
      )}
      <Caption x={34} y={76} anchor="middle">GRIND SIZE</Caption>
    </Stage>
  );
}
