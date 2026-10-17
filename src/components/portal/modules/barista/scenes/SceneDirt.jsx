import { useScene } from '../sceneKit';
import { Caption, Steam, Flow, Chip, Finger } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENES · HOW IT GETS DIRTY — oils · milk · stale grounds
   ----------------------------------------------------------------------------
   Each is a before/after pair so the finished frame tells the whole story:
   the left panel gets dirty over time, the right panel shows the habit or
   cycle that prevents it.
   ========================================================================== */

function Divider() {
  return <line className="bxi-s-faint" x1="160" y1="16" x2="160" y2="196" />;
}

/* Shower screen seen from below. */
function Screen({ cx, cy, oilClass, oil = 0 }) {
  return (
    <g>
      <circle className="bxi-s-steel" cx={cx} cy={cy} r="54" />
      <circle className="bxi-s-face" cx={cx} cy={cy} r="44" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        const r = [16, 26, 36][i % 3];
        return <circle key={i} className="bxi-s-dark" cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r="1" />;
      })}
      <circle className={`bxi-s-coffee ${oilClass}`} cx={cx} cy={cy} r="44" style={{ opacity: oil }} />
      <circle className="bxi-s-steel2" cx={cx} cy={cy} r="5" />
    </g>
  );
}

export function SceneOils() {
  const api = useScene(
    (tl, q, { cue }) => {
      tl.set(q('.bxi-dt-oilL'), { opacity: 0 }, 0);
      tl.set(q('.bxi-dt-oilR'), { opacity: 0.62 }, 0);
      tl.set(q('.bxi-dt-pulse'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-dt-shot'), { textContent: 0 }, { textContent: 40, duration: 2.4, ease: 'none', snap: { textContent: 1 } }, 0.2);
      tl.to(q('.bxi-dt-oilL'), { opacity: 0.62, duration: 2.4, ease: 'none' }, 0.2);
      cue(1, 2.8);
      tl.to(q('.bxi-dt-pulse'), { opacity: 1, duration: 0.2, repeat: 5, yoyo: true }, 2.8);
      tl.to(q('.bxi-dt-oilR'), { opacity: 0.08, duration: 2, ease: 'power1.inOut' }, 2.9);
    },
    { name: 'dirt-oils' },
  );
  return (
    <Stage {...api} name="Coffee oils" label="Left: a shower screen darkening with coffee oil over forty shots. Right: a cleaning cycle clearing it." beats={['Every shot leaves oil on the shower screen', 'A cleaning cycle back-flushes it off']}>
      <Divider />
      <Screen cx={80} cy={98} oilClass="bxi-dt-oilL" oil={0.62} />
      <text className="bxi-s-big" x="80" y="176" textAnchor="middle">
        <tspan className="bxi-dt-shot">40</tspan> shots
      </text>
      <Caption x={80} y={194} anchor="middle">oil builds up</Caption>
      <Screen cx={240} cy={98} oilClass="bxi-dt-oilR" oil={0.08} />
      <Flow d="M240 30 V52" className="bxi-dt-pulse" hidden />
      <text className="bxi-s-big" x="240" y="176" textAnchor="middle">cycle</text>
      <Caption x={240} y={194} anchor="middle">when the light flashes</Caption>
    </Stage>
  );
}

function Tip({ x, y, crustClass, crust = 0 }) {
  return (
    <g>
      <path className="bxi-s-steel2" d={`M${x - 8} ${y - 90} L${x + 8} ${y - 90} L${x + 6} ${y - 24} L${x - 6} ${y - 24} Z`} />
      <rect className="bxi-s-steel" x={x - 10} y={y - 26} width="20" height="32" rx="5" />
      <circle className="bxi-s-dark" cx={x - 5} cy={y + 2} r="1.5" />
      <circle className="bxi-s-dark" cx={x} cy={y + 3} r="1.5" />
      <circle className="bxi-s-dark" cx={x + 5} cy={y + 2} r="1.5" />
      <g className={crustClass} style={{ opacity: crust }}>
        <ellipse className="bxi-s-crust" cx={x - 3} cy={y - 34} rx="8" ry="4" />
        <ellipse className="bxi-s-crust" cx={x + 4} cy={y - 14} rx="9" ry="5" />
        <ellipse className="bxi-s-crust" cx={x} cy={y + 3} rx="9" ry="3.5" />
      </g>
    </g>
  );
}

export function SceneMilk() {
  const api = useScene(
    (tl, q, { cue }) => {
      tl.set(q('.bxi-dt-crust'), { opacity: 0 }, 0);
      tl.set(q('.bxi-dt-blast, .bxi-dt-wipe'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.fromTo(q('.bxi-dt-drinks'), { textContent: 0 }, { textContent: 12, duration: 2.2, ease: 'none', snap: { textContent: 1 } }, 0.2);
      tl.to(q('.bxi-dt-crust'), { opacity: 1, duration: 2.2, ease: 'none' }, 0.2);
      cue(1, 2.7);
      tl.fromTo(q('.bxi-dt-wipe'), { opacity: 0, x: -14 }, { opacity: 1, x: 14, duration: 0.5, repeat: 1, yoyo: true }, 2.7);
      tl.to(q('.bxi-dt-wipe'), { opacity: 0, duration: 0.2 }, 3.7);
      tl.fromTo(q('.bxi-dt-blast'), { opacity: 0, y: 0 }, { opacity: 1, y: 10, duration: 0.3, repeat: 3, yoyo: true }, 3.8);
      tl.to(q('.bxi-dt-blast'), { opacity: 1, duration: 0.2 }, 5);
    },
    { name: 'dirt-milk' },
  );
  return (
    <Stage {...api} name="Baked milk" label="Left: a steam wand tip crusted with dried milk after skipped purges. Right: wipe and a brief steam purge keep it clean." beats={['Skip the wipe and purge: milk bakes on and blocks the holes', 'Wipe, then a brief blast of steam over the drip tray']}>
      <Divider />
      <Tip x={80} y={140} crustClass="bxi-dt-crust" crust={1} />
      <text className="bxi-s-big" x="80" y="184" textAnchor="middle">
        <tspan className="bxi-dt-drinks">12</tspan> skipped
      </text>
      <Caption x={80} y={200} anchor="middle">holes blocking</Caption>
      <Tip x={240} y={140} />
      <path className="bxi-s-cloth bxi-dt-wipe" d="M220 100 q20 -8 40 0 l-4 10 q-16 -6 -32 0 Z" style={{ opacity: 0 }} />
      <g className="bxi-dt-blast">
        <Steam x={240} y={168} s={-0.9} />
      </g>
      <text className="bxi-s-big" x="240" y="200" textAnchor="middle">purge</text>
      <Caption x={240} y={30} anchor="middle">after every milk drink</Caption>
    </Stage>
  );
}

function Chute({ x, staleClass, stale = 0 }) {
  return (
    <g>
      <path className="bxi-s-steel" d={`M${x - 30} 30 L${x + 30} 30 L${x + 14} 70 L${x - 14} 70 Z`} />
      <rect className="bxi-s-dark" x={x - 12} y="70" width="24" height="70" rx="3" />
      <g className={staleClass} style={{ opacity: stale }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle key={i} className="bxi-s-bean" cx={x - 7 + (i % 4) * 4.6} cy={120 + Math.floor(i / 4) * 6} r="2.2" />
        ))}
      </g>
      <rect className="bxi-s-steel" x={x - 26} y="150" width="52" height="8" rx="2" />
    </g>
  );
}

export function SceneGrounds() {
  const api = useScene(
    (tl, q, { cue }) => {
      tl.set(q('.bxi-dt-staleL'), { opacity: 0 }, 0);
      tl.set(q('.bxi-dt-staleR'), { opacity: 1, y: 0 }, 0);
      tl.set(q('.bxi-dt-finger, .bxi-dt-purge'), { opacity: 0 }, 0);
      cue(0, 0);
      tl.to(q('.bxi-dt-staleL'), { opacity: 1, duration: 1.6 }, 0.3);
      cue(1, 2.1);
      tl.fromTo(q('.bxi-dt-finger'), { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 2.1);
      tl.to(q('.bxi-dt-staleR'), { y: 40, opacity: 0, duration: 0.8, ease: 'power2.in' }, 2.5);
      tl.to(q('.bxi-dt-purge'), { opacity: 1, duration: 0.3 }, 3.2);
      tl.to(q('.bxi-dt-finger'), { opacity: 0, duration: 0.3 }, 3.5);
    },
    { name: 'dirt-grounds' },
  );
  return (
    <Stage {...api} name="Stale grounds" label="Left: old grinds sit in the burrs and chute overnight. Right: holding DOSE purges them before the first coffee." beats={['Old grinds sit in the burrs and chute overnight', 'Hold [DOSE] to purge before the first coffee; tip them out']}>
      <Divider />
      <Chute x={80} staleClass="bxi-dt-staleL" stale={1} />
      <Caption x={80} y={184} anchor="middle" tone="strong">overnight</Caption>
      <Caption x={80} y={198} anchor="middle">stale in the chute</Caption>
      <Chute x={240} staleClass="bxi-dt-staleR" stale={0} />
      <Chip x={240} y={18} text="hold DOSE" />
      <Finger x={286} y={40} className="bxi-dt-finger" />
      <g className="bxi-dt-purge">
        <Caption x={240} y={184} anchor="middle" tone="strong">purged</Caption>
        <Caption x={240} y={198} anchor="middle">tip them out</Caption>
      </g>
    </Stage>
  );
}
