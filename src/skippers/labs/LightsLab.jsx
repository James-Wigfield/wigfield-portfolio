import { useMemo, useRef, useState } from 'react';
import { Stage, Seg, StoryBar } from '../kit/kit';
import { useWidth, useStory } from '../kit/hooks';
import { TopBoat, NightView } from '../art/parts';
import { aspectOf, visibleLights, norm180, dir, ASPECT_THETA, VESSELS, wedge, ARC, LIGHT_COLOR } from '../art/geometry';

/* LAB — the arcs (Workbook p.31–33). A vessel sits in the middle of a dark
   sea with its light sectors drawn as cones; you are the small boat on the
   ring. Drag yourself round (or tap ahead / port / starboard / astern) and
   the right-hand panel shows exactly the lights you would see from there. */

const VESSEL_OPTS = [
  { value: 'power-lt12', label: 'Power < 12 m' },
  { value: 'power-masthead', label: 'Masthead + stern' },
  { value: 'sail', label: 'Sailing' },
];
const ASPECTS = [
  { value: 'ahead', label: 'Ahead' },
  { value: 'starboard', label: 'Starboard' },
  { value: 'port', label: 'Port' },
  { value: 'astern', label: 'Astern' },
];

const colourWords = (ls) => {
  const c = ls.map((l) => l.color);
  const parts = [];
  if (c.includes('red') && c.includes('green')) parts.push('**red and green**');
  else if (c.includes('red')) parts.push('**red**');
  else if (c.includes('green')) parts.push('**green**');
  const whites = c.filter((x) => x === 'white').length;
  if (whites) parts.push(whites > 1 ? `**${whites} whites**` : '**white**');
  return parts.join(' + ');
};

function meaning(vessel, theta) {
  const a = aspectOf(theta);
  const sail = VESSELS[vessel].sail;
  if (a === 'ahead') return sail ? 'Head-on to a sailing vessel: **power gives way to sail**.' : 'Head-on: **both alter course to starboard**.';
  if (a === 'port') return sail ? 'Its red side: it is crossing from your right, and it is under sail. **You give way.**' : 'Its red (port) side faces you: it is on **your starboard** side. **You give way.**';
  if (a === 'starboard') return sail ? 'Its green side, under sail: **power still gives way to sail**.' : 'Its green side faces you: it is on **your port** side. **Hold course and speed**, ready to act.';
  return 'Only its stern light: if you are catching it up you are **overtaking — keep clear**.';
}

