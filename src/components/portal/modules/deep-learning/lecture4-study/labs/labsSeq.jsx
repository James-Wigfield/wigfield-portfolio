import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../icons';
import { Tex, Unfold } from '../../kit';
import { Lab, Chips, Range, Stat } from '../ui';
import { SEQ_MODES } from '../slideData';
import { fmtNum, fmtSigned, signClass, scalarBptt, numericalGrad } from '../rnn';
import { useReducedMotion } from '../hooks';
import { Arrowhead } from './parts';
import { useStudy } from '../context';
import './labsSeq.css';

/* ============================================================================
   LECTURE 4 STUDY — LABS FOR §4 AND §5
     SeqModesLab  Figure 15-4 as a four-way switcher: each panel drawn as the
                  figure draws it, every input marked real / zero and every
                  output used / ignored; slide 12's two readings of
                  vector-to-sequence side by side; the stock-price example's
                  one-day shift as an aligned day strip; then a sorting
                  exercise over slide 12's four examples
     BpttLab      Figure 15-5 live: five cells sharing one W,b, click any Ŷ(t)
                  in or out of the loss, step the forward pass then the
                  backward pass, and read ∂ℒ/∂w as the sum of every step's
                  share, checked against a finite difference
   The toy RNN in BpttLab (its weights, inputs, targets and loss) is this
   page's own; the slides give no numbers for Figure 15-5.
   ========================================================================== */

// A symbol with a bracketed subscript, e.g. X₍₀₎ drawn as X(0) with the
// bracket lowered and shrunk the way the figures typeset it.
function Sym({ x, y, m, s, className }) {
  return (
    <text x={x} y={y} textAnchor="middle" className={className}>
      {m}
      {s != null && <tspan className="dl4s-seq-sub" dy={4}>({s})</tspan>}
    </text>
  );
}
const symText = (m, s) => (s == null ? m : `${m}(${s})`);

/* ── §4 · Figure 15-4, four panels ───────────────────────────────────────── */
const MODE = Object.fromEntries(SEQ_MODES.map((m) => [m.id, m]));
const MODE_OPTS = SEQ_MODES.map((m) => ({ v: m.id, l: m.name, tag: m.where }));
const SORT_OPTS = SEQ_MODES.map((m) => ({ v: m.id, l: m.name }));
// slide 12's examples in a fixed order where no card sits under its own mode
const SORT_ORDER = ['vec2seq', 'encdec', 'seq2seq', 'seq2vec'];
const LETTERS = ['a', 'b', 'c', 'd'];
const V2S_OPTS = [
  { v: 'text', l: 'slide 12’s text: X at t = 0, then zeros' },
  { v: 'figure', l: 'Figure 15-4: X at every step' },
];

const SQ = { W: 600, cy: 124, half: 20 };

// The cells of one Figure 15-4 panel, left to right, plus its dashed boxes.
function seqChain(mode, v2s) {
  const cell = (cx, o) => ({ cx, dec: false, ...o });
  if (mode === 'seq2vec') {
    const cx = (k) => 120 + k * 120;
    return {
      cells: Array.from({ length: 4 }, (_, k) => cell(cx(k), { inM: 'X', inS: k, inReal: true, outM: 'Ŷ', outS: k, outUsed: k === 3 })),
      boxes: [{ x: cx(0) - 44, y: 12, w: cx(2) - cx(0) + 88, h: 88, title: 'Ignored outputs', strong: false }],
    };
  }
  if (mode === 'vec2seq') {
    const once = v2s === 'text';
    return {
      cells: Array.from({ length: 4 }, (_, k) => cell(120 + k * 120, {
        inM: once && k > 0 ? '0' : 'X',
        inS: null,
        inReal: !once || k === 0,
        outM: 'Ŷ',
        outS: k,
        outUsed: true,
      })),
      boxes: [],
    };
  }
  if (mode === 'encdec') {
    const xs = [85, 185, 315, 415, 515];
    return {
      cells: xs.map((cx, k) => (k < 2
        ? cell(cx, { inM: 'X', inS: k, inReal: true, outM: 'Ŷ', outS: k, outUsed: false })
        : cell(cx, { dec: true, inM: '0', inS: null, inReal: false, outM: 'Ŷ′', outS: k - 2, outUsed: true }))),
      boxes: [
        { x: 41, y: 12, w: 188, h: 212, title: 'Encoder', strong: false, ink: true },
        { x: 271, y: 12, w: 288, h: 212, title: 'Decoder', strong: true, ink: true },
      ],
    };
  }
  return {
    cells: Array.from({ length: 5 }, (_, k) => cell(80 + k * 110, { inM: 'X', inS: k, inReal: true, outM: 'Ŷ', outS: k, outUsed: true })),
    boxes: [],
  };
}

