/* ============================================================================
   LECTURE 9 STUDY — THE MATHS (pure functions, no React)
   ----------------------------------------------------------------------------
   Ports of the slides' own code where the slides give code, and the slides'
   equations where they give only an equation. Everything the labs compute
   comes from here, and tools/dl-lecture9-study/check-rl.mjs checks it.

     rng(seed)                       a seeded PRNG (mulberry32) + normal()
     discountRewards                 slide 34's discount_rewards
     discountAndNormalizeRewards     slide 34's discount_and_normalize_rewards
     CHAIN_187, markovStep           Figure 18-7's transition matrix (slide 40)
     T_188, R_188, ACTIONS_188       Figure 18-8's MDP (slide 47's lists)
     qValueIteration                 slide 48's loop (history included)
     valueIteration                  slide 44's update, V_{k+1}(s)
     argmaxRows                      np.argmax(Q, axis=1) (first maximum wins)
     tdUpdate                        slide 51's TD update, target and error
     qLearningUpdate                 slide 53's Q-learning update
     epsilonAt                       slide 64's max(1 - episode / 500, 0.01)
     epsilonGreedy                   slide 61's epsilon_greedy_policy
     dqnTargets                      slide 63's target_Q_values (runs mask)
     dense / forward / backward      a tiny dense network (policy net, DQN)
     nadam                           a Nadam step (Keras's formula)
     paramCount                      inputs·units + units, summed per layer
   ========================================================================== */

/* ── a seeded RNG ─────────────────────────────────────────────────────── */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
  const int = (n) => Math.floor(next() * n);
  const pick = (p) => {
    // index drawn from the probabilities p (they add up to 1)
    let u = next();
    for (let i = 0; i < p.length; i++) {
      u -= p[i];
      if (u < 0) return i;
    }
    return p.length - 1;
  };
  return { next, normal, int, pick };
}

/* ── slide 34: discounted returns and normalised advantages ───────────── */
// def discount_rewards(rewards, discount_factor):
//     discounted = np.array(rewards)
//     for step in range(len(rewards) - 2, -1, -1):
//         discounted[step] += discounted[step + 1] * discount_factor
//     return discounted
export function discountRewards(rewards, discountFactor) {
  const discounted = rewards.map(Number);
  for (let step = rewards.length - 2; step >= 0; step--) discounted[step] += discounted[step + 1] * discountFactor;
  return discounted;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// np.std: the population standard deviation (ddof = 0)
const std = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};
export { mean, std };

export function discountAndNormalizeRewards(allRewards, discountFactor) {
  const allDiscounted = allRewards.map((r) => discountRewards(r, discountFactor));
  const flat = allDiscounted.flat();
  const m = mean(flat);
  const s = std(flat);
  return allDiscounted.map((d) => d.map((x) => (x - m) / s));
}

/* ── slide 40: Figure 18-7's Markov chain ─────────────────────────────── */
// rows = source states, columns = destination states, both in the order s0, s1, s2, s3
export const CHAIN_187 = [
  [0.7, 0.2, 0.0, 0.1],
  [0.0, 0.0, 0.9, 0.1],
  [0.0, 1.0, 0.0, 0.0],
  [0.0, 0.0, 0.0, 1.0],
];
export const markovStep = (P, s, u) => {
  let acc = 0;
  for (let j = 0; j < P[s].length; j++) {
    acc += P[s][j];
    if (u < acc) return j;
  }
  return P[s].length - 1;
};

/* ── slide 47: Figure 18-8's MDP, as the slides' lists ────────────────── */
export const T_188 = [ // shape=[s, a, s']
  [[0.7, 0.3, 0.0], [1.0, 0.0, 0.0], [0.8, 0.2, 0.0]],
  [[0.0, 1.0, 0.0], null, [0.0, 0.0, 1.0]],
  [null, [0.8, 0.1, 0.1], null],
];
export const R_188 = [ // shape=[s, a, s']
  [[+10, 0, 0], [0, 0, 0], [0, 0, 0]],
  [[0, 0, 0], [0, 0, 0], [0, 0, -50]],
  [[0, 0, 0], [+40, 0, 0], [0, 0, 0]],
];
export const ACTIONS_188 = [[0, 1, 2], [0, 2], [1]];

