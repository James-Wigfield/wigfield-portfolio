import { useEffect, useMemo, useRef, useState } from 'react';
import { Tex, Note, Code } from '../kit';
import { mulberry32 } from '../mathfns';
import { QUIZ } from './quiz';

/* ============================================================================
   DEEP LEARNING — LECTURE 3 LABS (part 2)
   ----------------------------------------------------------------------------
     FeatureMapLab   Figure 14-5 for real: a synthetic temple image convolved
                     (actually computed, in JS) with the slide-10 line filters
                     or the Sobel pair — two feature maps, live
     StackingLab     Figure 14-6 interactive: 3 input channels, K filters,
                     pick a map and watch its filter span every channel
     KerasShapesLab  slide 16 as a calculator — drag the dims, read the four
                     tensors and the parameter count
     Quiz            ten questions, instant verdicts, slide receipts
   ========================================================================== */

/* ── §5 · Figure 14-5, computed live ─────────────────────────────────────── */
const IMG_N = 60;

function buildTemple() {
  const img = new Float32Array(IMG_N * IMG_N);
  const rng = mulberry32(7);
  for (let idx = 0; idx < IMG_N * IMG_N; idx++) img[idx] = rng() * 0.1;
  const px = (x, y, v) => {
    if (x >= 0 && x < IMG_N && y >= 0 && y < IMG_N) img[y * IMG_N + x] = Math.max(img[y * IMG_N + x], v);
  };
  const hline = (x0, x1, y, v = 1, t = 1) => { for (let x = x0; x <= x1; x++) for (let k = 0; k < t; k++) px(x, y + k, v); };
  const vline = (y0, y1, x, v = 1) => { for (let y = y0; y <= y1; y++) px(x, y, v); };
  hline(16, 43, 7, 1, 2); // ridge
  hline(8, 51, 14, 1, 2); // main roof line
  hline(12, 47, 20, 0.85); // eave band
  for (let t = 0; t < 5; t++) { px(8 - t, 14 - t, 0.9); px(51 + t, 14 - t, 0.9); } // upturned eaves
  [12, 19, 26, 33, 40, 47].forEach((x) => vline(22, 50, x, 1)); // columns
  [16, 23, 30, 37, 44].forEach((x) => vline(28, 50, x, 0.55)); // door lattice
  hline(6, 53, 51, 1, 2); // base
  return img;
}

function conv2(img, n, k, kn, useAbs) {
  const m = n - kn + 1;
  const out = new Float32Array(m * m);
  let max = 1e-9;
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < m; x++) {
      let s = 0;
      for (let j = 0; j < kn; j++) for (let i = 0; i < kn; i++) s += img[(y + j) * n + (x + i)] * k[j * kn + i];
      const v = useAbs ? Math.abs(s) : Math.max(0, s);
      out[y * m + x] = v;
      if (v > max) max = v;
    }
  }
  for (let idx = 0; idx < out.length; idx++) out[idx] /= max;
  return { data: out, n: m };
}

const mkKernel = (kn, fn) => Float32Array.from({ length: kn * kn }, (_, idx) => fn(idx % kn, Math.floor(idx / kn)));

const FILTER_SETS = [
  {
    id: 'line',
    label: 'Line filters · slide 10',
    kn: 7,
    abs: false,
    a: { k: mkKernel(7, (x) => (x === 3 ? 1 : 0)), name: 'Vertical-line filter', out: 'Feature Map 1 · verticals glow' },
    b: { k: mkKernel(7, (x, y) => (y === 3 ? 1 : 0)), name: 'Horizontal-line filter', out: 'Feature Map 2 · horizontals glow' },
  },
  {
    id: 'sobel',
    label: 'Sobel pair · slide 6',
    kn: 3,
    abs: true,
    a: { k: Float32Array.from([-1, 0, 1, -2, 0, 2, -1, 0, 1]), name: 'Sobel-x', out: 'Feature Map 1 · vertical edges' },
    b: { k: Float32Array.from([-1, -2, -1, 0, 0, 0, 1, 2, 1]), name: 'Sobel-y', out: 'Feature Map 2 · horizontal edges' },
  },
];

