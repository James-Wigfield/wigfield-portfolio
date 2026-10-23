import { useEffect, useId, useMemo, useRef, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { receipt, fmtAnswer } from '../../kit/why';
import { Tex, Code } from '../../../kit';
import { useWidth } from '../../../lecture8-study/useWidth';
import { rng } from '../../core/rng';
import { makeItems, simulate, fmt } from '../../maths/signalKeeper.js';
import { INTRO, SIM, TABLE, INITS, ACTS } from '../../content/signal-keeper.js';
import { stackGeometry, rowY, logBar, domX, STD_DOMAIN, GRAD_DOMAIN, CURVE, cx, cy, curveD, lineScale } from './view.js';
import './signal-keeper.css';

/* ============================================================================
   SIGNAL KEEPER (Lecture 2, slides 5–29)
   ----------------------------------------------------------------------------
   A 10-layer stack runs on the page (maths/signalKeeperSim.js): each layer's
   activation histogram, the spread σ(z) of what it feeds its activation and
   its back-propagated ∂L/∂z relative to the top layer. Each item is a fix:
   the init Table 11-1 pairs with the activation, slide 22's activation,
   SELU's constraints, BatchNormalization, clipping. A right answer heals the
   stack it was asked about; the simulation only draws, the answers score.

   Items: maths/signalKeeper.js (seeded). Words and slide receipts:
   content/signal-keeper.js. Geometry: ./view.js.
   ========================================================================== */
export default function SignalKeeper({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-sk">
      {item && <Stage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}

const fbFormat = (answer, item) => fmtAnswer(item, answer);

function Stage({ item, round }) {
  const fb = round.feedback;
  const live = round.state === 'play' && !fb;
  const wide = item.kind === 'custom' && item.scene?.type === 'checklist';
  return (
    <>
      <Prompt k={`${round.index + 1} / ${round.total} · ${receipt(item.src)}${item.beyond ? ' · beyond the slides' : ''}`} sub={item.sub}>
        <Why text={item.prompt} />
      </Prompt>
      <Feedback feedback={fb} format={fbFormat} />
      <div className={`dla-sk__grid${wide ? ' dla-sk__grid--wide' : ''}${item.kind === 'number' || item.kind === 'custom' ? ' dla-sk__grid--pad' : ''}`}>
        {!wide && (
          <div className="dla-floor dla-sk__floor">
            <Scene item={item} fb={fb} />
          </div>
        )}
        <Answer item={item} round={round} live={live} />
      </div>
      {item.maths && <SkMaths maths={item.maths} />}
    </>
  );
}

function Answer({ item, round, live }) {
  if (item.kind === 'choice') return <ChoiceAnswer item={item} round={round} live={live} />;
  if (item.kind === 'number') return <NumberAnswer item={item} round={round} live={live} />;
  if (item.scene?.type === 'checklist') return <Checklist item={item} round={round} live={live} />;
  return <VectorPad item={item} round={round} live={live} />;
}

function ChoiceAnswer({ item, round, live }) {
  const fb = round.feedback;
  const long = item.choices.some((c) => c.label.length > 18);
  return (
    <div className="dla-sk__answer">
      <Choice choices={item.choices} onPick={(v) => round.submit(v)} picked={fb ? fb.given : null} answer={fb ? item.answer : null} active={live} columns={long ? 1 : 2} label="Answers" />
    </div>
  );
}

function NumberAnswer({ item, round, live }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const v = Number(value);
    if (live && value !== '' && Number.isFinite(v)) round.submit(v);
  };
  return <Keypad value={value} onChange={setValue} onSubmit={submit} decimal={item.decimal} negative={item.negative} disabled={!live} active={live} label="Your answer" />;
}

/* SELU's constraints: toggle exactly the slide's set, then lock in */
function Checklist({ item, round, live }) {
  const [picked, setPicked] = useState([]);
  const fb = round.feedback;
  const toggle = (v) => {
    if (!live) return;
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  };
  const submit = () => {
    if (live && picked.length) round.submit(picked.slice());
  };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.options.length) { e.preventDefault(); toggle(item.options[n - 1].value); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="dla-sk__check" role="group" aria-label="Constraints">
      <ul className="dla-sk__checklist">
        {item.options.map((o, i) => {
          const on = picked.includes(o.value);
          const isAns = !!fb && item.answer.includes(o.value);
          const cls = `dla-choice dla-sk__tick${on ? ' dla-sk__tick--on' : ''}${fb && isAns ? ' dla-choice--right' : ''}${fb && on && !isAns ? ' dla-choice--wrong' : ''}`;
          return (
            <li key={o.value}>
              <button type="button" className={cls} aria-pressed={on} onClick={() => toggle(o.value)} disabled={!live} aria-label={`${i + 1}: ${o.label}`}>
                <span className="dla-choice__n" aria-hidden="true">{i + 1}</span>
                <span className="dla-sk__box" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="dla-choice__label">{o.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="dla-sk__lock">
        <span className="dla-k">{picked.length} selected</span>
        <button type="button" className="dla-btn dla-btn--primary" onClick={submit} disabled={!live || !picked.length}>
          Lock in <span className="dla-btn__key">Enter</span>
        </button>
      </div>
    </div>
  );
}

/* a gradient vector, one signed decimal per slot, through one keypad */
function VectorPad({ item, round, live }) {
  const n = item.answer.length;
  const [vals, setVals] = useState(() => Array.from({ length: n }, () => ''));
  const [slot, setSlot] = useState(0);
  const ok = (v) => v !== '' && v !== '-' && Number.isFinite(Number(v));
  const complete = vals.every(ok);
  const submit = () => {
    if (live && complete) round.submit(vals.map(Number));
  };
  const enter = () => {
    if (slot < n - 1 && !complete) setSlot(slot + 1);
    else if (complete) submit();
    else setSlot(vals.findIndex((v) => !ok(v)));
  };
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setSlot((s) => (e.shiftKey ? (s + n - 1) % n : (s + 1) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, n]);
  return (
    <div className="dla-sk__vec">
      <div className="dla-sk__slots" role="group" aria-label="The clipped gradient vector">
        <span className="dla-sk__paren" aria-hidden="true">(</span>
        {vals.map((v, i) => (
          <span key={i} className="dla-sk__slotcell">
            <button
              type="button"
              className={`dla-slot dla-sk__slot${i === slot ? ' dla-slot--on' : ''}${v === '' ? ' dla-slot--empty' : ''}`}
              onClick={() => setSlot(i)}
              aria-pressed={i === slot}
              aria-label={`component ${i + 1}: ${v === '' ? 'empty' : v}`}
              disabled={!live}
            >
              <span className="dla-slot__val">{v === '' ? '?' : v.replace('-', '−')}</span>
              <span className="dla-slot__k">g{i + 1}</span>
            </button>
            {i < n - 1 && <span className="dla-sk__comma" aria-hidden="true">,</span>}
          </span>
        ))}
        <span className="dla-sk__paren" aria-hidden="true">)</span>
      </div>
      <Keypad
        value={vals[slot] ?? ''}
        onChange={(v) => setVals((a) => a.map((x, i) => (i === slot ? v : x)))}
        onSubmit={enter}
        decimal
        negative
        disabled={!live}
        active={live}
        label={`Component ${slot + 1}`}
      />
    </div>
  );
}

/* ── the pictures ─────────────────────────────────────────────────────── */
function Scene({ item, fb }) {
  const s = item.scene ?? {};
  switch (s.type) {
    case 'stack': return <StackScene scene={s} fb={fb} />;
    case 'layer': return <LayerScene scene={s} fb={fb} answer={item.answer} />;
    case 'table': return <TableScene scene={s} fb={fb} />;
    case 'curve': return <CurveScene scene={s} fb={fb} answer={item.answer} />;
    case 'formula': return <div className="dla-sk__formula"><Tex block src={`f(z) = ${s.tex}`} /></div>;
    case 'code': return <CodeScene lines={s.lines} />;
    case 'batch': return <BatchScene scene={s} fb={fb} answer={item.answer} />;
    case 'params': return <ParamsScene scene={s} fb={fb} item={item} />;
    case 'placement': return <PlacementScene fb={fb} item={item} />;
    case 'clip': return <ClipScene scene={s} fb={fb} />;
    default: return null;
  }
}

const RANK = { exploding: 0, vanishing: 1, saturated: 2, healthy: 3 };
const worst = (a, b) => (RANK[a] <= RANK[b] ? a : b);
const fillN = (tpl, n) => tpl.replace('{n}', String(n));
// a small arrowhead at the end of a clamped bar
const chevron = (b) => {
  const x = b.cx + (b.over ? b.half + 2 : -b.half - 2);
  return b.over ? `M${x} -4 l5 4 l-5 4z` : `M${x} -4 l-5 4 l5 4z`;
};

function StackScene({ scene, fb }) {
  const ref = useRef(null);
  const width = useWidth(ref, 640);
  const healed = !!(fb?.correct && scene.after);
  const cfg = healed ? scene.after : scene.before;
  const sim = useMemo(() => simulate(cfg), [cfg]);
  const hide = !!scene.hideVerdict && !fb;
  const g = stackGeometry(width);
  const bw = g.hist / 15;
  const histH = g.rowH - 6;
  const label = `${g.layers}-layer stack, ${SIM.acts[cfg.act]} on ${SIM.inits[cfg.init]}${cfg.bn ? `, ${SIM.bn[cfg.bn]}` : ''}: `
    + `layer 1's σ(z) is ${fmt(sim.layers[0].zStd.toPrecision(2))} and its ∂L/∂z is ${fmt(sim.layers[0].ratio.toPrecision(2))} times the top layer's`
    + `${hide ? '' : `; ${fillN(SIM.healthy, sim.healthy)}`}.`;
  return (
    <div ref={ref} className={`dla-sk__stack${healed ? ' dla-sk__stack--healed' : ''}`}>
      <div className="dla-sk__cfg">
        <span><span className="dla-k">{SIM.cfg.act}</span> {SIM.acts[cfg.act]}</span>
        <span><span className="dla-k">{SIM.cfg.init}</span> {SIM.inits[cfg.init]}</span>
        <span><span className="dla-k">{SIM.cfg.bn}</span> {cfg.bn ? SIM.bn[cfg.bn] : SIM.bn.none}</span>
        {!hide && (
          <span className={`dla-sk__health${sim.healthy === g.layers ? ' dla-sk__health--ok' : ''}`}>
            <span className="dla-sk__hdot" aria-hidden="true" />{fillN(SIM.healthy, sim.healthy)}
          </span>
        )}
      </div>
      <svg className="dla-svg dla-sk__svg" viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label={label}>
        {/* column heads */}
        <text x={g.x.hist + g.hist / 2} y={12} textAnchor="middle" className="dla-t--xs dla-t--m">{SIM.axes.hist}</text>
        <text x={g.x.std + g.bar / 2} y={12} textAnchor="middle" className="dla-t--xs dla-t--m">{SIM.axes.std}</text>
        <text x={g.x.grad + g.bar / 2} y={12} textAnchor="middle" className="dla-t--xs dla-t--m">{SIM.axes.grad}</text>
        {/* healthy bands + centre lines */}
        {[['std', STD_DOMAIN], ['grad', GRAD_DOMAIN]].map(([col, dom]) => {
          const x0 = domX(g, col, dom.band[0], dom);
          const x1 = domX(g, col, dom.band[1], dom);
          const c = g.x[col] + g.bar / 2;
          return (
            <g key={col} aria-hidden="true">
              <rect x={x0} y={g.top - 4} width={x1 - x0} height={g.layers * g.rowH + 2} className="dla-sk__band" />
              <line x1={c} x2={c} y1={g.top - 6} y2={g.top + g.layers * g.rowH} className="dla-sk__centre" />
              {dom.ticks.map(([lv, t]) => (
                <text key={t} x={domX(g, col, lv, dom) + (lv === dom.lo ? -3 : lv === dom.hi ? 3 : 0)} y={g.top + g.layers * g.rowH + 12} textAnchor={lv === dom.lo ? 'start' : lv === dom.hi ? 'end' : 'middle'} className="dla-t--xs dla-t--m">{t}</text>
              ))}
            </g>
          );
        })}
        {sim.layers.map((r) => {
          const y = rowY(g, r.l);
          const base = y + g.rowH - 3;
          const max = Math.max(...r.hist, 1e-9);
          const st = logBar(g, 'std', r.zStd, STD_DOMAIN);
          const gr = logBar(g, 'grad', r.ratio, GRAD_DOMAIN);
          const status = hide ? 'hidden' : r.status;
          const gstatus = hide ? 'hidden' : r.gstatus;
          const dot = hide ? 'hidden' : worst(r.status, r.gstatus);
          const delay = { transitionDelay: `${(r.l - 1) * 18}ms` };
          return (
            <g key={r.l} className="dla-sk__row">
              <text x={g.x.lab + 2} y={y + g.rowH / 2 + 4} className="dla-t--xs dla-t--m">{SIM.layer}{r.l}</text>
              <line x1={g.x.hist} x2={g.x.hist + g.hist} y1={base + 0.5} y2={base + 0.5} className="dla-sk__axis" />
              {r.hist.map((b, k) => (
                <rect
                  key={k}
                  x={g.x.hist + k * bw + 0.5}
                  y={0}
                  width={Math.max(1, bw - 1)}
                  height={1}
                  className="dla-sk__bin"
                  style={{ transform: `translateY(${base}px) scaleY(${-(b / max) * histH})`, ...delay }}
                />
              ))}
              {r.over > 0.02 && <path d={`M${g.x.hist + g.hist + 1} ${y + 5} l5 4 l-5 4z`} className="dla-sk__over" />}
              {r.under > 0.02 && <path d={`M${g.x.hist - 1} ${y + 5} l-5 4 l5 4z`} className="dla-sk__over" />}
              <rect x={0} y={y + 6} width={1} height={g.rowH - 12} className={`dla-sk__bar dla-sk__bar--${status}`} style={{ transform: `translateX(${st.cx}px) scaleX(${st.len})`, ...delay }} />
              <rect x={0} y={y + 6} width={1} height={g.rowH - 12} className={`dla-sk__bar dla-sk__bar--${gstatus}`} style={{ transform: `translateX(${gr.cx}px) scaleX(${gr.len})`, ...delay }} />
              {(st.over || st.under) && <path d={chevron(st)} className="dla-sk__over" transform={`translate(0 ${y + g.rowH / 2})`} />}
              {(gr.over || gr.under) && <path d={chevron(gr)} className="dla-sk__over" transform={`translate(0 ${y + g.rowH / 2})`} />}
              <circle cx={g.x.dot} cy={y + g.rowH / 2} r={4.5} className={`dla-sk__dot dla-sk__dot--${dot}`} style={delay} />
            </g>
          );
        })}
        <text x={g.x.hist + g.hist / 2} y={g.H - 4} textAnchor="middle" className="dla-t--xs">{SIM.input}</text>
      </svg>
      <div className="dla-sk__legend" aria-hidden={hide ? 'true' : undefined}>
        {['healthy', 'vanishing', 'exploding', 'saturated'].map((k) => (
          <span key={k}><span className={`dla-sk__ldot dla-sk__ldot--${hide ? 'hidden' : k}`} />{SIM.status[k]}</span>
        ))}
        {healed && scene.afterNote && <span className="dla-sk__note">{scene.afterNote}</span>}
      </div>
    </div>
  );
}

/* one layer's weights: fan_in → fan_out and the distribution the weights come from */
function LayerScene({ scene, fb, answer }) {
  const { fin, fout, init, dist, ask } = scene;
  const show = !!fb;
  const W = 360;
  const H = 170;
  const nodes = (x) => Array.from({ length: 5 }, (_, i) => ({ x, y: 30 + i * 24 }));
  const L = nodes(40);
  const R = nodes(150);
  const askLabel = { fanAvg: 'fan_avg', glorotVar: 'σ²', glorotLimit: 'r', heVar: 'σ²', lecunVar: 'σ²' }[ask];
  // the weight distribution sketch on the right (shape only; the value is the question)
  const px0 = 200;
  const px1 = 344;
  const mid = (px0 + px1) / 2;
  const bell = Array.from({ length: 41 }, (_, i) => {
    const t = -3 + (6 * i) / 40;
    return `${i ? 'L' : 'M'}${(mid + t * 22).toFixed(1)} ${(140 - 80 * Math.exp(-0.5 * t * t)).toFixed(1)}`;
  }).join(' ');
  const initName = `${INITS[init].label} ${dist}`;
  return (
    <svg className="dla-svg dla-sk__layer" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A Dense layer: fan_in = ${fin}, fan_out = ${fout}; weights drawn from ${initName}; ${askLabel} = ${show ? fmt(answer) : '?'}`}>
      {L.map((a) => R.map((b) => <line key={`${a.y}-${b.y}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="dla-sk__wire" />))}
      {L.map((a) => <circle key={`l${a.y}`} cx={a.x} cy={a.y} r={6} className="dla-sk__node" />)}
      {R.map((b) => <circle key={`r${b.y}`} cx={b.x} cy={b.y} r={6} className="dla-sk__node dla-sk__node--out" />)}
      <text x={40} y={H - 14} textAnchor="middle" className="dla-t dla-t--m">fan_in</text>
      <text x={40} y={H - 1} textAnchor="middle" className="dla-t dla-t--m dla-t--b">{fin}</text>
      <text x={150} y={H - 14} textAnchor="middle" className="dla-t dla-t--m">fan_out</text>
      <text x={150} y={H - 1} textAnchor="middle" className="dla-t dla-t--m dla-t--b">{fout}</text>
      {dist === 'normal'
        ? <path d={bell} className="dla-sk__dist" />
        : <path d={`M${mid - 60} 140 V70 H${mid + 60} V140`} className="dla-sk__dist" />}
      <line x1={px0} x2={px1} y1={140.5} y2={140.5} className="dla-sk__axis" />
      {dist === 'uniform' && (
        <>
          <text x={mid - 60} y={154} textAnchor="middle" className="dla-t--xs dla-t--m">−r</text>
          <text x={mid + 60} y={154} textAnchor="middle" className="dla-t--xs dla-t--m">+r</text>
        </>
      )}
      <text x={mid} y={22} textAnchor="middle" className="dla-t--s">{initName}</text>
      <text x={mid} y={44} textAnchor="middle" className={`dla-t dla-t--m dla-t--b${show ? ' dla-sk__reveal' : ''}`}>{askLabel} = {show ? fmt(answer) : '?'}</text>
    </svg>
  );
}

/* Table 11-1 with the activation column hidden until the answer */
function TableScene({ scene, fb }) {
  return (
    <figure className="dla-sk__table">
      <table>
        <thead>
          <tr><th scope="col">Initialization</th><th scope="col">Activation functions</th><th scope="col">σ² (Normal)</th></tr>
        </thead>
        <tbody>
          {['glorot', 'he', 'lecun'].map((k) => (
            <tr key={k} className={k === scene.ask ? 'dla-sk__trow--ask' : ''}>
              <th scope="row">{k === scene.ask && <span className="dla-dot" aria-hidden="true" />}{INITS[k].label}</th>
              <td>{fb ? TABLE[k].map((a) => ACTS[a].table).join(', ') : <span className="dla-sk__hidden" aria-label="hidden">· · ·</span>}</td>
              <td className="dla-t--m">{INITS[k].sub.replace('σ² = ', '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>{TABLE.caption}</figcaption>
    </figure>
  );
}

function CurveScene({ scene, fb, answer }) {
  const clip = `sk${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const d = useMemo(() => curveD(scene.act, scene.alpha), [scene.act, scene.alpha]);
  const d2 = useMemo(() => (scene.also ? curveD(scene.also.act, scene.also.alpha) : null), [scene.also]);
  const ticksZ = [-4, -2, 0, 2, 4];
  const ticksY = [-2, -1, 0, 1, 2, 3];
  const show = !!fb;
  const markY = scene.mark !== undefined && scene.mark !== null ? answer : null;
  return (
    <svg className="dla-svg dla-sk__curve" viewBox={`0 0 ${CURVE.W} ${CURVE.H}`} role="img" aria-label={`An activation function plotted for z from −4 to 4${scene.mark !== undefined && scene.mark !== null ? `, with z = ${fmt(scene.mark)} marked` : ''}`}>
      {ticksY.map((y) => <line key={`y${y}`} x1={cx(-4)} x2={cx(4)} y1={cy(y)} y2={cy(y)} className={y === 0 ? 'dla-sk__axis' : 'dla-sk__gl'} />)}
      {ticksZ.map((z) => <line key={`z${z}`} x1={cx(z)} x2={cx(z)} y1={cy(-2.2)} y2={cy(3.2)} className={z === 0 ? 'dla-sk__axis' : 'dla-sk__gl'} />)}
      {ticksZ.map((z) => <text key={`tz${z}`} x={cx(z)} y={CURVE.H - 4} textAnchor="middle" className="dla-t--xs dla-t--m">{fmt(z)}</text>)}
      {ticksY.map((y) => <text key={`ty${y}`} x={CURVE.pad - 6} y={cy(y) + 3} textAnchor="end" className="dla-t--xs dla-t--m">{fmt(y)}</text>)}
      <text x={CURVE.W - 8} y={cy(0) - 5} textAnchor="end" className="dla-t--xs dla-t--m">z</text>
      <defs>
        <clipPath id={clip}><rect x={cx(CURVE.z0)} y={cy(CURVE.y1)} width={cx(CURVE.z1) - cx(CURVE.z0)} height={cy(CURVE.y0) - cy(CURVE.y1)} /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {d2 && <path d={d2} className="dla-sk__curve2" />}
        <path d={d} className="dla-sk__fz" />
      </g>
      {d2 && (
        <g aria-hidden="true">
          <line x1={cx(-3.8)} x2={cx(-3.2)} y1={cy(2.85)} y2={cy(2.85)} className="dla-sk__fz" />
          <text x={cx(-3.1)} y={cy(2.85) + 4} className="dla-t--xs">?</text>
          <line x1={cx(-3.8)} x2={cx(-3.2)} y1={cy(2.35)} y2={cy(2.35)} className="dla-sk__curve2" />
          <text x={cx(-3.1)} y={cy(2.35) + 4} className="dla-t--xs">{SIM.acts.elu}</text>
        </g>
      )}
      {scene.floor && show && (
        <g>
          <line x1={cx(-4)} x2={cx(4)} y1={cy(answer)} y2={cy(answer)} className="dla-sk__floorline" />
          <text x={cx(3.9)} y={cy(answer) - 4} textAnchor="end" className="dla-t--s dla-t--m dla-sk__reveal">{fmt(answer)}</text>
        </g>
      )}
      {markY !== null && (
        <g>
          <line x1={cx(scene.mark)} x2={cx(scene.mark)} y1={cy(-2.2)} y2={cy(3.2)} className="dla-sk__markline" />
          <text x={cx(scene.mark) + 4} y={cy(3.2) + 10} className="dla-t--s dla-t--m">z = {fmt(scene.mark)}</text>
          {show && <circle cx={cx(scene.mark)} cy={cy(Math.max(-2.2, Math.min(3.2, markY)))} r={4.5} className="dla-sk__pt" />}
        </g>
      )}
    </svg>
  );
}

function CodeScene({ lines }) {
  return <div className="dla-sk__code"><Code code={lines.join('\n')} label="python" /></div>;
}

/* one feature over the mini-batch on a number line (slide 24) */
function BatchScene({ scene, fb, answer }) {
  const { xs, mu, sd, xi, ask } = scene;
  const S = lineScale(xs);
  const y = 70;
  const showMu = ask !== 'mu' || !!fb;
  const showSd = ask === 'xhat' || ask === 'z' || !!fb;
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  return (
    <svg className="dla-svg dla-sk__batch" viewBox={`0 0 ${S.W} 130`} role="img" aria-label={`The mini-batch ${xs.map(fmt).join(', ')} on a number line${showMu ? `, μ_B = ${fmt(mu)}` : ''}`}>
      <line x1={S.pad - 10} x2={S.W - S.pad + 10} y1={y} y2={y} className="dla-sk__axis" />
      {showSd && (
        <g>
          <rect x={S.x(mu - sd)} y={y - 16} width={S.x(mu + sd) - S.x(mu - sd)} height={32} className="dla-sk__band" />
          <text x={S.x(mu + sd)} y={y + 30} textAnchor="middle" className="dla-t--xs dla-t--m">μ_B + σ_B</text>
          <text x={S.x(mu - sd)} y={y + 30} textAnchor="middle" className="dla-t--xs dla-t--m">μ_B − σ_B</text>
        </g>
      )}
      {showMu && (
        <g>
          <line x1={S.x(mu)} x2={S.x(mu)} y1={y - 26} y2={y + 20} className="dla-sk__mu" />
          <text x={S.x(mu)} y={y - 30} textAnchor="middle" className={`dla-t--s dla-t--m${ask === 'mu' ? ' dla-sk__reveal' : ''}`}>μ_B = {fmt(mu)}</text>
        </g>
      )}
      {order.map(({ x, i }, k) => {
        // equal values stack upwards; each value is labelled once
        const dup = order.slice(0, k).filter((o) => o.x === x).length;
        return (
          <g key={i}>
            <circle cx={S.x(x)} cy={y - dup * 16} r={7} className={`dla-sk__inst${xi === x ? ' dla-sk__inst--on' : ''}`} />
            {dup === 0 && <text x={S.x(x)} y={y + 48} textAnchor="middle" className="dla-t dla-t--m">{fmt(x)}</text>}
          </g>
        );
      })}
      {(ask === 'var' && fb) && <text x={S.W - S.pad} y={20} textAnchor="end" className="dla-t--s dla-t--m dla-sk__reveal">σ²_B = {fmt(answer)}</text>}
      {(ask === 'xhat' || ask === 'z') && fb && <text x={S.W - S.pad} y={20} textAnchor="end" className="dla-t--s dla-t--m dla-sk__reveal">{ask === 'xhat' ? 'x̂' : 'z'} = {fmt(answer)}</text>}
      {ask === 'z' && <text x={S.pad} y={20} className="dla-t--s dla-t--m">γ = {fmt(scene.gamma)}, β = {fmt(scene.beta)}</text>}
    </svg>
  );
}

/* a BN layer's per-feature parameters; the trainable pair lights up on the answer */
function ParamsScene({ scene, fb, item }) {
  const lit = !!fb;
  const cells = [['γ', true], ['β', true], ['moving mean', false], ['moving variance', false]];
  const testTime = item.tpl === 'testTime';
  return (
    <div className="dla-sk__params" role="img" aria-label="A BatchNormalization layer: per input feature, γ, β, a moving mean and a moving variance">
      <p className="dla-k">BatchNormalization(){scene.n ? ` · ${scene.n.toLocaleString('en-AU')} input features` : ''} · per feature</p>
      <div className="dla-sk__pgrid">
        {cells.map(([k, trainable]) => (
          <span key={k} className={`dla-sk__pcell${lit && (testTime ? !trainable : trainable) ? ' dla-sk__pcell--on' : ''}`}>
            <span className="dla-t--m">{k}</span>
            {lit && <span className="dla-sk__ptag"><span className={`dla-sk__ldot dla-sk__ldot--${trainable ? 'healthy' : 'hidden'}`} />{trainable ? 'trainable' : 'not trainable'}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* slide 26 (BN after) vs slide 28 (BN before) */
function PlacementScene({ fb, item }) {
  const lit = fb ? ({ paper: 'before', useBias: 'before', slide26: 'after' }[item.tpl] ?? null) : null;
  const pipes = [
    { id: 'before', boxes: [fb && item.tpl === 'useBias' ? 'Dense(use_bias=False)' : 'Dense', 'BatchNormalization', 'Activation("relu")'] },
    { id: 'after', boxes: ['Dense(activation="relu")', 'BatchNormalization'] },
  ];
  return (
    <div className="dla-sk__pipes" role="img" aria-label="Two orders: Dense, BatchNormalization, Activation; or Dense with its activation, then BatchNormalization">
      {pipes.map((p, k) => (
        <div key={p.id} className={`dla-sk__pipe${lit === p.id ? ' dla-sk__pipe--on' : ''}`}>
          <span className="dla-k">{String.fromCharCode(65 + k)}</span>
          {p.boxes.map((b, i) => (
            <span key={b} className="dla-sk__pbox">{i > 0 && <span className="dla-sk__arrow" aria-hidden="true">→</span>}<code>{b}</code></span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* the gradient components against the clip band [−1, 1] (slide 29) */
function ClipScene({ scene, fb }) {
  const { g, clipped, mode } = scene;
  const show = !!fb;
  const v = show ? clipped : g;
  const W = 360;
  const H = 170;
  const mid = 85;
  const maxAbs = Math.max(1.2, ...g.map(Math.abs));
  const k = 70 / maxAbs;
  const colW = (W - 60) / g.length;
  return (
    <svg className="dla-svg dla-sk__clip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gradient vector ${show ? 'after clipping' : ''} (${v.map(fmt).join(', ')})${mode === 'value' ? ', with the band from −1 to 1' : ''}`}>
      {mode === 'value' && <rect x={40} y={mid - k} width={W - 50} height={2 * k} className="dla-sk__band" />}
      <line x1={40} x2={W - 10} y1={mid} y2={mid} className="dla-sk__axis" />
      {mode === 'value' && (
        <g>
          <line x1={40} x2={W - 10} y1={mid - k} y2={mid - k} className="dla-sk__clipline" />
          <line x1={40} x2={W - 10} y1={mid + k} y2={mid + k} className="dla-sk__clipline" />
          <text x={36} y={mid - k + 3} textAnchor="end" className="dla-t--xs dla-t--m">1</text>
          <text x={36} y={mid + k + 3} textAnchor="end" className="dla-t--xs dla-t--m">−1</text>
        </g>
      )}
      {v.map((x, i) => {
        const bx = 50 + i * colW + colW * 0.25;
        return (
          <g key={i}>
            <rect x={0} y={0} width={colW * 0.5} height={1} className={`dla-sk__gbar${show ? ' dla-sk__gbar--clipped' : ''}`} style={{ transform: `translate(${bx}px, ${mid}px) scaleY(${-x * k})` }} />
            <text x={bx + colW * 0.25} y={H - 18} textAnchor="middle" className="dla-t--xs dla-t--m">g{i + 1}</text>
            <text x={bx + colW * 0.25} y={H - 4} textAnchor="middle" className={`dla-t--s dla-t--m${show ? ' dla-sk__reveal' : ''}`}>{scene.quiet && !show ? fmt(g[i]) : fmt(x)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* the drawer: the slide's equations, then the page's own notes (violet dot) */
function SkMaths({ maths }) {
  return (
    <Maths>
      {(maths.lines ?? []).map((l) => (
        <div key={l.k} className="dla-sk__mblock">
          <p className="dla-k">{l.k}</p>
          {l.tex.map((t) => <MEq key={t} tex={t} />)}
        </div>
      ))}
      {(maths.own ?? []).map((t) => <p key={t} className="dla-own">{t}</p>)}
    </Maths>
  );
}
