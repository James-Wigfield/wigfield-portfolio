/* ============================================================================
   DESCENT — THE OPTIMISERS (pure; Lecture 2 slides 29, 34–45, 50–59)
   ----------------------------------------------------------------------------
   Every club is the slide's update rule, term for term, on a vector θ:

     sgd       θ ← θ − η∇θJ(θ)                                  (slide 34)
     momentum  m ← βm − η∇θJ(θ);  θ ← θ + m                      (slide 34)
     nag       m ← βm − η∇θJ(θ + βm);  θ ← θ + m                 (slide 36)
     adagrad   s ← s + ∇θJ(θ) ⊗ ∇θJ(θ)
               θ ← θ − η∇θJ(θ) ⊘ √(s + ε)                        (slide 38)
     rmsprop   s ← ρs + (1 − ρ)∇θJ(θ) ⊗ ∇θJ(θ)
               θ ← θ − η∇θJ(θ) ⊘ √(s + ε)                        (slide 41)
     adam      1. m ← β₁m + (1 − β₁)∇θJ(θ)
               2. s ← β₂s + (1 − β₂)∇θJ(θ) ⊗ ∇θJ(θ)
               3. m̂ ← m/(1 − β₁ᵗ)      4. ŝ ← s/(1 − β₂ᵗ)
               5. θ ← θ − η m̂ ⊘ √(ŝ + ε)    (t = iteration number) (slide 43)

   ε sits INSIDE the square root, as slides 38, 41 and 43 print it. The
   defaults are the slides': β = 0.9 (34), ρ = 0.9 (41), β₁ = 0.9 and
   β₂ = 0.999 (44), ε = 10⁻¹⁰ (38, the deck's only ε value; slides 41 and 43
   give none, so the same ε is used for RMSProp and Adam).

     step(state, grad, hp) → state
       state  { theta: number[], m: number[], s: number[], t: number }
       grad   θ → ∇θJ(θ) (a function, because NAG measures it at θ + βm)
       hp     { club, eta, beta?, rho?, beta1?, beta2?, epsilon?,
                clipvalue?, clipnorm? }  (clipping as on slide 29: the
                gradient is clipped before the update)
   ========================================================================== */

export const CLUB_IDS = ['sgd', 'momentum', 'nag', 'adagrad', 'rmsprop', 'adam'];

export const DEFAULTS = { beta: 0.9, rho: 0.9, beta1: 0.9, beta2: 0.999, epsilon: 1e-10 };

const zeros = (n) => Array.from({ length: n }, () => 0);

export function initState(theta) {
  return { theta: theta.slice(), m: zeros(theta.length), s: zeros(theta.length), t: 0 };
}

/* slide 29: clipvalue clips every component to [−c, c]; clipnorm keeps the
   orientation (the vector is scaled down to norm c when it is longer) */
export function clipValue(g, c) {
  return g.map((v) => Math.max(-c, Math.min(c, v)));
}
export function clipNorm(g, c) {
  const n = Math.hypot(...g);
  return n > c ? g.map((v) => (v * c) / n) : g.slice();
}
export const norm = (g) => Math.hypot(...g);

function gradAt(grad, theta, hp) {
  let g = grad(theta);
  if (hp.clipvalue != null) g = clipValue(g, hp.clipvalue);
  if (hp.clipnorm != null) g = clipNorm(g, hp.clipnorm);
  return g;
}

export const STEPS = {
  sgd(state, grad, hp) {
    const g = gradAt(grad, state.theta, hp);
    return { ...state, theta: state.theta.map((th, i) => th - hp.eta * g[i]), t: state.t + 1 };
  },
  momentum(state, grad, hp) {
    const beta = hp.beta ?? DEFAULTS.beta;
    const g = gradAt(grad, state.theta, hp);
    const m = state.m.map((mi, i) => beta * mi - hp.eta * g[i]);
    return { ...state, m, theta: state.theta.map((th, i) => th + m[i]), t: state.t + 1 };
  },
  nag(state, grad, hp) {
    const beta = hp.beta ?? DEFAULTS.beta;
    const ahead = state.theta.map((th, i) => th + beta * state.m[i]);
    const g = gradAt(grad, ahead, hp);
    const m = state.m.map((mi, i) => beta * mi - hp.eta * g[i]);
    return { ...state, m, theta: state.theta.map((th, i) => th + m[i]), t: state.t + 1, ahead };
  },
  adagrad(state, grad, hp) {
    const eps = hp.epsilon ?? DEFAULTS.epsilon;
    const g = gradAt(grad, state.theta, hp);
    const s = state.s.map((si, i) => si + g[i] * g[i]);
    return { ...state, s, theta: state.theta.map((th, i) => th - (hp.eta * g[i]) / Math.sqrt(s[i] + eps)), t: state.t + 1 };
  },
  rmsprop(state, grad, hp) {
    const rho = hp.rho ?? DEFAULTS.rho;
    const eps = hp.epsilon ?? DEFAULTS.epsilon;
    const g = gradAt(grad, state.theta, hp);
    const s = state.s.map((si, i) => rho * si + (1 - rho) * g[i] * g[i]);
    return { ...state, s, theta: state.theta.map((th, i) => th - (hp.eta * g[i]) / Math.sqrt(s[i] + eps)), t: state.t + 1 };
  },
  adam(state, grad, hp) {
    const b1 = hp.beta1 ?? DEFAULTS.beta1;
    const b2 = hp.beta2 ?? DEFAULTS.beta2;
    const eps = hp.epsilon ?? DEFAULTS.epsilon;
    const t = state.t + 1; // t is the iteration number (1 on the first step)
    const g = gradAt(grad, state.theta, hp);
    const m = state.m.map((mi, i) => b1 * mi + (1 - b1) * g[i]); // 1
    const s = state.s.map((si, i) => b2 * si + (1 - b2) * g[i] * g[i]); // 2
    const mHat = m.map((mi) => mi / (1 - b1 ** t)); // 3
    const sHat = s.map((si) => si / (1 - b2 ** t)); // 4
    const theta = state.theta.map((th, i) => th - (hp.eta * mHat[i]) / Math.sqrt(sHat[i] + eps)); // 5
    return { theta, m, s, t, mHat, sHat };
  },
};