const rowMax = (r) => Math.max(...r);

/* Slide 48's loop, as written:
     Q_values = np.full((3, 3), -np.inf); 0.0 for the possible actions
     for iteration in range(n):
         Q_prev = Q_values.copy(); history1.append(Q_prev)
         for s in range(3):
             for a in possible_actions[s]:
                 Q_values[s, a] = np.sum([T[s][a][sp] * (R[s][a][sp] + gamma * Q_prev[sp].max()) for sp in range(3)])
   history[k] is Q_k (history[0] = all zeros); the result is Q_n.            */
export function qValueIteration({ T = T_188, R = R_188, actions = ACTIONS_188, gamma = 0.9, iterations = 50 } = {}) {
  const nS = T.length;
  let Q = Array.from({ length: nS }, () => Array(3).fill(-Infinity));
  actions.forEach((as, s) => as.forEach((a) => { Q[s][a] = 0; }));
  const history = [];
  for (let it = 0; it < iterations; it++) {
    const prev = Q.map((r) => r.slice());
    history.push(prev);
    const next = prev.map((r) => r.slice());
    for (let s = 0; s < nS; s++) {
      for (const a of actions[s]) {
        let sum = 0;
        for (let sp = 0; sp < nS; sp++) sum += T[s][a][sp] * (R[s][a][sp] + gamma * rowMax(prev[sp]));
        next[s][a] = sum;
      }
    }
    Q = next;
  }
  history.push(Q.map((r) => r.slice()));
  return { Q, history };
}

/* Slide 44: V_{k+1}(s) ← max_a Σ_{s'} T(s,a,s') [R(s,a,s') + γ V_k(s')],
   from V_0 = 0. history[k] = V_k. (The slides give this one as an equation
   only; the page iterates it the same way as slide 48's loop.)              */
export function valueIteration({ T = T_188, R = R_188, actions = ACTIONS_188, gamma = 0.9, iterations = 50 } = {}) {
  const nS = T.length;
  let V = Array(nS).fill(0);
  const history = [V.slice()];
  const best = [];
  for (let it = 0; it < iterations; it++) {
    const prev = V;
    const pick = [];
    V = prev.map((_, s) => {
      let top = -Infinity;
      let arg = -1;
      for (const a of actions[s]) {
        let sum = 0;
        for (let sp = 0; sp < nS; sp++) sum += T[s][a][sp] * (R[s][a][sp] + gamma * prev[sp]);
        if (sum > top) { top = sum; arg = a; }
      }
      pick.push(arg);
      return top;
    });
    history.push(V.slice());
    best.push(pick);
  }
  return { V, history, best };
}

// np.argmax(Q, axis=1): the first index of each row's maximum
export const argmaxRows = (Q) => Q.map((r) => r.reduce((bi, v, i) => (v > r[bi] ? i : bi), 0));

/* The γ between 0.90 and 0.95 where s1's best action flips from a0 to a2
   (bisection on the converged Q-values; this page's own working). */
