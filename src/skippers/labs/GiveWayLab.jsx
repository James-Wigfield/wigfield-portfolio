import { useState } from 'react';
import { Stage, Seg, StoryBar } from '../kit/kit';
import { useStory } from '../kit/hooks';
import { TopBoat } from '../art/parts';
import { dir } from '../art/geometry';

/* LAB — who gives way (Workbook p.28–29). Four encounters seen from above.
   ▶ plays the correct manoeuvre in four beats; tapping a boat tells you its
   role. The challenge: tap the give-way vessel in all four. */

// keyframes: [x, y, heading] at the END of beats 0..3
const SCENES = {
  crossing: {
    label: 'Crossing',
    giveWay: 'A',
    page: 29,
    boats: {
      A: { type: 'power', k: [[110, 255, 0], [110, 255, 0], [150, 205, 45], [222, 70, 15]] },
      B: { type: 'power', k: [[300, 140, 270], [300, 140, 270], [190, 140, 270], [55, 140, 270]] },
    },
    say: [
      'B is on A’s **starboard** (right) side and the bearing isn’t changing: risk of collision.',
      'The vessel on your right has right of way, so **A gives way**. B holds course and speed.',
      'A acts early and obviously: **turns to starboard** (or slows) to pass behind B.',
      'A passes astern of B, well clear. Look right, give way right, turn right, stay right.',
    ],
  },
  'head-on': {
    label: 'Head-on',
    giveWay: 'both',
    page: 29,
    boats: {
      A: { type: 'power', k: [[170, 270, 0], [170, 270, 0], [196, 190, 28], [214, 40, 0]] },
      B: { type: 'power', k: [[170, 40, 180], [170, 40, 180], [144, 120, 208], [126, 270, 180]] },
    },
    say: [
      'Two power vessels meeting bow to bow.',
      'Nobody stands on here: **both must alter course**.',
      'Both turn to **starboard** (right).',
      'They pass port side to port side. If the other turns the wrong way, turn more right, slow or stop.',
    ],
  },
  overtaking: {
    label: 'Overtake',
    giveWay: 'A',
    page: 29,
    boats: {
      A: { type: 'power', k: [[170, 278, 0], [170, 278, 0], [208, 205, 20], [216, 50, 0]] },
      B: { type: 'power', k: [[170, 150, 0], [170, 150, 0], [170, 125, 0], [170, 95, 0]] },
    },
    say: [
      'A is faster and is catching B up from astern.',
      'The overtaking rule beats every other rule: **the overtaking vessel keeps clear**.',
      'A may pass on either side, but well clear. B holds course and speed.',
      'A is past and clear before it cuts back in.',
    ],
  },
  'power-sail': {
    label: 'Vs sail',
    giveWay: 'A',
    page: 29,
    boats: {
      A: { type: 'power', k: [[205, 262, 0], [205, 262, 0], [205, 238, 0], [205, 95, 0]] },
      B: { type: 'sail', k: [[40, 140, 90], [40, 140, 90], [150, 140, 90], [300, 140, 90]] },
    },
    say: [
      'A motor boat and a sailing boat on crossing courses — the yacht is on A’s **port** side.',
      'It doesn’t matter which side it’s on: **power gives way to sail**.',
      'A **slows down** and lets the yacht cross ahead (slowing is a legal way to give way).',
      'The yacht passes clear ahead, then A carries on.',
    ],
  },
};
const ORDER = ['crossing', 'head-on', 'overtaking', 'power-sail'];
const BEATS = ['Spot it', 'Who gives way', 'Act early', 'Pass clear'];

