import Scene from '../../scene/Scene';
import { lin, seriesPath, bracket } from '../../scene/geom';
import { SERIES } from '../../data/series';

/* ============================================================================
   SCENE — what the pickle holds: three 3-D tensors (sequences × months ×
   channels). Shapes are Out [2]; block heights are to scale with the number
   of sequences (the channel depth is drawn thicker than scale so it can be
   seen). Row 566 is real data (the same row section 4 plots as
   "sequence 566"); the averages are Out [3].
   ========================================================================== */

const W = 800;
const H = 426;
const K = 210 / 1522; // px per sequence (heights to scale)
const MW = 2; // px per month
const DV = [18, -13]; // the channel axis (two slabs)
const BLOCKS = [
  { k: 'train', name: 'train_seq', shape: '(1522, 84, 2)', n: 1522, months: 84, x: 84, y: 124 },
  { k: 'val', name: 'val_seq', shape: '(313, 84, 2)', n: 313, months: 84, x: 352, y: 124 },
  { k: 'test', name: 'test_seq', shape: '(297, 96, 2)', n: 297, months: 96, x: 580, y: 124 },
];
const dims = (b) => ({ w: b.months * MW, h: b.n * K });
const ROW = 566;
const SEQ = SERIES.trainSeqs[String(ROW)];
const ROW_Y = BLOCKS[0].y + ROW * K;
const px = lin(1, 84, 330, 724);
const py = lin(4, 36, 326, 238);
const RED_Y = 392;
const RED_X = 302; // the two averaged cells
const RED_W = 50;
const PX_T = 318; // where the row's title starts
const TITLE_Y = 224;

const pt = (p) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
function faces(b) {
  const { w, h } = dims(b);
  const [dx, dy] = DV;
  const A = [b.x, b.y];
  const B = [b.x + w, b.y];
  const C = [b.x + w, b.y + h];
  const add = (p, f) => [p[0] + dx * f, p[1] + dy * f];
  return {
    front: [A, B, C, [b.x, b.y + h]],
    top0: [A, B, add(B, 0.5), add(A, 0.5)],
    top1: [add(A, 0.5), add(B, 0.5), add(B, 1), add(A, 1)],
    right0: [B, add(B, 0.5), add(C, 0.5), C],
    right1: [add(B, 0.5), add(B, 1), add(C, 1), add(C, 0.5)],
  };
}

function Block({ b, step }) {
  const f = faces(b);
  const { w, h } = dims(b);
  const base = { fill: 'var(--surface)', stroke: 'var(--ink-3)', strokeWidth: 1, strokeLinejoin: 'round' };
  const tint = (v, o) => ({ fill: `var(--dlp2-${v})`, opacity: o });
  return (
    <g>
      <g className={`tb-blk tb-blk-${b.k}`}>
        {['top1', 'right1', 'top0', 'right0', 'front'].map((k) => (
          <polygon key={k} points={pt(f[k])} style={base} />
        ))}
        <polygon points={pt(f.top0)} style={{ fill: 'var(--ink)', opacity: 0.05 }} />
        <polygon points={pt(f.top1)} style={{ fill: 'var(--ink)', opacity: 0.05 }} />
        <polygon points={pt(f.right0)} style={{ fill: 'var(--ink)', opacity: 0.12 }} />
        <polygon points={pt(f.right1)} style={{ fill: 'var(--ink)', opacity: 0.12 }} />
        <g className="tb-tint" opacity={step >= 3 ? 1 : 0}>
          <polygon points={pt(f.front)} style={tint('min', 0.2)} />
          <polygon points={pt(f.top0)} style={tint('min', 0.42)} />
          <polygon points={pt(f.right0)} style={tint('min', 0.5)} />
          <polygon points={pt(f.top1)} style={tint('max', 0.5)} />
          <polygon points={pt(f.right1)} style={tint('max', 0.6)} />
        </g>
        <text className="sv-lab-strong" x={b.x} y={b.y - 40}>{b.name}</text>
        <text className="sv-num" x={b.x} y={b.y - 24}>{b.shape}</text>
      </g>
      {/* axis 1 · months */}
      <g className="tb-ax1" opacity={step >= 2 ? 1 : 0}>
        <path className="sv-ink2 tb-br" d={bracket(b.x, b.x + w, b.y + h + 14, -6)} strokeWidth="1.2" />
        <text className="sv-lab" x={b.x + w / 2} y={b.y + h + 28} textAnchor="middle">
          {b.k === 'train' ? `axis 1 · ${b.months} months` : `${b.months} months`}
        </text>
      </g>
      {/* axis 0 · sequences */}
      <g className="tb-ax0" opacity={step >= 1 ? 1 : 0}>
        {b.k === 'train' ? (
          <>
            <path className="sv-ink2 tb-br" d={`M${b.x - 6} ${b.y}H${b.x - 12}V${b.y + h}H${b.x - 6}`} strokeWidth="1.2" />
            <text className="sv-lab" transform={`rotate(-90 ${b.x - 20} ${b.y + h / 2})`} x={b.x - 20} y={b.y + h / 2} textAnchor="middle">
              axis 0 · {b.n} sequences
            </text>
          </>
        ) : (
          <text className="sv-lab-strong" x={b.x + w / 2} y={b.y + h / 2 + 4} textAnchor="middle">{b.n} sequences</text>
        )}
      </g>
    </g>
  );
}

