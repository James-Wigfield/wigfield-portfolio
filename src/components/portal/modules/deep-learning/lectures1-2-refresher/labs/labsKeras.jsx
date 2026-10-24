import { useRef, useState } from 'react';
import { Stage, MLine, MNote } from '../stage';
import { useWidth } from '../useWidth';
import { denseParams } from '../nn';
import { hlLine } from './miniCode';
import './labsL1.css';

/* ============================================================================
   §1.5 · THE SEQUENTIAL API (L1 slides 32–42) · §1.6 · FUNCTIONAL AND
   SUBCLASSING APIs (L1 slides 43–49)
   ----------------------------------------------------------------------------
   SeqModelLab  slide 35's Fashion MNIST classifier with each Dense layer's
                weight matrix drawn to scale (inputs × units), so you see
                where slide 36's 266,610 parameters live. Pick a layer: its
                line of code lights up and its count is written out.
   ApisLab      one switch, three ways to build a model: Sequential (slide
                35's stack), Functional (slide 44's Wide & Deep graph),
                Subclassing (slide 48's class: the same kind of graph, but
                hidden inside call(), where Keras can't see it). Point at a
                box to light its line of code.
   ========================================================================== */

function MiniCode({ lines, on = [] }) {
  return (
    <pre className="dl12r-mini" aria-label="Code from the slide">
      {lines.map((l, i) => (
        <span key={i} className={on.includes(i) ? 'on' : undefined}>
          {hlLine(l || ' ').map(([t, c], j) => (c ? <i key={j} className={c} style={{ fontStyle: 'normal' }}>{t}</i> : t))}
        </span>
      ))}
    </pre>
  );
}

/* ── §1.5 · where the parameters live ─────────────────────────────────── */
const SEQ_CODE = [
  'model = tf.keras.Sequential([',
  '    tf.keras.layers.InputLayer(shape=[28, 28]),',
  '    tf.keras.layers.Flatten(),',
  '    tf.keras.layers.Dense(300, activation="relu"),',
  '    tf.keras.layers.Dense(100, activation="relu"),',
  '    tf.keras.layers.Dense(10, activation="softmax")',
  '])',
];
// slide 36's model.summary(): dense_3, dense_4, dense_5
const DENSE = [
  { name: 'Dense(300)', ins: 784, units: 300, line: 3, printed: '235,500' },
  { name: 'Dense(100)', ins: 300, units: 100, line: 4, printed: '30,100' },
  { name: 'Dense(10)', ins: 100, units: 10, line: 5, printed: '1,010' },
];
const TOTAL = DENSE.reduce((a, d) => a + denseParams(d.ins, d.units), 0); // 266,610 (slide 36)
const n0 = (v) => v.toLocaleString('en-AU');

// each weight matrix drawn as inputs (across) × units (down), stacked; its
// bias vector is the thin bar beside it (units long)
const PK = 0.4;
const PW = 380;
const BOXES = DENSE.reduce((acc, m) => {
  const y = acc.length ? acc[acc.length - 1].y + acc[acc.length - 1].h + 44 : 26;
  return [...acc, { ...m, x: 8, y, w: m.ins * PK, h: Math.max(3, m.units * PK) }];
}, []);
const PH = BOXES[BOXES.length - 1].y + BOXES[BOXES.length - 1].h + 34;

