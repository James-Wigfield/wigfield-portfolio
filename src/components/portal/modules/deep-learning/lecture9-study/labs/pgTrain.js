/* ============================================================================
   §9 · REINFORCE IN THE BROWSER (this page's own, pure functions)
   ----------------------------------------------------------------------------
   A JavaScript run of slides 32–36 on this page's port of CartPole: the same
   4 → 5 (ReLU) → 1 (sigmoid) network (slide 25), the same step (slide 32:
   action = (u > p(left)), y_target = 1 − action, binary cross-entropy), the
   same scoring (slide 34: discount_and_normalize_rewards, γ = 0.95), the
   same update (slide 36: every step's gradient × its advantage, averaged,
   then one Nadam step, learning rate 0.01), 10 episodes per iteration and at
   most 200 steps. Its own seeded RNG and initial weights: its numbers are
   this page's own, not TensorFlow's.
   ========================================================================== */
import { rng, dense, forward, bceGrad, nadam, discountAndNormalizeRewards } from '../rl.js';
import { step, reset } from '../cartpole.js';

export const PG = { episodesPerUpdate: 10, maxSteps: 200, gamma: 0.95, lr: 0.01, iterations: 150 };

export function newTrainer(seed = 42) {
  const R = rng(seed);
  return { R, layers: dense([4, 5, 1], ['relu', 'sigmoid'], R), opt: {}, iteration: 0, curve: [] };
}

// slide 32's play_one_step: returns the next obs, the reward, done and the step's gradients
function playOneStep(T, obs) {
  const p = forward(T.layers, obs).out[0];
  const action = T.R.next() > p ? 1 : 0; // (tf.random.uniform([1, 1]) > left_proba)
  const yTarget = 1 - action; // tf.constant([[1.]]) - tf.cast(action, tf.float32)
  const { grads } = bceGrad(T.layers, obs, yTarget);
  const r = step(obs, action);
  return { obs: r.obs, reward: r.reward, done: r.terminated, grads };
}

// one training iteration (slide 36's loop body); returns the printed mean reward
export function trainIteration(T) {
  const allRewards = [];
  const allGrads = [];
  for (let e = 0; e < PG.episodesPerUpdate; e++) {
    const rewards = [];
    const grads = [];
    let obs = reset(T.R);
    for (let s = 0; s < PG.maxSteps; s++) {
      const out = playOneStep(T, obs);
      rewards.push(out.reward);
      grads.push(out.grads);
      obs = out.obs;
      if (out.done) break;
    }
    allRewards.push(rewards);
    allGrads.push(grads);
  }
  const total = allRewards.reduce((a, r) => a + r.length, 0);
  const finals = discountAndNormalizeRewards(allRewards, PG.gamma);
  // mean over every step of every episode of final_reward × gradient
  const mean = T.layers.map((L) => ({ W: L.W.map((r) => r.map(() => 0)), b: L.b.map(() => 0) }));
  finals.forEach((fr, e) => fr.forEach((f, s) => {
    allGrads[e][s].forEach((g, l) => {
      g.W.forEach((row, i) => row.forEach((v, j) => { mean[l].W[i][j] += (f * v) / total; }));
      g.b.forEach((v, j) => { mean[l].b[j] += (f * v) / total; });
    });
  }));
  nadam(T.layers, mean, T.opt, PG.lr);
  T.iteration += 1;
  const m = total / PG.episodesPerUpdate;
  T.curve.push(m);
  return m;
}

// play one episode with a policy network (sampling, as the slides do)
export function playPolicy(layers, start, R, maxSteps = PG.maxSteps, greedy = false) {
  const states = [start];
  const actions = [];
  let obs = start;
  for (let t = 0; t < maxSteps; t++) {
    const p = forward(layers, obs).out[0];
    const a = greedy ? (p < 0.5 ? 1 : 0) : R.next() > p ? 1 : 0;
    const r = step(obs, a);
    actions.push(a);
    states.push(r.obs);
    obs = r.obs;
    if (r.terminated) break;
  }
  return { states, actions };
}
