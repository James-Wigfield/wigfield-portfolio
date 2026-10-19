import Scene from '../../scene/Scene';

/* ============================================================================
   SCENES — plate 8·1, what a GRU layer hands back (mechanism)
   ReturnStateScene  'm3-state'    the two encoder layers unrolled over 72
                                    months: return_sequences hands back every
                                    step's output, return_state the final state,
                                    and state k becomes decoder layer k's
                                    initial_state (Out [15] shapes, Connected to)
   SharedLayersScene 'm3-state-b'  the seven layer objects built once and the
                                    three Keras models wired from them (model3,
                                    encoder, decoder), with the call numbers
                                    the summaries print and 5,218 = 2,592 + 2,626
   No values are drawn: a state is shown as 16 empty boxes, never as numbers.
   ========================================================================== */

// ── shared bits ───────────────────────────────────────────────────────────
const headUp = (x, y) => `M${x - 4} ${y + 7}L${x} ${y}L${x + 4} ${y + 7}Z`;
const headRight = (x, y) => `M${x - 7} ${y - 4}L${x} ${y}L${x - 7} ${y + 4}Z`;
const ACC = { fill: 'var(--dlp2-mark)' }; // arrowheads match the sv-accent strokes (ink)
const FAINT = { fill: 'var(--ink-3)' };

// one month as its two channels: min (blue) | max (orange); truth is solid
function Chip({ x, y }) {
  return (
    <g>
      <rect className="sv-fmin" x={x - 9} y={y - 9} width={9} height={18} />
      <rect className="sv-fmax" x={x} y={y - 9} width={9} height={18} />
    </g>
  );
}

// a state: 16 numbers, drawn as 16 empty boxes (no values)
function StateBar({ x, y, cls, op = 1 }) {
  return (
    <g className={cls} opacity={op}>
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} className="sv-fill-ground2" x={x - 4} y={y - 26 + i * 3.25} width={8} height={3.25} style={{ stroke: 'var(--dlp2-mark)', strokeWidth: 0.6 }} />
      ))}
    </g>
  );
}