export function SeqModelLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const [sel, setSel] = useState(0);
  const d = DENSE[sel];
  const share = denseParams(DENSE[0].ins, DENSE[0].units) / TOTAL;
  return (
    <Stage
      title="Where the 266,610 parameters live"
      slides="L1 · slides 35–36"
      tryThis="Guess which layer holds most of the model’s parameters, then pick each one and compare."
      caption={`Each Dense layer has inputs × units weights plus one bias per unit. The first one, 784 × 300, holds ${Math.round(share * 100)}% of the total, because Flatten turns each 28 × 28 image into 784 inputs.`}
      own="counts printed on slide 36 · drawn to scale"
      maths={
        <>
          <MLine text={`$\\text{params} = \\text{inputs} \\times \\text{units} + \\text{units}$ (weights $(\\text{inputs}, \\text{units})$, biases $(\\text{units},)$, as slide 36’s \`get_weights()\` shows for the first one).`} />
          {DENSE.map((m) => <MLine key={m.name} text={`${m.name}: $${m.ins} \\times ${m.units} + ${m.units} = ${n0(denseParams(m.ins, m.units))}$ (slide 36 prints ${m.printed}).`} />)}
          <MLine text={`Total: $${DENSE.map((m) => n0(denseParams(m.ins, m.units))).join(' + ')} = ${n0(TOTAL)}$, all trainable (slide 36). \`Flatten\` has none.`} />
          <MNote text={'Training then uses `model.compile(loss="sparse_categorical_crossentropy", optimizer="sgd", metrics=["accuracy"])` and 30 epochs of `fit` (slide 37); the test accuracy is 0.8733 (slide 39).'} />
        </>
      }
    >
      <div ref={wrap} className={`dl12r-apis dl12r-apis--seq${narrow ? ' dl12r-apis--narrow' : ''}`}>
        <div>
          <svg className="dl12r-svg" viewBox={`0 0 ${PW} ${PH}`} style={{ maxWidth: PW + 30 }} role="group" aria-label={`${d.name}: weights ${d.ins} by ${d.units} plus ${d.units} biases = ${n0(denseParams(d.ins, d.units))} parameters`}>
            {BOXES.map((b, i) => (
              <g
                key={b.name}
                className={`dl12r-pm__layer${i === sel ? '' : ' dl12r-pm__layer--dim'}`}
                role="button"
                tabIndex={0}
                aria-pressed={i === sel}
                aria-label={`${b.name}: ${n0(denseParams(b.ins, b.units))} parameters`}
                onClick={() => setSel(i)}
                onPointerEnter={() => setSel(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(i); } }}
              >
                <text x={b.x} y={b.y - 8} className="dl12r-t dl12r-t--s"><tspan className="dl12r-t--b">{b.name}</tspan> · weights ({b.ins}, {b.units}) + {b.units} biases</text>
                <rect className="dl12r-pm__mat dl12r-pm__mat--w" x={b.x} y={b.y} width={b.w} height={b.h} rx={2} />
                <rect className="dl12r-pm__mat dl12r-pm__mat--b" x={b.x + b.w + 5} y={b.y} width={5} height={b.h} rx={1} />
                <text x={b.x + b.w + 16} y={b.y + Math.min(b.h, 30) / 2 + 4} className="dl12r-t dl12r-t--s dl12r-t--m">{n0(denseParams(b.ins, b.units))}</text>
              </g>
            ))}
          </svg>
          <p className="dl12r-legend">
            <span className="dl12r-legend__score">{d.name}: {n0(denseParams(d.ins, d.units))} of {n0(TOTAL)} ({Math.round((denseParams(d.ins, d.units) / TOTAL) * 1000) / 10}%)</span>
            <span><i className="dl12r-legend__swatch" style={{ color: 'var(--dl12r-w)', borderTopWidth: 8 }} /> weights (inputs × units)</span>
            <span><i className="dl12r-legend__swatch" style={{ color: 'var(--dl12r-w)', borderTopWidth: 3 }} /> biases</span>
          </p>
        </div>
        <MiniCode lines={SEQ_CODE} on={[d.line]} />
      </div>
    </Stage>
  );
}

