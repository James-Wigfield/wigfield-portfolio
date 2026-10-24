import { useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Scrub } from '../svgParts';
import { cellFill } from '../svgFill';
import { useWidth } from '../useWidth';
import { useStudy } from '../context';
import { useStory } from '../story';
import { svgPoint } from '../hooks';
import { discountRewards, discountAndNormalizeRewards, mean, std, fmt } from '../rl';
import './labsReturns.css';

/* ============================================================================
   §7 · THE CREDIT ASSIGNMENT PROBLEM  (slides 26–29)
   ----------------------------------------------------------------------------
   ReturnsLab    slide 26's rewards 10, 0, −50 as signed bars, and under
                 them each step's sum of discounted future rewards (amber,
                 discountRewards from rl.js = slide 34's code), with Figure
                 18-6's leftward "× γ" arrows passing each return back one
                 step. One control: γ (0 … 0.99), opening on slide 26's 0.8
                 (−22, −40, −50). Below, a half-weight ruler: γⁿ for n = 0 …
                 80, with the step where it falls to ½ marked, and slide 28's
                 two marks (0.95 → 13 steps, 0.99 → 69 steps).
   AdvantageLab  slide 29's action advantage on three CartPole-like episodes
                 of this page's own lengths (every reward +1): returns per
                 step → pool every step (mean, std) → normalise
                 (discountAndNormalizeRewards, γ = 0.95) → read the colours.
                 Drag an episode's end to change its length.
   ========================================================================== */

const REWARDS = [10, 0, -50];
const ACTIONS = ['Right', 'Right', 'Right'];
const halfLife = (g) => (g <= 0 ? 0 : g >= 1 ? Infinity : Math.log(0.5) / Math.log(g));
const sgn = (v, d = 0) => (Math.abs(v) < 0.5 * 10 ** -d ? '0' : v > 0 ? `+${v.toFixed(d)}` : `−${Math.abs(v).toFixed(d)}`);

function geomRet(narrow) {
  return narrow
    ? { W: 340, H: 286, cols: [92, 182, 272], lab: null, k: 1.05, yAct: 40, yRew: 92, yRet: 196, bw: 30 }
    : { W: 760, H: 268, cols: [330, 480, 630], lab: 236, k: 1.15, yAct: 26, yRew: 84, yRet: 182, bw: 34 };
}

function Bar({ x, y0, v, k, w, cls }) {
  const h = Math.max(0.0001, Math.abs(v) * k);
  return <rect x={x - w / 2} y={v >= 0 ? y0 - h : y0} width={w} height={h} rx={2} className={`dl9s-bar ${cls}`} />;
}

