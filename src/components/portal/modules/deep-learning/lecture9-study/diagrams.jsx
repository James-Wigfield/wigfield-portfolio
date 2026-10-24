import { createContext, useContext } from 'react';

/* ============================================================================
   LECTURE 9 STUDY — LINE-ART DIAGRAMS (the notebook pages and code cards)
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per figure worth drawing by hand: boxes,
   circles, arrows and short labels in currentColor, no fills or shading, so
   each can be copied onto paper in a minute or two. <Diagram fig="…" />
   picks one.

     rlLoop     slide 6 / Figure 18-2: agent → action → environment →
                observation + reward → agent
     policyNet  slide 25 / Figure 18-5: 4 inputs → 5 ReLU → 1 sigmoid = p(left)
                → sample the action
     returns    Figure 18-6: rewards +10, 0, −50 → returns −22, −40, −50 (× 0.8)
     mdp        Figure 18-8, simplified: s0, s1, s2 and the +10, −50, +40
     sample     slide 62: sample_experiences(32) → 6 arrays of 32
     dqnStep    slide 63: the data flow of training_step

   Highlighting: <Diagram fig="…" hl={['…']} sheet /> draws the named parts
   (<P k="…">) in the notebook's green pen. The part keys per figure are
   listed in ./sheets/figParts.js (page-check.mjs compares both sides).
   ========================================================================== */

const SW = 1.4;
const HlCtx = createContext(null);
const NO_HL = [];

function P({ k, children }) {
  const hl = useContext(HlCtx);
  if (!hl) return children;
  return <g className={hl.includes(k) ? 'dl9s-fig__hl' : undefined} data-part={k}>{children}</g>;
}