/* ── §1.6 · three ways to build a model ───────────────────────────────── */
const APIS = {
  seq: {
    label: 'Sequential',
    slides: 'slide 35',
    code: SEQ_CODE,
    boxes: [
      { id: 'in', t: 'InputLayer [28, 28]', x: 40, y: 12, line: 1 },
      { id: 'fl', t: 'Flatten', x: 40, y: 58, line: 2 },
      { id: 'd1', t: 'Dense(300, relu)', x: 40, y: 104, line: 3 },
      { id: 'd2', t: 'Dense(100, relu)', x: 40, y: 150, line: 4 },
      { id: 'd3', t: 'Dense(10, softmax)', x: 40, y: 196, line: 5 },
    ],
    edges: [['in', 'fl'], ['fl', 'd1'], ['d1', 'd2'], ['d2', 'd3']],
    note: 'A plain stack: each layer feeds the next.',
  },
  fun: {
    label: 'Functional',
    slides: 'slide 44',
    code: [
      'input_ = tf.keras.layers.Input(shape=X_train.shape[1:])',
      'normalized = normalization_layer(input_)',
      'hidden1 = hidden_layer1(normalized)',
      'hidden2 = hidden_layer2(hidden1)',
      'concat = concat_layer([normalized, hidden2])',
      'output = output_layer(concat)',
      '',
      'model = tf.keras.Model(inputs=[input_], outputs=[output])',
    ],
    boxes: [
      { id: 'in', t: 'Input', x: 40, y: 12, line: 0 },
      { id: 'no', t: 'Normalization', x: 40, y: 58, line: 1 },
      { id: 'h1', t: 'Dense(30, relu)', x: 110, y: 104, line: 2 },
      { id: 'h2', t: 'Dense(30, relu)', x: 110, y: 150, line: 3 },
      { id: 'cc', t: 'Concatenate', x: 40, y: 196, line: 4 },
      { id: 'out', t: 'Dense(1)', x: 40, y: 242, line: 5 },
    ],
    edges: [['in', 'no'], ['no', 'h1'], ['h1', 'h2'], ['h2', 'cc'], ['no', 'cc', 'wide'], ['cc', 'out']],
    note: 'Layers called like functions, so the graph can branch: the short (wide) path skips the deep one.',
  },
  sub: {
    label: 'Subclassing',
    slides: 'slide 48',
    code: [
      'class WideAndDeepModel(tf.keras.Model):',
      '    def __init__(self, units=30, activation="relu", **kwargs):',
      '        super().__init__(**kwargs)  # needed to support naming the model',
      '        self.norm_layer_wide = tf.keras.layers.Normalization()',
      '        self.norm_layer_deep = tf.keras.layers.Normalization()',
      '        self.hidden1 = tf.keras.layers.Dense(units, activation=activation)',
      '        self.hidden2 = tf.keras.layers.Dense(units, activation=activation)',
      '        self.output = tf.keras.layers.Dense(1)',
      '    def call(self, inputs):',
      '        input_wide, input_deep = inputs',
      '        norm_wide = self.norm_layer_wide(input_wide)',
      '        norm_deep = self.norm_layer_deep(input_deep)',
      '        hidden1 = self.hidden1(norm_deep)',
      '        hidden2 = self.hidden2(hidden1)',
      '        concat = tf.keras.layers.concatenate([norm_wide, hidden2])',
      '        return self.output(concat)',
    ],
    boxes: [
      { id: 'iw', t: 'input_wide', x: 10, y: 12, line: 9 },
      { id: 'id', t: 'input_deep', x: 150, y: 12, line: 9 },
      { id: 'nw', t: 'norm_layer_wide', x: 10, y: 58, line: 10, hidden: true },
      { id: 'nd', t: 'norm_layer_deep', x: 150, y: 58, line: 11, hidden: true },
      { id: 'h1', t: 'hidden1', x: 150, y: 104, line: 12, hidden: true },
      { id: 'h2', t: 'hidden2', x: 150, y: 150, line: 13, hidden: true },
      { id: 'cc', t: 'concatenate', x: 10, y: 196, line: 14, hidden: true },
      { id: 'out', t: 'output', x: 10, y: 242, line: 15, hidden: true },
    ],
    edges: [['iw', 'nw'], ['id', 'nd'], ['nd', 'h1'], ['h1', 'h2'], ['h2', 'cc'], ['nw', 'cc'], ['cc', 'out']],
    note: 'The wiring lives inside call(): flexible (loops, ifs), but Keras can’t inspect it, so no clone_model() and summary() can’t show the connections (slide 49).',
  },
};
const BW = 138;
const BH = 28;

