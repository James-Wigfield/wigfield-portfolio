import Scene from '../../scene/Scene';

/* ============================================================================
   SCENE — what the setup cell does for reproducibility (schematic)
   The three lines are In [1]'s. Numbers: 1.591829 / 1.591826 are the GPU
   check with op determinism off (experiments/log.md); the five identical
   final runs, the CPU run's "within 0.001" and the VAE's 49 / 29 against
   43 / 23 are the handover's; 1.250 is model 1's printed test MAE (Out [10]).
   The log lines are drawn as bars, not quoted: their text is not in the
   notebook. Handover §9: inside Jupyter the in-cell log level alone did not
   hide them; the saved run also had it set in the kernel's environment.
   ========================================================================== */

const W = 800;
const H = 436;
const CODE = [
  { k: 'log', txt: 'os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"', tag: 'asks TensorFlow to hide its log lines', beat: 5 },
  { k: 'seed', txt: 'keras.utils.set_random_seed(42)', tag: 'fixes the random starting points', beat: 0 },
  { k: 'det', txt: 'tf.config.experimental.enable_op_determinism()', tag: 'same numbers on every run', beat: 3 },
];
const SEED = { x: 88, y: 218, r: 30 };
const BOX = { x: 166, w: 242, h: 40 };
const SOURCES = [
  { k: 'w', t: 'initial weights', s: 'every layer’s kernels, at build' },
  { k: 'sh', t: 'shuffle order', s: '1522 rows reshuffled each epoch' },
  { k: 'eps', t: 'VAE ε and prior draws', s: 'Sampling layer, sampled codings' },
  { k: 'np', t: 'NumPy draws', s: 'plotted rows, e.g. 95, 259, 140' },
];
const boxTop = (j) => 120 + j * 52;
const RX = 452;
const DIG_X = 640; // where the last digit starts
// the log block stays inside x 24–340, so a 390 px stage (about 405 of the 800
// units, minus its edge fade) shows the bars and every label line at fx 0
const LOG_BARS = [101, 80, 112, 57, 92, 71];
const LOG_TX = 154;
const LOG_LINES = [
  ['sv-lab-strong', 'hidden in the saved run'],
  ['sv-lab', 'level 3, set in the cell'],
  ['sv-lab', 'and the kernel’s environment'],
  ['sv-lab', 'in Jupyter, the cell line'],
  ['sv-lab', 'alone did not hide them'],
];
// a setup line before its beat: ink text at 0.62 measures 4.6 / 4.8 / 5.9:1 on the
// stage in jade / coral / arcade (0.38 gave 2.3–3.1:1)
const DIM = 0.62;
const MUTED = 0.3; // the log lines once hidden
const HL = 0.16; // the ink tint behind the digit that differs

