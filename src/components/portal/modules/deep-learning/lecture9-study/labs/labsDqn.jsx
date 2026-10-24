import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine } from '../stage';
import { useStory } from '../story';
import { Rich } from '../Rich';
import { Grid, Scrub, Tip } from '../svgParts';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { rng, epsilonAt, fmt } from '../rl';
import { MAXLEN, BATCH, appendEpisode, fillBuffer, playRandomEpisode, episodeSeed, sampleIndices, regroup, trainStepNumbers } from './labsDqnMath';
import './labsDqn.css';

/* ============================================================================
   §16 · DEEP Q-LEARNING IN tf.keras  (slides 61–64)
   ----------------------------------------------------------------------------
   ReplayLab       the replay buffer, deque(maxlen=2000), as a ring filling
                   with 6-field experiences (state, action, reward,
                   next_state, done, truncated) from random-action episodes
                   of this page's CartPole port; sample_experiences(32)
                   draws 32 random indices (with replacement), marked on
                   the ring, and regroups them into slide 62's 6 arrays.
                   "play until full" shows the oldest experiences dropping.
   TrainStepLab    story mode over slide 63's training_step on 4 of the 32
                   experiences of one batch (this page's experiences and
                   trained DQN): sample → next_Q_values and their max →
                   runs (0 where the episode ended) → target_Q_values →
                   one_hot mask keeps Q(s, a) → MSE loss, one Nadam step.
   EpsScheduleLab  slide 64's epsilon = max(1 - episode / 500, 0.01) over
                   episodes 0–599, with the episodes before training_step
                   starts (episode > 50) shaded, slide 57's "e.g. 0.05" as
                   a faint line, and a draggable episode marker.
   ========================================================================== */