export default function GiveWayLab() {
  const [scene, setScene] = useState('crossing');
  const [picked, setPicked] = useState(null); // { id, ok }
  const [solved, setSolved] = useState({});
  const story = useStory(4, { start: 1, ms: 1700 });
  const S = SCENES[scene];
  const b = Math.max(0, story.beat);
  const showRole = story.beat >= 1;

  const pick = (id) => {
    const ok = S.giveWay === 'both' || S.giveWay === id;
    setPicked({ id, ok });
    if (ok) setSolved((s) => ({ ...s, [scene]: true }));
  };
  const change = (v) => { setScene(v); setPicked(null); story.go(1); };

  const beats = BEATS.map((label, i) => ({ label, say: S.say[i] }));
  const done = ORDER.every((k) => solved[k]);

  return (
    <Stage
      title="Four encounters"
      receipt={`Workbook p.27–29`}
      tryThis="Pick an encounter, press ▶, then **tap the vessel that must give way**."
      story={<StoryBar story={story} beats={beats} />}
      challenge={{ text: `Tap the give-way vessel in all four encounters (${ORDER.filter((k) => solved[k]).length}/4).`, done }}
    >
      <div className="sk-ctrls" style={{ marginBottom: '0.6rem' }}>
        <Seg value={scene} onChange={change} options={ORDER.map((k) => ({ value: k, label: SCENES[k].label }))} label="Encounter" />
      </div>
      <svg viewBox="0 0 340 310" className="sk-svg" role="img" aria-label={`${S.label} encounter seen from above`} style={{ maxWidth: 520, margin: '0 auto' }}>
        <defs>
          <pattern id="sk-gw-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0 H0 V20" fill="none" stroke="var(--contour)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="340" height="310" rx="10" fill="url(#sk-gw-grid)" />
        {Object.entries(S.boats).map(([id, boat]) => {
          // the track so far: dashed path through the keyframes up to the beat
          const pts = boat.k.slice(0, b + 1).map(([x, y]) => `${x},${y}`).join(' ');
          return <polyline key={`t${id}`} points={pts} fill="none" stroke="var(--ink-3)" strokeOpacity="0.5" strokeDasharray="3 4" />;
        })}
        {story.beat === 0 && (
          <line x1={S.boats.A.k[0][0]} y1={S.boats.A.k[0][1]} x2={S.boats.B.k[0][0]} y2={S.boats.B.k[0][1]} stroke="var(--warn)" strokeWidth="1.2" strokeDasharray="5 4" />
        )}
        {Object.entries(S.boats).map(([id, boat]) => {
          const [x, y, h] = boat.k[b];
          const isGive = S.giveWay === 'both' || S.giveWay === id;
          const [dx, dy] = dir(h);
          return (
            <g key={`${scene}-${id}`} role="button" tabIndex={0} aria-label={`Vessel ${id}`} className="sk-hit"
              onClick={() => pick(id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(id)}>
              <g className="sk-anim" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <circle r="34" fill="transparent" />
                <g className="sk-anim" style={{ transform: `rotate(${h}deg)` }}>
                  <TopBoat type={boat.type} scale={0.72} tone={id === 'A' ? 'you' : 'ink'} />
                </g>
                <line x1={dx * 26} y1={dy * 26} x2={dx * 44} y2={dy * 44} stroke="var(--ink-3)" strokeWidth="1.4" />
                <text x={-28} y={-16} textAnchor="middle" className="sk-t sk-t--b" style={{ fontSize: 14 }}>{id}</text>
                {showRole && (
                  <text x={0} y={46} textAnchor="middle" className="sk-t" style={{ fontSize: 10, fill: isGive ? 'var(--port)' : 'var(--stbd)' }}>
                    {isGive ? '● give way' : '● stand on'}
                  </text>
                )}
              </g>
            </g>
          );
        })}
        {story.beat === 0 && <text x="12" y="300" className="sk-t sk-t--s">dashed orange = steady bearing → risk of collision</text>}
      </svg>
      <p style={{ minHeight: '1.5em', marginTop: '0.4rem', fontSize: '0.9rem' }} aria-live="polite">
        {picked && (
          <span className={`sk-dot ${picked.ok ? 'sk-dot--ok' : 'sk-dot--bad'}`}>
            {picked.ok
              ? S.giveWay === 'both' ? `Right — head-on, both ${picked.id} and the other alter to starboard.` : `Right — ${picked.id} gives way.`
              : `Not ${picked.id}: ${picked.id} stands on. The give-way vessel is ${S.giveWay}.`}
          </span>
        )}
      </p>
    </Stage>
  );
}