function art(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      {/* the setup cell */}
      <text className="sv-cap" x={24} y={24}>Setup cell · In [1]</text>
      {CODE.map((c, j) => (
        <g key={c.k}>
          <text className={`sv-lab-strong sd-code sd-code-${c.k}`} x={24} y={48 + j * 18} opacity={step >= c.beat ? 1 : DIM}>{c.txt}</text>
          <text className={`sv-lab sd-tag sd-tag-${c.k}`} x={372} y={48 + j * 18} opacity={on(c.beat)}>→ {c.tag}</text>
        </g>
      ))}
      <line className="sv-grid" x1={24} x2={W - 24} y1={96} y2={96} />

      {/* the seed and its four sources */}
      <g className="sd-seed" opacity={on(0)}>
        <circle cx={SEED.x} cy={SEED.y} r={SEED.r} style={{ fill: 'var(--surface)', stroke: 'var(--ink)', strokeWidth: 1.6 }} />
        <text className="sv-big" x={SEED.x} y={SEED.y + 8} textAnchor="middle">42</text>
        <text className="sv-lab" x={SEED.x} y={SEED.y + SEED.r + 18} textAnchor="middle">Python, NumPy</text>
        <text className="sv-lab" x={SEED.x} y={SEED.y + SEED.r + 32} textAnchor="middle">and TensorFlow</text>
      </g>
      <g className="sd-src" opacity={on(1)}>
        {SOURCES.map((s, j) => {
          const cy = boxTop(j) + BOX.h / 2;
          return (
            <g key={s.k}>
              <path
                className="sv-faint sd-fan"
                d={`M${SEED.x + SEED.r} ${SEED.y}C${SEED.x + SEED.r + 30} ${SEED.y}, ${BOX.x - 30} ${cy}, ${BOX.x} ${cy}`}
                strokeWidth="1.2"
              />
              <g className="sd-box">
                <rect className="sv-box" x={BOX.x} y={boxTop(j)} width={BOX.w} height={BOX.h} />
                <text className="sv-lab-strong" x={BOX.x + 10} y={boxTop(j) + 17}>{s.t}</text>
                <text className="sv-lab" x={BOX.x + 10} y={boxTop(j) + 31}>{s.s}</text>
              </g>
            </g>
          );
        })}
        <path className="sv-ink2 sd-brace" d={`M${BOX.x + BOX.w + 8} ${boxTop(0)}h6V${boxTop(3) + BOX.h}h-6M${BOX.x + BOX.w + 14} ${SEED.y}H${RX - 12}`} strokeWidth="1.2" />
        <path className="sv-ink2" d={`M${RX - 17} ${SEED.y - 4}L${RX - 12} ${SEED.y}L${RX - 17} ${SEED.y + 4}`} strokeWidth="1.2" fill="none" />
      </g>

      {/* determinism off */}
      <g className="sd-off" opacity={on(2)}>
        <text className="sv-cap" x={RX} y={120}>Op determinism off · one GPU test, twice</text>
        {[['run 1', '9'], ['run 2', '6']].map(([r, d], j) => (
          <g key={r}>
            <text className="sv-lab" x={RX} y={146 + j * 22}>{r}</text>
            <text className="sv-lab" x={RX + 50} y={146 + j * 22}>val_mae</text>
            <text className="sv-num" x={DIG_X} y={146 + j * 22} textAnchor="end">1.59182</text>
            <rect className="sd-hl" x={DIG_X - 1} y={146 + j * 22 - 13} width={11} height={17} style={{ fill: 'var(--ink)', opacity: HL }} />
            <text className="sv-num" x={DIG_X} y={146 + j * 22} style={{ fontWeight: 700 }}>{d}</text>
          </g>
        ))}
        <text className="sv-lab" x={RX} y={192}>differ in the sixth decimal place</text>
      </g>

      {/* determinism on */}
      <g className="sd-on" opacity={on(3)}>
        <text className="sv-cap" x={RX} y={224}>Op determinism on · five final runs</text>
        {[0, 1, 2, 3, 4].map((j) => (
          <g key={j} className="sd-chip">
            <rect className="sv-box-strong" x={RX + j * 64} y={236} width={56} height={24} />
            <text className="sv-num" x={RX + j * 64 + 28} y={252} textAnchor="middle">1.250</text>
          </g>
        ))}
        <text className="sv-lab" x={RX} y={278}>model 1’s test MAE, identical in every run</text>
      </g>

      {/* other hardware */}
      <g className="sd-cpu" opacity={on(4)}>
        <text className="sv-cap" x={RX} y={316}>The same notebook on a CPU</text>
        <text className="sv-lab-strong" x={RX} y={338}>GRU models</text>
        <text className="sv-lab" x={RX + 82} y={338}>within 0.001, same stopping epochs</text>
        <text className="sv-lab-strong" x={RX} y={358}>VAE</text>
        <text className="sv-lab" x={RX + 82} y={358}>stopped at 49 (best 29), not 43 (23)</text>
      </g>

      {/* the log lines */}
      <g className="sd-logs" opacity={on(5)}>
        <text className="sv-cap" x={24} y={350}>TensorFlow’s C++ log lines</text>
        {LOG_BARS.map((w, j) => (
          <rect key={j} className="sd-bar" x={24} y={362 + j * 9} width={w} height={4} style={{ fill: 'var(--ink-3)' }} opacity={step >= 5 ? MUTED : 0.8} />
        ))}
        {LOG_LINES.map(([cls, t], j) => (
          <text key={t} className={cls} x={LOG_TX} y={366 + j * 14}>{t}</text>
        ))}
      </g>
    </>
  );
}

// a timeline position: a bare beat label plus ONE summed offset (GSAP keeps only
// the first offset of 'b1+=1+=0.2' and silently drops the rest)
const pos = (label, off = 0) => (off ? `${label}+=${off}` : label);

