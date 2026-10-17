import { useScene } from '../sceneKit';
import { Caption } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · WATER PATH — where scale comes from   (IB p.6, p.22)
   ----------------------------------------------------------------------------
   A SCHEMATIC, not a service diagram: tank → filter → pump → Thermocoil →
   the three outlets. Only parts Breville names are named (Thermocoil, PID,
   the filter); the pump is drawn generically. Over a sped-up six months,
   scale accretes in the hot sections while the filter catches some on the
   way in.
   ========================================================================== */

const BEATS = [
  'Cold tap water from the tank, through the filter',
  'Heated in the Thermocoil (PID-controlled)',
  'Six months: scale builds where the water gets hot',
  'The filter catches some on the way in — a fresh one every 3 months helps',
];

// Scale specks: [x, y, inHotSection]
const SPECKS = [
  [156, 92], [168, 104], [182, 92], [194, 104], [206, 92], [218, 104],
  [238, 60], [250, 60], [262, 60], [238, 110], [252, 110], [264, 110], [240, 160], [254, 160], [266, 160],
];
const FILTER_SPECKS = [[70, 120], [76, 128], [66, 134], [80, 140]];

export default function SceneWaterPath() {
  const api = useScene(
    (tl, q, { cue }) => {
      const specks = q('.bxi-wp-speck');
      const caught = q('.bxi-wp-caught');
      tl.set(specks, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, 0);
      tl.set(caught, { opacity: 0 }, 0);
      tl.set(q('.bxi-wp-m0'), { opacity: 1 }, 0);
      tl.set(q('.bxi-wp-m6'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-wp-flow-in'), { strokeDashoffset: 0 }, { strokeDashoffset: -60, duration: 1.4, ease: 'none' }, 0.1);
      cue(1, 1);
      tl.fromTo(q('.bxi-wp-coil'), { opacity: 0.5 }, { opacity: 1, duration: 0.25, repeat: 3, yoyo: true }, 1);
      tl.fromTo(q('.bxi-wp-flow-out'), { strokeDashoffset: 0 }, { strokeDashoffset: -60, duration: 1.6, ease: 'none' }, 1.2);
      cue(2, 2.6);
      tl.to(q('.bxi-wp-m0'), { opacity: 0, duration: 0.2 }, 2.6);
      tl.to(q('.bxi-wp-m6'), { opacity: 1, duration: 0.2 }, 2.6);
      tl.to(specks, { opacity: 1, scale: 1, duration: 0.5, stagger: { each: 0.12, from: 'random' } }, 2.7);
      cue(3, 4.8);
      tl.to(caught, { opacity: 1, duration: 0.4, stagger: 0.15 }, 4.8);
    },
    { name: 'water-path' },
  );

  return (
    <Stage {...api} name="Water path · schematic" label="Schematic of the water path: tank, filter, pump, Thermocoil, then the group head, steam wand and hot water outlet; scale builds up in the hot sections and the filter catches some." beats={BEATS}>
      <text className="bxi-s-label bxi-s-label--accent" x="310" y="16" textAnchor="end">SCHEMATIC</text>
      {/* Tank */}
      <rect className="bxi-s-glass" x="14" y="40" width="44" height="120" rx="5" />
      <rect className="bxi-s-water" x="16" y="70" width="40" height="88" rx="3" />
      <Caption x={36} y={176} anchor="middle">tank</Caption>
      {/* Filter */}
      <rect className="bxi-s-dark" x="62" y="112" width="24" height="36" rx="4" />
      <Caption x={74} y={176} anchor="middle">filter</Caption>
      {FILTER_SPECKS.map(([x, y], i) => (
        <circle key={i} className="bxi-s-scale bxi-wp-caught" cx={x} cy={y} r="2" />
      ))}
      {/* Pipe in → pump */}
      <path className="bxi-s-faint" d="M86 130 H112" strokeWidth="6" />
      <path className="bxi-s-waterline bxi-live-flow bxi-wp-flow-in" d="M86 130 H112" />
      <circle className="bxi-s-steel" cx="124" cy="130" r="12" />
      <path className="bxi-s-thin" d="M124 120 v20 M114 130 h20 M117 123 l14 14 M131 123 l-14 14" />
      <Caption x={124} y={176} anchor="middle">pump</Caption>
      {/* Thermocoil */}
      <path className="bxi-s-faint" d="M136 130 H148" strokeWidth="6" />
      <path className="bxi-s-hotline bxi-wp-coil" d="M150 98 L162 110 L174 98 L186 110 L198 98 L210 110 L222 98" strokeWidth="3" />
      <path className="bxi-s-waterline" d="M136 130 H150 V104" />
      <Caption x={186} y={78} anchor="middle" tone="strong">Thermocoil</Caption>
      <Caption x={186} y={128} anchor="middle">PID control</Caption>
      {/* Outlets */}
      <path className="bxi-s-faint" d="M222 104 H232 V60 H290 M232 104 V110 H290 M232 110 V160 H290" strokeWidth="6" />
      <path className="bxi-s-waterline bxi-live-flow bxi-wp-flow-out" d="M222 104 H232 V60 H290 M232 110 H290 M232 110 V160 H290" />
      <Caption x={294} y={63}>group</Caption>
      <Caption x={294} y={113}>wand</Caption>
      <Caption x={294} y={163}>hot water</Caption>
      {SPECKS.map(([x, y], i) => (
        <circle key={i} className="bxi-s-scale bxi-wp-speck" cx={x} cy={y} r="2.6" />
      ))}
      <text className="bxi-s-big bxi-wp-m0" x="14" y="24" style={{ opacity: 0 }}>MONTH 0</text>
      <text className="bxi-s-big bxi-wp-m6" x="14" y="24">MONTH 6</text>
      <Caption x={14} y={204}>scale = minerals that drop out of hot water</Caption>
    </Stage>
  );
}