// Slide 12 item 1, read out: the cell fed day k is trained on day k + 1.
function DayStrip({ cells }) {
  const n = cells.length;
  return (
    <g>
      <text x={4} y={249} className="dl4s-seq-tag">input</text>
      <text x={4} y={281} className="dl4s-seq-tag">output</text>
      {cells.map((c, k) => (
        <g key={k}>
          <rect x={c.cx - 28} y={236} width={56} height={18} rx={3} className="dl4s-seq-day" />
          <text x={c.cx} y={249} textAnchor="middle" className="dl4s-seq-daytext">day {k + 1}</text>
          <rect x={c.cx - 28} y={268} width={56} height={18} rx={3} className="dl4s-seq-day dl4s-seq-day--out" />
          <text x={c.cx} y={281} textAnchor="middle" className="dl4s-seq-daytext">day {k + 2}</text>
          {k < n - 1 && <line x1={cells[k + 1].cx - 22} y1={256} x2={c.cx + 22} y2={266} className="dl4s-seq-same" />}
        </g>
      ))}
      <text x={cells[n - 1].cx} y={300} textAnchor="middle" className="dl4s-seq-tag dl4s-seq-tag--on">= tomorrow</text>
    </g>
  );
}

const MODE_NOTE = {
  seq2seq: 'Every step takes a real input, and every step’s output is used.',
  seq2vec: 'Every step takes a real input, but only the last output, Ŷ(3), is used: the first three are ignored.',
  encdec:
    'The encoder reads X(0) and X(1); its own outputs are ignored. Its last cell passes its state right, into the decoder, whose inputs are all 0 — so what the decoder writes, Ŷ′(0) … Ŷ′(2), comes from that handed-over state.',
};
const V2S_NOTE = {
  figure: 'Figure 15-4 (slide 13) draws the same X fed into every step. Slide 12’s text describes the other reading — switch above to see it.',
  text: 'Slide 12’s text: the single input X goes in at t = 0 and the later steps are fed zeros; the outputs are still a whole sequence. Figure 15-4 draws the other reading — switch above to see it.',
};
// on paper there is no switch: both readings, as one note
const V2S_PRINT = 'Figure 15-4 (slide 13) draws the same X fed into every step (as here); slide 12’s text instead puts X in at t = 0 only and feeds zeros after. Either way the outputs are a whole sequence.';

// One Figure 15-4 panel with its tallies and slide-12 reading (the lab shows
// the chosen one; the printed page shows all four).
function ModePanel({ mode, v2s }) {
  const { printing } = useStudy();
  const m = MODE[mode];
  const { cells, boxes } = seqChain(mode, v2s);
  const { cy, half } = SQ;
  const H = mode === 'seq2seq' ? 306 : 232;
  const nReal = cells.filter((c) => c.inReal).length;
  const nUsed = cells.filter((c) => c.outUsed).length;
  const aria = `${m.name}, Figure 15-4 ${m.where}: ${cells.length} cells, time left to right. Inputs: ${cells
    .map((c) => `${symText(c.inM, c.inS)} ${c.inReal ? 'real' : 'zero'}`)
    .join(', ')}. Outputs: ${cells.map((c) => `${symText(c.outM, c.outS)} ${c.outUsed ? 'used' : 'ignored'}`).join(', ')}.`;
  return (
    <>
      <div className="dl4s-seq-stage">
        <svg viewBox={`0 0 ${SQ.W} ${H}`} className="dl4s-svg" role="img" aria-label={aria}>
          {boxes.map((b) => (
            <g key={b.title}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} className={`dl4s-seq-box${b.ink ? ' dl4s-seq-box--ink' : ''}`} />
              <text x={b.x + b.w / 2} y={b.y + 15} textAnchor="middle" className={`dl4s-seq-boxtitle${b.strong ? ' dl4s-seq-boxtitle--strong' : ''}`}>{b.title}</text>
            </g>
          ))}
          {cells.map((c, k) => {
            const next = cells[k + 1];
            return (
              <g key={`${mode}${k}`}>
                {/* input, below, arrow up into the cell */}
                <g className={c.inReal ? '' : 'dl4s-seq-ghost'}>
                  <line x1={c.cx} y1={180} x2={c.cx} y2={cy + half + 2} className={`dl4s-wire${c.inReal ? ' dl4s-wire--x' : ''}`} />
                  <Arrowhead x={c.cx} y={cy + half + 1} className={`dl4s-ah${c.inReal ? ' dl4s-ah--x' : ''}`} />
                  <Sym x={c.cx} y={198} m={c.inM} s={c.inS} className={`dl4s-seq-lab${c.inReal ? ' dl4s-seq-lab--x' : ''}`} />
                </g>
                <text x={c.cx} y={212} textAnchor="middle" className={`dl4s-seq-tag${c.inReal ? ' dl4s-seq-tag--on' : ''}`}>{c.inReal ? 'real' : 'zero'}</text>
                {/* output, above, arrow up out of the cell */}
                <g className={c.outUsed ? '' : 'dl4s-seq-ghost'}>
                  <line x1={c.cx} y1={cy - half - 1} x2={c.cx} y2={75} className={`dl4s-wire${c.outUsed ? ' dl4s-wire--y' : ''}`} />
                  <Arrowhead x={c.cx} y={74} className={`dl4s-ah${c.outUsed ? ' dl4s-ah--y' : ''}`} />
                  <Sym x={c.cx} y={52} m={c.outM} s={c.outS} className={`dl4s-seq-lab${c.outUsed ? ' dl4s-seq-lab--y' : ''}`} />
                </g>
                <text x={c.cx} y={66} textAnchor="middle" className={`dl4s-seq-tag${c.outUsed ? ' dl4s-seq-tag--on' : ''}`}>{c.outUsed ? 'used' : 'ignored'}</text>
                {/* the cell, and the arrow on to the next one */}
                <rect x={c.cx - half} y={cy - half} width={half * 2} height={half * 2} rx={8} className={`dl4s-seq-cell${c.dec ? ' dl4s-seq-cell--dec' : ''}`} />
                {next && (
                  <g>
                    <line x1={c.cx + half + 1} y1={cy} x2={next.cx - half - 2} y2={cy} className="dl4s-seq-link" />
                    <Arrowhead x={next.cx - half - 1} y={cy} dir="right" className="dl4s-ah dl4s-seq-link" />
                  </g>
                )}
              </g>
            );
          })}
          {mode === 'seq2seq' && <DayStrip cells={cells} />}
        </svg>
      </div>
      <p className="dl4s-seq-swipe">Scroll sideways to see the whole chain.</p>

      <p className="dl4s-seq-tally">
        <span><span className="dl4s-dot dl4s-dot--x" />real inputs <b>{nReal}</b></span>
        <span><span className="dl4s-dot" />zero inputs <b>{cells.length - nReal}</b></span>
        <span><span className="dl4s-dot dl4s-dot--y" />outputs used <b>{nUsed}</b></span>
        <span><span className="dl4s-dot" />outputs ignored <b>{cells.length - nUsed}</b></span>
      </p>
      <p className="dl4s-readout" aria-live="polite">
        <b>Slide 12, item {m.item}:</b> {m.text} — e.g., {m.example}.
        <br />
        {mode === 'vec2seq' ? (printing ? V2S_PRINT : V2S_NOTE[v2s]) : MODE_NOTE[mode]}
      </p>
      {mode === 'seq2seq' && (
        <>
          <p className="dl4s-cap">
            What slide 12’s example means (N = 5 here, one day per cell): the cell fed day k’s price is trained to output day k + 1’s, so the outputs are the
            inputs shifted one day into the future, ending the day after the inputs end — the slide’s “tomorrow”. (Its “N − 1 ago” is missing the word “days”.)
          </p>
        </>
      )}
    </>
  );
}