export function ApisLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 640;
  const [api, setApi] = useState('fun');
  const [hot, setHot] = useState(null);
  const A = APIS[api];
  const boxes = Object.fromEntries(A.boxes.map((b) => [b.id, b]));
  const hb = hot ? boxes[hot] : null;
  const H = Math.max(...A.boxes.map((b) => b.y)) + BH + 14;
  const W = 300;
  return (
    <Stage
      title="Sequential, Functional, Subclassing"
      slides="L1 · slides 35, 43–49"
      tryThis="Point at a box to light its line of code; then switch to Subclassing and notice where the wiring has gone."
      caption={A.note}
      own="graphs drawn from the slides’ code"
      maths={
        <>
          <MLine text="Functional (slide 44): create the layers, then call each on the previous output — `hidden1 = hidden_layer1(normalized)` — and wrap the graph in `tf.keras.Model(inputs=[input_], outputs=[output])`." />
          <MLine text="Multiple inputs and outputs (slides 46–47): `tf.keras.Model(inputs=[input_wide, input_deep], outputs=[output, aux_output])`, `loss_weights=(0.9, 0.1)`." />
          <MLine text="Subclassing (slides 48–49): layers in `__init__`, the forward pass in `call()`; anything goes in `call()` (for loops, if statements, low-level TensorFlow), but the architecture is hidden from Keras." />
          <MNote text="See §1.6’s Slide check: slide 48’s `self.output = …` fails in Keras 3." />
        </>
      }
    >
      <div ref={wrap}>
        <div className="dl12r-switch" role="group" aria-label="Keras API">
          {Object.entries(APIS).map(([k, a]) => (
            <button key={k} type="button" className={`dl12r-switch__opt${api === k ? ' dl12r-switch__opt--on' : ''}`} aria-pressed={api === k} onClick={() => { setApi(k); setHot(null); }}>{a.label} <span className="dl12r-mini-s">· {a.slides}</span></button>
          ))}
        </div>
        <div className={`dl12r-apis${narrow ? ' dl12r-apis--narrow' : ''}`}>
          <svg className="dl12r-svg" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W + 20 }} role="group" aria-label={`${A.label} model graph`}>
            {api === 'sub' && (
              <g>
                <rect className="dl12r-g__fog" x={2} y={50} width={W - 4} height={H - 54} rx={10} />
                <text x={W - 10} y={H - 10} textAnchor="end" className="dl12r-t dl12r-t--xs dl12r-t--m">inside call()</text>
              </g>
            )}
            {A.edges.map(([a, b, kind]) => {
              const p = boxes[a];
              const q = boxes[b];
              const hidden = api === 'sub';
              if (kind === 'wide') {
                const x = p.x - 14 + (p.x < 30 ? 30 : 0);
                return <path key={`${a}-${b}`} className="dl12r-g__edge" d={`M${p.x + 18} ${p.y + BH} C${x - 10} ${p.y + 80} ${x - 10} ${q.y - 40} ${q.x + 18} ${q.y}`} markerEnd="url(#dl12r-arrow)" />;
              }
              const x1 = p.x + BW / 2;
              const x2 = q.x + BW / 2;
              return <path key={`${a}-${b}`} className={`dl12r-g__edge${hidden ? ' dl12r-g__edge--hidden' : ''}`} d={`M${x1} ${p.y + BH} C${x1} ${p.y + BH + 14} ${x2} ${q.y - 14} ${x2} ${q.y}`} markerEnd="url(#dl12r-arrow)" />;
            })}
            <defs>
              <marker id="dl12r-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L8 4 L0 8 z" fill="var(--ink-3)" />
              </marker>
            </defs>
            {A.boxes.map((b) => (
              <g
                key={b.id}
                className={`dl12r-g__box${hot === b.id ? ' dl12r-g__box--on' : ''}${b.hidden ? ' dl12r-g__box--hidden' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${b.t}: light its line of code`}
                onPointerEnter={() => setHot(b.id)}
                onFocus={() => setHot(b.id)}
                onClick={() => setHot(b.id)}
              >
                <rect x={b.x} y={b.y} width={BW} height={BH} rx={6} />
                <text x={b.x + BW / 2} y={b.y + BH / 2 + 4} textAnchor="middle">{b.t}</text>
              </g>
            ))}
          </svg>
          <MiniCode lines={A.code} on={hb ? [hb.line] : []} />
        </div>
      </div>
    </Stage>
  );
}