export function flipGamma({ lo = 0.9, hi = 0.95, iterations = 2000 } = {}) {
  const best = (g) => argmaxRows(qValueIteration({ gamma: g, iterations }).Q)[1];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (best(mid) === 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ── slide 51: TD learning ────────────────────────────────────────────── */
// V_{k+1}(s) ← (1 − α) V_k(s) + α (r + γ V_k(s'))  =  V_k(s) + α δ_k(s, r, s')
export function tdUpdate(v, r, vNext, alpha, gamma) {
  const target = r + gamma * vNext;
  const error = target - v;
  return { target, error, next: v + alpha * error, blend: (1 - alpha) * v + alpha * target };
}

/* ── slide 53: Q-learning ─────────────────────────────────────────────── */
// Q_{k+1}(s,a) ← (1 − α) Q_k(s,a) + α (r + γ max_{a'} Q_k(s', a'))
export function qLearningUpdate(q, r, qNextRow, alpha, gamma) {
  const target = r + gamma * rowMax(qNextRow);
  return { target, next: (1 - alpha) * q + alpha * target };
}

/* Q-learning on Figure 18-8 with a purely random exploration policy (slide
   57's first option) and a learning rate that is gradually reduced (slide
   52): α_k = α0 / (1 + k·decay). This page's own run, seeded. It tracks
   Q(s0, a0) and Q(s2, a1), the two values slides 54–55 chart.            */
export function qLearningRun({ steps = 10000, gamma = 0.9, alpha0 = 0.05, decay = 0.005, seed = 42, every = 10 } = {}) {
  const R = rng(seed);
  const Q = [[0, 0, 0], [0, -Infinity, 0], [-Infinity, 0, -Infinity]];
  const track = { s0a0: [0], s2a1: [0], k: [0] };
  let s = 0;
  for (let k = 0; k < steps; k++) {
    const as = ACTIONS_188[s];
    const a = as[R.int(as.length)];
    const sp = R.pick(T_188[s][a]);
    const r = R_188[s][a][sp];
    const alpha = alpha0 / (1 + k * decay);
    Q[s][a] = qLearningUpdate(Q[s][a], r, Q[sp], alpha, gamma).next;
    s = sp;
    if ((k + 1) % every === 0) {
      track.k.push(k + 1);
      track.s0a0.push(Q[0][0]);
      track.s2a1.push(Q[2][1]);
    }
  }
  return { Q, track };
}

/* ── slides 57, 61, 64: ε-greedy ──────────────────────────────────────── */
export const epsilonAt = (episode) => Math.max(1 - episode / 500, 0.01);

// slide 61: if np.random.rand() < epsilon: random action, else argmax Q
export function epsilonGreedy(qRow, epsilon, R) {
  if (R.next() < epsilon) return { action: R.int(qRow.length), explored: true };
  return { action: argmaxRows([qRow])[0], explored: false };
}

/* ── slide 63: the DQN targets ────────────────────────────────────────── */
// max_next_Q_values = next_Q_values.max(axis=1)
// runs = 1.0 - (dones | truncateds)   # episode is not done or truncated
// target_Q_values = rewards + runs * discount_factor * max_next_Q_values
export function dqnTargets({ rewards, dones, truncateds, nextQ, discountFactor = 0.95 }) {
  const maxNext = nextQ.map(rowMax);
  const runs = dones.map((d, i) => 1.0 - ((d || truncateds[i]) ? 1 : 0));
  const targets = rewards.map((r, i) => r + runs[i] * discountFactor * maxNext[i]);
  return { maxNext, runs, targets };
}

/* ── a tiny dense network ─────────────────────────────────────────────── */
const ACT = {
  relu: (z) => (z > 0 ? z : 0),
  elu: (z) => (z > 0 ? z : Math.exp(z) - 1),
  sigmoid: (z) => 1 / (1 + Math.exp(-z)),
  linear: (z) => z,
};
const DACT = { // derivative from z (pre-activation) and a (activation)
  relu: (z) => (z > 0 ? 1 : 0),
  elu: (z, a) => (z > 0 ? 1 : a + 1),
  sigmoid: (z, a) => a * (1 - a),
  linear: () => 1,
};

// sizes [4, 5, 1], acts ['relu', 'sigmoid'] → layers with Glorot-uniform W, zero b (Keras's defaults)
export function dense(sizes, acts, R) {
  return acts.map((act, l) => {
    const nIn = sizes[l];
    const nOut = sizes[l + 1];
    const lim = Math.sqrt(6 / (nIn + nOut));
    return {
      act,
      W: Array.from({ length: nIn }, () => Array.from({ length: nOut }, () => (R.next() * 2 - 1) * lim)),
      b: Array(nOut).fill(0),
    };
  });
}

// weights exported from Keras ({ W: in×out, b }) + activations → layers
export const fromWeights = (ws, acts) => ws.map((w, l) => ({ act: acts[l], W: w.W, b: w.b }));

export const paramCount = (layers) => layers.reduce((a, L) => a + L.W.length * L.W[0].length + L.b.length, 0);
export const paramCountOf = (sizes) => sizes.slice(1).reduce((a, n, l) => a + sizes[l] * n + n, 0);

export function forward(layers, x) {
  const zs = [];
  const as = [x];
  let a = x;
  layers.forEach((L) => {
    const z = L.b.map((bj, j) => a.reduce((s, ai, i) => s + ai * L.W[i][j], bj));
    zs.push(z);
    a = z.map((zj) => ACT[L.act](zj));
    as.push(a);
  });
  return { out: a, zs, as };
}

// gradients of a loss whose derivative w.r.t. the output activations is dOut
export function backward(layers, cache, dOut) {
  const grads = layers.map((L) => ({ W: L.W.map((r) => r.map(() => 0)), b: L.b.map(() => 0) }));
  let delta = dOut.map((d, j) => d * DACT[layers[layers.length - 1].act](cache.zs[layers.length - 1][j], cache.as[layers.length][j]));
  for (let l = layers.length - 1; l >= 0; l--) {
    const aIn = cache.as[l];
    aIn.forEach((ai, i) => delta.forEach((dj, j) => { grads[l].W[i][j] += ai * dj; }));
    delta.forEach((dj, j) => { grads[l].b[j] += dj; });
    if (l > 0) {
      const L = layers[l];
      delta = aIn.map((_, i) => delta.reduce((s, dj, j) => s + dj * L.W[i][j], 0) * DACT[layers[l - 1].act](cache.zs[l - 1][i], cache.as[l][i]));
    }
  }
  return grads;
}

// the gradient of slide 32's loss, binary cross-entropy(y_target, p(left)),
// w.r.t. the sigmoid output p: −(y/p) + (1−y)/(1−p)
export function bceGrad(layers, obs, yTarget) {
  const cache = forward(layers, obs);
  const p = Math.min(1 - 1e-7, Math.max(1e-7, cache.out[0]));
  return { p: cache.out[0], grads: backward(layers, cache, [-(yTarget / p) + (1 - yTarget) / (1 - p)]) };
}

/* Keras's Nadam (β1 0.9, β2 0.999, ε 1e-7), one step on every parameter.
   state = { t, uProduct, m, v } is created on first use. */
export function nadam(layers, grads, state, lr = 0.01) {
  const b1 = 0.9;
  const b2 = 0.999;
  const eps = 1e-7;
  if (!state.m) {
    state.t = 0;
    state.uProduct = 1;
    state.m = grads.map((g) => ({ W: g.W.map((r) => r.map(() => 0)), b: g.b.map(() => 0) }));
    state.v = grads.map((g) => ({ W: g.W.map((r) => r.map(() => 0)), b: g.b.map(() => 0) }));
  }
  state.t += 1;
  const t = state.t;
  const uT = b1 * (1 - 0.5 * 0.96 ** (t * 0.004));
  const uT1 = b1 * (1 - 0.5 * 0.96 ** ((t + 1) * 0.004));
  const uProdT = state.uProduct * uT;
  const uProdT1 = uProdT * uT1;
  state.uProduct = uProdT;
  const b2p = b2 ** t;
  const upd = (P, G, M, V, key, i, j) => {
    const g = j === undefined ? G[key][i] : G[key][i][j];
    const mo = j === undefined ? M[key] : M[key][i];
    const vo = j === undefined ? V[key] : V[key][i];
    const k = j === undefined ? i : j;
    mo[k] = b1 * mo[k] + (1 - b1) * g;
    vo[k] = b2 * vo[k] + (1 - b2) * g * g;
    const mHat = (uT1 * mo[k]) / (1 - uProdT1) + ((1 - uT) * g) / (1 - uProdT);
    const vHat = vo[k] / (1 - b2p);
    const step = (lr * mHat) / (Math.sqrt(vHat) + eps);
    if (j === undefined) P[key][i] -= step;
    else P[key][i][j] -= step;
  };
  layers.forEach((L, l) => {
    L.W.forEach((r, i) => r.forEach((_, j) => upd(L, grads[l], state.m[l], state.v[l], 'W', i, j)));
    L.b.forEach((_, i) => upd(L, grads[l], state.m[l], state.v[l], 'b', i));
  });
}

/* ── formatting ───────────────────────────────────────────────────────── */
// "s0" → s₀ (the deck writes states and actions with subscripts)
export const sub = (name) => name.replace(/(\d+)$/, (d) => [...d].map((c) => '₀₁₂₃₄₅₆₇₈₉'[c]).join(''));

export const fmt = (x, d = 2) => {
  if (x === -Infinity) return '−∞';
  if (x === Infinity) return '∞';
  const s = Number(x).toFixed(d);
  return s.startsWith('-') && Number(s) !== 0 ? `−${s.slice(1)}` : s.replace(/^-/, '');
};