/* ── the replay buffer ───────────────────────────────────────────────── */
const BASE = 9; // episodes 9000, 9001, … (playRandomEpisode seeds)
const OPEN_EPISODES = 30;
const SAMPLE_SEED = 62;
const CX = 150;
const CY = 150;
const RR = 108;
const ang = (slot) => -Math.PI / 2 + (2 * Math.PI * (((slot % MAXLEN) + MAXLEN) % MAXLEN)) / MAXLEN;
const pt = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
function arc(r, from, len) {
  if (len >= MAXLEN) return `M${CX} ${CY - r} A${r} ${r} 0 1 1 ${CX} ${CY + r} A${r} ${r} 0 1 1 ${CX} ${CY - r}`;
  if (len <= 0) return '';
  const [x0, y0] = pt(r, ang(from));
  const [x1, y1] = pt(r, ang(from + len));
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${len > MAXLEN / 2 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const slotOf = (buf, i) => buf.appended - buf.items.length + i; // deque index i → append number

function openReplay() {
  const buf = fillBuffer(BASE, OPEN_EPISODES);
  const R = rng(SAMPLE_SEED);
  return { buf, R, indices: sampleIndices(R, buf.items.length) };
}
const OPEN_R = openReplay();
const OPEN_REPLAY = { buf: OPEN_R.buf, indices: OPEN_R.indices };

const FIELDS6 = [
  { k: 'states', w: 4, role: 'obs' },
  { k: 'actions', w: 1, role: 'act' },
  { k: 'rewards', w: 1, role: 'rpos' },
  { k: 'next_states', w: 4, role: 'obs' },
  { k: 'dones', w: 1, role: 'done' },
  { k: 'truncateds', w: 1, role: 'done' },
];
const OBS_SCALE = [0.25, 1.5, 0.21, 2.0]; // colour scale per observation number (position, velocity, angle, angular velocity)

function Ring({ buf, indices, hot }) {
  const len = buf.items.length;
  const full = len >= MAXLEN;
  const start = buf.appended - len;
  const [le0, le1] = buf.lastEpisode;
  const head = buf.appended; // the next append goes here (when full: the oldest's slot)
  const [hx, hy] = pt(RR + 22, ang(head));
  const dups = indices ? indices.length - new Set(indices).size : 0;
  return (
    <svg className="dl9s-svg dl9s-rp__ring" viewBox="-40 -6 380 312" role="img" aria-label={`The replay buffer: ${len} of ${MAXLEN} experiences${full ? ', full: each new experience drops the oldest' : ''}${indices ? `; ${indices.length} sampled indices marked` : ''}`}>
      <circle cx={CX} cy={CY} r={RR} className="dl9s-rp__track" />
      <path d={arc(RR, start, len)} className="dl9s-rp__fill" />
      <path d={arc(RR, le0, le1 - le0)} className="dl9s-rp__last" />
      {buf.items.map((e, i) => {
        if (!e.done) return null;
        const a = ang(slotOf(buf, i));
        const [x0, y0] = pt(RR - 8, a);
        const [x1, y1] = pt(RR + 8, a);
        return <line key={`d${i}`} x1={x0} y1={y0} x2={x1} y2={y1} className="dl9s-rp__done" />;
      })}
      {indices?.map((ix, k) => {
        const a = ang(slotOf(buf, ix));
        const [x0, y0] = pt(RR - 14, a);
        const [x1, y1] = pt(RR + 13, a);
        const [dx, dy] = pt(RR + 18, a);
        const on = hot === k;
        return (
          <g key={`s${k}`} className={on ? 'dl9s-rp__pick dl9s-rp__pick--on' : 'dl9s-rp__pick'}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} />
            <circle cx={dx} cy={dy} r={on ? 4.2 : 2.1} />
          </g>
        );
      })}
      <g className="dl9s-rp__head">
        <circle cx={hx} cy={hy} r={3.5} />
        <text x={hx + (hx >= CX ? 8 : -8)} y={hy + 4} textAnchor={hx >= CX ? 'start' : 'end'} className="dl9s-t dl9s-t--xs">{full ? 'oldest: dropped next' : 'next append'}</text>
      </g>
      <text x={CX} y={CY - 26} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">len(replay_buffer)</text>
      <text x={CX} y={CY + 4} textAnchor="middle" className="dl9s-rp__len">{len.toLocaleString('en-US')}</text>
      <text x={CX} y={CY + 24} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">maxlen = 2,000</text>
      <text x={CX} y={CY + 42} textAnchor="middle" className={`dl9s-t dl9s-t--xs${full ? ' dl9s-t--b' : ''}`}>{full ? `${(buf.dropped ?? 0).toLocaleString('en-US')} oldest dropped` : indices ? `drawn with replacement: ${dups} repeat${dups === 1 ? '' : 's'}` : ''}</text>
    </svg>
  );
}

// the batch drawing's layout: each field's column, left to right
const BC = 18;
const BCH = 8;
const BGAP = 14;
const BY0 = 66;
const GROUPS = FIELDS6.reduce((acc, f) => {
  const x = acc.length ? acc.at(-1).x + acc.at(-1).w * BC + BGAP : 30;
  return [...acc, { ...f, x }];
}, []);
const BW = GROUPS.at(-1).x + GROUPS.at(-1).w * BC + 46;

function Batch({ arrays, onHot, narrow }) {
  const c = BC;
  const ch = BCH;
  const y0 = BY0;
  const [tip, setTip] = useState(null);
  const groups = GROUPS;
  const W = BW;
  const H = y0 + BATCH * ch + 34;
  const fmtCell = (f, v) => (f.role === 'done' ? (v ? 'True' : 'False') : f.k === 'actions' ? String(v) : f.k === 'rewards' ? v.toFixed(1) : fmt(v, 3));
  return (
    <svg className="dl9s-svg dl9s-rp__batch" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="The 6 arrays sample_experiences returns: states 32 by 4, actions, rewards, next_states 32 by 4, dones, truncateds">
      {groups.map((g) => {
        const raw = arrays[g.k];
        const M = raw.map((v) => {
          if (g.w === 4) return v.map((o, j) => o / OBS_SCALE[j]);
          if (g.role === 'done') return [v ? -1 : 0];
          return [Number(v)];
        });
        return (
          <g key={g.k}>
            <text x={g.x + 2} y={y0 - 10} transform={`rotate(-38 ${g.x + 2} ${y0 - 10})`} className="dl9s-t dl9s-t--xs dl9s-t--m dl9s-rp__name">{g.k}</text>
            <Grid
              x={g.x}
              y={y0}
              M={M}
              c={c}
              ch={ch}
              role={g.role === 'done' ? 'val' : g.role}
              weights={g.k === 'actions' || g.k === 'rewards'}
              max={1}
              frame={false}
              onHover={(hv) => {
                if (!hv) { setTip(null); onHot(null); return; }
                onHot(hv.i);
                const v = g.w === 4 ? raw[hv.i][hv.j] : raw[hv.i];
                setTip({ x: g.x + hv.j * c + c / 2, y: y0 + hv.i * ch, text: `[${hv.i}] ${fmtCell(g, v)}` });
              }}
            />
            <text x={g.x + (g.w * c) / 2} y={y0 + BATCH * ch + 16} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{g.w === 4 ? '32×4' : '32'}</text>
          </g>
        );
      })}
      <text x={24} y={y0 + 5} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">0</text>
      <text x={24} y={y0 + BATCH * ch} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">31</text>
      {!narrow && <text x={W - 6} y={H - 2} textAnchor="end" className="dl9s-t dl9s-t--xs">hover a row</text>}
      {tip && <Tip x={tip.x} y={tip.y} text={tip.text} />}
    </svg>
  );
}

export function ReplayLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [state, setState] = useState(OPEN_REPLAY);
  const [hot, setHot] = useState(null);
  const gen = useRef(null);
  const view = printing ? OPEN_REPLAY : state;
  const { buf, indices } = view;
  const arrays = useMemo(() => (indices ? regroup(buf.items, indices) : null), [buf, indices]);

  const playOne = () => setState((s) => ({ buf: appendEpisode(s.buf, playRandomEpisode(episodeSeed(BASE, s.buf.episodes))), indices: null }));
  const playFull = () => setState((s) => {
    let b = s.buf;
    while (b.items.length < MAXLEN) b = appendEpisode(b, playRandomEpisode(episodeSeed(BASE, b.episodes)));
    b = appendEpisode(b, playRandomEpisode(episodeSeed(BASE, b.episodes)));
    return { buf: b, indices: null };
  });
  const sample = () => {
    if (!gen.current) gen.current = openReplay().R;
    const ix = sampleIndices(gen.current, buf.items.length);
    setState((s) => ({ ...s, indices: ix }));
  };
  const reset = () => { gen.current = null; setState(OPEN_REPLAY); };

  return (
    <Stage
      title="The replay buffer: a ring of 2,000 experiences"
      slides="slides 61–62"
      tryThis="Predict what happens once all 2,000 slots are full, then press play until full."
      caption="Each step `play_one_step` appends one 6-field experience (slide 61’s comment lists 5) and `deque(maxlen=2000)` drops the oldest once it is full; `sample_experiences(32)` draws 32 random indices, with replacement, and regroups that batch field by field into 6 arrays."
      challenge={{ text: 'Fill the buffer until its oldest experiences start dropping out.', done: (buf.dropped ?? 0) > 0 }}
      own="random-action episodes of this page’s CartPole port"
      maths={
        <>
          <MLine text={`\`replay_buffer.append((state, action, reward, next_state, done, truncated))\`: one experience per step, ${buf.appended.toLocaleString('en-US')} appended so far in ${buf.episodes} episodes; \`len(replay_buffer) = ${buf.items.length.toLocaleString('en-US')}\`${(buf.dropped ?? 0) > 0 ? `, so the deque has dropped the ${buf.dropped.toLocaleString('en-US')} oldest` : ''}.`} />
          {indices ? (
            <MLine text={`\`indices = np.random.randint(${buf.items.length}, size=32)\` → [${indices.slice(0, 10).join(', ')}, …]: whole numbers from 0 (the oldest experience) to ${buf.items.length - 1}, drawn with replacement, so an index can repeat (${indices.length - new Set(indices).size} did here).`} />
          ) : (
            <MLine text="Press “sample a batch of 32” to draw the indices." />
          )}
          <MLine text="`[np.array([experience[field_index] for experience in batch]) for field_index in range(6)]` turns 32 tuples into 6 arrays: `states` (32, 4), `actions` (32,), `rewards` (32,), `next_states` (32, 4), `dones` (32,), `truncateds` (32,)." />
          <p className="dl9s-mnote">The episodes here use random actions (as the early, high-ε episodes of slide 64 mostly do) and stop at 200 steps like slide 64’s loop, so truncated is never True: CartPole-v1 truncates at 500. Red ticks on the ring are experiences with done = True, the last step of each episode.</p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-rp${narrow ? ' dl9s-rp--narrow' : ''}`}>
        <div className="dl9s-floorrow dl9s-rp__ctl dl9s-noprint">
          <div className="dl9s-rp__btns">
            <button type="button" className="dl9s-rp__btn" onClick={playOne}>play an episode</button>
            <button type="button" className="dl9s-rp__btn" onClick={playFull}>play until full</button>
            <button type="button" className="dl9s-rp__btn dl9s-rp__btn--pick" onClick={sample}>sample a batch of 32</button>
          </div>
          <button type="button" className="dl9s-rp__reset" onClick={reset}>reset</button>
        </div>
        <div className="dl9s-rp__row">
          <div className="dl9s-rp__left">
            <Ring buf={buf} indices={indices} hot={hot} />
            <p className="dl9s-rp__key">
              <span className="dl9s-rp__k dl9s-rp__k--fill">experiences</span>
              <span className="dl9s-rp__k dl9s-rp__k--last">last episode</span>
              <span className="dl9s-rp__k dl9s-rp__k--done">done = True</span>
              <span className="dl9s-rp__k dl9s-rp__k--pick">sampled</span>
            </p>
          </div>
          <div className="dl9s-rp__right">
            <p className="dl9s-rp__code"><code>sample_experiences(32)</code> → 6 arrays</p>
            {arrays ? <Batch arrays={arrays} onHot={setHot} narrow={narrow} /> : <p className="dl9s-rp__empty">Sample a batch of 32 to see the 6 arrays.</p>}
          </div>
        </div>
      </div>
    </Stage>
  );
}

/* ── one training step ───────────────────────────────────────────────── */
const TS_BASE = 4;
const TS_EPISODES = 40;
const TS_SAMPLE_SEED = 81;
const SHOW = 4;

const TS_BEATS = [
  { label: 'sample', code: 'experiences = sample_experiences(batch_size)', say: 'Sample 32 experiences and split them into the 6 arrays (4 of the 32 rows shown; row 3’s episode ended there).' },
  { label: 'next Q', code: 'next_Q_values = model.predict(next_states)  ·  max_next_Q_values = next_Q_values.max(axis=1)', say: 'The DQN predicts both Q-values of every **next** state; keep the larger one per row.' },
  { label: 'runs', code: 'runs = 1.0 - (dones | truncateds)', say: '`runs` is 0 where the episode ended (done or truncated), 1 elsewhere: an ended episode has no future to add.' },
  { label: 'targets', code: 'target_Q_values = rewards + runs * discount_factor * max_next_Q_values', say: 'Target = reward + runs × 0.95 × the best next Q-value: the ended row’s target is just its reward, 1.0.' },
  { label: 'mask', code: 'mask = tf.one_hot(actions, n_outputs)  ·  Q_values = tf.reduce_sum(all_Q_values * mask, axis=1, keepdims=True)', say: 'The DQN predicts both Q-values of each state; the one-hot mask keeps only $Q(s, a)$ for the action actually taken.' },
  { label: 'loss → Nadam', code: 'loss = tf.reduce_mean(loss_fn(target_Q_values, Q_values))  ·  optimizer.apply_gradients(zip(grads, …))', say: 'The loss is the mean squared error over all 32 rows; its gradients drive one Nadam step, which lowers the loss on this batch.' },
];
// which arrays each beat is about (the rest of the visible ones are dimmed)
const ACTIVE = [
  ['states', 'actions', 'rewards', 'next_states', 'dones', 'truncateds'],
  ['next_states', 'nextQ', 'maxNext'],
  ['dones', 'truncateds', 'runs'],
  ['rewards', 'runs', 'maxNext', 'targets'],
  ['states', 'actions', 'mask', 'allQ', 'qs'],
  ['targets', 'qs', 'err'],
];
const FROM_BEAT = { states: 0, actions: 0, rewards: 0, next_states: 0, dones: 0, truncateds: 0, nextQ: 1, maxNext: 1, runs: 2, targets: 3, mask: 4, allQ: 4, qs: 4, err: 5 };

function tsLayout(narrow) {
  const top = 64;
  if (narrow) {
    const ch = 22;
    return {
      W: 340, ch, rowsY: [top, top + 4 * ch + 76, top + 8 * ch + 152], H: top + 12 * ch + 152 + 112, lossAt: [10, top + 12 * ch + 152 + 34],
      cols: {
        states: [0, 4, 14, false], actions: [0, 1, 22], rewards: [0, 1, 28], next_states: [0, 4, 14, false], dones: [0, 1, 26], truncateds: [0, 1, 26],
        nextQ: [1, 2, 38], maxNext: [1, 1, 40], runs: [1, 1, 30], targets: [1, 1, 44],
        mask: [2, 2, 22], allQ: [2, 2, 38], qs: [2, 1, 40], err: [2, 1, 42],
      },
      gap: 12, x0: 26,
    };
  }
  const ch = 22;
  return {
    W: 800, ch, rowsY: [top, top + 4 * ch + 84], H: top + 8 * ch + 112, lossAt: [628, top + 8],
    cols: {
      states: [0, 4, 40], actions: [0, 1, 26], rewards: [0, 1, 32], next_states: [0, 4, 40], dones: [0, 1, 42], truncateds: [0, 1, 42],
      nextQ: [1, 2, 42], maxNext: [1, 1, 44], runs: [1, 1, 32], targets: [1, 1, 46],
      mask: [1, 2, 26], allQ: [1, 2, 42], qs: [1, 1, 44], err: [1, 1, 44],
    },
    gap: 18, x0: 30,
  };
}

const ROLE = { states: 'obs', next_states: 'obs', actions: 'act', rewards: 'rpos', dones: 'val', truncateds: 'val', nextQ: 'val', maxNext: 'val', runs: 'ret', targets: 'ret', mask: 'act', allQ: 'val', qs: 'val', err: 'pol' };
const LABEL = { states: 'states', actions: 'actions', rewards: 'rewards', next_states: 'next_states', dones: 'dones', truncateds: 'truncateds', nextQ: 'next_Q_values', maxNext: 'max_next_Q_values', runs: 'runs', targets: 'target_Q_values', mask: 'mask', allQ: 'all_Q_values', qs: 'Q_values', err: '(target − Q)²' };

export function TrainStepLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const story = useStory(TS_BEATS.length);
  const { beat } = story;
  const [run, setRun] = useState(null);
  const [tip, setTip] = useState(null);
  useEffect(() => {
    let alive = true;
    import('../data/dqnRun.js').then((m) => { if (alive) setRun(m.DQN_RUN); });
    return () => { alive = false; };
  }, []);
  const D = useMemo(() => {
    if (!run) return null;
    const buf = fillBuffer(TS_BASE, TS_EPISODES);
    const idx = sampleIndices(rng(TS_SAMPLE_SEED), buf.items.length);
    const b = regroup(buf.items, idx);
    const t = trainStepNumbers(run.bestWeights, b);
    return { b, t, len: buf.items.length, idx };
  }, [run]);
  const L = tsLayout(narrow);

  // the 4 displayed rows of every array, as matrices + how to print a cell
  const data = D && {
    states: D.b.states.slice(0, SHOW), actions: D.b.actions.slice(0, SHOW).map((v) => [v]), rewards: D.b.rewards.slice(0, SHOW).map((v) => [v]),
    next_states: D.b.next_states.slice(0, SHOW), dones: D.b.dones.slice(0, SHOW).map((v) => [v]), truncateds: D.b.truncateds.slice(0, SHOW).map((v) => [v]),
    nextQ: D.t.nextQ.slice(0, SHOW), maxNext: D.t.maxNext.slice(0, SHOW).map((v) => [v]), runs: D.t.runs.slice(0, SHOW).map((v) => [v]),
    targets: D.t.targets.slice(0, SHOW).map((v) => [v]), mask: D.t.mask.slice(0, SHOW), allQ: D.t.allQ.slice(0, SHOW),
    qs: D.t.qs.slice(0, SHOW).map((v) => [v]), err: D.t.qs.slice(0, SHOW).map((q, i) => [(D.t.targets[i] - q) ** 2]),
  };
  const show = (v, k) => {
    if (k === 'dones' || k === 'truncateds') return narrow ? (v ? 'T' : 'F') : (v ? 'True' : 'False');
    if (k === 'actions' || k === 'mask') return String(v);
    if (k === 'rewards' || k === 'runs') return v.toFixed(1);
    if (k === 'states' || k === 'next_states') return fmt(v, 2);
    return fmt(v, narrow ? 1 : 2);
  };
  const tone = (v, k, j) => {
    if (k === 'states' || k === 'next_states') return v / OBS_SCALE[j];
    if (k === 'dones' || k === 'truncateds') return v ? -1 : 0;
    if (['nextQ', 'maxNext', 'allQ', 'qs', 'targets'].includes(k)) return v / 22;
    if (k === 'err') return Math.min(1, v / 70);
    return Number(v);
  };

  // place the arrays row by row
  const placed = {};
  if (data) {
    const cursor = L.rowsY.map(() => L.x0);
    Object.entries(L.cols).forEach(([k, [row, w, c]]) => {
      placed[k] = { x: cursor[row], y: L.rowsY[row], w, c };
      cursor[row] += w * c + L.gap;
    });
  }
  const doneRow = D ? D.b.dones.slice(0, SHOW).findIndex(Boolean) : -1;
  const beatNow = Math.max(beat, 0);

  return (
    <Stage
      title="One training step, array by array"
      slides="slide 63"
      tryThis="Predict which row ends up with the biggest error, then step through the beats."
      story={<StoryBar story={story} beats={TS_BEATS} />}
      caption="Each array carries the slide’s variable name; the rows are 4 of the 32 in one batch. The row whose episode ended (`done = True`) gets `runs = 0`, so its target is just its reward, far below what the DQN predicts, and it dominates the loss."
      own="experiences and trained DQN · this page’s own"
      maths={
        D && (
          <>
            <MLine text={`\`batch_size = 32\`, \`discount_factor = 0.95\`, Nadam with \`learning_rate=1e-2\`, \`loss_fn = mean_squared_error\` (slide 63). The batch: 32 indices drawn from a buffer of ${D.len} experiences.`} />
            {data.targets.map((tg, i) => (
              <MLine key={i} text={`Row ${i}: $${show(data.rewards[i][0], 'rewards')} + ${data.runs[i][0].toFixed(1)} \\times 0.95 \\times ${fmt(data.maxNext[i][0], 3)} = ${fmt(tg[0], 3)}$; $Q(s, a{=}${data.actions[i][0]}) = ${fmt(data.qs[i][0], 3)}$; squared error $${fmt(data.err[i][0], 3)}$.`} />
            ))}
            <MLine text={`\`loss\` = the mean of the 32 squared errors $= ${fmt(D.t.loss, 3)}$. After one Nadam step (all 1,282 parameters move), the same batch’s loss is $${fmt(D.t.lossAfter, 3)}$.`} />
            <p className="dl9s-mnote"><Rich text="Slide 63 computes the targets outside the GradientTape (no gradient flows through them) and only `all_Q_values = model(states)` inside it. `target_Q_values.reshape(-1, 1)` and `keepdims=True` make both (32, 1), so the MSE compares row by row." /></p>
          </>
        )
      }
    >
      <div ref={wrap} className={`dl9s-ts${narrow ? ' dl9s-ts--narrow' : ''}`}>
        {!D ? (
          <p className="dl9s-ts__load">Loading this page’s run…</p>
        ) : (
          <>
            <p className="dl9s-ts__code"><code>{TS_BEATS[beatNow].code}</code></p>
            <svg className="dl9s-svg dl9s-ts__svg" viewBox={`0 0 ${L.W} ${L.H}`} role="img" aria-label={`Training step, beat ${beatNow + 1}: ${TS_BEATS[beatNow].label}. Targets ${data.targets.map((t) => fmt(t[0], 2)).join(', ')}; Q-values ${data.qs.map((q) => fmt(q[0], 2)).join(', ')}; loss over 32 ${fmt(D.t.loss, 2)}`}>
              {/* row 3 (the ended episode) banded while runs and the targets are built */}
              {doneRow >= 0 && beat >= 2 && beat <= 3 && L.rowsY.slice(0, 2).map((ry) => (
                <rect key={ry} className="dl9s-rowband" x={4} y={ry + doneRow * L.ch - 2} width={L.W - 8} height={L.ch + 4} rx={4} />
              ))}
              {Object.entries(placed).map(([k, p]) => {
                const visible = beat >= FROM_BEAT[k];
                const active = ACTIVE[beatNow].includes(k);
                const M = data[k];
                const numbers = L.cols[k][3] !== false;
                return (
                  <g key={k} className={`dl9s-fade${visible ? (active ? '' : ' dl9s-ts__quiet') : ' dl9s-hide'}`}>
                    <text x={p.x + 1} y={p.y - 8} transform={`rotate(-30 ${p.x + 1} ${p.y - 8})`} className={`dl9s-t dl9s-t--xs dl9s-t--m dl9s-ts__name${active ? ' dl9s-ts__name--on' : ''}`}>{LABEL[k]}</text>
                    <Grid
                      x={p.x}
                      y={p.y}
                      M={M.map((r) => r.map((v, j) => tone(v, k, j)))}
                      c={p.c}
                      ch={L.ch}
                      role={ROLE[k]}
                      weights={k === 'actions' || k === 'rewards' || k === 'mask' || k === 'runs'}
                      max={1}
                      frame={false}
                      values={numbers ? (_, i, j) => show(M[i][j], k) : undefined}
                      onHover={(hv) => setTip(hv ? { x: p.x + hv.j * p.c + p.c / 2, y: p.y + hv.i * L.ch, text: `${LABEL[k]}[${hv.i}${p.w > 1 ? `, ${hv.j}` : ''}] = ${k === 'dones' || k === 'truncateds' ? (M[hv.i][hv.j] ? 'True' : 'False') : fmt(M[hv.i][hv.j], 4)}` } : null)}
                    />
                  </g>
                );
              })}
              {[0, 1, 2, 3].map((i) => L.rowsY.filter((_, r) => beat >= [0, 1, 4][r]).map((ry) => (
                <text key={`${i}-${ry}`} x={L.x0 - 8} y={ry + i * L.ch + L.ch / 2 + 4} textAnchor="end" className={`dl9s-t dl9s-t--xs dl9s-t--m${i === doneRow ? ' dl9s-t--rneg' : ''}`}>{i}</text>
              )))}
              <text x={4} y={L.rowsY[0] + 4 * L.ch + 16} className="dl9s-t dl9s-t--xs">4 of the 32 rows</text>
              <g className={`dl9s-fade${beat >= 5 ? '' : ' dl9s-hide'}`}>
                <text x={L.lossAt[0]} y={L.lossAt[1]} className="dl9s-t dl9s-t--s">loss over all 32</text>
                <text x={L.lossAt[0]} y={L.lossAt[1] + 24} className="dl9s-ts__loss">{fmt(D.t.loss, 2)}</text>
                <text x={L.lossAt[0]} y={L.lossAt[1] + 46} className="dl9s-t dl9s-t--xs">one Nadam step (lr 0.01) →</text>
                <text x={L.lossAt[0]} y={L.lossAt[1] + 68} className="dl9s-ts__loss dl9s-ts__loss--after">{fmt(D.t.lossAfter, 2)}</text>
              </g>
              {tip && <Tip x={Math.min(L.W - 70, Math.max(70, tip.x))} y={tip.y} text={tip.text} />}
            </svg>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ── slide 64's ε schedule ───────────────────────────────────────────── */
const EP_MAX = 599;
const FLOOR_EP = 495;

export function EpsScheduleLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const { printing } = useStudy();
  const [ep, setEp] = useState(250);
  const [found, setFound] = useState(false);
  const e = printing ? 250 : ep;
  const eps = epsilonAt(e);
  const trains = e > 50;
  const G = narrow
    ? { W: 340, H: 268, x0: 40, x1: 318, yTop: 34, yBot: 168, scrubY: 222 }
    : { W: 760, H: 252, x0: 60, x1: 720, yTop: 30, yBot: 166, scrubY: 212 };
  const toX = (v) => G.x0 + (v / EP_MAX) * (G.x1 - G.x0);
  const toY = (v) => G.yBot - v * (G.yBot - G.yTop);
  const d = `M${toX(0)} ${toY(1)} L${toX(FLOOR_EP)} ${toY(0.01)} L${toX(EP_MAX)} ${toY(0.01)}`;
  const onEp = (v) => { setEp(v); if (v === FLOOR_EP) setFound(true); };

  return (
    <Stage
      title="ε falls, then training starts"
      slides="slide 64"
      tryThis="Predict the ε at episode 250, then drag the episode marker and watch when training_step starts."
      caption="`epsilon = max(1 - episode / 500, 0.01)` falls in a straight line from 1 at episode 0 to its floor of 0.01 and stays there; `training_step` only runs once `episode > 50`, so the first 51 episodes just fill the replay buffer with mostly random actions ($\epsilon \geq 0.9$)."
      challenge={{ text: 'Find the first episode where ε reaches its floor of 0.01.', done: found }}
      own={null}
      maths={
        <>
          <MLine text={`At \`episode = ${e}\`: \`epsilon = max(1 - ${e}/500, 0.01) = max(${(1 - e / 500).toFixed(3)}, 0.01) = ${eps.toFixed(3)}\`, the probability that \`epsilon_greedy_policy\` picks a random action at each step of this episode.`} />
          <MLine text="$1 - \text{episode}/500 = 0.01$ when episode $= 495$; from there to episode 599 the floor 0.01 holds (about 1 random action in 100)." />
          <MLine text="Slide 57’s example floor, 0.05, is reached at episode 475 with this schedule. `epsilon` is recomputed at every step, but it only depends on the episode, so it is constant within an episode." />
          <p className="dl9s-mnote"><Rich text="The loop counts episodes from 0 (`range(600)`); the debug print shows `episode + 1`, so the last line reads “Episode: 600”." /></p>
        </>
      }
    >
      <div ref={wrap} className={`dl9s-es${narrow ? ' dl9s-es--narrow' : ''}`}>
        <p className="dl9s-es__read" aria-live="polite">
          <span>episode <b>{e}</b></span>
          <span>ε = <b className="dl9s-es__eps">{eps.toFixed(3)}</b></span>
          <span className={trains ? 'dl9s-es__on' : 'dl9s-es__off'}>{trains ? `training_step runs (${e} > 50)` : `no training_step yet (${e} ≤ 50)`}</span>
        </p>
        <svg className="dl9s-svg dl9s-es__svg" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Epsilon schedule over 600 episodes; at episode ${e}, epsilon = ${eps.toFixed(3)}`}>
          <rect x={toX(0)} y={G.yTop} width={toX(50.5) - toX(0)} height={G.yBot - G.yTop} className="dl9s-es__off-zone" />
          <text x={toX(0) + 4} y={G.yTop - 8} className="dl9s-t dl9s-t--xs">{narrow ? 'no training' : 'no training_step (episode ≤ 50)'}</text>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={G.x0} y1={toY(v)} x2={G.x1} y2={toY(v)} className="dl9s-grid-line" />
              <text x={G.x0 - 8} y={toY(v) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>
            </g>
          ))}
          <line x1={G.x0} y1={toY(0.05)} x2={G.x1} y2={toY(0.05)} className="dl9s-es__ref" />
          <text x={narrow ? toX(70) : toX(300)} y={toY(0.05) - 5} textAnchor={narrow ? 'start' : 'middle'} className="dl9s-t dl9s-t--xs dl9s-slidemark">e.g. 0.05 (slide 57)</text>
          <text x={G.x0 - 8} y={G.yTop - 12} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--pol">ε</text>
          <path d={d} className="dl9s-line dl9s-line--pol" />
          <text x={G.x1} y={toY(0.01) + 16} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">floor 0.01</text>
          <line x1={toX(e)} y1={G.yTop - 2} x2={toX(e)} y2={G.yBot + 2} className="dl9s-today" />
          <circle cx={toX(e)} cy={toY(eps)} r={5.5} className="dl9s-es__dot" />
          <Scrub x0={G.x0} x1={G.x1} y={G.scrubY} value={e} min={0} max={EP_MAX} step={1} big={25} onChange={onEp} label="Episode" show={(v) => String(v)} ticks={[0, 100, 200, 300, 400, 500]} marks={[{ v: 50, label: '' }]} />
          <text x={G.x1 + (narrow ? 0 : 12)} y={G.scrubY + (narrow ? 34 : 4)} textAnchor={narrow ? 'end' : 'start'} className="dl9s-t dl9s-t--xs">episode</text>
        </svg>
      </div>
    </Stage>
  );
}