function art(step) {
  const tr = BLOCKS[0];
  const trw = dims(tr).w;
  const corner = [tr.x + trw + DV[0], tr.y + DV[1]];
  const mins = SEQ.map((r) => r[0]);
  const maxs = SEQ.map((r) => r[1]);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>The pickle · three float32 tensors</text>
      {BLOCKS.map((b) => <Block key={b.k} b={b} step={step} />)}

      {/* axis 2 · channels */}
      <g className="tb-ax2" opacity={step >= 3 ? 1 : 0}>
        <text className="sv-lab" x={corner[0] + 10} y={corner[1] + 22}>axis 2</text>
        <text className="sv-lab" x={corner[0] + 10} y={corner[1] + 36}>channels</text>
        <rect x={corner[0] + 10} y={corner[1] + 47} width={9} height={9} style={{ fill: 'var(--dlp2-min)' }} />
        <text className="sv-lab-strong" x={corner[0] + 24} y={corner[1] + 56}>0 min</text>
        <rect x={corner[0] + 10} y={corner[1] + 63} width={9} height={9} style={{ fill: 'var(--dlp2-max)' }} />
        <text className="sv-lab-strong" x={corner[0] + 24} y={corner[1] + 72}>1 max</text>
      </g>

      {/* one row, drawn */}
      <g className="tb-row" opacity={step >= 4 ? 1 : 0}>
        <rect className="tb-band" x={tr.x} y={ROW_Y - 1.3} width={trw} height={2.6} style={{ fill: 'var(--ink)' }} />
        <path className="sv-ink2 tb-lead" d={`M${tr.x + trw} ${ROW_Y}H${PX_T - 12}V${TITLE_Y - 4}H${PX_T - 5}`} strokeWidth="1.2" fill="none" />
        <path className="sv-ink2 tb-lead" d={`M${PX_T - 10} ${TITLE_Y - 8}L${PX_T - 5} ${TITLE_Y - 4}L${PX_T - 10} ${TITLE_Y}`} strokeWidth="1.2" fill="none" />
        <text className="sv-lab-strong" x={PX_T} y={TITLE_Y}>train_seq[{ROW}] · one row · 84 months × 2 channels</text>
        <line className="sv-axis" x1={px(1) - 4} x2={px(84) + 4} y1={332} y2={332} />
        {[1, 12, 24, 36, 48, 60, 72, 84].map((m) => (
          <g key={m}>
            <line className="sv-axis" x1={px(m)} x2={px(m)} y1={332} y2={336} />
            <text className="sv-lab" x={px(m)} y={348} textAnchor="middle">{m}</text>
          </g>
        ))}
        {[10, 20, 30].map((t) => (
          <g key={t}>
            <line className="sv-grid" x1={px(1) - 4} x2={px(84) + 4} y1={py(t)} y2={py(t)} />
            <text className="sv-lab" x={px(1) - 10} y={py(t) + 4} textAnchor="end">{t}°</text>
          </g>
        ))}
        <path className="sv-line sv-max tb-line" d={seriesPath(maxs, px, py)} strokeWidth="1.6" />
        <path className="sv-line sv-min tb-line" d={seriesPath(mins, px, py)} strokeWidth="1.6" />
        <text className="sv-lab-strong tb-end" x={px(84) + 8} y={py(maxs[83]) + 4}>max · 1</text>
        <text className="sv-lab-strong tb-end" x={px(84) + 8} y={py(mins[83]) + 4}>min · 0</text>
      </g>

      {/* average two axes away */}
      {/* starts at the stage's left margin so a 390 px screen sees the code and both averages */}
      <g className="tb-red" opacity={step >= 5 ? 1 : 0}>
        <text className="sv-lab-strong" x={24} y={RED_Y + 4}>tf.reduce_mean(train_seq, axis=(0, 1))</text>
        <text className="sv-lab-strong" x={RED_X - 16} y={RED_Y + 4}>→</text>
        {[['min', 12.2], ['max', 24.7]].map(([c, v], j) => (
          <g key={c} className="tb-cell">
            <rect x={RED_X + j * RED_W} y={RED_Y - 11} width={RED_W} height={22} style={{ fill: 'var(--surface)', stroke: 'var(--ink-2)', strokeWidth: 1 }} />
            <rect x={RED_X + j * RED_W} y={RED_Y - 11} width={RED_W} height={22} style={{ fill: `var(--dlp2-${c})`, opacity: 0.3 }} />
            <text className="sv-num" x={RED_X + (j + 0.5) * RED_W} y={RED_Y + 4} textAnchor="middle">{v}</text>
            <text className="sv-lab" x={RED_X + (j + 0.5) * RED_W} y={RED_Y + 25} textAnchor="middle">{c}</text>
          </g>
        ))}
        <text className="sv-lab" x={RED_X + 2 * RED_W + 12} y={RED_Y + 4}>°C · one number per channel is left</text>
      </g>
    </>
  );
}