export default function LightsLab() {
  const box = useRef(null);
  const svg = useRef(null);
  const W = useWidth(box, 800);
  const wide = W > 640;
  const [vessel, setVessel] = useState('power-lt12');
  const [theta, setTheta] = useState(-62); // open on the red side: the "aha"
  const [drag, setDrag] = useState(false);
  const story = useStory(3, { start: 2 });
  const seen = useMemo(() => visibleLights(vessel, theta), [vessel, theta]);

  const R = 118;
  const cx = 160;
  const cy = 160;
  const [ox, oy] = dir(theta).map((v) => v * R);

  const fromPointer = (e) => {
    const el = svg.current;
    if (!el) return;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM().inverse());
    const a = (Math.atan2(p.x - cx, -(p.y - cy)) * 180) / Math.PI;
    setTheta(Math.round(norm180(a)));
  };

  const beats = [
    { label: 'Sidelights', say: 'Red to port and green to starboard, each **112.5°** from dead ahead.' },
    { label: 'Masthead', say: 'The white masthead light shines **225°** forward, over both sidelights.' },
    { label: 'Stern', say: 'The stern light fills the last **135°** aft, so white is seen all the way round.' },
  ];
  // the story reveals cones one by one; the lab itself always uses all of them
  const showMast = story.beat >= 1;
  const showStern = story.beat >= 2;
  const showSide = story.beat >= 0;

  const topView = (
    <svg
      ref={svg}
      viewBox="0 0 320 320"
      className="sk-svg"
      role="img"
      aria-label="Top view: the vessel's light sectors and your position on the ring"
      onPointerDown={(e) => { setDrag(true); e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => drag && fromPointer(e)}
      onPointerUp={() => setDrag(false)}
      style={{ touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' }}
    >
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#9fb8cf" strokeOpacity="0.22" strokeDasharray="3 5" />
      <g transform={`translate(${cx} ${cy})`}>
        <g opacity={showSide ? 1 : 0} style={{ transition: 'opacity .5s' }}>
          <path d="M0 0 L0 -100" stroke="#9fb8cf" strokeOpacity="0.35" strokeDasharray="2 4" />
        </g>
        <Sectors mast={showMast} stern={showStern} side={showSide} />
        <TopBoat type={VESSELS[vessel].sail ? 'sail' : 'power'} />
      </g>
      <g transform={`translate(${cx + ox} ${cy + oy})`}>
        <circle r="17" fill="#9fb8cf" fillOpacity="0.1" stroke="var(--chart)" strokeWidth="1.5" />
        <TopBoat heading={theta + 180} scale={0.28} tone="you" />
        <text y="-22" textAnchor="middle" className="sk-t sk-t--seab" style={{ fontSize: 10 }}>YOU</text>
      </g>
      <text x="8" y="14" className="sk-t sk-t--sea" style={{ fontSize: 8.5 }}>FROM ABOVE · drag yourself round</text>
    </svg>
  );

  const nightView = (
    <svg viewBox="0 0 320 200" className="sk-svg" role="img" aria-label={`What you see: ${seen.map((l) => l.color).join(', ')}`}>
      <NightView vessel={vessel} theta={theta} w={320} h={200} hull scale={2} />
      <text x="8" y="14" className="sk-t sk-t--sea" style={{ fontSize: 8.5 }}>WHAT YOU SEE</text>
    </svg>
  );

  return (
    <Stage
      title="The light arcs"
      receipt="Workbook p.31–33"
      tryThis="Drag **YOU** round the ring. Watch which lights switch on and off in the right-hand view."
      story={<StoryBar story={story} beats={beats} />}
      sea
      caption={`You see ${colourWords(seen)}. ${meaning(vessel, theta)}`}
      foot={<span className="sk-dot sk-dot--chart">angles from the workbook; boat not to scale</span>}
    >
      <div ref={box} className="sk-lab2" style={{ maxWidth: 940, margin: '0 auto' }} data-wide={wide}>
        {topView}
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {nightView}
          <div className="sk-ctrls" style={{ color: 'var(--ink)' }}>
            <SegSea value={aspectOf(theta)} onChange={(a) => setTheta(a === 'starboard' ? 62 : a === 'port' ? -62 : ASPECT_THETA[a])} options={ASPECTS} label="Where you are" />
            <SegSea value={vessel} onChange={setVessel} options={VESSEL_OPTS} label="Vessel" />
          </div>
        </div>
      </div>
    </Stage>
  );
}

function SegSea(props) {
  return (
    <div className="sk-seasegs">
      <Seg {...props} />
    </div>
  );
}

function Sectors({ mast, stern, side }) {
  // drawn as cones from the boat
  return (
    <g style={{ pointerEvents: 'none' }}>
      <g opacity={side ? 1 : 0} style={{ transition: 'opacity .5s' }}>
        <TopBoatSectorsPart part="side" />
      </g>
      <g opacity={mast ? 1 : 0} style={{ transition: 'opacity .5s' }}>
        <TopBoatSectorsPart part="mast" />
      </g>
      <g opacity={stern ? 1 : 0} style={{ transition: 'opacity .5s' }}>
        <TopBoatSectorsPart part="stern" />
      </g>
    </g>
  );
}


function TopBoatSectorsPart({ part }) {
  const r = 96;
  if (part === 'side') {
    return (
      <>
        <path d={wedge(r, 0, ARC.side)} fill={LIGHT_COLOR.green} fillOpacity="0.22" stroke={LIGHT_COLOR.green} strokeWidth="1" />
        <path d={wedge(r, -ARC.side, 0)} fill={LIGHT_COLOR.red} fillOpacity="0.22" stroke={LIGHT_COLOR.red} strokeWidth="1" />
        <text x="44" y="-30" className="sk-t sk-t--seab" style={{ fontSize: 9 }}>112.5°</text>
        <text x="-82" y="-30" className="sk-t sk-t--seab" style={{ fontSize: 9 }}>112.5°</text>
      </>
    );
  }
  if (part === 'mast') {
    return (
      <>
        <path d={wedge(r * 0.62, -ARC.mast / 2, ARC.mast / 2)} fill={LIGHT_COLOR.white} fillOpacity="0.16" stroke={LIGHT_COLOR.white} strokeOpacity="0.6" strokeDasharray="3 3" />
        <text x="0" y={-r * 0.62 - 6} textAnchor="middle" className="sk-t sk-t--seab" style={{ fontSize: 9 }}>masthead 225°</text>
      </>
    );
  }
  return (
    <>
      <path d={wedge(r * 0.8, ARC.side, 360 - ARC.side)} fill={LIGHT_COLOR.white} fillOpacity="0.18" stroke={LIGHT_COLOR.white} strokeOpacity="0.6" />
      <text x="0" y={r * 0.8 + 14} textAnchor="middle" className="sk-t sk-t--seab" style={{ fontSize: 9 }}>stern 135°</text>
    </>
  );
}