export function ReturnsLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [gamma, setGamma] = useState(0.8);
  const g = printing ? 0.8 : gamma;
  const G = geomRet(narrow);
  const ret = discountRewards(REWARDS, g);
  const hl = halfLife(g);
  const RW = narrow ? 340 : 760;
  const rx0 = narrow ? 30 : 60;
  const rx1 = RW - 16;
  const nMax = 80;
  const RX = (n) => rx0 + (n / nMax) * (rx1 - rx0);
  const ry0 = 30;
  const ry1 = 112;
  const RY = (w) => ry1 - w * (ry1 - ry0);

  return (
    <Stage
      title="Pass the rewards back, shrinking by γ"
      slides="slides 26–28"
      tryThis="Predict the first step’s return at γ = 0.8, then drag γ toward 0 and toward 1 and watch the −50 reach (or not reach) the first step."
      caption="Each step’s return is its own reward plus γ times the next step’s return, worked from the last step back (Figure 18-6). The ruler below shows how much a reward n steps ahead still counts: γⁿ."
      challenge={{ text: 'Find a γ that makes the first step’s return positive.', done: ret[0] > 0 }}
      own={null}
      maths={
        <>
          <MEq tex={'10 + \\gamma \\times 0 + \\gamma^2 \\times (-50)'} />
          <MLine text={`With $\\gamma = ${g.toFixed(2)}$: $10 + ${g.toFixed(2)} \\times 0 + ${(g * g).toFixed(4)} \\times (-50) = ${fmt(ret[0], 2)}$. Slide 26, with $\\gamma = 0.8$: $10 + 0 - 0.64 \\times 50 = -22$.`} />
          <MLine text={`Figure 18-6 works backwards: $-50$; then $0 + ${g.toFixed(2)} \\times (${fmt(ret[2], 2)}) = ${fmt(ret[1], 2)}$; then $10 + ${g.toFixed(2)} \\times (${fmt(ret[1], 2)}) = ${fmt(ret[0], 2)}$. That is slide 34’s \`discount_rewards\` (with float rewards; on this integer list NumPy truncates each sum unless it is whole, as it is at $\\gamma = 0.8$).`} />
          <MLine text={`The first return is positive when $10 - 50\\gamma^2 > 0$, i.e. $\\gamma < \\sqrt{0.2} \\approx 0.447$ (this page’s working).`} />
          <MLine text={`Half weight: $\\gamma^n = 0.5$ when $n = \\ln 0.5 / \\ln \\gamma$${g > 0 ? ` $= ${hl.toFixed(1)}$ for $\\gamma = ${g.toFixed(2)}$` : ''}. Slide 28: $0.95^{13} \\approx 0.5$ ($0.513$ to three decimals) and $0.99^{69} \\approx 0.5$ ($0.500$ to three decimals).`} />
        </>
      }
    >
      <div ref={wrap} className="dl9s-rt">
        <svg className="dl9s-svg dl9s-rt__steps" viewBox={`0 0 ${G.W} ${G.H}`} role="img" aria-label={`Rewards 10, 0, −50; with gamma ${g.toFixed(2)} the sums of discounted future rewards are ${ret.map((v) => fmt(v, 1)).join(', ')}`}>
          {/* row names (Figure 18-6) */}
          {G.lab ? (
            <>
              <text x={G.lab} y={G.yAct + 4} textAnchor="end" className="dl9s-t dl9s-t--s">Actions:</text>
              <text x={G.lab} y={G.yRew + 4} textAnchor="end" className="dl9s-t dl9s-t--s">Rewards:</text>
              <text x={G.lab} y={G.yRet - 6} textAnchor="end" className="dl9s-t dl9s-t--s">Sum of discounted</text>
              <text x={G.lab} y={G.yRet + 8} textAnchor="end" className="dl9s-t dl9s-t--s">future rewards:</text>
            </>
          ) : (
            <>
              <text x={4} y={G.yAct - 18} className="dl9s-t dl9s-t--xs">actions</text>
              <text x={4} y={G.yRew - 30} className="dl9s-t dl9s-t--xs">rewards</text>
              <text x={4} y={G.yRet - 34} className="dl9s-t dl9s-t--xs">sum of discounted future rewards</text>
            </>
          )}
          <line x1={G.cols[0] - 50} y1={G.yRew} x2={G.cols[2] + 50} y2={G.yRew} className="dl9s-ax" />
          <line x1={G.cols[0] - 50} y1={G.yRet} x2={G.cols[2] + 50} y2={G.yRet} className="dl9s-ax" />
          {G.cols.map((cx, i) => (
            <g key={i}>
              <text x={cx} y={G.yAct + 4} textAnchor="middle" className="dl9s-t dl9s-t--act dl9s-t--b">{ACTIONS[i]}</text>
              <Bar x={cx} y0={G.yRew} v={REWARDS[i]} k={G.k} w={G.bw} cls={REWARDS[i] >= 0 ? 'dl9s-bar--pos' : 'dl9s-bar--neg'} />
              <text x={cx + G.bw / 2 + 6} y={REWARDS[i] < 0 ? G.yRew + 16 : G.yRew - 4} className={`dl9s-t dl9s-t--b dl9s-t--m ${REWARDS[i] > 0 ? 'dl9s-t--rpos' : REWARDS[i] < 0 ? 'dl9s-t--rneg' : ''}`}>{sgn(REWARDS[i])}</text>
              {/* reward ↓ (+) into its return (wide only) */}
              {G.lab && <line x1={cx - G.bw / 2 - 8} y1={G.yRew + 8} x2={cx - G.bw / 2 - 8} y2={G.yRet - 22} className="dl9s-rt__down" />}
              {G.lab && <polygon points={`${cx - G.bw / 2 - 8},${G.yRet - 16} ${cx - G.bw / 2 - 12},${G.yRet - 24} ${cx - G.bw / 2 - 4},${G.yRet - 24}`} className="dl9s-rt__downhead" />}
              {G.lab && i < 2 && <text x={cx - G.bw / 2 - 16} y={G.yRet - 30} textAnchor="end" className="dl9s-t dl9s-t--s dl9s-t--b">+</text>}
              <Bar x={cx} y0={G.yRet} v={ret[i]} k={G.k} w={G.bw} cls="dl9s-bar--ret" />
              <text x={cx} y={ret[i] < 0 ? G.yRet + Math.abs(ret[i]) * G.k + 15 : G.yRet - ret[i] * G.k - 5} textAnchor="middle" className="dl9s-t dl9s-t--b dl9s-t--m dl9s-t--ret dl9s-halo">{fmt(ret[i], Math.abs(ret[i] - Math.round(ret[i])) < 0.005 ? 0 : 1)}</text>
            </g>
          ))}
          {/* Figure 18-6's discount arrows: each return passes back × γ */}
          {[0, 1].map((i) => {
            const xa = G.cols[i + 1] - G.bw / 2 - 18;
            const xb = G.cols[i] + G.bw / 2 + 6;
            const y = G.yRet - 10;
            return (
              <g key={`g${i}`} className="dl9s-rt__pass">
                <line x1={xa} y1={y} x2={xb + 7} y2={y} />
                <polygon points={`${xb},${y} ${xb + 8},${y - 4} ${xb + 8},${y + 4}`} />
                <text x={(xa + xb) / 2} y={y - 7} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--ret dl9s-t--b dl9s-halo">× {g.toFixed(2)}</text>
              </g>
            );
          })}
        </svg>
        <svg className="dl9s-svg dl9s-rt__ctl" viewBox={`0 0 ${RW} 76`} role="group" aria-label="The discount rate gamma">
          <text x={rx0 - 10} y={14} className="dl9s-t dl9s-t--s dl9s-t--ret">discount rate γ</text>
          <Scrub
            x0={rx0}
            x1={rx1 - 10}
            y={42}
            value={g}
            min={0}
            max={0.99}
            step={0.01}
            big={0.05}
            onChange={setGamma}
            label="Discount rate gamma"
            show={(v) => v.toFixed(2)}
            ticks={[0, 0.5, 0.99]}
            tickLabel={(v) => String(v)}
            marks={narrow ? [{ v: 0.8, label: '0.8' }, { v: 0.95, label: '0.95' }] : [{ v: 0.8, label: '0.8 · slide 26' }, { v: 0.95, label: '0.95 · slide 28' }]}
          />
        </svg>
        <div className="dl9s-rt__ruler">
          <p className="dl9s-rt__k">half-weight ruler <span>· how much a reward n steps ahead still counts: γⁿ</span></p>
          <svg className="dl9s-svg" viewBox={`0 0 ${RW} 150`} role="img" aria-label={`gamma to the n for n from 0 to 80; it falls to one half after ${g > 0 ? hl.toFixed(1) : 0} steps`}>
            <line x1={rx0} y1={RY(0.5)} x2={rx1} y2={RY(0.5)} className="dl9s-rt__half" />
            <text x={rx0 - 6} y={RY(0.5) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">½</text>
            <text x={rx0 - 6} y={RY(1) + 4} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">1</text>
            {Array.from({ length: nMax + 1 }, (_, n) => (
              <line key={n} x1={RX(n)} y1={ry1} x2={RX(n)} y2={RY(g ** n)} className={`dl9s-rt__stem${g ** n >= 0.5 ? ' dl9s-rt__stem--hi' : ''}`} />
            ))}
            <line x1={rx0} y1={ry1} x2={rx1} y2={ry1} className="dl9s-ax" />
            {[0, 20, 40, 60].map((n) => (
              <text key={n} x={RX(n)} y={ry1 + 13} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{n}</text>
            ))}
            <text x={RX(80) + 4} y={ry1 + 13} textAnchor="end" className="dl9s-t dl9s-t--xs dl9s-t--m">{narrow ? '80' : '80 steps ahead'}</text>
            {/* slide 28's two marks */}
            {[{ n: 13, l: narrow ? '0.95 → 13' : 'γ = 0.95 → 13 · slide 28' }, { n: 69, l: narrow ? '0.99 → 69' : 'γ = 0.99 → 69 · slide 28' }].map((m) => (
              <g key={m.n}>
                <line x1={RX(m.n)} y1={ry1 + 17} x2={RX(m.n)} y2={ry1 + 23} className="dl9s-rt__slidemark" />
                <text x={RX(m.n)} y={ry1 + 35} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-slidemark">{m.l}</text>
              </g>
            ))}
            {g > 0 && hl <= nMax && (
              <g className="dl9s-rt__hl">
                <line x1={RX(hl)} y1={RY(0.5)} x2={RX(hl)} y2={ry0 - 14} />
                <circle cx={RX(hl)} cy={RY(0.5)} r={3.5} />
                <text x={RX(hl) + (hl > 60 ? -5 : 5)} y={ry0 - 16} textAnchor={hl > 60 ? 'end' : 'start'} className="dl9s-t dl9s-t--xs dl9s-t--b dl9s-t--ret">half weight after ≈ {hl.toFixed(1)} steps</text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </Stage>
  );
}

/* ── slide 29 · action advantage ───────────────────────────────────────────── */
const ADV_BEATS = [
  { label: 'returns per step', say: 'Every CartPole reward is +1, so a step’s discounted return ($\\gamma = 0.95$) measures how long the pole stayed up after it.' },
  { label: 'pool all steps', say: 'Pool every step of every episode and take their mean and standard deviation.' },
  { label: 'normalise', say: 'Subtract the mean and divide by the standard deviation: each step’s **normalized score**, its **action advantage**.' },
  { label: 'read the colours', say: 'Positive advantage (green): probably a good action; negative (red): probably bad. A long episode’s early actions look good; a short episode’s look bad.' },
];
const MAX_LEN = 60;
const DEFAULT_LENS = [14, 32, 55];
const GAMMA = 0.95;

function LenHandle({ x, y, h, len, onLen, toLen, i }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  const set = (e) => {
    const pt = svgPoint(e, ref.current?.ownerSVGElement);
    if (pt) onLen(i, toLen(pt.x));
  };
  const onKey = (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (d !== undefined) { e.preventDefault(); onLen(i, len + d); }
  };
  return (
    <g
      ref={ref}
      className={`dl9s-adv__handle${drag ? ' dl9s-adv__handle--drag' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={`Length of episode ${i + 1}`}
      aria-valuemin={1}
      aria-valuemax={MAX_LEN}
      aria-valuenow={len}
      aria-valuetext={`${len} steps`}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); set(e); }}
      onPointerMove={(e) => { if (drag) set(e); }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <rect x={x - 10} y={y - 8} width={20} height={h + 16} fill="transparent" />
      <rect x={x - 2.5} y={y - 5} width={5} height={h + 10} rx={2.5} className="dl9s-adv__grip" />
    </g>
  );
}

export function AdvantageLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const story = useStory(ADV_BEATS.length);
  const { beat } = story;
  const { printing } = useStudy();
  const [lensState, setLens] = useState(DEFAULT_LENS);
  const lens = printing ? DEFAULT_LENS : lensState;
  const [hover, setHover] = useState(null);

  const all = lens.map((L) => Array(L).fill(1));
  const rets = all.map((r) => discountRewards(r, GAMMA));
  const flat = rets.flat();
  const mu = mean(flat);
  const sd = std(flat);
  const adv = discountAndNormalizeRewards(all, GAMMA);
  const aMax = Math.max(...adv.flat().map(Math.abs));
  const allFirstGood = adv.every((a) => a[0] > 0);

  const W = narrow ? 340 : 760;
  const x0 = narrow ? 8 : 16;
  const cw = (W - x0 - 22) / MAX_LEN;
  const rowH = 24;
  const rowY = (i) => 26 + i * 54;
  const toLen = (px) => Math.max(1, Math.min(MAX_LEN, Math.round((px - x0) / cw)));
  const onLen = (i, L) => setLens((ls) => ls.map((v, j) => (j === i ? Math.max(1, Math.min(MAX_LEN, L)) : v)));
  // the pooled number line (return units; normalising only relabels it)
  const ly = rowY(3) + 34;
  const LX = (r) => x0 + (r / 20) * (W - x0 - 22);
  const showLine = beat >= 1;
  const normed = beat >= 2;
  const hv = hover ? { ret: rets[hover.e][hover.t], adv: adv[hover.e][hover.t] } : null;

  return (
    <Stage
      title="Which actions were good? Normalise and see"
      slides="slide 29"
      tryThis="Predict which episode’s actions come out green, then drag the short episode’s end past the others and watch its colours flip."
      story={<StoryBar story={story} beats={ADV_BEATS} />}
      caption="Each cell is one action, coloured by its advantage from slide 34’s `discount_and_normalize_rewards(all_rewards, 0.95)`. Advantages are relative to the batch: lengthen one episode and every other episode’s actions look worse."
      challenge={{ text: 'Make all three episodes’ first actions look good (green).', done: allFirstGood }}
      own="three episodes of this page’s own lengths · every reward +1"
      maths={
        <>
          <MLine text={`An action $k$ steps from its episode’s end has return $1 + 0.95 + 0.95^2 + \\cdots + 0.95^{k-1}$ (at most $1 / 0.05 = 20$).`} />
          <MLine text={`Pooled over all ${flat.length} steps: mean $= ${mu.toFixed(3)}$, standard deviation $= ${sd.toFixed(3)}$ (\`np.std\`).`} />
          <MLine text={`Advantage $= (\\text{return} - ${mu.toFixed(2)}) / ${sd.toFixed(2)}$. First actions: ${rets.map((r, e) => `episode ${e + 1}: $(${r[0].toFixed(2)} - ${mu.toFixed(2)}) / ${sd.toFixed(2)} = ${fmt(adv[e][0], 2)}$`).join('; ')}.`} />
        </>
      }
    >
      <div ref={wrap} className="dl9s-adv">
        <svg className="dl9s-svg dl9s-adv__svg" viewBox={`0 0 ${W} ${ly + 62}`} role="group" aria-label={`Three episodes of ${lens.join(', ')} steps; pooled mean return ${mu.toFixed(2)}, standard deviation ${sd.toFixed(2)}`} onPointerLeave={() => setHover(null)}>
          {lens.map((L, e) => {
            const y = rowY(e);
            const good = adv[e].filter((a) => a > 0).length;
            return (
              <g key={e}>
                <text x={x0} y={y - 7} className="dl9s-t dl9s-t--xs">
                  <tspan className="dl9s-t--b">episode {e + 1}</tspan> · {L} step{L === 1 ? '' : 's'}
                  <tspan className={`dl9s-fade${beat >= 3 ? '' : ' dl9s-hide'}`}>
                    {'  ·  '}<tspan className="dl9s-t--rpos dl9s-t--b">{good} good</tspan>{' · '}<tspan className="dl9s-t--rneg dl9s-t--b">{L - good} bad</tspan>
                  </tspan>
                </text>
                {rets[e].map((r, t) => (
                  <rect
                    key={t}
                    x={x0 + t * cw + 0.6}
                    y={y}
                    width={Math.max(0.8, cw - 1.2)}
                    height={rowH}
                    rx={Math.min(2, cw / 4)}
                    className={`dl9s-cell${hover && hover.e === e && hover.t === t ? ' dl9s-cell--hit' : ''}`}
                    style={{ fill: beat < 0 ? 'var(--dl9s-floor)' : normed ? cellFill('rpos', adv[e][t], aMax) : cellFill('ret', r, 20) }}
                    onPointerEnter={() => setHover({ e, t })}
                  />
                ))}
                <LenHandle x={x0 + L * cw + 3} y={y} h={rowH} len={L} onLen={onLen} toLen={toLen} i={e} />
              </g>
            );
          })}
          {/* the pooled number line */}
          <g className={`dl9s-fade${showLine ? '' : ' dl9s-hide'}`}>
            <rect x={LX(Math.max(0, mu - sd))} y={ly - 16} width={LX(Math.min(20, mu + sd)) - LX(Math.max(0, mu - sd))} height={24} className="dl9s-adv__sd" />
            <line x1={LX(0)} y1={ly} x2={LX(20)} y2={ly} className="dl9s-ax" />
            {flat.map((r, i) => {
              const a = (r - mu) / sd;
              return <circle key={i} cx={LX(r)} cy={ly - 4 - (i % 3) * 4} r={2.2} className={normed ? (a > 0 ? 'dl9s-adv__dot--pos' : 'dl9s-adv__dot--neg') : 'dl9s-adv__dot'} />;
            })}
            <line x1={LX(mu)} y1={ly - 22} x2={LX(mu)} y2={ly + 6} className="dl9s-adv__mu" />
            {normed
              ? [-2, -1, 0, 1, 2].filter((k) => mu + k * sd >= 0 && mu + k * sd <= 20).map((k) => (
                <text key={k} x={LX(mu + k * sd)} y={ly + 18} textAnchor="middle" className={`dl9s-t dl9s-t--xs dl9s-t--m${k === 0 ? ' dl9s-t--b' : ''}`}>{k > 0 ? `+${k}` : k < 0 ? `−${-k}` : '0'}</text>
              ))
              : [0, 5, 10, 15, 20].map((v) => <text key={v} x={LX(v)} y={ly + 18} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--m">{v}</text>)}
            <text x={LX(mu)} y={ly - 27} textAnchor="middle" className="dl9s-t dl9s-t--xs dl9s-t--b dl9s-halo">{normed ? 'advantage 0 = the mean' : `mean ${mu.toFixed(2)} · std ${sd.toFixed(2)}`}</text>
            <text x={W - 22} y={ly + 34} textAnchor="end" className="dl9s-t dl9s-t--xs">{normed ? 'advantage (in standard deviations from the mean)' : 'discounted return, every step pooled'}</text>
          </g>
          {hv && (
            <text x={x0} y={ly + 54} className="dl9s-t dl9s-t--xs dl9s-t--m dl9s-adv__tip">
              ep {hover.e + 1}, step {hover.t + 1}: return {hv.ret.toFixed(2)} → advantage {fmt(hv.adv, 2)}
            </text>
          )}
        </svg>
      </div>
    </Stage>
  );
}
