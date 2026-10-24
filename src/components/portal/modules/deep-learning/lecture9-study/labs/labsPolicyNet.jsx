import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, MLine } from '../stage';
import { Scrub } from '../svgParts';
import { weightFill } from '../svgFill';
import { Rich } from '../Rich';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { fromWeights, forward, rng } from '../rl';
import { SLIDE17_OBS } from '../cartpole';
import CartScene from './CartScene';
import './labsPolicyNet.css';

/* ============================================================================
   §6 · NEURAL NETWORK POLICIES  (slides 23–25)
   ----------------------------------------------------------------------------
   PolicyNetLab  slide 25's network (4 inputs → Dense(5, ReLU) → Dense(1,
                 sigmoid) = p, the probability of action 0, left), with this
                 page's own trained weights (../data/pgRun.js, the §9 run;
                 lazy). The observation is slide 17's, with the pole angle
                 obs[2] on a scrubber: lean the pole and p(left) and
                 1 − p(right) move on the split bar. Twenty random draws sit
                 on that bar as dots (a draw u < p means left, as in slide
                 32's `uniform > left_proba`): Figure 18-5's "multinomial
                 sampling", exploration made visible. A switch hides the two
                 velocities (slide 24): one observation then no longer pins
                 p down, and the bar shows the range p could take.
   ========================================================================== */

