import { useRef, useState } from 'react';
import { Stage, StoryBar } from '../stage';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { useStory } from '../story';
import './labsStory.css';

/* ============================================================================
   §1 · RL IN A NUTSHELL (slides 4–5)  ·  §2 · THE RL LOOP (slides 6–10)
   ----------------------------------------------------------------------------
   TimelineLab  slide 4's facts on a light timeline (since the 1950s: games
                such as TD-Gammon and machine control; 2013 DeepMind learns
                Atari from raw pixels; 2014 Google buys DeepMind for over 500
                million dollars; May 2017 AlphaGo beats Ke Jie at Go), then
                slide 5's answer and its three techniques as signposts that
                jump to their sections. Horizontal when wide, vertical when
                narrow. Nothing computed.
   RlLoopLab    slide 6's loop drawn like Figure 18-2: the agent's box, the
                environment's box, an action arrow one way and observation +
                reward arrows back. Story mode walks observe → act → the
                world changes → reward. A five-way switch relabels every
                part with Figure 18-1's examples in the slides' own words
                (slides 7–10); a part the slide doesn't name for that
                example reads, faintly, "not given on the slide".
   ========================================================================== */

/* ── §1 · the timeline ───────────────────────────────────────────────────── */
const STOPS = [
  { when: 'since the 1950s', what: 'games (e.g. TD-Gammon) and machine control', old: true },
  { when: '2013', what: 'DeepMind: a system learns to play just about any Atari game from scratch, from raw pixels only' },
  { when: '2014', what: 'Google buys DeepMind for over 500 million dollars' },
  { when: 'May 2017', what: 'AlphaGo beats Ke Jie, the world champion of Go' },
];
const TECHS = [
  { n: 1, name: 'policy gradients', id: 's08', sec: '§8' },
  { n: 2, name: 'Markov decision processes (MDPs)', id: 's10', sec: '§10' },
  { n: 3, name: 'Deep Q-network', id: 's15', sec: '§15' },
];

export function TimelineLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { jumpTo } = useStudy();
  return (
    <Stage
      title="An old field, and four sudden years"
      slides="slides 4–5"
      tryThis="Notice the long gap before 2013, then click one of slide 5’s three techniques to jump to where it is taught."
      caption="The dashed stretch is not to scale: slide 4 gives no year for TD-Gammon."
      own={null}
    >
      <div ref={wrap} className={`dl9s-tl${narrow ? ' dl9s-tl--narrow' : ''}`}>
        <ol className="dl9s-tl__line" aria-label="Slide 4’s timeline">
          {STOPS.map((s, i) => (
            <li key={s.when} className={`dl9s-tl__stop${s.old ? ' dl9s-tl__stop--old' : ''}${i === STOPS.length - 1 ? ' dl9s-tl__stop--last' : ''}`}>
              <span className="dl9s-tl__when">{s.when}</span>
              <span className="dl9s-tl__rail" aria-hidden="true"><span className="dl9s-tl__dot" /><span className="dl9s-tl__seg" /></span>
              <span className="dl9s-tl__what">{s.what}</span>
            </li>
          ))}
        </ol>
        <div className="dl9s-tl__how">
          <p className="dl9s-tl__punch">
            <span className="dl9s-tl__q">How? </span>
            “they applied the power of <b>Deep Learning</b> to the field of <b>Reinforcement Learning</b>”
            <span className="dl9s-tl__src">slide 5</span>
          </p>
          <ol className="dl9s-tl__techs" aria-label="Slide 5’s three techniques">
            {TECHS.map((t) => (
              <li key={t.id}>
                <button type="button" className="dl9s-tl__tech" onClick={() => jumpTo(t.id)} aria-label={`${t.name}: go to ${t.sec}`}>
                  <span className="dl9s-tl__n">{t.n}</span>
                  <span className="dl9s-tl__name">{t.name}</span>
                  <span className="dl9s-tl__sec">{t.sec} →</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Stage>
  );
}

/* ── §2 · the loop ───────────────────────────────────────────────────────── */
// Figure 18-1's examples, in the slides' own words (null = the slide doesn't say)
const EXAMPLES = [
  {
    key: 'robot', name: 'walking robot', slide: 'slide 7',
    agent: 'the program controlling a walking robot', env: 'the real world environment',
    act: null, obs: 'sensor readings',
    pos: 'approaching the target destination', neg: 'wasting time in the wrong direction or falling down',
  },
  {
    key: 'pacman', name: 'Ms. Pac-Man', slide: 'slide 8',
    agent: 'the program controlling Ms. Pac-Man', env: 'a simulation of the Atari game',
    act: 'the possible joystick positions', obs: 'the screenshots', rew: 'just the game points',
  },
  {
    key: 'thermo', name: 'smart thermostat', slide: 'slide 9',
    agent: 'a smart thermostat', env: null, act: null, obs: null,
    pos: 'close to the target temperature and saves energy', neg: 'when humans need to tweak the temperature',
  },
  {
    key: 'trader', name: 'trader', slide: 'slide 10',
    agent: 'an automatic trader', env: null,
    act: 'how much to buy or sell every second', obs: 'stock market prices', rew: 'the monetary gains and losses',
  },
  {
    key: 'maze', name: 'maze robot', slide: 'slide 10',
    agent: 'a program to control a robot to move to get out of a maze', env: null, act: null, obs: null,
    pos: 'no positive reward', neg: 'only negative reward', noPos: true,
  },
];

const BEATS = [
  { label: 'observe', say: 'The agent makes **observations** of its environment.' },
  { label: 'act', say: 'Using them, it takes an **action** within the environment.' },
  { label: 'the world changes', say: 'The action changes the environment, so what the agent observes next is different.' },
  { label: 'reward', say: 'In return it receives a **reward** (positive = pleasure, negative = pain), and by trial and error it learns to maximize its expected long-term rewards.' },
];

// greedy word wrap for SVG text
function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  });
  if (cur) lines.push(cur);
  return lines;
}