function GrayCanvas({ data, n, label, sub }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = n;
    cv.height = n;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const g = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
      id.data[i * 4] = g;
      id.data[i * 4 + 1] = g;
      id.data[i * 4 + 2] = g;
      id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }, [data, n]);
  return (
    <figure className="dl3-shot">
      <canvas ref={ref} className="dl3-shot__cv" aria-label={label} />
      <figcaption className="dl3-shot__cap">
        <b>{label}</b>
        {sub && <span>{sub}</span>}
      </figcaption>
    </figure>
  );
}

function FilterPreview({ k, kn, name }) {
  let lo = Infinity;
  let hi = -Infinity;
  k.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; });
  const span = hi - lo || 1;
  return (
    <figure className="dl3-fprev">
      <svg viewBox={`0 0 ${kn} ${kn}`} className="dl3-fprev__svg" shapeRendering="crispEdges" aria-label={`${name} weights as an image`}>
        {Array.from(k).map((v, idx) => {
          const g = Math.round(((v - lo) / span) * 255);
          return <rect key={idx} x={idx % kn} y={Math.floor(idx / kn)} width={1} height={1} fill={`rgb(${g},${g},${g})`} />;
        })}
      </svg>
      <figcaption className="dl3-fprev__cap">{name}</figcaption>
    </figure>
  );
}

