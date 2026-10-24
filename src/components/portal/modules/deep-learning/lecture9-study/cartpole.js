/* ============================================================================
   LECTURE 9 STUDY — THIS PAGE'S PORT OF CARTPOLE
   ----------------------------------------------------------------------------
   The slides use Gymnasium's "CartPole-v1" (slides 16–22) but don't print its
   physics. This file ports it from Gymnasium's source
   (gymnasium/envs/classic_control/cartpole.py, class CartPoleEnv, which
   follows Barto, Sutton & Anderson, 1983), so the cart and pole can run live
   in the browser. Beyond the slides; labelled "this page's port of CartPole"
   wherever it is shown.

     constants   gravity 9.8, cart mass 1.0, pole mass 0.1, length 0.5
                 (half the pole's length), force 10.0, tau 0.02 s per step,
                 Euler integration
     state       [x, x_dot, theta, theta_dot] = the observation's four
                 numbers (slide 17): cart position (0.0 = centre), cart
                 velocity (positive = right), pole angle (0.0 = vertical,
                 radians), angular velocity (positive = clockwise)
     actions     0 = push left, 1 = push right (slide 19's Discrete(2))
     reward      1.0 for every step taken, including the last one
     terminated  ("done" on the slides) the pole tilts past ±12°
                 (±0.2095 rad) or the cart leaves ±2.4
     truncated   CartPole-v1's time limit is 500 steps; the slides' own
                 loops stop at 200 (range(200), n_max_steps = 200)
     reset       each number uniform in [−0.05, 0.05], from a seeded RNG
                 (this page's RNG, not NumPy's: reset(seed=42) here does not
                 give slide 17's numbers; SLIDE17_OBS holds those)
   ========================================================================== */
import { rng } from './rl.js';

export const GRAVITY = 9.8;
export const MASS_CART = 1.0;
export const MASS_POLE = 0.1;
export const TOTAL_MASS = MASS_POLE + MASS_CART;
export const LENGTH = 0.5; // half the pole's length
export const POLEMASS_LENGTH = MASS_POLE * LENGTH;
export const FORCE_MAG = 10.0;
export const TAU = 0.02;
export const THETA_LIMIT = (12 * 2 * Math.PI) / 360;
export const X_LIMIT = 2.4;
export const TIME_LIMIT = 500;
export const SLIDE_STEPS = 200;

// slide 17: obs, info = env.reset(seed=42)
export const SLIDE17_OBS = [0.0273956, -0.00611216, 0.03585979, 0.0197368];
// slide 20: after env.step(1) from that observation
export const SLIDE20_OBS = [0.02727336, 0.18847767, 0.03625453, -0.26141977];

export const OBS_NAMES = ['cart position', 'cart velocity', 'pole angle', 'angular velocity'];

// one env.step(action) → { obs, reward, terminated }
export function step(state, action) {
  const [x, xDot, theta, thetaDot] = state;
  const force = action === 1 ? FORCE_MAG : -FORCE_MAG;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const temp = (force + POLEMASS_LENGTH * thetaDot ** 2 * sin) / TOTAL_MASS;
  const thetaAcc = (GRAVITY * sin - cos * temp) / (LENGTH * (4.0 / 3.0 - (MASS_POLE * cos ** 2) / TOTAL_MASS));
  const xAcc = temp - (POLEMASS_LENGTH * thetaAcc * cos) / TOTAL_MASS;
  const obs = [x + TAU * xDot, xDot + TAU * xAcc, theta + TAU * thetaDot, thetaDot + TAU * thetaAcc];
  return { obs, reward: 1.0, terminated: isDone(obs) };
}

export const isDone = ([x, , theta]) => x < -X_LIMIT || x > X_LIMIT || theta < -THETA_LIMIT || theta > THETA_LIMIT;

export function reset(R) {
  return [0, 1, 2, 3].map(() => R.next() * 0.1 - 0.05);
}

// slide 21: return 0 if angle < 0 else 1
export const basicPolicy = (obs) => (obs[2] < 0 ? 0 : 1);

/* One episode under a policy (obs → action), at most maxSteps steps, from a
   start state; returns the states visited (start included), the actions and
   the total reward (= the number of steps taken). */
export function runEpisode(policy, start, maxSteps = SLIDE_STEPS) {
  const states = [start];
  const actions = [];
  let obs = start;
  let total = 0;
  for (let t = 0; t < maxSteps; t++) {
    const action = policy(obs, t);
    const r = step(obs, action);
    actions.push(action);
    states.push(r.obs);
    total += r.reward;
    obs = r.obs;
    if (r.terminated) break;
  }
  return { states, actions, total };
}

/* slide 22's experiment, on this page's port: 500 episodes of basic_policy,
   each from its own seeded reset, at most 200 steps. */
export function basicPolicyTotals({ episodes = 500, seed = 2026 } = {}) {
  return Array.from({ length: episodes }, (_, e) => runEpisode(basicPolicy, reset(rng(seed + e * 7919))).total);
}