export function SeqModesLab() {
  const { printing } = useStudy();
  const [mode, setMode] = useState('seq2seq');
  const [v2s, setV2s] = useState('figure');
  const [chosen, setPicks] = useState({});
  const [isChecked, setChecked] = useState(false);
  // on paper: all four panels, and the sorting exercise shown answered
  const picks = printing ? Object.fromEntries(SORT_ORDER.map((id) => [id, id])) : chosen;
  const checked = printing || isChecked;

  const nPicked = SORT_ORDER.filter((id) => picks[id]).length;
  const score = SORT_ORDER.filter((id) => picks[id] === id).length;
  const pick = (id, v) => {
    setPicks((p) => ({ ...p, [id]: v }));
    setChecked(false);
  };

  return (
    <Lab
      title="Figure 15-4 live · four ways to wire a sequence"
      slides="slides 12–13"
      tryThis="before switching to sequence-to-vector, predict which of its outputs are used; then sort slide 12’s four examples below and check."
    >
      {!printing && (
        <div className="dl-lab__controls">
          <Chips label="Figure 15-4 panel" value={mode} options={MODE_OPTS} onChange={setMode} />
          {mode === 'vec2seq' && <Chips label="fed after t = 0" value={v2s} options={V2S_OPTS} onChange={setV2s} />}
        </div>
      )}

      {printing
        ? SEQ_MODES.map((sm) => (
          <div key={sm.id} className="dl4s-seq-printpanel">
            <p className="dl4s-stagehead">Figure 15-4, {sm.where} · {sm.name}</p>
            <ModePanel mode={sm.id} v2s={v2s} />
          </div>
        ))
        : <ModePanel mode={mode} v2s={v2s} />}
      <p className="dl4s-cap">
        Drawn as Figure 15-4 draws it; the words real / zero and used / ignored are this page’s labels (the figure greys them).
      </p>

      <div className="dl4s-seq-sort">
        <p className="dl4s-stagehead">Sort slide 12’s four examples into their modes</p>
        <ol className="dl4s-seq-cards">
          {SORT_ORDER.map((id, i) => {
            const ex = MODE[id];
            const got = picks[id];
            const ok = got === id;
            return (
              <li key={id} className="dl4s-seq-card">
                <span className="dl4s-seq-card__no" aria-hidden="true">{LETTERS[i]}</span>
                <div className="dl4s-seq-card__body">
                  <p className="dl4s-seq-card__ex">e.g., {ex.example}</p>
                  <Chips compact label={`Mode for example ${LETTERS[i]}`} value={got ?? null} options={SORT_OPTS} onChange={(v) => pick(id, v)} />
                  {checked && got && (
                    <p className="dl4s-seq-verdict">
                      <span className={`dl4s-dot ${ok ? 'dl4s-seq-dot--ok' : 'dl4s-seq-dot--no'}`} aria-hidden="true" />
                      <b>{printing ? ex.name : ok ? 'right' : `not ${MODE[got].name}`}</b> — slide 12, item {ex.item} ({ex.name}): {ex.text}.{' '}
                      <button type="button" className="dl4s-link dl4s-seq-show" onClick={() => setMode(id)}>
                        <Icon name="eye" size={12} /> show it in the figure
                      </button>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="dl4s-seq-sortbar">
          <button type="button" className="dl-btn dl4s-ibtn" onClick={() => setChecked(true)} disabled={nPicked < SORT_ORDER.length}>
            <Icon name="check" size={13} /> check
          </button>
          <button type="button" className="dl-btn dl4s-ibtn" onClick={() => { setPicks({}); setChecked(false); }} disabled={!nPicked}>
            <Icon name="skipBack" size={13} /> reset
          </button>
          <span className="dl4s-seq-score" aria-live="polite">
            {checked ? `${score} of 4 right` : nPicked < SORT_ORDER.length ? `${nPicked} of 4 sorted — pick a mode for each to check` : 'all four sorted — check them'}
          </span>
        </div>
      </div>
    </Lab>
  );
}

/* ── §5 · Figure 15-5, backpropagation through time ──────────────────────── */
const BP_T = 5;
const BP_X = [0.9, -0.4, 0.6, 0.2, -0.7]; // this page's inputs x(0) … x(4)
const BP_Y = [0.3, 0.6, 0.2, 0.9, 0.4]; // this page's targets y(0) … y(4)
const BP_U = 1; // input weight
const BP_B = 0; // bias
const EPS = 1e-4;
const LOSS_TICK = BP_T + 1; // ticks 1…5 run the cells, 6 the loss …
const END = 2 * BP_T + 2; // … 7…11 the backward pass, cell 4 down to cell 0; 12 done
const backTick = (k) => LOSS_TICK + (BP_T - k);
const BX = (t) => 70 + 105 * t;
const SUM_X = 590;
const LOSS_X = BX(2);
const BCY = 190;
const PARAM_OPTS = [
  { v: 'w', l: 'w (fed-back weight)' },
  { v: 'u', l: 'u (input weight)' },
  { v: 'b', l: 'b (bias)' },
];
const SHARE_RULE = { w: '∂ℒ/∂a(t) · h(t−1)', u: '∂ℒ/∂a(t) · x(t)', b: '∂ℒ/∂a(t) · 1' };

// An open chevron with its point at (x, y), pointing along angle `ang`.
function Tip({ x, y, ang, s = 5, className }) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const l = s * 1.3;
  const d = `M${x - ux * l - uy * s} ${y - uy * l + ux * s} L${x} ${y} L${x - ux * l + uy * s} ${y - uy * l - ux * s}`;
  return <path d={d} className={className} />;
}

// ℒ(Y(2), Y(3), Y(4); Ŷ(2), Ŷ(3), Ŷ(4)) for whichever outputs are in the loss
function LossLabel({ S, value }) {
  const parts = [<tspan key="L" className="dl4s-bptt-script">ℒ</tspan>, <tspan key="o">(</tspan>];
  const add = (kind, list) => list.forEach((t, i) => {
    const cls = kind === 'y' ? 'dl4s-bptt-tgt' : 'dl4s-bptt-pred';
    parts.push(<tspan key={`${kind}${t}`} className={cls}>{kind === 'y' ? 'Y' : 'Ŷ'}</tspan>);
    parts.push(<tspan key={`${kind}${t}s`} className={`dl4s-seq-sub ${cls}`} dy={4}>({t})</tspan>);
    const sep = i < list.length - 1 ? ', ' : kind === 'y' ? '; ' : ')';
    parts.push(<tspan key={`${kind}${t}r`} dy={-4}>{sep}</tspan>);
  });
  if (S.length) {
    add('y', S);
    add('yh', S);
  } else {
    parts.push(<tspan key="e"> ; )  — no output in the loss</tspan>);
  }
  if (value != null) parts.push(<tspan key="v" className="dl4s-bptt-lossv">{`  = ${value}`}</tspan>);
  return <text x={LOSS_X} y={26} textAnchor="middle" className="dl4s-bptt-loss">{parts}</text>;
}

const plusJoin = (vals, dp) => vals.map((v, i) => (i === 0 ? fmtSigned(v, dp) : `${v < 0 ? ' − ' : ' + '}${Math.abs(v).toFixed(dp)}`)).join('');

export function BpttLab() {
  const reduced = useReducedMotion();
  const [inLoss, setInLoss] = useState([false, false, true, true, true]); // slide 14: the last three outputs
  const [w, setW] = useState(0.8);
  const [param, setParam] = useState('w');
  const [tick, setTick] = useState(END); // open on the finished figure
  const [playing, setPlaying] = useState(false);
  const running = playing && !reduced;

  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => {
      if (tick >= END) setPlaying(false);
      else setTick(tick + 1);
    }, 750);
    return () => clearTimeout(id);
  }, [running, tick]);

  const S = useMemo(() => inLoss.flatMap((on, t) => (on ? [t] : [])), [inLoss]);
  const p = useMemo(() => ({ w, u: BP_U, b: BP_B }), [w]);
  const run = useMemo(() => scalarBptt(p, BP_X, BP_Y, S), [p, S]);
  const numeric = useMemo(() => numericalGrad(p, param, BP_X, BP_Y, S, EPS), [p, param, S]);
  const share = run.share[param];
  const total = run.total[param];
  const last = S.length ? S[S.length - 1] : -1;
  const reached = (k) => k <= last;
  const fwdDone = (k) => tick >= k + 1;
  const lossDone = tick >= LOSS_TICK;
  const backDone = (k) => tick >= backTick(k);
  const cur = tick >= 1 && tick <= BP_T ? tick - 1 : tick > LOSS_TICK && tick < END ? BP_T - (tick - LOSS_TICK) : -1;
  const isDefault = S.join() === '2,3,4';

  const toggle = (t) => setInLoss((a) => a.map((v, i) => (i === t ? !v : v)));
  const play = () => {
    if (reduced) {
      setPlaying(false);
      setTick(END);
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (tick >= END) setTick(0);
    setPlaying(true);
  };
  const stepTo = (v) => {
    setPlaying(false);
    setTick(Math.max(0, Math.min(END, v)));
  };

  const shareExpr = (k) => {
    const ga = fmtSigned(run.ga[k], 3);
    if (param === 'w') return `${ga} × h(${k - 1}) = ${ga} × ${fmtSigned(run.f[k].hPrev, 3)}`;
    if (param === 'u') return `${ga} × x(${k}) = ${ga} × ${fmtSigned(BP_X[k], 1)}`;
    return ga;
  };
  let status;
  if (tick === 0) status = 'Ready: step or play to run the forward pass, left to right.';
  else if (tick <= BP_T) {
    const k = tick - 1;
    const s = run.f[k];
    status = `Forward pass · cell ${k}: h(${k}) = tanh(${w.toFixed(1)} × ${fmtSigned(s.hPrev, 3)} + ${BP_U} × ${fmtSigned(s.x, 1)} + ${BP_B}) = ${fmtSigned(s.h, 3)} = ŷ(${k})`;
  } else if (tick === LOSS_TICK) {
    status = S.length
      ? `Loss: ℒ = mean of (ŷ(t) − y(t))² over t ∈ {${S.join(', ')}} = ${fmtNum(run.L, 4)}`
      : 'Loss: no output is in the loss, so ℒ = 0 and there is nothing to send back.';
  } else if (tick >= END) {
    status = last < 0
      ? 'Done: nothing was in the loss, so no gradient flowed back and every share is 0.'
      : `Done: forward pass left to right, the loss, then the gradient right to left — it reached ${last === 0 ? 'cell 0 only' : `cells 0–${last}`}.`;
  } else if (!reached(cur)) {
    status = `Backward pass · cell ${cur}: no output at or after step ${cur} is in the loss, so no gradient reaches this cell — its share is 0.`;
  } else {
    const fromNext = cur < BP_T - 1 ? `${w.toFixed(1)} × ${fmtSigned(run.ga[cur + 1], 3)}` : '0';
    status = `Backward pass · cell ${cur}: ∂ℒ/∂a(${cur}) = (${fmtSigned(run.gy[cur], 3)} + ${fromNext}) × (1 − ${fmtSigned(run.f[cur].h, 3)}²) = ${fmtSigned(run.ga[cur], 3)}; its share of ∂ℒ/∂${param} = ${shareExpr(cur)} = ${fmtSigned(share[cur], 3)}`;
  }
  const phase = tick === 0 ? 'start' : tick <= BP_T ? `forward · cell ${tick - 1}` : tick === LOSS_TICK ? 'loss' : `backward · cell ${cur}`;

  // bars: every step's share of ∂ℒ/∂param, and their sum
  const maxAbs = Math.max(0.02, Math.abs(total), ...share.map(Math.abs));
  const barH = (v) => (Math.abs(v) / maxAbs) * 24;
  const BASE = 336;
  const roundedSum = share.reduce((a, v) => a + Number(v.toFixed(4)), 0);
  const sumSign = Math.abs(roundedSum - total) < 5e-5 ? '=' : '≈';

  const rows = [
    { k: 'x(t)', f: 'input (this page’s)', v: (t) => fmtSigned(BP_X[t], 1), show: () => true },
    { k: 'y(t)', f: 'target (this page’s)', v: (t) => fmtSigned(BP_Y[t], 1), show: () => true, dim: (t) => !inLoss[t] },
    { k: 'ŷ(t) = h(t)', f: 'tanh(w·h(t−1) + u·x(t) + b)', v: (t) => fmtSigned(run.f[t].h, 3), show: fwdDone },
    { k: '∂ℒ/∂ŷ(t)', f: `2(ŷ(t) − y(t)) / ${Math.max(1, S.length)} if in ℒ, else 0`, v: (t) => fmtSigned(run.gy[t], 3), show: () => lossDone },
    { k: '∂ℒ/∂h(t)', f: '∂ℒ/∂ŷ(t) + w · ∂ℒ/∂a(t+1)', v: (t) => fmtSigned(run.gh[t], 3), show: backDone },
    { k: '∂ℒ/∂a(t)', f: '∂ℒ/∂h(t) · (1 − h(t)²)', v: (t) => fmtSigned(run.ga[t], 3), show: backDone },
    { k: `share of ∂ℒ/∂${param}`, f: SHARE_RULE[param], v: (t) => (reached(t) ? fmtSigned(share[t], 3) : 'none'), show: backDone, hot: true },
  ];

  const aria = `Figure 15-5: five cells sharing the same W,b. The loss uses ${S.length ? S.map((t) => `Ŷ(${t})`).join(', ') : 'no outputs'}; the gradient reaches ${
    last >= 0 ? `cells 0 to ${last}` : 'no cell'
  }. Total ∂ℒ/∂${param} = ${fmtSigned(total, 4)}.`;

  return (
    <Lab
      title="Figure 15-5 live · backpropagation through time"
      slides="slide 14"
      tryThis="predict which cells get any gradient if only Ŷ(2) is in the loss; click Ŷ(3) and Ŷ(4) out and notice cells 3–4 go cold. Then compare the BPTT sum with the numerical check."
    >
      <div className="dl-lab__controls">
        <Chips label="gradient for" value={param} options={PARAM_OPTS} onChange={setParam} />
        <div className="dl-sliders">
          <Range label="w (shared by all five cells)" value={w} min={-1.5} max={1.5} step={0.1} onChange={setW} fmt={(v) => v.toFixed(1)} />
        </div>
      </div>

      <div className="dl4s-bptt-run">
        <div className="dl4s-stepper" role="group" aria-label="Forward and backward pass">
          <button type="button" className="dl-btn" onClick={() => stepTo(0)} aria-label="Back to the start"><Icon name="skipBack" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => stepTo(tick - 1)} disabled={tick === 0} aria-label="Previous step"><Icon name="arrowLeft" size={14} /></button>
          <button type="button" className="dl-btn" onClick={play} aria-label={running ? 'Pause' : 'Play the forward then the backward pass'}><Icon name={running ? 'pause' : 'play'} size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => stepTo(tick + 1)} disabled={tick >= END} aria-label="Next step"><Icon name="arrowRight" size={14} /></button>
          <button type="button" className="dl-btn" onClick={() => stepTo(END)} disabled={tick >= END} aria-label="Jump to the end"><Icon name="skipForward" size={14} /></button>
          <span className="dl4s-stepper__t">step <b>{tick}</b> of {END} · {tick >= END ? 'done' : phase}</span>
        </div>
        <span className="dl4s-bptt-legend">
          <span><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" className="dl4s-bptt-fwd" /></svg> forward pass</span>
          <span><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" className="dl4s-bptt-grad" /></svg> gradient (backward)</span>
        </span>
      </div>

      <div className="dl4s-bptt-stage">
        <svg viewBox="0 0 640 384" className="dl4s-svg" role="img" aria-label={aria}>
          <LossLabel S={S} value={lossDone && S.length ? fmtNum(run.L, 4) : null} />
          {/* Ŷ(t) ⇄ ℒ: dashed up (forward), solid down (gradient) */}
          {S.map((t) => {
            const cx = BX(t);
            const lx = LOSS_X + (cx - LOSS_X) * 0.3;
            const y1 = 76;
            const y2 = 38;
            const len = Math.hypot(lx - cx, y2 - y1);
            const ux = (lx - cx) / len;
            const uy = (y2 - y1) / len;
            const nx = -uy * 4;
            const ny = ux * 4;
            const up = Math.atan2(uy, ux);
            return (
              <g key={`l${t}`}>
                <g className={lossDone ? '' : 'dl4s-bptt-off'}>
                  <line x1={cx + nx} y1={y1 + ny} x2={lx + nx} y2={y2 + ny} className="dl4s-bptt-fwd" />
                  <Tip x={lx + nx} y={y2 + ny} ang={up} className="dl4s-bptt-fwdhead" />
                </g>
                <g className={tick > LOSS_TICK ? '' : 'dl4s-bptt-off'}>
                  <line x1={lx - nx} y1={y2 - ny} x2={cx - nx} y2={y1 - ny} className="dl4s-bptt-grad" />
                  <Tip x={cx - nx} y={y1 - ny} ang={up + Math.PI} className="dl4s-bptt-gradhead" />
                </g>
              </g>
            );
          })}

          {BP_X.map((x, t) => {
            const cx = BX(t);
            const on = inLoss[t];
            const cold = !reached(t);
            const next = t < BP_T - 1;
            const toggleKey = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(t);
              }
            };
            return (
              <g key={t}>
                {/* input: dashed, up into the cell */}
                <g className={fwdDone(t) ? '' : 'dl4s-bptt-off'}>
                  <line x1={cx} y1={250} x2={cx} y2={211} className="dl4s-bptt-fwd" />
                  <Arrowhead x={cx} y={210} className="dl4s-bptt-fwdhead" />
                </g>
                <Sym x={cx} y={266} m="X" s={t} className="dl4s-bptt-xlab" />
                <text x={cx} y={280} textAnchor="middle" className="dl4s-tick">x = {fmtSigned(x, 1)}</text>

                {/* output: dashed up to Ŷ(t); solid back down if Ŷ(t) is in the loss */}
                <g className={fwdDone(t) ? '' : 'dl4s-bptt-off'}>
                  <line x1={cx - 6} y1={171} x2={cx - 6} y2={128} className="dl4s-bptt-fwd" />
                  <Arrowhead x={cx - 6} y={127} className="dl4s-bptt-fwdhead" />
                </g>
                {on && (
                  <g className={backDone(t) ? '' : 'dl4s-bptt-off'}>
                    <line x1={cx + 6} y1={127} x2={cx + 6} y2={170} className="dl4s-bptt-grad" />
                    <Arrowhead x={cx + 6} y={171} dir="down" className="dl4s-bptt-gradhead" />
                  </g>
                )}
                <g className="dl4s-bptt-out" tabIndex={0} role="button" aria-pressed={on} aria-label={`Ŷ(${t}) ${on ? 'is in' : 'is not in'} the loss — press to toggle`} onClick={() => toggle(t)} onKeyDown={toggleKey}>
                  <rect x={cx - 31} y={78} width={62} height={46} rx={6} className={`dl4s-bptt-obox ${on ? 'dl4s-bptt-obox--in' : 'dl4s-bptt-obox--out'}`} />
                  <Sym x={cx} y={94} m="Ŷ" s={t} className={`dl4s-bptt-olab${on ? '' : ' dl4s-bptt-olab--out'}`} />
                  <text x={cx} y={107} textAnchor="middle" className="dl4s-tick">{fwdDone(t) ? fmtSigned(run.f[t].h, 3) : '?'}</text>
                  <text x={cx} y={119} textAnchor="middle" className={`dl4s-bptt-otag${on ? ' dl4s-bptt-otag--in' : ''}`}>{on ? 'in ℒ' : 'not in ℒ'}</text>
                </g>

                {/* the cell: the same W,b every step */}
                <rect x={cx - 28} y={BCY - 18} width={56} height={36} rx={8} className={`dl4s-bptt-cell${cold && tick > LOSS_TICK ? ' dl4s-bptt-cell--cold' : ''}${cur === t ? ' dl4s-bptt-cell--now' : ''}`} />
                <text x={cx} y={BCY + 4} textAnchor="middle" className="dl4s-bptt-wb">W,b</text>

                {/* between cells: dashed → (forward) above, solid ← (gradient) below */}
                {next && (
                  <g>
                    <g className={fwdDone(t + 1) ? '' : 'dl4s-bptt-off'}>
                      <line x1={cx + 29} y1={BCY - 7} x2={BX(t + 1) - 30} y2={BCY - 7} className="dl4s-bptt-fwd" />
                      <Arrowhead x={BX(t + 1) - 29} y={BCY - 7} dir="right" className="dl4s-bptt-fwdhead" />
                    </g>
                    {reached(t + 1) && (
                      <g className={backDone(t) ? '' : 'dl4s-bptt-off'}>
                        <line x1={BX(t + 1) - 29} y1={BCY + 7} x2={cx + 30} y2={BCY + 7} className="dl4s-bptt-grad" />
                        <Arrowhead x={cx + 29} y={BCY + 7} dir="left" className="dl4s-bptt-gradhead" />
                      </g>
                    )}
                  </g>
                )}

                {/* this step's share of ∂ℒ/∂param */}
                {backDone(t) && reached(t) && share[t] !== 0 && (
                  <rect x={cx - 9} y={share[t] >= 0 ? BASE - barH(share[t]) : BASE} width={18} height={barH(share[t])} className={share[t] >= 0 ? 'dl4s-bptt-bar dl4s-bptt-bar--pos' : 'dl4s-bptt-bar dl4s-bptt-bar--neg'} />
                )}
                <text x={cx} y={376} textAnchor="middle" className={`dl4s-tick${backDone(t) && reached(t) ? ` ${signClass(share[t])}` : ''}`}>
                  {!backDone(t) ? '·' : reached(t) ? fmtSigned(share[t], 3) : 'no gradient'}
                </text>
              </g>
            );
          })}

          {/* the shares and their sum */}
          <text x={8} y={302} className="dl4s-bptt-rowlab">each step’s share of ∂ℒ/∂{param}</text>
          <line x1={BX(0) - 40} y1={BASE} x2={SUM_X + 30} y2={BASE} className="dl4s-axis" />
          <line x1={548} y1={296} x2={548} y2={380} className="dl4s-bptt-divider" />
          <text x={SUM_X} y={302} textAnchor="middle" className="dl4s-bptt-rowlab">sum</text>
          {tick >= END && total !== 0 && (
            <rect x={SUM_X - 11} y={total >= 0 ? BASE - barH(total) : BASE} width={22} height={barH(total)} className={`dl4s-bptt-bar dl4s-bptt-bar--sum ${total >= 0 ? 'dl4s-bptt-bar--pos' : 'dl4s-bptt-bar--neg'}`} />
          )}
          <text x={SUM_X} y={376} textAnchor="middle" className={`dl4s-tick dl4s-bptt-sumv${tick >= END ? ` ${signClass(total)}` : ''}`}>{tick >= END ? fmtSigned(total, 3) : '·'}</text>
        </svg>
      </div>
      <p className="dl4s-seq-swipe">Scroll sideways to see the whole figure.</p>

      <p className="dl4s-readout dl4s-mono dl4s-bptt-status" aria-live="polite">{status}</p>

      {tick >= END ? (
        <>
          <p className="dl4s-readout">
            The same {param} is used by all five cells, so ∂ℒ/∂{param} is the sum of every step’s share:{' '}
            <span className="dl4s-mono">
              {plusJoin(share, 4)} {sumSign} <b>{fmtSigned(total, 4)}</b>
            </span>
            {last >= 0 && last < BP_T - 1 && <> — {last + 1 === BP_T - 1 ? `cell ${last + 1} comes` : `cells ${last + 1}–${BP_T - 1} come`} after the last output in the loss, so {last + 1 === BP_T - 1 ? 'it adds' : 'they add'} nothing</>}
            {param === 'w' && last >= 0 && <>. Step 0 always adds 0 to ∂ℒ/∂w: its share multiplies the state before step 0, which is 0</>}.
          </p>
          <p className="dl4s-readout dl4s-mono">
            numerical check: (ℒ({param} + ε) − ℒ({param} − ε)) / 2ε = <b>{fmtSigned(numeric, 6)}</b> · BPTT: <b>{fmtSigned(total, 6)}</b> · ε = 0.0001
          </p>
        </>
      ) : (
        <p className="dl4s-readout">The total ∂ℒ/∂{param} and its numerical check appear once the backward pass has reached cell 0.</p>
      )}

      <div className="dl4s-stats dl4s-stats--tight">
        <Stat k="ℒ (mean squared error)" v={S.length ? fmtNum(run.L, 4) : '—'} sub={S.length ? `over ${S.length} output${S.length > 1 ? 's' : ''}: ${S.map((t) => `Ŷ(${t})`).join(', ')}` : 'no output in the loss'} />
        <Stat k="cells the gradient reaches" v={`${last + 1} of ${BP_T}`} tone="accent" sub={last < 0 ? 'none — nothing in the loss' : last === BP_T - 1 ? 'every cell, back from Ŷ(4)' : `${last === 0 ? 'cell 0 only' : `cells 0–${last}`}; after Ŷ(${last}) nothing flows back`} />
        <Stat k="parameters" v="w, u, b" sub="one copy, used by all five cells" />
      </div>

      <Unfold label="The backward pass, step by step (∂ℒ/∂ŷ, ∂ℒ/∂h, ∂ℒ/∂a) — this page’s working">
      <div className="dl-tablewrap">
        <table className="dl-table dl4s-bptt-table">
          <thead>
            <tr>
              <th scope="col">quantity</th>
              {BP_X.map((_, t) => <th key={t} scope="col">t = {t}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className={r.hot ? 'dl4s-bptt-hot' : ''}>
                <th scope="row">
                  <b>{r.k}</b>
                  <small>{r.f}</small>
                </th>
                {BP_X.map((_, t) => (
                  <td key={t} className={r.dim?.(t) ? 'dl4s-bptt-dimcell' : ''}>{r.show(t) ? r.v(t) : '·'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Unfold>

      <div className="dl4s-bptt-defs">
        <p><Tex src="\left\{\mathbf{X}_{(t)} \,|\, t = 0, ..., 4\right\}" /> denotes the batch of training sequences fed into the network;</p>
        <p><Tex src="\left\{\hat{\mathbf{Y}}_{(t)} \,|\, t = 0, ..., 4\right\}" /> denotes the corresponding computed output.</p>
        <p className="dl4s-cap">Slide 14, beside Figure 15-5.</p>
      </div>
      <p className="dl4s-cap">
        {isDefault
          ? 'As on slide 14: “the loss function is computed based on the last three outputs only”, and the gradients flow back through the unrolled network along the solid arrows.'
          : `Slide 14’s example puts the last three outputs in the loss; here it is ${S.length ? S.map((t) => `Ŷ(${t})`).join(', ') : 'none'}.`}
      </p>
      <p className="dl4s-cap">
        This page’s own toy RNN, one number per step: h(t) = tanh(w·h(t−1) + u·x(t) + b) and ŷ(t) = h(t), with u = {BP_U}, b = {BP_B} and h = 0 before step 0 (a(t) is
        the sum inside the tanh). The inputs, targets and mean-squared-error loss are this page’s choices: slide 14 gives no numbers and names no loss.
      </p>
    </Lab>
  );
}