const NOT_GIVEN = 'not given on the slide';

function Words({ x, y, text, max, lh = 15, cls = '', anchor = 'middle' }) {
  const lines = wrap(text ?? NOT_GIVEN, max);
  return (
    <text x={x} y={y} textAnchor={anchor} className={`dl9s-loop__words dl9s-halo${text ? '' : ' dl9s-loop__words--none'} ${cls}`}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>{l}</tspan>)}
    </text>
  );
}

function Lane({ x0, x1, y, dir, role, word, state, children, wide }) {
  const a = dir > 0 ? x0 : x1;
  const b = dir > 0 ? x1 : x0;
  const head = 9;
  return (
    <g className={`dl9s-loop__lane dl9s-loop__lane--${state}`}>
      <text x={(x0 + x1) / 2} y={y - 10} textAnchor="middle" className={`dl9s-loop__role dl9s-t--${role} dl9s-halo`}>{word}</text>
      <line x1={a} y1={y} x2={b - dir * head} y2={y} className={`dl9s-loop__wire dl9s-loop__wire--${role}${wide ? ' dl9s-loop__wire--fat' : ''}`} />
      <polygon points={`${b},${y} ${b - dir * head * 1.3},${y - head * 0.7} ${b - dir * head * 1.3},${y + head * 0.7}`} className={`dl9s-loop__head dl9s-loop__head--${role}`} />
      {children}
    </g>
  );
}

function RewardLane({ x0, x1, y, state, noPos }) {
  const head = 9;
  return (
    <g className={`dl9s-loop__lane dl9s-loop__lane--${state}`}>
      <text x={(x0 + x1) / 2} y={y - 13} textAnchor="middle" className="dl9s-loop__role dl9s-halo">
        <tspan className="dl9s-t--rpos">+</tspan> reward <tspan className="dl9s-t--rneg">−</tspan>
      </text>
      <g className={noPos ? 'dl9s-loop__ghost' : ''}>
        <line x1={x1} y1={y - 3} x2={x0 + head} y2={y - 3} className="dl9s-loop__wire dl9s-loop__wire--rpos" />
      </g>
      <line x1={x1} y1={y + 3} x2={x0 + head} y2={y + 3} className="dl9s-loop__wire dl9s-loop__wire--rneg" />
      <polygon points={`${x0},${y} ${x0 + head * 1.3},${y - head * 0.8} ${x0 + head * 1.3},${y + head * 0.8}`} className="dl9s-loop__head" />
    </g>
  );
}

function geomLoop(narrow) {
  if (narrow) {
    // a sequence diagram: the two boxes as headers, lifelines, arrows between
    return {
      narrow, W: 340, H: 392,
      agent: { x: 2, y: 2, w: 160, h: 92, cx: 82, max: 24 },
      env: { x: 178, y: 2, w: 160, h: 92, cx: 258, max: 24 },
      x0: 82, x1: 258, laneMax: 50, lanes: [148, 232, 312], lifeTop: 94,
    };
  }
  return {
    narrow, W: 760, H: 300,
    agent: { x: 4, y: 8, w: 168, h: 284, cx: 88, max: 22 },
    env: { x: 588, y: 8, w: 168, h: 284, cx: 672, max: 22 },
    x0: 172, x1: 588, laneMax: 58, lanes: [62, 146, 226],
  };
}