const N_DRAWS = 20;
const NAMES = ['position', 'velocity', 'angle', 'angular velocity'];
const SHORT = ['position', 'velocity', 'angle', 'ang. velocity'];
const HIDE = [1, 3];
const s4 = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(4)}`;
const draws = (seed) => {
  const R = rng(seed);
  return Array.from({ length: N_DRAWS }, () => ({ u: R.next(), j: R.next() }));
};

// p over the velocities the observation would hide (this page's own range)
function pRange(layers, obs) {
  let lo = 1;
  let hi = 0;
  for (let v = -1; v <= 1.0001; v += 0.1) {
    for (let w = -1.5; w <= 1.5001; w += 0.1) {
      const p = forward(layers, [obs[0], v, obs[2], w]).out[0];
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
  }
  return [lo, hi];
}

function geomNet(narrow) {
  return narrow
    ? { W: 340, H: 292, xi: 92, xh: 196, xo: 290, yi: [52, 110, 168, 226], yh: [40, 92, 144, 196, 248], yo: 144, lab: 78 }
    : { W: 520, H: 292, xi: 112, xh: 270, xo: 416, yi: [52, 110, 168, 226], yh: [40, 92, 144, 196, 248], yo: 144, lab: 94 };
}

function Net({ layers, x, hidden, narrow }) {
  const G = geomNet(narrow);
  const f = forward(layers, x);
  const h = f.as[1];
  const p = f.out[0];
  const [W1, W2] = [layers[0].W, layers[1].W];
  const wMax = Math.max(...W1.flat().map(Math.abs), ...W2.flat().map(Math.abs));
  const contrib1 = W1.map((r, i) => r.map((w) => Math.abs(w * x[i])));
  const contrib2 = W2.map((r, j) => Math.abs(r[0] * h[j]));
  const cMax1 = Math.max(1e-6, ...contrib1.flat());
  const cMax2 = Math.max(1e-6, ...contrib2);
  const hMax = Math.max(1e-6, ...h);
  const edge = (w, c, cMax, dim) => ({
    strokeWidth: 0.6 + (2.4 * Math.abs(w)) / wMax,
    opacity: dim ? 0.12 : 0.18 + 0.72 * (c / cMax),
    strokeDasharray: w < 0 ? '4 3' : undefined,
  });
  return (
    <svg className="dl9s-svg dl9s-pn__net" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label={hidden ? 'The policy network with the two velocities hidden: p cannot be computed from this observation alone' : `The policy network: inputs ${x.map(s4).join(', ')}; output p(left) = ${p.toFixed(3)}`}>
      <text x={G.xi} y={14} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--b">obs</text>
      <text x={G.xh} y={14} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">Dense(5, relu)</text>
      <text x={G.xo} y={narrow ? 96 : 104} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">Dense(1, sigmoid)</text>
      {W1.map((r, i) => r.map((w, j) => (
        <line key={`a${i}${j}`} x1={G.xi + 14} y1={G.yi[i]} x2={G.xh - 13} y2={G.yh[j]} className="dl9s-pn__edge" style={edge(w, contrib1[i][j], cMax1, hidden)} />
      )))}
      {W2.map((r, j) => (
        <line key={`b${j}`} x1={G.xh + 13} y1={G.yh[j]} x2={G.xo - 18} y2={G.yo} className="dl9s-pn__edge" style={edge(r[0], contrib2[j], cMax2, hidden)} />
      ))}
      {x.map((v, i) => {
        const off = hidden && HIDE.includes(i);
        return (
          <g key={`in${i}`} className={`dl9s-pn__in${off ? ' dl9s-pn__in--off' : ''}`}>
            <circle cx={G.xi} cy={G.yi[i]} r={14} />
            <text x={G.xi} y={G.yi[i] + 4} textAnchor="middle" className="dl9s-pn__xi">{`x${'₁₂₃₄'[i]}`}</text>
            <text x={G.xi - 22} y={G.yi[i] - 3} textAnchor="end" className="dl9s-t dl9s-t--xs">{narrow ? SHORT[i] : `obs[${i}] ${NAMES[i]}`}</text>
            <text x={G.xi - 22} y={G.yi[i] + 11} textAnchor="end" className={`dl9s-t dl9s-t--m dl9s-pn__val${off ? ' dl9s-pn__val--off' : ''}`}>{off ? '?' : s4(v)}</text>
          </g>
        );
      })}
      {h.map((a, j) => (
        <circle key={`h${j}`} cx={G.xh} cy={G.yh[j]} r={13} className="dl9s-pn__hid" style={{ fill: hidden ? 'var(--dl9s-floor)' : `color-mix(in srgb, var(--ink) ${Math.round((a / hMax) * 62)}%, var(--dl9s-floor))` }} />
      ))}
      <text x={G.xh} y={G.H - 6} textAnchor="middle" className="dl9s-t dl9s-t--xs">{narrow ? '5 units (slide 25)' : '5 units, as in slide 25’s code'}</text>
      <circle cx={G.xo} cy={G.yo} r={18} className="dl9s-pn__out" style={{ fill: hidden ? 'var(--dl9s-floor)' : weightFill('pol', p) }} />
      <text x={G.xo} y={G.yo + 5} textAnchor="middle" className="dl9s-pn__p">{hidden ? '?' : 'p'}</text>
      <text x={G.xo} y={G.yo + 38} textAnchor="middle" className="dl9s-t dl9s-t--xs">probability of</text>
      <text x={G.xo} y={G.yo + 51} textAnchor="middle" className="dl9s-t dl9s-t--xs">action 0 (left)</text>
    </svg>
  );
}

function SplitBar({ p, range, ds, narrow }) {
  const W = narrow ? 340 : 760;
  const H = 104;
  const x0 = 12;
  const x1 = W - 12;
  const y = 44;
  const bh = 18;
  const X = (v) => x0 + v * (x1 - x0);
  const left = ds ? ds.filter((d) => d.u < p).length : 0;
  return (
    <svg className="dl9s-svg dl9s-pn__bar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={range ? `p(left) could be anywhere from ${range[0].toFixed(2)} to ${range[1].toFixed(2)}` : `p(left) = ${p.toFixed(3)}, p(right) = ${(1 - p).toFixed(3)}; of ${N_DRAWS} random draws, ${left} went left and ${N_DRAWS - left} right`}>
      <defs>
        <pattern id="dl9s-pn-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="dl9s-pn__hatch" />
        </pattern>
      </defs>
      {range ? (
        <>
          <rect x={x0} y={y} width={x1 - x0} height={bh} rx={3} className="dl9s-pn__track" />
          <rect x={X(range[0])} y={y} width={X(range[1]) - X(range[0])} height={bh} fill="url(#dl9s-pn-hatch)" className="dl9s-pn__band" />
          <text x={W / 2} y={y - 12} textAnchor="middle" className="dl9s-t dl9s-t--s dl9s-t--pol dl9s-t--b">p could be anywhere from {range[0].toFixed(2)} to {range[1].toFixed(2)}</text>
          <text x={W / 2} y={y + bh + 22} textAnchor="middle" className="dl9s-t dl9s-t--xs">{narrow ? 'over velocities this observation can’t show' : 'over the velocities this observation no longer shows (cart ±1, pole ±1.5: this page’s own range)'}</text>
        </>
      ) : (
        <>
          <rect x={x0} y={y} width={X(p) - x0} height={bh} rx={3} className="dl9s-pn__left dl9s-bar" />
          <rect x={X(p)} y={y} width={x1 - X(p)} height={bh} rx={3} className="dl9s-pn__right dl9s-bar" />
          <line x1={X(p)} y1={y - 6} x2={X(p)} y2={y + bh + 6} className="dl9s-pn__cut" />
          <text x={x0} y={y - 10} className="dl9s-t dl9s-t--s dl9s-t--pol dl9s-t--b">p = {p.toFixed(2)} · 0 left</text>
          <text x={x1} y={y - 10} textAnchor="end" className="dl9s-t dl9s-t--s dl9s-t--b">1 right · 1 − p = {(1 - p).toFixed(2)}</text>
          {ds && ds.map((d, i) => (
            <circle key={i} cx={X(d.u)} cy={y + bh + 12 + d.j * 16} r={4.2} className={`dl9s-pn__draw${d.u < p ? ' dl9s-pn__draw--l' : ''}`} />
          ))}
          {ds && (
            <>
              <text x={x0} y={H - 2} className="dl9s-t dl9s-t--xs dl9s-t--act dl9s-t--b">← {left} left</text>
              <text x={x1} y={H - 2} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--act dl9s-t--b">{N_DRAWS - left} right →</text>
            </>
          )}
        </>
      )}
    </svg>
  );
}

export function PolicyNetLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const { printing } = useStudy();
  const [weights, setWeights] = useState(null);
  const [angle, setAngle] = useState(SLIDE17_OBS[2]);
  const [hide, setHide] = useState(false);
  const [seed, setSeed] = useState(1);
  const [preferLeft, setPreferLeft] = useState(false);

  useEffect(() => {
    let live = true;
    import('../data/pgRun.js').then((m) => { if (live) setWeights(m.PG_RUN.weights); });
    return () => { live = false; };
  }, []);

  const layers = useMemo(() => (weights ? fromWeights(weights, ['relu', 'sigmoid']) : null), [weights]);
  const ang = printing ? SLIDE17_OBS[2] : angle;
  const hid = printing ? false : hide;
  const x = [SLIDE17_OBS[0], SLIDE17_OBS[1], ang, SLIDE17_OBS[3]];
  const f = layers ? forward(layers, x) : null;
  const p = f ? f.out[0] : 0.5;
  const range = layers && hid ? pRange(layers, x) : null;
  const ds = useMemo(() => draws(printing ? 1 : seed), [seed, printing]);
  const setA = (v) => {
    setAngle(v);
    if (layers && forward(layers, [SLIDE17_OBS[0], SLIDE17_OBS[1], v, SLIDE17_OBS[3]]).out[0] > 0.5) setPreferLeft(true);
  };
  const SW = narrow ? 340 : 250;

  return (
    <Stage
      title="A network that outputs a probability"
      slides="slides 23–25"
      tryThis="Predict whether p(left) rises or falls as the pole leans right, drag the angle, then draw 20 actions and notice the less likely one still turns up."
      caption="The network outputs one number, $p$, the probability of action 0 (left); each dot is one random draw, left if it lands in $p$’s part of the bar. Hide the velocities and the same position and angle could mean almost any $p$: the observation is no longer the full state (slide 24)."
      challenge={{ text: 'Lean the pole until the network prefers left: $p > 0.5$.', done: preferLeft }}
      own="weights: this page’s own trained network (§9)"
      maths={
        f ? (
          <>
            <MLine text={`Input (slide 17’s observation, with your angle): $x = [${x.map(s4).join(', ')}]$.`} />
            <MLine text={`Hidden layer, \`Dense(5, activation="relu")\`: $h = \\text{ReLU}(xW_1 + b_1) = [${f.as[1].map((v) => v.toFixed(3)).join(', ')}]$.`} />
            <MLine text={`Output, \`Dense(1, activation="sigmoid")\`: $z = hW_2 + b_2 = ${f.zs[1][0].toFixed(3)}$, so $p = \\sigma(z) = 1 / (1 + e^{-z}) = ${p.toFixed(3)}$: the probability of action 0 (left). Right gets $1 - p = ${(1 - p).toFixed(3)}$.`} />
            <MLine text="Sampling: draw $u$ uniformly from $[0, 1)$; the action is 0 (left) if $u < p$, else 1 (right). Slide 32’s code writes it as `action = (tf.random.uniform([1, 1]) > left_proba)`." />
            <p className="dl9s-mnote"><Rich text="Figure 18-5 draws 4 hidden neurons, but slide 25’s code has `Dense(5, ...)`; the lab follows the code (31 parameters: 4 × 5 + 5 and 5 × 1 + 1). The weights come from this page’s own run of the slides’ training loop (§9)." /></p>
          </>
        ) : <MLine text="Loading this page’s trained network…" />
      }
    >
      <div ref={wrap} className={`dl9s-pn${narrow ? ' dl9s-pn--narrow' : ''}`}>
        <div className="dl9s-pn__top">
          <div className="dl9s-pn__obs">
            <CartScene obs={x} W={narrow ? 340 : 250} H={150} label={`The pole at ${((ang * 180) / Math.PI).toFixed(1)} degrees`} />
            <svg className="dl9s-svg dl9s-pn__scrub" viewBox={`0 0 ${SW} 74`} role="group" aria-label="The pole angle obs[2]">
              <text x={16} y={14} className="dl9s-t dl9s-t--s dl9s-t--obs">obs[2] pole angle (rad)</text>
              <Scrub
                x0={44}
                x1={SW - 44}
                y={40}
                value={ang}
                min={-0.2}
                max={0.2}
                step={0.005}
                big={0.05}
                onChange={setA}
                label="Pole angle obs[2] in radians"
                show={(v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(3)}`}
                valueText={`${ang.toFixed(3)} radians, ${((ang * 180) / Math.PI).toFixed(1)} degrees`}
                ticks={[-0.2, 0.2]}
                tickLabel={(v) => (v < 0 ? '−0.2 left' : '+0.2 right')}
                marks={[{ v: SLIDE17_OBS[2], label: 'slide 17' }]}
              />
            </svg>
            <div className="dl9s-switch" role="group" aria-label="What the observation shows">
              <button type="button" className={`dl9s-switch__opt${!hid ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={!hid} onClick={() => setHide(false)}>full state</button>
              <button type="button" className={`dl9s-switch__opt${hid ? ' dl9s-switch__opt--on' : ''}`} aria-pressed={hid} onClick={() => setHide(true)}>hide the velocities</button>
            </div>
          </div>
          <div className="dl9s-pn__netcol">
            {layers ? <Net layers={layers} x={x} hidden={hid} narrow={narrow} /> : <p className="dl9s-pn__loading">Loading this page’s trained network…</p>}
          </div>
        </div>
        <div className="dl9s-pn__sample">
          <p className="dl9s-pn__k">multinomial sampling · {N_DRAWS} random draws</p>
          {layers && <SplitBar p={p} range={range} ds={hid ? null : ds} narrow={narrow} />}
          {!printing && (
            <button type="button" className="dl9s-pn__again" onClick={() => setSeed((s) => s + 1)} disabled={hid || !layers}>
              <Icon name="swap" size={13} /> draw {N_DRAWS} actions again
            </button>
          )}
        </div>
      </div>
    </Stage>
  );
}