function build(tl, { q, beat }) {
  const draw = (els, label, dur, off = 0, stagger = 0) =>
    els.forEach((p, i) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, pos(label, off + i * stagger));
    });
  const code = (k, label) => {
    tl.fromTo(q(`.sd-code-${k}`), { opacity: DIM }, { opacity: 1, duration: 0.4 }, label);
    tl.fromTo(q(`.sd-tag-${k}`), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.4 }, pos(label, 0.2));
  };
  tl.set(q('.sd-code'), { opacity: DIM, immediateRender: true }, 0);
  tl.set(q('.sd-tag, .sd-seed, .sd-src, .sd-off, .sd-on, .sd-cpu, .sd-logs'), { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  code('seed', 'b0');
  tl.fromTo(q('.sd-seed'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.3)' }, 'b0+=0.3');

  beat(1, '+=0.7');
  tl.fromTo(q('.sd-src'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b1');
  draw(q('.sd-fan'), 'b1', 0.5, 0, 0.15);
  tl.fromTo(q('.sd-box'), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.15 }, 'b1+=0.3');
  draw(q('.sd-brace'), 'b1', 0.5, 1.0);

  beat(2, '+=0.8');
  tl.fromTo(q('.sd-off'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2');
  tl.fromTo(q('.sd-hl'), { opacity: 0 }, { opacity: HL, duration: 0.3, repeat: 1, yoyo: true, repeatDelay: 0.1 }, 'b2+=0.6');
  tl.fromTo(q('.sd-hl'), { opacity: 0 }, { opacity: HL, duration: 0.3 }, 'b2+=1.4');

  beat(3, '+=1.0');
  code('det', 'b3');
  tl.fromTo(q('.sd-on'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b3+=0.3');
  tl.fromTo(q('.sd-chip'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12 }, 'b3+=0.3');

  beat(4, '+=0.9');
  tl.fromTo(q('.sd-cpu'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b4');

  beat(5, '+=1.0');
  code('log', 'b5');
  tl.fromTo(q('.sd-logs'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b5');
  tl.fromTo(q('.sd-bar'), { opacity: 0, scaleX: 0, transformOrigin: '0% 50%' }, { opacity: 0.8, scaleX: 1, duration: 0.3, stagger: 0.08 }, 'b5');
  tl.fromTo(q('.sd-bar'), { opacity: 0.8 }, { opacity: MUTED, duration: 0.5, immediateRender: false }, 'b5+=1.1');
  tl.to({}, { duration: 1.2 });
}

const BEATS = [
  { t: 'One seed', fx: 0, c: 'keras.utils.set_random_seed(42) seeds Python’s, NumPy’s and TensorFlow’s random number generators in one call.' },
  {
    t: 'Four things it fixes', fx: 0.1,
    c: 'The random starting weights, the order the 1522 training rows are shuffled into each epoch, the VAE’s ε and prior samples, and NumPy’s choice of which rows to plot.',
  },
  {
    t: 'A seed is not enough on a GPU', fx: 1,
    c: 'With op determinism off, the same short run twice gave val_mae 1.591829 and 1.591826. The GPU sums numbers in parallel, the order can change between runs, and floating-point sums depend on the order.',
  },
  { t: 'Determinism on', fx: 1, c: 'enable_op_determinism() switches TensorFlow to deterministic versions of its ops. Five final runs of the notebook printed identical numbers.' },
  {
    t: 'Other hardware still drifts', fx: 1,
    c: 'A CPU run matched every GRU number to within 0.001, but the VAE stopped at epoch 49 (best 29) rather than 43 (best 23). That is why the text quotes the saved run.',
  },
  {
    // fx 0 frames the lit code line, the bars and all five label lines at 390 px
    t: 'Quiet logs', fx: 0,
    c: 'TF_CPP_MIN_LOG_LEVEL = "3" is meant to hide TensorFlow’s log lines, including harmless warnings about compiling GPU kernels. Inside Jupyter the cell line alone did not; the saved run also set it in the kernel’s environment.',
  },
];

export default function SeedScene({ id = 'seed' }) {
  return (
    <Scene
      id={id}
      label="Schematic of the setup cell: seed 42 feeds four random sources; without op determinism two GPU runs differ in the sixth decimal place, with it five runs agree; a CPU run drifts slightly; the log level, also set in the kernel's environment for the saved run, hides TensorFlow's log lines"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
      schematic="boxes and arrows illustrative · run numbers real"
    />
  );
}