function Arrow({ x1, y1, x2, y2, dashed = false, head = 5 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

// an arrowhead at the end of a path that arrives heading `dir` (radians)
function Head({ x, y, dir, size = 5 }) {
  const p = (d) => `${x - size * Math.cos(dir + d)},${y - size * Math.sin(dir + d)}`;
  return <polyline points={`${p(0.45)} ${x},${y} ${p(-0.45)}`} />;
}

function T({ x, y, children, a = 'middle', s = 10.5, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl9s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h = 20, label, s = 10, r = 4 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} />
      {label && <T x={x + w / 2} y={y + h / 2 + 3.6} s={s}>{label}</T>}
    </g>
  );
}

// `wide`: a long left-to-right figure; on a narrow notebook page it keeps a
// readable size and scrolls sideways instead of shrinking
function Svg({ w, h, label, wide = false, children }) {
  const hl = useContext(HlCtx);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dl9s-fig${hl ? ' dl9s-fig--hl' : ''}`} data-wide={wide ? '' : undefined} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* §2 — the RL loop (slide 6, Figure 18-2) */
function RlLoop() {
  return (
    <Svg w={360} h={150} label="The reinforcement learning loop: the agent sends an action to the environment; the environment sends back an observation and a reward to the agent">
      <P k="agent">
        <Box x={14} y={52} w={92} h={40} label="Agent" s={11.5} />
        <T x={60} y={108} s={9.5} i>policy</T>
      </P>
      <P k="env"><Box x={252} y={52} w={96} h={40} label="Environment" s={11} /></P>
      <P k="act">
        <path d="M60 52 V 22 H 300 V 46" />
        <Head x={300} y={50} dir={Math.PI / 2} />
        <T x={180} y={16} s={10.5}>action</T>
      </P>
      <P k="obs">
        <path d="M300 92 V 122 H 60 V 98" />
        <Head x={60} y={94} dir={-Math.PI / 2} />
        <T x={180} y={138} s={10.5}>observation + reward</T>
      </P>
      <T x={180} y={78} s={9.5} i>maximise the expected long-term rewards</T>
    </Svg>
  );
}

/* §6 — slide 25's policy network (Figure 18-5) */
function PolicyNet() {
  const xs = [30, 70, 110, 150];
  const hs = [20, 55, 90, 125, 160];
  return (
    <Svg w={360} h={170} label="The policy network: four observation inputs, a hidden Dense layer of five ReLU units, one sigmoid output p, the probability of action 0 (left); the action is then sampled: left with probability p, right with 1 minus p">
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={150} r={7} />
          <T x={x} y={168} s={9}>{['x₁', 'x₂', 'x₃', 'x₄'][i]}</T>
          {hs.map((h) => <line key={h} x1={x} y1={143} x2={h} y2={97} strokeWidth={0.6} />)}
        </g>
      ))}
      <P k="hidden">
        {hs.map((h) => <circle key={h} cx={h} cy={90} r={7} />)}
        <T x={196} y={94} a="start" s={9.5}>5 × ReLU</T>
      </P>
      {hs.map((h) => <line key={h} x1={h} y1={83} x2={90} y2={47} strokeWidth={0.6} />)}
      <P k="out">
        <circle cx={90} cy={40} r={8} />
        <T x={106} y={44} a="start" s={9.5}>sigmoid: p = P(left)</T>
      </P>
      <P k="sample">
        <Arrow x1={240} y1={40} x2={270} y2={40} head={4} />
        <T x={276} y={36} a="start" s={9.5}>left with p</T>
        <T x={276} y={50} a="start" s={9.5}>right with 1 − p</T>
      </P>
      <T x={230} y={150} a="start" s={9} i>4 obs inputs</T>
    </Svg>
  );
}

/* §7 — Figure 18-6: discounted returns, worked backwards */
function Returns() {
  const xs = [60, 170, 280];
  return (
    <Svg w={340} h={128} label="Figure 18-6: three steps with rewards plus 10, 0 and minus 50; with discount 0.8 the sums of discounted future rewards are minus 22, minus 40 and minus 50, each step adding 0.8 times the next one">
      <T x={6} y={30} a="start" s={9.5}>rewards</T>
      <T x={6} y={96} a="start" s={9.5}>returns</T>
      {xs.map((x, i) => (
        <g key={x}>
          <T x={x} y={30} s={12} b>{['+10', '0', '−50'][i]}</T>
          <Arrow x1={x} y1={38} x2={x} y2={78} head={4} />
          <P k="ret"><T x={x} y={96} s={12} b>{['−22', '−40', '−50'][i]}</T></P>
        </g>
      ))}
      <P k="gamma">
        {[0, 1].map((i) => (
          <g key={i}>
            <Arrow x1={xs[i + 1] - 22} y1={92} x2={xs[i] + 22} y2={92} head={4} />
            <T x={(xs[i] + xs[i + 1]) / 2} y={114} s={9.5}>× 0.8</T>
          </g>
        ))}
      </P>
    </Svg>
  );
}

/* §11 — Figure 18-8, simplified: the three states and the three rewards */
function Mdp() {
  return (
    <Svg w={360} h={150} wide label="Figure 18-8 simplified: three states s0, s1, s2. In s0, action a0 loops back to s0 with reward plus 10 (probability 0.7). In s1, action a2 goes through the fire to s2 with reward minus 50. In s2, action a1 goes back to s0 with reward plus 40 (probability 0.8)">
      {[[50, 's₀'], [180, 's₁'], [310, 's₂']].map(([x, n]) => (
        <g key={n}>
          <circle cx={x} cy={90} r={18} />
          <T x={x} y={95} s={13}>{n}</T>
        </g>
      ))}
      <P k="plus10">
        <path d="M38 104 C 20 140, 80 140, 62 104" />
        <Head x={62} y={105} dir={-1.2} />
        <T x={50} y={146} s={10}>a₀: +10 (0.7)</T>
      </P>
      <Arrow x1={68} y1={90} x2={160} y2={90} head={4} />
      <T x={114} y={84} s={9} i>a₀ 0.3 · a₂ 0.2</T>
      <P k="fire">
        <Arrow x1={198} y1={90} x2={290} y2={90} head={4} />
        <T x={244} y={84} s={10}>a₂: −50</T>
        <T x={244} y={106} s={9} i>the fire</T>
      </P>
      <P k="plus40">
        <path d="M300 74 C 260 10, 100 10, 60 74" />
        <Head x={60} y={73} dir={2.1} />
        <T x={180} y={26} s={10}>a₁: +40 (0.8)</T>
      </P>
    </Svg>
  );
}

/* §16 — slide 62: sample_experiences(32) */
function Sample() {
  const fields = ['states', 'actions', 'rewards', 'next_states', 'dones', 'truncateds'];
  return (
    <Svg w={360} h={150} label="sample_experiences: 32 random experiences from the replay buffer of up to 2000, each a tuple of 6 fields, regrouped into 6 arrays of 32 entries: states, actions, rewards, next states, dones, truncateds">
      <Box x={10} y={20} w={70} h={110} />
      <T x={45} y={14} s={9.5}>replay_buffer</T>
      <T x={45} y={142} s={9} i>maxlen = 2000</T>
      {[34, 54, 74, 94, 114].map((y) => <line key={y} x1={14} y1={y} x2={76} y2={y} strokeWidth={0.6} />)}
      <P k="pick">
        <Arrow x1={84} y1={75} x2={124} y2={75} head={4} />
        <T x={104} y={68} s={9}>32</T>
        <T x={104} y={92} s={8.5} i>random</T>
      </P>
      <P k="arrays">
        {fields.map((f, i) => (
          <g key={f}>
            <rect x={132} y={18 + i * 20} width={14} height={16} rx={2} />
            <T x={152} y={30 + i * 20} a="start" s={9.5}>{f}</T>
          </g>
        ))}
        <T x={290} y={76} a="start" s={9} i>6 arrays,</T>
        <T x={290} y={88} a="start" s={9} i>32 each</T>
      </P>
    </Svg>
  );
}

/* §16 — slide 63: the data flow of training_step */
function DqnStep() {
  return (
    <Svg w={400} h={200} label="training_step: sample 32 experiences; run the DQN on the next states and keep the max over actions; multiply by runs (zero where the episode ended) and gamma and add the rewards: the target; run the DQN on the states and keep the taken action's Q-value with the one-hot mask; the mean squared error between them gives the gradients for one Nadam step">
      <Box x={4} y={86} w={64} h={28} label="sample 32" s={10} />
      <Arrow x1={68} y1={94} x2={92} y2={44} head={4} />
      <Arrow x1={68} y1={106} x2={92} y2={156} head={4} />
      <P k="target">
        <Box x={94} y={28} w={84} h={30} label="DQN(s′)" s={10.5} />
        <Arrow x1={178} y1={43} x2={192} y2={43} head={4} />
        <Box x={194} y={28} w={44} h={30} label="max" s={10.5} />
        <Arrow x1={238} y1={43} x2={252} y2={43} head={4} />
        <Box x={254} y={20} w={110} h={46} />
        <T x={309} y={39} s={10}>r + runs·γ·max</T>
        <T x={309} y={56} s={10.5} b>target y</T>
      </P>
      <P k="q">
        <Box x={94} y={142} w={84} h={30} label="DQN(s)" s={10.5} />
        <Arrow x1={178} y1={157} x2={192} y2={157} head={4} />
        <Box x={194} y={142} w={82} h={30} label="× one-hot" s={10} />
        <Arrow x1={276} y1={157} x2={290} y2={157} head={4} />
        <Box x={292} y={142} w={72} h={30} label="Q(s, a)" s={10.5} />
      </P>
      <P k="loss">
        <Arrow x1={330} y1={66} x2={352} y2={86} head={4} />
        <Arrow x1={330} y1={142} x2={352} y2={116} head={4} />
        <Box x={330} y={88} w={66} h={26} label="MSE" s={10.5} />
        <T x={300} y={104} a="end" s={9.5} i>grads → Nadam</T>
      </P>
    </Svg>
  );
}

const FIGS = {
  rlLoop: RlLoop,
  policyNet: PolicyNet,
  returns: Returns,
  mdp: Mdp,
  sample: Sample,
  dqnStep: DqnStep,
};

export function Diagram({ fig, sheet = false, lab = false, hl = NO_HL }) {
  const Fig = FIGS[fig];
  if (!Fig) return null;
  if (!sheet && !lab) return <Fig />;
  return (
    <span className={lab ? 'dl9s-figwrap dl9s-figwrap--lab' : 'dl9s-figwrap dl9s-figwrap--sheet'}>
      <HlCtx.Provider value={hl}>
        <Fig />
      </HlCtx.Provider>
    </span>
  );
}