export function step(state, grad, hp) {
  const f = STEPS[hp.club];
  if (!f) throw new Error(`unknown club ${hp.club}`);
  return f(state, grad, hp);
}

/* Run a club from `start` for up to nMax steps; the path includes the start.
   Stops early (diverged) when a coordinate leaves ±limit or stops being a
   number. */
export function run(club, grad, start, hp, nMax, limit = 1e6) {
  let st = initState(start);
  const path = [start.slice()];
  let diverged = false;
  for (let k = 0; k < nMax; k++) {
    st = step(st, grad, { ...hp, club });
    const th = st.theta;
    if (!th.every((v) => Number.isFinite(v)) || th.some((v) => Math.abs(v) > limit)) {
      diverged = true;
      path.push(th.map((v) => (Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : limit)));
      break;
    }
    path.push(th.slice());
  }
  return { path, diverged };
}

/* Par counts the steps until the ball is in the cup FOR GOOD: within radius r
   of the flag at that step and at every later step up to nMax. Returns the
   step number, or null when the ball is not in the cup to stay. */
export function holedAt(path, flag, r, diverged = false) {
  if (diverged) return null;
  const inCup = (p) => Math.hypot(p[0] - flag[0], p[1] - flag[1]) <= r;
  if (!inCup(path[path.length - 1])) return null;
  let k = path.length - 1;
  while (k > 0 && inCup(path[k - 1])) k--;
  return k;
}

/* ── learning-rate schedules (slides 50–59) ───────────────────────────── */
// slide 50: η(t) = η₀ / (1 + rt/s)^c
export const powerSched = (t, { eta0, r, s, c = 1 }) => eta0 / (1 + (r * t) / s) ** c;
// slide 52: η(t) = η₀ r^(t/s)
export const expSched = (t, { eta0, r, s }) => eta0 * r ** (t / s);
// slide 56: PiecewiseConstantDecay(boundaries, values): values has one more
// entry; values[0] up to boundaries[0], values[1] up to boundaries[1], …
export function piecewiseSched(t, { boundaries, values }) {
  let i = 0;
  while (i < boundaries.length && t > boundaries[i]) i++;
  return values[i];
}
// slide 57: ReduceLROnPlateau, multiply η by `factor` once the best validation
// loss has not improved for `patience` consecutive epochs
export function performanceSched(valLosses, { eta0, factor, patience }) {
  let eta = eta0;
  let best = Infinity;
  let wait = 0;
  return valLosses.map((v) => {
    if (v < best) {
      best = v;
      wait = 0;
    } else {
      wait += 1;
      if (wait >= patience) {
        eta *= factor;
        wait = 0;
      }
    }
    return eta;
  });
}
// slide 59 gives the SHAPE only (no numbers): linear η₀ → η₁ by halfway, linear
// back down to η₀, then the last few epochs drop by several orders of magnitude
// (still linearly). Used for a schematic curve with no axis values.
export function oneCycleSched(t, { eta0, eta1, total, tail }) {
  const half = total / 2; // η₁ is reached halfway through training
  const down = total - tail; // back at η₀ when the last few epochs begin
  if (t <= half) return eta0 + ((eta1 - eta0) * t) / half;
  if (t <= down) return eta1 - ((eta1 - eta0) * (t - half)) / (down - half);
  const u = Math.min(1, (t - down) / tail);
  return eta0 + (eta0 / 1000 - eta0) * u;
}
