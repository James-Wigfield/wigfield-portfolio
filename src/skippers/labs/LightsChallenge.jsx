import { useState } from 'react';
import { Stage, Icon } from '../kit/kit';
import { NightView } from '../art/parts';
import { ASPECT_THETA } from '../art/geometry';
import { shuffle } from '../content/bank';
import { useStored } from '../kit/storage';

/* LAB — "What is it, and what do you do?" (Workbook p.17, 28–34). Lights
   only, on a black sea. Pick the action; a streak counter keeps score. */

const ACTIONS = {
  headon: 'Head-on power boat: both of you alter to starboard',
  giveway: 'You see its red side: it’s on your starboard — you give way',
  standon: 'You see its green side: it’s on your port — hold course and speed, with caution',
  stern: 'You see its stern light: if you’re catching it up, keep clear (overtaking)',
  sail: 'No masthead light — a sailing vessel: power gives way to sail',
  anchor: 'One all-round white: a small boat or one at anchor — slow down, keep clear',
  diver: 'Red-white-red all-round: divers down — keep 50 m clear',
};
const WHY = {
  headon: 'Red and green together means you’re looking straight at its bow, with the white above. Both turn right (p.29).',
  giveway: 'Red is its port side, so its bow is pointing across your bow from your right. The vessel on your starboard has right of way (p.29).',
  standon: 'Green is its starboard side: it’s crossing from your left, so it gives way. You stand on but stay ready (p.28–29).',
  stern: 'A low white light alone is a stern light. The overtaking vessel always keeps clear (p.29, 31).',
  sail: 'Sidelights with no white masthead light above them = under sail. Power gives way to sail (p.29, 33).',
  anchor: 'An anchored boat under 50 m shows one all-round white light (p.34); a small power boat under 7 m may show only one too (p.32).',
  diver: 'Three all-round lights in a vertical line, red-white-red, mark a vessel with divers down at night. Keep 50 m clear (p.17).',
};
const SCENES = [
  { vessel: 'power-lt12', aspect: 'ahead', a: 'headon' },
  { vessel: 'power-masthead', aspect: 'ahead', a: 'headon' },
  { vessel: 'power-lt12', aspect: 'port', a: 'giveway' },
  { vessel: 'power-masthead', aspect: 'port', a: 'giveway' },
  { vessel: 'power-lt12', aspect: 'starboard', a: 'standon' },
  { vessel: 'power-masthead', aspect: 'starboard', a: 'standon' },
  { vessel: 'power-masthead', aspect: 'astern', a: 'stern' },
  { vessel: 'sail', aspect: 'ahead', a: 'sail' },
  { vessel: 'sail', aspect: 'port', a: 'sail' },
  { vessel: 'anchor', aspect: 'ahead', a: 'anchor' },
  { vessel: 'diver', aspect: 'starboard', a: 'diver' },
];

function deal(prev) {
  let s;
  do s = SCENES[Math.floor(Math.random() * SCENES.length)]; while (prev && s === prev && SCENES.length > 1);
  const wrong = shuffle(Object.keys(ACTIONS).filter((k) => k !== s.a)).slice(0, 3);
  return { s, opts: shuffle([s.a, ...wrong]) };
}

export default function LightsChallenge() {
  const [round, setRound] = useState(() => ({ ...deal(null), pick: null }));
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useStored('lightsBest', 0);
  const { s, opts, pick } = round;
  const answered = pick !== null;

  const choose = (k) => {
    if (answered) return;
    setRound((r) => ({ ...r, pick: k }));
    if (k === s.a) {
      const n = streak + 1;
      setStreak(n);
      if (n > best) setBest(n);
    } else setStreak(0);
  };

  return (
    <Stage
      title="What is it, and what do you do?"
      receipt="Workbook p.17, 28–34"
      tryThis="Read the dots, then pick what you would **do**."
      sea
      challenge={{ text: `Get 8 in a row (streak ${streak} · best ${best}).`, done: best >= 8 }}
    >
      <div className="sk-lab2" style={{ maxWidth: 940, margin: '0 auto', alignItems: 'start' }}>
        <svg viewBox="0 0 320 190" className="sk-svg" role="img" aria-label="A vessel's lights at night, lights only">
          <NightView vessel={s.vessel} theta={ASPECT_THETA[s.aspect]} w={320} h={190} hull={answered} scale={2} />
          <text x="8" y="14" className="sk-t sk-t--sea" style={{ fontSize: 8.5 }}>{answered ? 'HULL SHOWN' : 'LIGHTS ONLY'}</text>
        </svg>
        <div className="sk-opts" style={{ borderTopColor: 'rgba(214,224,236,.2)' }}>
          {opts.map((k, i) => {
            const right = answered && k === s.a;
            const wrong = answered && k === pick && k !== s.a;
            return (
              <button key={k} type="button" className={`sk-opt${right ? ' sk-opt--right' : ''}${wrong ? ' sk-opt--wrong' : ''}`} disabled={answered} onClick={() => choose(k)}
                style={{ color: '#e8edf2', borderBottomColor: 'rgba(214,224,236,.16)' }}>
                <span className="sk-opt__k" style={{ color: right ? 'var(--ok)' : wrong ? 'var(--bad)' : '#9fb8cf' }}>{'ABCD'[i]}</span>
                <span style={{ fontSize: '0.92rem' }}>{ACTIONS[k]}</span>
                <span />
              </button>
            );
          })}
          {answered && (
            <div style={{ paddingTop: '0.7rem', display: 'grid', gap: '0.5rem', color: '#c9d4dd', fontSize: '0.88rem' }} aria-live="polite">
              <span className={`sk-dot ${pick === s.a ? 'sk-dot--ok' : 'sk-dot--bad'}`} style={{ color: '#e8edf2' }}>{pick === s.a ? 'Right' : 'Not that one'}</span>
              <p>{WHY[s.a]}</p>
              <span>
                <button type="button" className="sk-btn sk-btn--small" onClick={() => setRound({ ...deal(s), pick: null })}>Next lights <Icon name="arrow" size={13} /></button>
              </span>
            </div>
          )}
        </div>
      </div>
    </Stage>
  );
}