function build(tl, { q, beat }) {
  const draw = (els, at, dur) =>
    els.forEach((p) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, at);
    });
  tl.set(q('.tb-blk, .tb-ax0, .tb-ax1, .tb-ax2, .tb-tint, .tb-row, .tb-red'), { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.tb-blk'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.25 }, 'b0');

  beat(1, '+=0.6');
  tl.fromTo(q('.tb-ax0'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.15 }, 'b1');
  draw(q('.tb-ax0 .tb-br'), 'b1', 0.7);

  beat(2, '+=0.9');
  tl.fromTo(q('.tb-ax1'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.12 }, 'b2');
  draw(q('.tb-ax1 .tb-br'), 'b2', 0.6);

  beat(3, '+=0.9');
  tl.fromTo(q('.tb-tint'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.1 }, 'b3');
  tl.fromTo(q('.tb-ax2'), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.5 }, 'b3+=0.3');

  beat(4, '+=0.9');
  tl.fromTo(q('.tb-row'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b4');
  tl.fromTo(q('.tb-band'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 'b4');
  draw(q('.tb-lead'), 'b4+=0.3', 0.5);
  draw(q('.tb-line'), 'b4+=0.7', 1.6);
  tl.fromTo(q('.tb-end'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b4+=2.1');

  beat(5, '+=0.8');
  tl.fromTo(q('.tb-red'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b5');
  tl.fromTo(q('.tb-cell'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.15, ease: 'back.out(1.3)' }, 'b5+=0.3');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  { t: 'Three tensors', fx: 0, c: 'load_data unpickles three TensorFlow tensors, one per split, each a block of float32 numbers.' },
  { t: 'Axis 0 · sequences', fx: 0, c: 'Each row is one run of consecutive months from one station: 1522 rows for training, 313 for validation, 297 for the test. Block heights are to scale.' },
  { t: 'Axis 1 · months', fx: 0, c: 'Training and validation sequences are 84 months long; the test sequences run 96, a year longer.' },
  { t: 'Axis 2 · two channels', fx: 0, c: 'Index 0 is the monthly mean minimum and index 1 the monthly mean maximum, both in °C. seq[:, :, 1] takes every maximum at once.' },
  { t: 'One row, drawn', fx: 0.75, c: 'Row 566 of the training block is 84 months by 2 channels: seven annual cycles of minimums and maximums. Section 4 plots this row as “sequence 566”.' },
  { t: 'Average two axes away', fx: 0, c: 'tf.reduce_mean(seq, axis=(0, 1)) averages over every sequence and every month together, which leaves one number per channel: 12.2 °C and 24.7 °C for training.' },
];

export default function TensorBlockScene({ id = 'tensor' }) {
  return (
    <Scene
      id={id}
      label="Three tensor blocks, train (1522, 84, 2), val (313, 84, 2) and test (297, 96, 2), with their three axes labelled, one training row drawn as two temperature curves, and the per-channel average"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
    />
  );
}