export function FeatureMapLab() {
  const [setId, setSetId] = useState('line');
  const set = FILTER_SETS.find((s) => s.id === setId);
  const temple = useMemo(() => buildTemple(), []);
  const mapA = useMemo(() => conv2(temple, IMG_N, set.a.k, set.kn, set.abs), [temple, set]);
  const mapB = useMemo(() => conv2(temple, IMG_N, set.b.k, set.kn, set.abs), [temple, set]);

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 14-5 · two filters, two feature maps — convolved for real, right here</span>
      </div>

      <div className="dl-ctl">
        <span className="dl-ctl__label">Filter pair</span>
        <div className="dl-chips">
          {FILTER_SETS.map((s) => (
            <button key={s.id} type="button" className={`dl-chip${setId === s.id ? ' dl-chip--on' : ''}`} onClick={() => setSetId(s.id)} aria-pressed={setId === s.id}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="dl3-fprevrow">
          <FilterPreview k={set.a.k} kn={set.kn} name={set.a.name} />
          <FilterPreview k={set.b.k} kn={set.kn} name={set.b.name} />
        </div>
      </div>

      <div className="dl3-fmrow" key={setId}>
        <GrayCanvas data={temple} n={IMG_N} label="Input" sub="a temple, drawn in light" />
        <GrayCanvas data={mapA.data} n={mapA.n} label={set.a.out} sub={set.a.name} />
        <GrayCanvas data={mapB.data} n={mapB.n} label={set.b.out} sub={set.b.name} />
      </div>

      <Note label="Read the maps">
        <p>
          The vertical-line filter is all 0s except its central column of 1s, so a neuron using it
          ignores <em>everything</em> in its receptive field except the central vertical line — the
          door lattice and columns survive, the roof lines wash out. The horizontal filter does the
          exact opposite. Same input, two filters, two feature maps.
        </p>
      </Note>
    </div>
  );
}

/* ── §6 · Figure 14-6, interactive ───────────────────────────────────────── */
const SHEET_W = 250;
const SKEW = 100;
const DEPTH = 56;
const BX = 60;

const sheetPts = (x, y) => `${x},${y} ${x + SHEET_W},${y} ${x + SHEET_W + SKEW},${y - DEPTH} ${x + SKEW},${y - DEPTH}`;
const ptOn = (x, y, u, v) => [x + u * SHEET_W + v * SKEW, y - v * DEPTH];

function patchPts(x, y, u, v, su, sv) {
  const c = [ptOn(x, y, u, v), ptOn(x, y, u + su, v), ptOn(x, y, u + su, v + sv), ptOn(x, y, u, v + sv)];
  return c.map((pt) => pt.join(',')).join(' ');
}

const CHANNELS = [
  { name: 'Blue', color: 'var(--dlv-blue)', y: 432 },
  { name: 'Green', color: 'var(--dlv-green)', y: 419 },
  { name: 'Red', color: 'var(--dlv-red)', y: 406 },
];

export function StackingLab() {
  const [K, setK] = useState(3);
  const [mapNo, setMapNo] = useState(2);
  const [stage2, setStage2] = useState(false);
  const k = Math.min(mapNo, K);

  const l1y = (idx) => 300 - idx * 13; // idx 0 = map 1 (bottom sheet)
  const l2y = (idx) => 160 - idx * 13;
  const selY = l1y(k - 1);
  const [nx, ny] = ptOn(BX, selY, 0.3, 0.56);
  const [n2x, n2y] = ptOn(BX, l2y(1), 0.68, 0.5);

  const params = 3 * 3 * 3 * K + K;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Figure 14-6 · one filter spans every channel of the layer below</span>
        <label className="dl-check">
          <input type="checkbox" checked={stage2} onChange={(e) => setStage2(e.target.checked)} />
          show a layer-2 neuron too
        </label>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-ctl">
          <span className="dl-ctl__label">Filters K</span>
          <div className="dl-chips">
            {[2, 3, 4, 5].map((v) => (
              <button key={v} type="button" className={`dl-chip${K === v ? ' dl-chip--on' : ''}`} onClick={() => { setK(v); if (mapNo > v) setMapNo(v); }} aria-pressed={K === v}>
                {v}
              </button>
            ))}
          </div>
          <span className="dl-ctl__label">Watch map</span>
          <div className="dl-chips">
            {Array.from({ length: K }, (_, idx) => idx + 1).map((v) => (
              <button key={v} type="button" className={`dl-chip${k === v ? ' dl-chip--on' : ''}`} onClick={() => setMapNo(v)} aria-pressed={k === v}>
                map {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        viewBox={stage2 ? '0 55 760 415' : '0 175 760 295'}
        className="dl3-stacksvg"
        aria-label="Input channels, convolutional layer 1 and layer 2 drawn as stacked planes"
      >
        {/* input channels */}
        {CHANNELS.map((c) => (
          <g key={c.name}>
            <polygon points={sheetPts(BX, c.y)} className="dl3-sheet" style={{ stroke: c.color, fill: c.color }} />
            <text x={BX - 8} y={c.y - 2} textAnchor="end" className="dl3-sheetlabel" style={{ fill: c.color }}>{c.name}</text>
          </g>
        ))}
        <text x={BX + SHEET_W + SKEW + 10} y={410} className="dl3-stacklabel">Input layer</text>
        <text x={BX - 8} y={452} textAnchor="end" className="dl3-stacklabel">Channels</text>

        {/* stage-1 receptive field: a patch on EVERY channel */}
        {CHANNELS.map((c) => (
          <g key={`p${c.name}`}>
            <polygon points={patchPts(BX, c.y, 0.22, 0.44, 0.14, 0.22)} className="dl3-patch" style={{ stroke: c.color }} />
            {[[0.22, 0.44], [0.36, 0.66]].map(([u, v], li) => {
              const [px, py] = ptOn(BX, c.y, u, v);
              return <line key={li} x1={px} y1={py} x2={nx} y2={ny} className="dl3-flow dl3-flow--soft" />;
            })}
          </g>
        ))}

        {/* conv layer 1 — K sheets, map 1 at the bottom */}
        {Array.from({ length: K }, (_, idx) => {
          const on = idx === k - 1;
          return (
            <g key={idx}>
              <polygon points={sheetPts(BX, l1y(idx))} className={`dl3-sheet dl3-sheet--gray${on ? ' dl3-sheet--on' : ''}`} />
              <text x={BX - 8} y={l1y(idx) - 2} textAnchor="end" className={`dl3-sheetlabel${on ? ' dl3-sheetlabel--on' : ''}`}>map {idx + 1}</text>
            </g>
          );
        })}
        <circle cx={nx} cy={ny} r={4.5} className="dl3-neuron" />
        <text x={BX + SHEET_W + SKEW + 10} y={l1y(Math.floor((K - 1) / 2)) - 20} className="dl3-stacklabel">Convolutional layer 1</text>

        {/* stage 2: a layer-2 neuron's field spans ALL K maps of layer 1 */}
        {stage2 && (
          <g>
            {Array.from({ length: K }, (_, idx) => (
              <g key={idx}>
                <polygon points={patchPts(BX, l1y(idx), 0.58, 0.38, 0.14, 0.22)} className="dl3-patch dl3-patch--s2" />
                {(() => {
                  const [px, py] = ptOn(BX, l1y(idx), 0.65, 0.49);
                  return <line x1={px} y1={py} x2={n2x} y2={n2y} className="dl3-flow dl3-flow--soft" />;
                })()}
              </g>
            ))}
            {[0, 1, 2].map((idx) => (
              <polygon key={idx} points={sheetPts(BX, l2y(idx))} className="dl3-sheet dl3-sheet--gray" />
            ))}
            <circle cx={n2x} cy={n2y} r={4.5} className="dl3-neuron" />
            <text x={BX + SHEET_W + SKEW + 10} y={l2y(1) - 20} className="dl3-stacklabel">Convolutional layer 2</text>
          </g>
        )}
      </svg>

      <div className="dl3-stackread">
        <Tex block src={`z_{${k}} = b_{${k}} + x_{\\text{R}} * f_{\\text{R},${k}} + x_{\\text{G}} * f_{\\text{G},${k}} + x_{\\text{B}} * f_{\\text{B},${k}}`} />
        <p className="dl-body">
          Filter <Tex src={`f_{${k}}`} /> has one channel per input channel (3 here), convolves each,
          sums the three results and adds one bias — that's feature map {k}. Layer-1 parameters with
          3×3 filters: <span className="dl-mono">3·3·3·{K} + {K} = {params}</span>.
        </p>
      </div>

      <Note label="Try this">
        <p>
          Switch between maps: the receptive field on the input <em>never moves</em> — every map
          looks at the same patch through different weights. Then tick the layer-2 neuron: its
          field spans <em>all {K} maps</em> of layer 1, exactly like the input channels below.
        </p>
      </Note>
    </div>
  );
}

/* ── §7 · Slide 16 as a calculator ───────────────────────────────────────── */
export function KerasShapesLab() {
  const [batch, setBatch] = useState(32);
  const [h, setH] = useState(70);
  const [w, setW] = useState(120);
  const [c, setC] = useState(3);
  const [f, setF] = useState(3);
  const [fn, setFn] = useState(32);

  const params = f * f * c * fn + fn;
  const code = `# one image — a 3D tensor
image.shape      # (${h}, ${w}, ${c})

# a mini-batch — a 4D tensor
batch.shape      # (${batch}, ${h}, ${w}, ${c})

# all the filters of the layer — a 4D tensor
kernels.shape    # (${f}, ${f}, ${c}, ${fn})

# the bias terms — a 1D tensor, one bias per filter
biases.shape     # (${fn},)`;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">Slide 16 · drag the dims, read the four tensors</span>
      </div>

      <div className="dl-lab__controls">
        <div className="dl-sliders">
          <label className="dl-slider">
            <span>batch size = {batch}</span>
            <input type="range" min="1" max="128" step="1" value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
          </label>
          <label className="dl-slider">
            <span>height = {h}</span>
            <input type="range" min="28" max="224" step="14" value={h} onChange={(e) => setH(Number(e.target.value))} />
          </label>
          <label className="dl-slider">
            <span>width = {w}</span>
            <input type="range" min="28" max="224" step="14" value={w} onChange={(e) => setW(Number(e.target.value))} />
          </label>
          <label className="dl-slider">
            <span>filters f_n = {fn}</span>
            <input type="range" min="8" max="64" step="8" value={fn} onChange={(e) => setFn(Number(e.target.value))} />
          </label>
        </div>
        <div className="dl-ctl">
          <span className="dl-ctl__label">Channels</span>
          <div className="dl-chips">
            {[{ v: 1, l: '1 · grayscale' }, { v: 3, l: '3 · RGB' }].map((o) => (
              <button key={o.v} type="button" className={`dl-chip${c === o.v ? ' dl-chip--on' : ''}`} onClick={() => setC(o.v)} aria-pressed={c === o.v}>{o.l}</button>
            ))}
          </div>
          <span className="dl-ctl__label">Filter size</span>
          <div className="dl-chips">
            {[3, 5, 7].map((v) => (
              <button key={v} type="button" className={`dl-chip${f === v ? ' dl-chip--on' : ''}`} onClick={() => setF(v)} aria-pressed={f === v}>{v}×{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="dl-cardgrid dl-cardgrid--4">
        <div className="dlk-fact">
          <p className="dlk-fact__k">one image · 3D</p>
          <p className="dlk-fact__v dl-mono">[{h}, {w}, {c}]</p>
          <div className="dlk-fact__sub"><p>[height, width, channels]</p></div>
        </div>
        <div className="dlk-fact">
          <p className="dlk-fact__k">mini-batch · 4D</p>
          <p className="dlk-fact__v dl-mono">[{batch}, {h}, {w}, {c}]</p>
          <div className="dlk-fact__sub"><p>[batch, height, width, channels]</p></div>
        </div>
        <div className="dlk-fact" data-tone="accent">
          <p className="dlk-fact__k">weights · 4D</p>
          <p className="dlk-fact__v dl-mono">[{f}, {f}, {c}, {fn}]</p>
          <div className="dlk-fact__sub"><p>[f_h, f_w, f_c, f_n] — f_c must equal the input's channels</p></div>
        </div>
        <div className="dlk-fact">
          <p className="dlk-fact__k">biases · 1D</p>
          <p className="dlk-fact__v dl-mono">[{fn}]</p>
          <div className="dlk-fact__sub"><p>one bias per filter</p></div>
        </div>
      </div>

      <p className="dl-verdict">
        <span className="dl-verdict__dot" aria-hidden="true" />
        <strong>parameters</strong>&thinsp;: {f}·{f}·{c}·{fn} weights + {fn} biases = <b>{params.toLocaleString()}</b> — and not one of them depends on the image size.
      </p>

      <Code code={code} label="conv_layer_shapes.py" meta="slide 16" />
    </div>
  );
}

/* ── §8 · Quiz ───────────────────────────────────────────────────────────── */
export function Quiz({ quiz = QUIZ, answers, onAnswer, onReset }) {
  const answered = Object.keys(answers).length;
  const score = Object.entries(answers).filter(([i, a]) => quiz[Number(i)].ans === a).length;

  return (
    <div className="dl-lab">
      <div className="dl-lab__bar">
        <span className="dl-lab__name">
          {answered === 0 ? 'Ten questions, straight from the slides' : `Score: ${score}/${answered} answered (${quiz.length} total)`}
        </span>
        {answered > 0 && (
          <button type="button" className="dl-btn" onClick={onReset}>reset</button>
        )}
      </div>

      <ol className="dl-quiz">
        {quiz.map((item, qi) => {
          const picked = answers[qi];
          const done = picked !== undefined;
          return (
            <li key={qi} className="dl-quiz__item">
              <p className="dl-quiz__q">{item.q}</p>
              <div className="dl-quiz__opts">
                {item.opts.map((opt, oi) => {
                  const state = !done ? '' : oi === item.ans ? ' dl-quiz__opt--right' : oi === picked ? ' dl-quiz__opt--wrong' : ' dl-quiz__opt--dim';
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={`dl-quiz__opt${state}`}
                      disabled={done}
                      onClick={() => onAnswer(qi, oi)}
                    >
                      <span className="dl-quiz__mark" aria-hidden="true">{String.fromCharCode(97 + oi)}</span>
                      {opt}
                      {done && oi === item.ans && <span className="dl-quiz__verdict">✓ correct</span>}
                      {done && oi === picked && oi !== item.ans && <span className="dl-quiz__verdict">✗ your pick</span>}
                    </button>
                  );
                })}
              </div>
              {done && (
                <p className="dl-quiz__why">
                  {item.why} <span className="dl-quiz__slide">· slide {item.slide}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
