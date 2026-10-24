/* ============================================================================
   §15–§16 · THE DQN LABS' OWN WORKING (pure functions, no React)
   ----------------------------------------------------------------------------
   Used by labsApprox.jsx and labsDqn.jsx. Everything here runs on this
   page's port of CartPole (../cartpole.js) and this page's own trained DQN
   (../data/dqnRun.js, loaded lazily by the labs); none of it is the slides'.

     playRandomEpisode(seed)   one episode of random actions, recorded the
                               way slide 62's play_one_step appends to the
                               replay buffer: (state, action, reward,
                               next_state, done, truncated), at most 200
                               steps (slide 64's range(200))
     Buffer                    deque(maxlen=2000) semantics: append, and the
                               oldest experience drops out once it is full
     sampleIndices             np.random.randint(len, size=n): with replacement
     regroup                   slide 62's [np.array([e[f] for e in batch])
                               for f in range(6)]
     dqnLayers                 the trained DQN as a fresh, private copy
                               (training must never touch DQN_RUN itself)
     trainStepNumbers          slide 63's training_step on one batch, every
                               intermediate array, and one Nadam step
   ========================================================================== */
import { rng, forward, backward, nadam, dqnTargets } from '../rl.js';
import { reset, step, SLIDE_STEPS, TIME_LIMIT } from '../cartpole.js';

export const MAXLEN = 2000;
export const BATCH = 32;
export const N_OUTPUTS = 2;
export const DISCOUNT = 0.95;
export const FIELDS = ['states', 'actions', 'rewards', 'next_states', 'dones', 'truncateds'];

// one episode of random actions, at most 200 steps
export function playRandomEpisode(seed) {
  const R = rng(seed);
  let state = reset(R);
  const out = [];
  for (let t = 0; t < SLIDE_STEPS; t++) {
    const action = R.int(N_OUTPUTS);
    const r = step(state, action);
    const truncated = !r.terminated && t + 1 >= TIME_LIMIT; // CartPole-v1 truncates at 500: never within 200
    out.push({ state, action, reward: r.reward, next_state: r.obs, done: r.terminated, truncated });
    state = r.obs;
    if (r.terminated || truncated) break;
  }
  return out;
}

export const episodeSeed = (base, e) => base * 1000 + e;

/* deque(maxlen=2000): `items[0]` is the oldest experience. `appended`
   counts every append ever made, so the drawing can place experience n at
   ring slot n mod 2000 (a circular buffer, which is what the deque is). */
export function emptyBuffer() {
  return { items: [], appended: 0, episodes: 0, lastEpisode: [0, 0] };
}

export function appendEpisode(buf, episode) {
  const items = buf.items.concat(episode);
  const start = buf.appended;
  const drop = Math.max(0, items.length - MAXLEN);
  return {
    items: drop ? items.slice(drop) : items,
    appended: buf.appended + episode.length,
    episodes: buf.episodes + 1,
    lastEpisode: [start, start + episode.length],
    dropped: (buf.dropped ?? 0) + drop,
  };
}

export function fillBuffer(base, episodes) {
  let buf = emptyBuffer();
  for (let e = 0; e < episodes; e++) buf = appendEpisode(buf, playRandomEpisode(episodeSeed(base, e)));
  return buf;
}

// np.random.randint(len(replay_buffer), size=batch_size)
export const sampleIndices = (R, len, n = BATCH) => Array.from({ length: n }, () => R.int(len));

// slide 62: a list of 6 arrays, one per field
export function regroup(items, indices) {
  const batch = indices.map((i) => items[i]);
  return {
    states: batch.map((e) => e.state),
    actions: batch.map((e) => e.action),
    rewards: batch.map((e) => e.reward),
    next_states: batch.map((e) => e.next_state),
    dones: batch.map((e) => e.done),
    truncateds: batch.map((e) => e.truncated),
  };
}

// a private copy of exported Keras weights, so a training step can't change them
export const dqnLayers = (ws) => ws.map((w, l) => ({ act: ['elu', 'elu', 'linear'][l], W: w.W.map((r) => r.slice()), b: w.b.slice() }));

/* §15's one experience: step 42 of random-action episode 4040, a state
   where the pole leans left and is falling (θ ≈ −0.106, θ̇ ≈ −1.64) and the
   random action pushes right. Picked (this page's own choice) because the
   trained DQN's Q_θ(s, a) sits visibly below its target there: in most
   states the trained network is already within a fraction of its target. */
export const APPROX_EPISODE = 4040;
export const APPROX_STEP = 42;

export function approxExample(weights) {
  const e = playRandomEpisode(APPROX_EPISODE)[APPROX_STEP];
  const model = dqnLayers(weights);
  const qS = forward(model, e.state).out;
  const qSp = forward(model, e.next_state).out;
  const max = Math.max(...qSp);
  const disc = DISCOUNT * max;
  const y = e.reward + disc;
  const q = qS[e.action];
  return { ...e, qS, qSp, best: qSp.indexOf(max), max, disc, y, q, err: y - q, sq: (y - q) ** 2 };
}

const mse = (ys, qs) => ys.reduce((a, y, i) => a + (y - qs[i]) ** 2, 0) / ys.length;

/* Slide 63's training_step on one batch (regroup's arrays), with this
   page's DQN. Returns every array the slide names, the loss, and the loss
   on the same batch after one Nadam step (learning_rate=1e-2). */
export function trainStepNumbers(weights, b, { discountFactor = DISCOUNT, lr = 1e-2 } = {}) {
  const model = dqnLayers(weights);
  const nextQ = b.next_states.map((s) => forward(model, s).out); // model.predict(next_states)
  const { maxNext, runs, targets } = dqnTargets({ rewards: b.rewards, dones: b.dones, truncateds: b.truncateds, nextQ, discountFactor });
  const mask = b.actions.map((a) => Array.from({ length: N_OUTPUTS }, (_, j) => (j === a ? 1 : 0))); // tf.one_hot
  const caches = b.states.map((s) => forward(model, s));
  const allQ = caches.map((c) => c.out); // model(states)
  const qs = allQ.map((row, i) => row.reduce((a, q, j) => a + q * mask[i][j], 0)); // reduce_sum(all_Q * mask, axis=1)
  const loss = mse(targets, qs);
  // the gradient of mean((y − Q)^2) w.r.t. each all_Q_values row: mask · 2(Q − y)/n
  const n = qs.length;
  const grads = model.map((L) => ({ W: L.W.map((r) => r.map(() => 0)), b: L.b.map(() => 0) }));
  caches.forEach((c, i) => {
    const dOut = mask[i].map((m) => m * (2 * (qs[i] - targets[i])) / n);
    const g = backward(model, c, dOut);
    g.forEach((gl, l) => {
      gl.W.forEach((r, a) => r.forEach((v, j) => { grads[l].W[a][j] += v; }));
      gl.b.forEach((v, j) => { grads[l].b[j] += v; });
    });
  });
  nadam(model, grads, {}, lr);
  const qsAfter = b.states.map((s, i) => forward(model, s).out[b.actions[i]]);
  return { nextQ, maxNext, runs, targets, mask, allQ, qs, loss, lossAfter: mse(targets, qsAfter), qsAfter };
}