function drawer(tl) {
  return (el, at, dur = 0.5) => {
    if (!el) return;
    const L = el.getTotalLength();
    tl.fromTo(el, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut', immediateRender: true }, at);
  };
}

/* ============================================================================
   A · return_sequences, return_state and the hand-over
   ========================================================================== */
const W = 800;
const H = 432;
const CW = 44;
const CH = 28;
const COLS = [{ t: 1, x: 80 }, { t: 2, x: 175 }, { gap: true, x: 275 }, { t: 71, x: 375 }, { t: 72, x: 470 }];
const REAL = COLS.filter((c) => !c.gap);
const LASTX = COLS[COLS.length - 1].x;
const RIGHT = LASTX + CW / 2; // right edge of the month-72 cell
const R1 = 306; // encoder_gru1 row
const R2 = 178; // encoder_gru2 row
const IN = 368; // input chips
const SX = 536; // the handed-back states
const BX = 615; // decoder boxes
const BW = 165;
const ENTRY = 40; // where h(0) = 0 enters
const LINK_T = [1, 2, 70, 71];
const UPY = (R1 - CH / 2 + R2 + CH / 2) / 2 + 10; // label height on the up arrows

const edgeR = (c) => c.x + (c.gap ? 18 : CW / 2);
const edgeL = (c) => c.x - (c.gap ? 18 : CW / 2);
const LINKS = COLS.slice(0, -1).map((a, i) => ({ x0: edgeR(a), x1: edgeL(COLS[i + 1]), t: LINK_T[i] }));

function Layer({ y, sup, cls, op = 1 }) {
  return (
    <g className={cls} opacity={op}>
      <text className="sv-lab-strong rs-zero" x={30} y={y + 4} textAnchor="middle">0</text>
      <path className="sv-faint rs-link" d={`M${ENTRY} ${y}H${COLS[0].x - CW / 2}`} />
      {COLS.map((c) =>
        c.gap ? (
          <text key="gap" className="sv-lab rs-dots" x={c.x} y={y + 4} textAnchor="middle">· · ·</text>
        ) : (
          <rect key={c.t} className="sv-box-strong rs-cell" x={c.x - CW / 2} y={y - CH / 2} width={CW} height={CH} rx={3} />
        ),
      )}
      {LINKS.map((l) => (
        <g key={l.t}>
          <path className="sv-faint rs-link" d={`M${l.x0} ${y}H${l.x1}`} />
          <text className="sv-lab rs-hlab" x={(l.x0 + l.x1) / 2} y={y - 7} textAnchor="middle">h{sup}({l.t})</text>
        </g>
      ))}
    </g>
  );
}

function artA(step) {
  const on = (b) => (step >= b ? 1 : 0);
  const midHead = step >= 2 && step < 4 ? 1 : 0; // the states' arrowheads before the hand-over
  return (
    <>
      <text className="sv-cap" x={24} y={24}>Encoder · 72 months</text>
      <text className="sv-cap" x={BX} y={24}>Decoder</text>

      {/* ── beat 0: inputs and layer 1 ── */}
      {REAL.map((c) => (
        <g key={c.t} className="rs-in" opacity={on(0)}>
          <path className="sv-faint" d={`M${c.x} ${IN - 10}V${R1 + CH / 2}`} />
          <Chip x={c.x} y={IN} />
          <text className="sv-lab" x={c.x} y={IN + 26} textAnchor="middle">x({c.t})</text>
        </g>
      ))}
      <text className="sv-lab rs-in" x={COLS[2].x} y={IN + 4} textAnchor="middle" opacity={on(0)}>· · ·</text>
      <Layer y={R1} sup="¹" cls="rs-l1" />
      <text className="sv-lab rs-name1" x={24} y={414} opacity={on(0)}>encoder_gru1: return_sequences=True, return_state=True</text>
      <circle className="sv-accent-fill rs-pulse1" cx={RIGHT} cy={R1} r={4} opacity={0} />

      {/* ── beat 1: return_sequences — every step's output goes up ── */}
      {REAL.map((c, i) => (
        <g key={c.t}>
          <path className="sv-faint rs-up" d={`M${c.x} ${R1 - CH / 2}V${R2 + CH / 2 + 7}`} strokeWidth="1.2" opacity={on(1)} />
          <path className="rs-uphead" d={headUp(c.x, R2 + CH / 2 + 1)} style={FAINT} opacity={on(1)} />
          <text className="sv-lab rs-uplab" x={i < 2 ? c.x - 6 : c.x + 6} y={UPY} textAnchor={i < 2 ? 'end' : 'start'} opacity={on(1)}>h¹({c.t})</text>
        </g>
      ))}
      <g className="rs-seq" opacity={on(1)}>
        <text className="sv-lab-strong" x={COLS[2].x} y={UPY - 14} textAnchor="middle">sequence1</text>
        <text className="sv-lab" x={COLS[2].x} y={UPY} textAnchor="middle">(None, None, 16)</text>
        <text className="sv-lab" x={COLS[2].x} y={UPY + 14} textAnchor="middle">here (N, 72, 16)</text>
      </g>

      {/* ── beat 2: return_state — the final state, handed back separately ── */}
      <path className="sv-accent rs-hl1" d={`M${LASTX} ${R1 - CH / 2}V${R2 + CH / 2 + 7}`} strokeWidth="1.8" opacity={on(2)} />
      <path className="sv-accent rs-s1a" d={`M${RIGHT} ${R1}H${SX - 7}`} strokeWidth="2" opacity={on(2)} />
      <path className="rs-s1h" d={headRight(SX - 5, R1)} style={ACC} opacity={midHead} />
      <StateBar x={SX} y={R1} cls="rs-bar1" op={on(2)} />
      <g className="rs-s1lab" opacity={on(2)}>
        <text className="sv-lab-strong" x={SX} y={R1 - 34} textAnchor="middle">state1</text>
        <text className="sv-lab" x={SX} y={R1 + 42} textAnchor="middle">(None, 16)</text>
        <text className="sv-lab" x={SX} y={R1 + 56} textAnchor="middle">= h¹(72)</text>
      </g>

      {/* ── beat 3: layer 2 — return_state only ── */}
      <Layer y={R2} sup="²" cls="rs-l2" op={on(3)} />
      <text className="sv-lab rs-name2" x={24} y={R2 - 32} opacity={on(3)}>encoder_gru2: return_state=True</text>
      <circle className="sv-accent-fill rs-pulse2" cx={RIGHT} cy={R2} r={4} opacity={0} />
      <path className="sv-faint rs-lastup" d={`M${LASTX} ${R2 - CH / 2}V${R2 - 50}`} strokeWidth="1.2" opacity={on(3)} />
      <path className="rs-lasthead" d={headUp(LASTX, R2 - 56)} style={FAINT} opacity={on(3)} />
      <g className="rs-lastlab" opacity={on(3)}>
        <text className="sv-lab-strong" x={LASTX} y={R2 - 64} textAnchor="middle">_ · (None, 16)</text>
        <text className="sv-lab" x={LASTX} y={R2 - 78} textAnchor="middle">last output, thrown away</text>
      </g>
      <path className="sv-accent rs-s2a" d={`M${RIGHT} ${R2}H${SX - 7}`} strokeWidth="2" opacity={on(3)} />
      <path className="rs-s2h" d={headRight(SX - 5, R2)} style={ACC} opacity={step === 3 ? 1 : 0} />
      <StateBar x={SX} y={R2} cls="rs-bar2" op={on(3)} />
      <g className="rs-s2lab" opacity={on(3)}>
        <text className="sv-lab-strong" x={SX} y={R2 - 34} textAnchor="middle">state2</text>
        <text className="sv-lab" x={SX} y={R2 + 42} textAnchor="middle">(None, 16)</text>
        <text className="sv-lab" x={SX} y={R2 + 56} textAnchor="middle">= h²(72)</text>
      </g>

      {/* ── beat 4: state k → decoder layer k ── */}
      {[R1, R2].map((y, k) => (
        <g key={y}>
          <path className="sv-accent rs-hand" d={`M${SX + 4} ${y}H${BX - 4}`} strokeWidth="2" opacity={on(4)} />
          <path className="rs-handhead" d={headRight(BX - 2, y)} style={ACC} opacity={on(4)} />
          <g className="rs-box" opacity={on(4)}>
            <rect className="sv-box-strong" x={BX} y={y - 22} width={BW} height={44} rx={3} />
            <text className="sv-lab-strong" x={BX + 10} y={y - 4}>decoder_gru{k + 1} · GRU(16)</text>
            <text className="sv-lab" x={BX + 10} y={y + 12}>initial_state=state{k + 1}</text>
          </g>
          <g className="rs-conn" opacity={on(4)}>
            <text className="sv-cap" x={BX} y={y + 40}>Connected to</text>
            <text className="sv-lab-strong" x={BX} y={y + 55}>
              encoder_gru{k + 1}
              <tspan style={{ fill: 'var(--ink-3)' }}>[0]</tspan>
              <tspan style={{ fill: 'var(--ink)', fontWeight: 700 }}>[1]</tspan>
            </text>
          </g>
        </g>
      ))}
      <g className="rs-legend" opacity={on(4)}>
        <text className="sv-lab" x={BX} y={396}>
          <tspan style={{ fill: 'var(--ink-3)', fontWeight: 600 }}>[0]</tspan> first call
        </text>
        <text className="sv-lab" x={BX} y={411}>
          <tspan style={{ fill: 'var(--ink)', fontWeight: 700 }}>[1]</tspan> second output: state
        </text>
      </g>
    </>
  );
}

function buildA(tl, { q, beat }) {
  const draw = drawer(tl);
  // label + one summed offset: GSAP reads 'b0+=0.75+=1.5' as 'b0+=0.75'
  const pulse = (sel, label, start) => {
    const el = q(sel);
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15 }, `${label}+=${start}`);
    tl.fromTo(el, { attr: { cx: ENTRY } }, { attr: { cx: RIGHT }, duration: 1.5, ease: 'none' }, `${label}+=${start}`);
    tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 0.2, immediateRender: false }, `${label}+=${(start + 1.5).toFixed(2)}`);
  };
  tl.set(
    q('.rs-in, .rs-cell, .rs-hlab, .rs-zero, .rs-dots, .rs-name1, .rs-name2, .rs-uphead, .rs-uplab, .rs-seq, .rs-s1h, .rs-bar1 rect, .rs-s1lab, .rs-lasthead, .rs-lastlab, .rs-s2h, .rs-bar2 rect, .rs-s2lab, .rs-handhead, .rs-box, .rs-conn, .rs-legend'),
    { opacity: 0, immediateRender: true },
    0,
  );

  // 0 · layer 1 runs over the months, one state carried along
  beat(0, 0);
  tl.fromTo(q('.rs-in'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 }, 'b0');
  tl.fromTo(q('.rs-l1 .rs-cell, .rs-l1 .rs-dots'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.07 }, 'b0+=0.3');
  tl.fromTo(q('.rs-l1 .rs-zero, .rs-name1'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b0+=0.6');
  q('.rs-l1 .rs-link').forEach((p, i) => draw(p, `b0+=${0.75 + i * 0.28}`, 0.3));
  tl.fromTo(q('.rs-l1 .rs-hlab'), { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.28 }, 'b0+=1.0');
  pulse('.rs-pulse1', 'b0', 0.75);

  // 1 · return_sequences: every step's output, upward
  beat(1, '+=0.5');
  q('.rs-up').forEach((p, i) => draw(p, `b1+=${i * 0.14}`, 0.4));
  tl.fromTo(q('.rs-uphead'), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.14 }, 'b1+=0.35');
  tl.fromTo(q('.rs-uplab'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, 'b1+=0.5');
  tl.fromTo(q('.rs-seq'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5 }, 'b1+=0.9');

  // 2 · return_state: the final state comes out on its own
  beat(2, '+=0.9');
  draw(q('.rs-hl1')[0], 'b2', 0.5);
  draw(q('.rs-s1a')[0], 'b2+=0.4', 0.4);
  tl.fromTo(q('.rs-s1h'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, 'b2+=0.75');
  tl.fromTo(q('.rs-bar1 rect'), { opacity: 0 }, { opacity: 1, duration: 0.12, stagger: 0.025 }, 'b2+=0.8');
  tl.fromTo(q('.rs-s1lab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2+=1.1');

  // 3 · layer 2: reads sequence1, hands back two copies of h²(72)
  beat(3, '+=0.9');
  tl.fromTo(q('.rs-l2 .rs-cell, .rs-l2 .rs-dots'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.07 }, 'b3');
  tl.fromTo(q('.rs-l2 .rs-zero, .rs-name2'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3+=0.3');
  q('.rs-l2 .rs-link').forEach((p, i) => draw(p, `b3+=${0.45 + i * 0.28}`, 0.3));
  tl.fromTo(q('.rs-l2 .rs-hlab'), { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.28 }, 'b3+=0.7');
  pulse('.rs-pulse2', 'b3', 0.45);
  draw(q('.rs-lastup')[0], 'b3+=2.0', 0.35);
  tl.fromTo(q('.rs-lasthead, .rs-lastlab'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3+=2.3');
  draw(q('.rs-s2a')[0], 'b3+=2.4', 0.4);
  tl.fromTo(q('.rs-s2h'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, 'b3+=2.75');
  tl.fromTo(q('.rs-bar2 rect'), { opacity: 0 }, { opacity: 1, duration: 0.12, stagger: 0.025 }, 'b3+=2.8');
  tl.fromTo(q('.rs-s2lab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3+=3.1');

  // 4 · state k starts decoder layer k
  beat(4, '+=1.0');
  tl.fromTo(q('.rs-box'), { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.15 }, 'b4');
  tl.fromTo(q('.rs-s1h, .rs-s2h'), { opacity: 1 }, { opacity: 0, duration: 0.15, immediateRender: false }, 'b4+=0.4');
  q('.rs-hand').forEach((p, i) => draw(p, `b4+=${0.4 + i * 0.2}`, 0.5));
  tl.fromTo(q('.rs-handhead'), { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.2 }, 'b4+=0.85');
  tl.fromTo(q('.rs-conn'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.15 }, 'b4+=1.2');
  tl.fromTo(q('.rs-legend'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4+=1.6');
  tl.to({}, { duration: 1.2 });
}

const BEATS_A = [
  {
    t: 'A GRU layer is a loop',
    fx: 0,
    c: 'encoder_gru1 keeps a 16-number state and updates it once per month: h(t) = z(t) ⊗ h(t−1) + (1 − z(t)) ⊗ g(t). With no initial_state it starts from zeros.',
  },
  {
    t: 'return_sequences=True',
    fx: 0.4,
    c: 'A GRU’s output at month t is its state h(t). return_sequences=True hands back all 72 as sequence1, which layer 2 reads: (None, None, 16), as neither batch nor length is fixed.',
  },
  {
    t: 'return_state=True',
    fx: 0.7,
    c: 'The layer also hands back its final state, state1, shape (None, 16). For a GRU those are the same 16 numbers as the last output: sequence1[:, -1] equals state1.',
  },
  {
    t: 'Layer 2 hands back two copies',
    fx: 0.5,
    c: 'encoder_gru2 has return_state but not return_sequences, so it returns [(None, 16), (None, 16)]: last output and final state, the same numbers. The code keeps one: _, state2 = encoder_gru2(sequence1).',
  },
  {
    t: 'State k starts decoder layer k',
    fx: 0.97,
    c: 'state1 becomes decoder_gru1’s initial_state and state2 decoder_gru2’s, instead of zeros. The summary’s Connected to column writes the first as encoder_gru1[0][1]: that layer’s first call, its second output.',
  },
];

export default function ReturnStateScene({ id = 'm3-state', note }) {
  return (
    <Scene
      id={id}
      label="The two encoder GRU layers unrolled over 72 months: layer 1 returns its full output sequence and its final state, layer 2 returns its last output and its final state, and each final state becomes the initial state of the matching decoder layer"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS_A}
      art={artA}
      build={buildA}
      keyframes={[4]}
      note={note}
    />
  );
}

/* ============================================================================
   B · one set of layers, three Keras models
   ========================================================================== */
const HB = 456;
const ROWS = [
  { name: 'normalization_4', p: '0', sub: 'inputs · °C → z-scores' },
  { name: 'encoder_gru1', p: '960', w: true },
  { name: 'encoder_gru2', p: '1,632', w: true },
  { name: 'decoder_gru1', p: '960', w: true },
  { name: 'decoder_gru2', p: '1,632', w: true },
  { name: 'next_month', p: '34', w: true },
  { name: 'normalization_5', p: '0', sub: 'output · z-scores → °C' },
];
const RY = (i) => 104 + i * 38;
// columns 160 apart, so the three totals and the = and + between them fit in
// the half of the stage a narrow screen shows
const MODELS = [
  { key: 'm', name: 'model3', role: 'training', x: 320, calls: ['[0] [1]', '[0]', '[0]', '[0]', '[0]', '[0]', 'used'], total: '5,218', io: ['in: 72 + 12 months', 'out: 12 months'] },
  { key: 'e', name: 'encoder', role: 'inference', x: 480, calls: ['used', 'used', 'used', null, null, null, null], total: '2,592', io: ['in: 72 months', 'out: state1, state2'] },
  { key: 'd', name: 'decoder', role: 'inference', x: 640, calls: ['[2]', null, null, '[1]', '[1]', '[1]', 'used'], total: '2,626', io: ['in: 1 month + 2 states', 'out: 1 month + 2 states'] },
];
const CHW = 74;
const TOT = 428;

function artB(step) {
  const on = (b) => (step >= b ? 1 : 0);
  return (
    <>
      <text className="sv-cap" x={24} y={24}>One set of layers · three models</text>

      {/* ── beat 0: the layer objects ── */}
      <g className="sl-rows" opacity={on(0)}>
        <text className="sv-cap" x={24} y={78}>Layer object</text>
        <text className="sv-cap" x={200} y={78} textAnchor="end">Params</text>
        <line className="sv-axis" x1={20} x2={782} y1={RY(0) - 19} y2={RY(0) - 19} />
        {ROWS.map((r, i) => (
          <g key={r.name}>
            <line className="sv-grid" x1={20} x2={782} y1={RY(i) + 19} y2={RY(i) + 19} />
            <line className="sv-grid sl-rail" x1={214} x2={782} y1={RY(i)} y2={RY(i)} />
            {/* the two scaling layers carry a second line saying which way they scale */}
            <text className="sv-lab-strong" x={24} y={RY(i) + (r.sub ? -2 : 4)}>{r.name}</text>
            {r.sub && <text className="sv-cap-code" x={24} y={RY(i) + 12}>{r.sub}</text>}
            <text className="sv-num" x={200} y={RY(i) + 4} textAnchor="end">{r.p}</text>
          </g>
        ))}
        <line className="sv-axis" x1={20} x2={782} y1={RY(6) + 19} y2={RY(6) + 19} />
      </g>

      {/* ── beats 1–3: one column per Keras model ── */}
      {MODELS.map((m, j) => (
        <g key={m.key}>
          <g className={`sl-head sl-head-${m.key}`} opacity={on(j + 1)}>
            <text className="sv-title" x={m.x} y={40} textAnchor="middle">{m.name}</text>
            <text className="sv-cap" x={m.x} y={58} textAnchor="middle">{m.role}</text>
          </g>
          {m.calls.map((c, i) =>
            c ? (
              <g key={i} className={`sl-chip sl-chip-${m.key}`} opacity={on(j + 1)}>
                <rect className="sv-box-strong" x={m.x - CHW / 2} y={RY(i) - 12} width={CHW} height={24} rx={3} />
                <text className="sv-lab-strong" x={m.x} y={RY(i) + 4} textAnchor="middle">{c}</text>
              </g>
            ) : null,
          )}
          <g className={`sl-io sl-io-${m.key}`} opacity={on(j + 1)}>
            <text className="sv-lab" x={m.x} y={378} textAnchor="middle">{m.io[0]}</text>
            <text className="sv-lab" x={m.x} y={392} textAnchor="middle">{m.io[1]}</text>
            <text className="sv-big" x={m.x} y={TOT} textAnchor="middle">{m.total}</text>
            <text className="sv-cap" x={m.x} y={TOT + 18} textAnchor="middle">params</text>
          </g>
        </g>
      ))}

      {/* ── beat 4: one set of weights, trained through model3 ── */}
      <g className="sl-train" opacity={on(4)}>
        {ROWS.map((r, i) =>
          r.w ? (
            <g key={r.name}>
              <circle className="sv-accent-fill" cx={13} cy={RY(i)} r={3.5} />
              {MODELS.filter((m) => m.calls[i]).map((m) => (
                <circle key={m.key} className="sv-accent-fill" cx={m.x + CHW / 2} cy={RY(i) - 12} r={3.5} />
              ))}
            </g>
          ) : null,
        )}
        <circle className="sv-accent-fill" cx={28} cy={374} r={3.5} />
        <text className="sv-lab" x={38} y={378}>one set of weights,</text>
        <text className="sv-lab" x={38} y={392}>trained through model3</text>
        <text className="sv-big" x={(MODELS[0].x + MODELS[1].x) / 2} y={TOT} textAnchor="middle">=</text>
        <text className="sv-big" x={(MODELS[1].x + MODELS[2].x) / 2} y={TOT} textAnchor="middle">+</text>
      </g>
    </>
  );
}

function buildB(tl, { q, beat }) {
  tl.set(q('.sl-rows, .sl-head, .sl-chip, .sl-io, .sl-train'), { opacity: 0, immediateRender: true }, 0);

  beat(0, 0);
  tl.fromTo(q('.sl-rows'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'b0');
  q('.sl-rail').forEach((p, i) => {
    tl.fromTo(p, { attr: { x2: 214 } }, { attr: { x2: 782 }, duration: 0.6, ease: 'power2.out' }, `b0+=${0.3 + i * 0.08}`);
  });

  MODELS.forEach((m, j) => {
    const b = `b${j + 1}`;
    beat(j + 1, j === 0 ? '+=0.6' : '+=1.0');
    tl.fromTo(q(`.sl-head-${m.key}`), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.4 }, b);
    tl.fromTo(q(`.sl-chip-${m.key}`), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.09 }, `${b}+=0.25`);
    tl.fromTo(q(`.sl-io-${m.key}`), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45 }, `${b}+=0.9`);
  });

  beat(4, '+=1.0');
  tl.fromTo(q('.sl-train circle'), { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.04 }, 'b4');
  tl.fromTo(q('.sl-train text'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12 }, 'b4+=0.6');
  tl.fromTo(q('.sl-train'), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 'b4');
  tl.to({}, { duration: 1.2 });
}

const BEATS_B = [
  {
    t: 'One set of layers',
    fx: 0,
    c: 'build_encoder_decoder creates each layer once, and the layer object owns its weights: 960 per first GRU layer, 1,632 per second, 34 for the Dense, none for the two scaling layers.',
  },
  {
    t: 'model3, for training',
    fx: 0,
    c: 'The training model calls every layer once, and the shared input scaling layer twice, once per input: 72 encoder months and 12 teacher-forced decoder months in, 12 months out. 5,218 parameters.',
  },
  {
    t: 'encoder, for inference',
    fx: 0.6,
    c: 'keras.Model(encoder_input, [state1, state2]) is cut out of model3’s own graph, so it adds no new calls; it just ends at the two states. 2,592 parameters.',
  },
  {
    t: 'decoder, for inference',
    fx: 1,
    c: 'The one-step decoder calls the decoder layers a second time on new inputs, one month and two states, which is why its summary shows decoder_gru1[1][0] and normalization_4[2][0]. 2,626 parameters.',
  },
  {
    t: 'Train one, train all three',
    fx: 0.7,
    c: 'fit sees only model3, but the weights live in the layers, so encoder and decoder already have them. Each weighted layer is in exactly one: 5,218 = 2,592 + 2,626.',
  },
];

export function SharedLayersScene({ id = 'm3-state-b', note }) {
  return (
    <Scene
      id={id}
      label="Seven layer objects built once and the three Keras models wired from them: model3 for training uses all of them, the encoder uses the scaling layer and both encoder GRUs, and the one-step decoder calls the scaling layer, both decoder GRUs and the Dense layer again; 5,218 parameters equal 2,592 plus 2,626"
      viewBox={`0 0 ${W} ${HB}`}
      beats={BEATS_B}
      art={artB}
      build={buildB}
      keyframes={[4]}
      note={note}
    />
  );
}