export function RlLoopLab() {
  const ref = useRef(null);
  const narrow = useWidth(ref) < 560;
  const G = geomLoop(narrow);
  const story = useStory(BEATS.length);
  const { beat } = story;
  const { printing } = useStudy();
  const [exState, setEx] = useState(0);
  const ex = printing ? 0 : exState;
  const [seenMaze, setSeenMaze] = useState(false);
  const E = EXAMPLES[ex];

  // what each part looks like at this beat: 'on' | 'past' | 'off'
  const st = (onAt) => (beat < 0 ? 'off' : beat === onAt || beat === 3 ? 'on' : beat > onAt ? 'past' : 'off');
  const obsS = st(0);
  const actS = st(1);
  const envOn = beat >= 2;
  const rewS = beat >= 3 ? 'on' : 'off';
  const [lA, lO, lR] = G.lanes;
  const pick = (i) => { setEx(i); if (EXAMPLES[i].key === 'maze') setSeenMaze(true); };

  // title + words, centred in the box (top-aligned in the short narrow headers)
  const box = (b, role, title, words) => {
    const n = wrap(words ?? NOT_GIVEN, b.max).length;
    const top = G.narrow ? b.y + 26 : b.y + b.h / 2 - (22 + 14 * n) / 2 + 8;
    return (
      <g className={`dl9s-loop__box dl9s-loop__box--${role}${role === 'env' && envOn ? ' dl9s-loop__box--pulse' : ''}`}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} />
        <text x={b.cx} y={top} textAnchor="middle" className={`dl9s-loop__title dl9s-t--${role}`}>{title}</text>
        <Words x={b.cx} y={top + 22} text={words} max={b.max} lh={14} />
      </g>
    );
  };

  const rewWords = E.rew ? (
    <Words x={(G.x0 + G.x1) / 2} y={lR + 24} text={E.rew} max={G.laneMax} />
  ) : (
    <>
      <text x={(G.x0 + G.x1) / 2} y={lR + 24} textAnchor="middle" className={`dl9s-loop__words dl9s-halo dl9s-t--rpos${E.noPos ? ' dl9s-loop__words--soft' : ''}`}>+ {E.pos}</text>
      <Words x={(G.x0 + G.x1) / 2} y={lR + 41} text={`− ${E.neg}`} max={G.laneMax} cls="dl9s-t--rneg" />
    </>
  );

  return (
    <Stage
      title="One loop, many agents"
      slides="slides 6–10"
      tryThis="Predict what Ms. Pac-Man’s agent observes, then switch examples and notice which parts of the loop each slide leaves unnamed."
      story={<StoryBar story={story} beats={BEATS} />}
      caption="The loop is the same in every example; only the words on it change. A faint label is a part the slide doesn’t name for that example."
      challenge={{ text: 'Find the example with no positive reward at all.', done: seenMaze }}
      own={null}
    >
      <div ref={ref} className="dl9s-loop">
        <div className="dl9s-floorrow">
          <div className="dl9s-switch" role="group" aria-label="Figure 18-1’s examples">
            {EXAMPLES.map((e, i) => (
              <button key={e.key} type="button" className={`dl9s-switch__opt${i === ex ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={i === ex} onClick={() => pick(i)}>
                {e.name}
              </button>
            ))}
          </div>
          <span className="dl9s-loop__slide">{E.slide} · Figure 18-1</span>
        </div>
        <svg
          className="dl9s-svg dl9s-loop__svg"
          viewBox={`0 0 ${G.W} ${G.H}`}
          role="img"
          aria-label={`The reinforcement learning loop for the ${E.name} (${E.slide}): agent ${E.agent ?? NOT_GIVEN}; environment ${E.env ?? NOT_GIVEN}; action ${E.act ?? NOT_GIVEN}; observation ${E.obs ?? NOT_GIVEN}; reward ${E.rew ?? `positive: ${E.pos}; negative: ${E.neg}`}.`}
        >
          {G.narrow && (
            <g className="dl9s-loop__life">
              <line x1={G.x0} y1={G.lifeTop} x2={G.x0} y2={G.H - 8} />
              <line x1={G.x1} y1={G.lifeTop} x2={G.x1} y2={G.H - 8} />
            </g>
          )}
          {box(G.agent, 'agent', 'agent', E.agent)}
          {box(G.env, 'env', 'environment', E.env)}
          <Lane x0={G.x0} x1={G.x1} y={lA} dir={1} role="act" word="action" state={actS}>
            <Words x={(G.x0 + G.x1) / 2} y={lA + 24} text={E.act} max={G.laneMax} />
          </Lane>
          <Lane x0={G.x0} x1={G.x1} y={lO} dir={-1} role="obs" word="observation" state={obsS}>
            <Words x={(G.x0 + G.x1) / 2} y={lO + 24} text={E.obs} max={G.laneMax} />
          </Lane>
          <RewardLane x0={G.x0} x1={G.x1} y={lR} state={rewS} noPos={E.noPos} />
          <g className={`dl9s-loop__lane dl9s-loop__lane--${rewS}`}>{rewWords}</g>
        </svg>
      </div>
    </Stage>
  );
}
