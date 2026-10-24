import { createContext, useContext } from 'react';

/* ============================================================================
   LECTURE 9 STUDY — LINE-ART DIAGRAMS (the notebook pages)
   ----------------------------------------------------------------------------
   One monochrome line-art SVG per figure worth drawing by hand: boxes,
   circles, arrows and short labels in currentColor, no fills or shading, so
   each can be copied onto paper in a minute or two. <Diagram fig="…" />
   picks one.

     birnn        Figure 16-5: forward and backward cells per step, joined
                  (concatenated) into one output
     bahdanau     Figure 16-7, simplified: y(0..2) weighted by α(3,i) into ⊕
                  and up to the decoder; the alignment model beside it
     transformer  Figure 16-8, simplified: where Q, K and V come from
     pewave       slide 33's idea: fast waves for small i, slow for large i
     sdpa         slides 37–38: QKᵀ → ÷ √d_keys → softmax → × V, with shapes
     mha          Figure 16-10: Linear → Split → H × attention → Concat →
                  Linear
     mask         slide 31: the causal mask as a triangle
     vit          slide 46: 16 × 16 patches → 768 → linear → + position →
                  transformer

   Highlighting: <Diagram fig="…" hl={['…']} sheet /> draws the named parts
   (<P k="…">) in the notebook's green pen. The part keys per figure are
   listed in ./sheets/figParts.js (page-check.mjs compares both sides).
   ========================================================================== */

const SW = 1.4;
const HlCtx = createContext(null);
const NO_HL = [];

function P({ k, children }) {
  const hl = useContext(HlCtx);
  if (!hl) return children;
  return <g className={hl.includes(k) ? 'dl9s-fig__hl' : undefined} data-part={k}>{children}</g>;
}

function Arrow({ x1, y1, x2, y2, dashed = false, head = 5 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${x2 - head * Math.cos(a + d)},${y2 - head * Math.sin(a + d)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? '4 3' : undefined} />
      <polyline points={`${p(0.45)} ${x2},${y2} ${p(-0.45)}`} />
    </g>
  );
}

// an arrowhead at the end of a path that arrives heading `dir` (radians)
function Head({ x, y, dir, size = 5 }) {
  const p = (d) => `${x - size * Math.cos(dir + d)},${y - size * Math.sin(dir + d)}`;
  return <polyline points={`${p(0.45)} ${x},${y} ${p(-0.45)}`} />;
}

function T({ x, y, children, a = 'middle', s = 10.5, i = false, b = false }) {
  return (
    <text x={x} y={y} textAnchor={a} fontSize={s} fontStyle={i ? 'italic' : undefined} fontWeight={b ? 700 : undefined} className="dl9s-fig__t">
      {children}
    </text>
  );
}

function Box({ x, y, w, h = 20, label, s = 10, r = 4 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} />
      {label && <T x={x + w / 2} y={y + h / 2 + 3.6} s={s}>{label}</T>}
    </g>
  );
}

// `wide`: a long left-to-right figure; on a narrow notebook page it keeps a
// readable size and scrolls sideways instead of shrinking
function Svg({ w, h, label, wide = false, children }) {
  const hl = useContext(HlCtx);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`dl9s-fig${hl ? ' dl9s-fig--hl' : ''}`} data-wide={wide ? '' : undefined} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/* §2 — Figure 16-5: a bidirectional recurrent layer */
function BiRnn() {
  const cols = [70, 180, 290];
  const yc = 100; // cell top
  const ch = 26;
  return (
    <Svg w={360} h={214} label="A bidirectional layer: at each of three steps a forward cell and a backward cell read the input x(t); forward cells are chained left to right along the bottom, backward cells right to left along the top; the two outputs at each step are concatenated into y-hat(t)">
      {cols.map((cx, t) => (
        <g key={cx}>
          {/* input forks into both cells */}
          <line x1={cx} y1={190} x2={cx} y2={160} />
          <Arrow x1={cx} y1={160} x2={cx - 19} y2={yc + ch + 1} head={4} />
          <Arrow x1={cx} y1={160} x2={cx + 19} y2={yc + ch + 1} head={4} />
          <T x={cx} y={204} i>x({t})</T>
          <P k="fwd"><Box x={cx - 34} y={yc} w={30} h={ch} label="→" s={11} /></P>
          <P k="bwd"><Box x={cx + 4} y={yc} w={30} h={ch} label="←" s={11} /></P>
          <P k="cat">
            <line x1={cx - 19} y1={yc} x2={cx} y2={70} />
            <line x1={cx + 19} y1={yc} x2={cx} y2={70} />
            <circle cx={cx} cy={70} r={2.4} />
            <Arrow x1={cx} y1={70} x2={cx} y2={42} head={4} />
            <T x={cx} y={34} i>ŷ({t})</T>
          </P>
        </g>
      ))}
      {/* forward chain along the bottom, backward chain along the top */}
      <P k="fwd">
        {[0, 1].map((t) => (
          <g key={`f${t}`}>
            <path d={`M${cols[t] - 19} ${yc + ch} V ${yc + ch + 12} H ${cols[t + 1] - 19} V ${yc + ch + 3}`} />
            <Head x={cols[t + 1] - 19} y={yc + ch + 3} dir={-Math.PI / 2} size={4} />
          </g>
        ))}
        <T x={344} y={yc + ch + 16} a="end" s={9.5}>forward</T>
      </P>
      <P k="bwd">
        {[0, 1].map((t) => (
          <g key={`b${t}`}>
            <path d={`M${cols[t + 1] + 19} ${yc} V ${yc - 12} H ${cols[t] + 19} V ${yc - 3}`} />
            <Head x={cols[t] + 19} y={yc - 3} dir={Math.PI / 2} size={4} />
          </g>
        ))}
        <T x={16} y={yc - 16} a="start" s={9.5}>backward</T>
      </P>
      <P k="cat"><T x={300} y={74} a="start" s={9.5}>concatenate</T></P>
    </Svg>
  );
}

/* §6 — Figure 16-7, simplified */
function Bahdanau() {
  const ys = [50, 120, 190];
  return (
    <Svg w={400} h={236} label="Bahdanau attention at decoder step 3: the encoder outputs y(0), y(1), y(2) are multiplied by the weights alpha(3,0), alpha(3,1), alpha(3,2) and summed at a plus node that feeds the decoder cell, which outputs fútbol; beside it, the alignment model: h(2) and each y(i) go into a one-neuron Dense layer giving scores e(3,i), then a softmax gives the weights alpha(3,i)">
      {/* encoder outputs */}
      {ys.map((x, i) => (
        <g key={x}>
          <Box x={x - 24} y={196} w={48} h={20} />
          <T x={x} y={230} i s={10}>y({i})</T>
        </g>
      ))}
      <T x={4} y={186} a="start" s={10}>encoder</T>
      {/* weighted lines up to ⊕ */}
      <P k="sum">
        {ys.map((x, i) => <line key={x} x1={x} y1={196} x2={120} y2={124} strokeWidth={i === 2 ? 3 : 1} />)}
        <T x={36} y={166} a="start" s={10} i>×α(3,0)</T>
        <T x={128} y={170} a="start" s={10} i>×α(3,1)</T>
        <T x={176} y={150} a="start" s={10} i>×α(3,2)</T>
        <circle cx={120} cy={114} r={10} />
        <line x1={114} y1={114} x2={126} y2={114} />
        <line x1={120} y1={108} x2={120} y2={120} />
        <Arrow x1={120} y1={104} x2={120} y2={78} head={4} />
      </P>
      <Box x={84} y={50} w={72} h={26} label="decoder" />
      <T x={170} y={66} a="start" s={10} i>step 3</T>
      <Arrow x1={120} y1={50} x2={120} y2={28} head={4} />
      <T x={120} y={20} i>fútbol</T>
      {/* the alignment model */}
      <P k="align">
        <rect x={238} y={14} width={154} height={214} rx={6} strokeDasharray="4 3" />
        <T x={246} y={222} a="start" s={10}>alignment model</T>
        <T x={315} y={202} s={9.5} i>h(2) and each y(i)</T>
        <Arrow x1={315} y1={192} x2={315} y2={172} head={4} />
        <Box x={258} y={148} w={114} h={22} label="Dense (1 neuron)" s={9.5} />
        <Arrow x1={315} y1={148} x2={315} y2={128} head={4} />
        <T x={315} y={120} s={9.5} i>scores e(3,i)</T>
        <Arrow x1={315} y1={110} x2={315} y2={92} head={4} />
        <Box x={276} y={68} w={78} h={22} label="softmax" s={9.5} />
        <Arrow x1={315} y1={68} x2={315} y2={48} head={4} />
        <T x={315} y={40} s={9.5} i>weights α(3,i)</T>
      </P>
      <Arrow x1={262} y1={36} x2={196} y2={146} dashed head={4} />
    </Svg>
  );
}

/* §9 — Figure 16-8, simplified */
function Transformer() {
  const E = 92; // encoder centre
  const D = 300; // decoder centre
  const bw = 132;
  return (
    <Svg w={400} h={372} label="The transformer, simplified: the encoder (inputs, embedding plus positional encoding, then N layers of multi-head attention, add and norm, feed forward, add and norm); the decoder (outputs shifted right, embedding plus positional encoding, then N layers of masked multi-head attention, add and norm, multi-head attention whose keys and values come from the encoder's output and whose queries come from the decoder, add and norm, feed forward, add and norm), then linear and softmax">
      {/* encoder */}
      <P k="enc">
        <T x={E} y={362} s={9.5}>inputs</T>
        <Arrow x1={E} y1={352} x2={E} y2={334} head={4} />
        <Box x={E - bw / 2} y={312} w={bw} h={22} label="Input Embedding" s={9.5} />
      </P>
      <P k="pe">
        <Arrow x1={E} y1={312} x2={E} y2={290} head={4} />
        <circle cx={E} cy={282} r={8} />
        <line x1={E - 5} y1={282} x2={E + 5} y2={282} />
        <line x1={E} y1={277} x2={E} y2={287} />
        <T x={E - 14} y={286} a="end" s={10}>position</T>
      </P>
      <P k="enc">
        <Arrow x1={E} y1={274} x2={E} y2={250} head={4} />
        <rect x={E - bw / 2 - 8} y={118} width={bw + 16} height={132} rx={8} strokeDasharray="5 3" />
        <T x={E - bw / 2 - 12} y={186} a="end" s={10} b>N×</T>
        <Box x={E - bw / 2} y={222} w={bw} h={22} label="Multi-Head Attention" s={9.5} />
        <Box x={E - bw / 2} y={194} w={bw} h={20} label="Add & Norm" s={10} />
        <Box x={E - bw / 2} y={158} w={bw} h={22} label="Feed Forward" s={9.5} />
        <Box x={E - bw / 2} y={130} w={bw} h={20} label="Add & Norm" s={10} />
        <T x={E - 6} y={114} a="end" s={10} i>encoder output</T>
      </P>
      {/* decoder */}
      <P k="dec">
        <T x={D} y={362} s={9.5}>outputs (shifted right)</T>
        <Arrow x1={D} y1={352} x2={D} y2={334} head={4} />
        <Box x={D - bw / 2} y={312} w={bw} h={22} label="Output Embedding" s={9.5} />
      </P>
      <P k="pe">
        <Arrow x1={D} y1={312} x2={D} y2={300} head={4} />
        <circle cx={D} cy={292} r={8} />
        <line x1={D - 5} y1={292} x2={D + 5} y2={292} />
        <line x1={D} y1={287} x2={D} y2={297} />
      </P>
      <P k="dec">
        <Arrow x1={D} y1={284} x2={D} y2={274} head={4} />
        <rect x={D - bw / 2 - 8} y={62} width={bw + 16} height={212} rx={8} strokeDasharray="5 3" />
        <T x={D + bw / 2 + 12} y={170} a="start" s={10} b>N×</T>
        <Box x={D - bw / 2} y={246} w={bw} h={22} label="Masked Multi-Head Att." s={9.5} />
        <Box x={D - bw / 2} y={220} w={bw} h={20} label="Add & Norm" s={10} />
        <Box x={D - bw / 2} y={170} w={bw} h={22} label="Multi-Head Attention" s={9.5} />
        <Box x={D - bw / 2} y={144} w={bw} h={20} label="Add & Norm" s={10} />
        <Box x={D - bw / 2} y={102} w={bw} h={22} label="Feed Forward" s={9.5} />
        <Box x={D - bw / 2} y={76} w={bw} h={20} label="Add & Norm" s={10} />
        <Arrow x1={D} y1={62} x2={D} y2={50} head={4} />
        <Box x={D - 40} y={28} w={80} h={20} label="Linear" s={9.5} />
        <Box x={D - 40} y={4} w={80} h={20} label="Softmax" s={9.5} />
      </P>
      {/* cross-attention: keys and values from the encoder, queries from the decoder */}
      <P k="cross">
        {/* the encoder's output runs round the outside of the decoder box,
            then up into the attention block: keys and values */}
        <path d={`M${E} 118 V 104 H ${D - bw / 2 - 18} V 206 H ${D - 30} V 194`} />
        <Head x={D - 30} y={193} dir={-Math.PI / 2} size={4} />
        <path d={`M${D - 50} 206 V 194`} />
        <Head x={D - 50} y={193} dir={-Math.PI / 2} size={4} />
        <T x={D - bw / 2 - 22} y={222} a="end" s={9.5} i>K, V</T>
        <Arrow x1={D + 40} y1={220} x2={D + 40} y2={193} head={4} />
        <T x={D + 48} y={212} a="start" s={9.5} i>Q</T>
      </P>
    </Svg>
  );
}

/* §10 — positional encodings: fast waves for small i, slow for large i */
function PeWave() {
  const x0 = 30;
  const x1 = 330;
  const wave = (yc, amp, period) => {
    const pts = [];
    for (let x = x0; x <= x1; x += 3) pts.push(`${x},${(yc - amp * Math.sin(((x - x0) / period) * 2 * Math.PI)).toFixed(1)}`);
    return pts.join(' ');
  };
  return (
    <Svg w={350} h={170} label="Positional encodings: along position p, component i of the encoding is a sine or cosine wave; small i oscillates fast, large i slowly; a vertical line at one position cuts every wave, and those values are that position's encoding">
      <line x1={x0} y1={150} x2={x1} y2={150} />
      <T x={x1} y={164} a="end" s={9.5} i>position p</T>
      <P k="fast">
        <polyline points={wave(48, 18, 40)} />
        <T x={x0 - 4} y={52} a="end" s={10} i>small i</T>
      </P>
      <P k="slow">
        <polyline points={wave(108, 18, 520)} />
        <T x={x0 - 4} y={112} a="end" s={10} i>large i</T>
      </P>
      <P k="col">
        <line x1={196} y1={20} x2={196} y2={150} strokeDasharray="4 3" />
        <circle cx={196} cy={48 - 18 * Math.sin(((196 - x0) / 40) * 2 * Math.PI)} r={3} />
        <circle cx={196} cy={108 - 18 * Math.sin(((196 - x0) / 520) * 2 * Math.PI)} r={3} />
        <T x={202} y={16} a="start" s={10}>one position: its encoding</T>
      </P>
    </Svg>
  );
}

/* §11 — scaled dot-product attention, with shapes (the slides' own names) */
function Sdpa() {
  return (
    <Svg w={520} h={140} wide label="Scaled dot-product attention: Q [n_queries, d_keys] times K transposed gives Q K-transpose [n_queries, n_keys]; divide by the square root of d_keys; softmax along each row so the rows add up to 1; multiply by V [n_keys, d_values]; the output is [n_queries, d_values]">
      <Box x={40} y={14} w={56} h={22} label="Q" s={10.5} />
      <T x={68} y={48} s={10.5}>[n_queries, d_keys]</T>
      <Box x={40} y={74} w={56} h={22} label="K" s={10.5} />
      <T x={68} y={108} s={10.5}>[n_keys, d_keys]</T>
      <P k="scores">
        <line x1={96} y1={25} x2={130} y2={52} />
        <line x1={96} y1={85} x2={130} y2={58} />
        <Box x={130} y={44} w={56} h={22} label="QKᵀ" s={10.5} />
        <T x={158} y={80} s={10.5}>[n_queries, n_keys]</T>
      </P>
      <P k="scale">
        <Arrow x1={186} y1={55} x2={204} y2={55} head={4} />
        <Box x={204} y={44} w={58} h={22} label="÷ √d_keys" s={9.5} />
      </P>
      <P k="soft">
        <Arrow x1={262} y1={55} x2={278} y2={55} head={4} />
        <Box x={278} y={44} w={62} h={22} label="softmax" s={10} />
        <T x={309} y={80} s={10.5}>rows sum to 1</T>
      </P>
      <P k="out">
        <Arrow x1={340} y1={55} x2={356} y2={55} head={4} />
        <Box x={356} y={44} w={34} h={22} label="× V" s={10} />
        <T x={373} y={128} s={10.5}>V [n_keys, d_values]</T>
        <Arrow x1={373} y1={116} x2={373} y2={68} head={4} />
        <Arrow x1={390} y1={55} x2={406} y2={55} head={4} />
        <T x={460} y={52} s={10.5}>output</T>
        <T x={460} y={68} s={10.5}>[n_queries, d_values]</T>
      </P>
    </Svg>
  );
}

/* §12 — Figure 16-10, multi-head attention */
function Mha() {
  const xs = [70, 150, 230];
  const names = ['V', 'K', 'Q'];
  return (
    <Svg w={300} h={250} label="Multi-head attention, bottom to top: V, K and Q each go through a Linear layer, then a Split; the parts go through H scaled dot-product attention layers; the results are concatenated and go through a final Linear layer">
      {xs.map((x, i) => (
        <g key={x}>
          <T x={x} y={244} s={11} b>{names[i]}</T>
          <Arrow x1={x} y1={232} x2={x} y2={218} head={4} />
          <P k="lin"><Box x={x - 30} y={196} w={60} h={22} label="Linear" s={9.5} /></P>
          <Arrow x1={x} y1={196} x2={x} y2={182} head={4} />
          <P k="split"><Box x={x - 30} y={160} w={60} h={22} label="Split" s={9.5} /></P>
          <Arrow x1={x} y1={160} x2={x} y2={136} head={4} />
        </g>
      ))}
      <P k="att">
        <rect x={52} y={108} width={196} height={28} rx={5} strokeDasharray="3 3" transform="translate(8 -8)" />
        <Box x={52} y={108} w={196} h={28} label="Scaled Dot-Product Attention" s={10} />
        <T x={262} y={112} a="start" s={11} b>H</T>
      </P>
      <Arrow x1={150} y1={100} x2={150} y2={80} head={4} />
      <P k="concat"><Box x={110} y={58} w={80} h={22} label="Concat" s={9.5} /></P>
      <Arrow x1={150} y1={58} x2={150} y2={44} head={4} />
      <Box x={110} y={22} w={80} h={22} label="Linear" s={9.5} />
      <Arrow x1={150} y1={22} x2={150} y2={6} head={4} />
    </Svg>
  );
}

/* §13 — the causal mask */
function Mask() {
  const words = ['⟨SOS⟩', 'me', 'gusta', 'el'];
  const x0 = 70;
  const y0 = 40;
  const c = 30;
  return (
    <Svg w={230} h={192} label="The causal mask: a 4 by 4 grid over the decoder inputs SOS, me, gusta, el; rows are the word being processed, columns what it may attend to; cells on and below the diagonal are allowed, cells above it are crossed out">
      {words.map((w, i) => (
        <g key={w}>
          <T x={x0 - 6} y={y0 + i * c + c / 2 + 4} a="end" s={9.5} i>{w}</T>
          <T x={x0 + i * c + c / 2} y={y0 - 8} s={10} i>{w}</T>
          {words.map((_, j) => (
            <g key={j}>
              <rect x={x0 + j * c} y={y0 + i * c} width={c} height={c} />
              {j > i && (
                <P k="mask">
                  <line x1={x0 + j * c + 6} y1={y0 + i * c + 6} x2={x0 + j * c + c - 6} y2={y0 + i * c + c - 6} />
                  <line x1={x0 + j * c + c - 6} y1={y0 + i * c + 6} x2={x0 + j * c + 6} y2={y0 + i * c + c - 6} />
                </P>
              )}
              {j <= i && <P k="ok"><circle cx={x0 + j * c + c / 2} cy={y0 + i * c + c / 2} r={3} /></P>}
            </g>
          ))}
        </g>
      ))}
      <T x={x0 + 2 * c} y={y0 + 4 * c + 18} s={10}>can attend to: itself and earlier words</T>
    </Svg>
  );
}

/* §15 — ViT patching */
function Vit() {
  return (
    <Svg w={430} h={128} wide label="The vision transformer: the image is cut into 16 by 16 squares; the squares form a sequence; each is flattened to 16 times 16 times 3 equals 768 numbers; a linear layer keeps 768; positional embeddings are added; the result goes into the transformer">
      <P k="patch">
        <rect x={6} y={20} width={72} height={72} />
        {[18, 36, 54].map((d) => (
          <g key={d}>
            <line x1={6 + d} y1={20} x2={6 + d} y2={92} />
            <line x1={6} y1={20 + d} x2={78} y2={20 + d} />
          </g>
        ))}
        <T x={42} y={108} s={10}>16 × 16 squares</T>
      </P>
      <Arrow x1={84} y1={56} x2={104} y2={56} head={4} />
      <P k="patch">
        {[0, 1, 2, 3].map((k) => <rect key={k} x={108 + k * 20} y={46} width={16} height={16} />)}
        <T x={150} y={40} s={10}>a sequence</T>
      </P>
      <Arrow x1={190} y1={56} x2={206} y2={56} head={4} />
      <P k="flat">
        <rect x={208} y={30} width={10} height={54} />
        <T x={213} y={100} s={10}>16 × 16 × 3</T>
        <T x={213} y={112} s={10} b>= 768</T>
      </P>
      <Arrow x1={222} y1={56} x2={238} y2={56} head={4} />
      <Box x={240} y={44} w={56} h={24} label="Linear" s={9.5} />
      <T x={268} y={84} s={9.5}>keeps 768</T>
      <Arrow x1={296} y1={56} x2={312} y2={56} head={4} />
      <P k="pos">
        <circle cx={320} cy={56} r={8} />
        <line x1={315} y1={56} x2={325} y2={56} />
        <line x1={320} y1={51} x2={320} y2={61} />
        <T x={320} y={84} s={9.5}>+ position</T>
      </P>
      <Arrow x1={328} y1={56} x2={344} y2={56} head={4} />
      <Box x={346} y={42} w={78} h={28} label="Transformer" s={9.5} />
    </Svg>
  );
}

const FIGS = {
  birnn: BiRnn,
  bahdanau: Bahdanau,
  transformer: Transformer,
  pewave: PeWave,
  sdpa: Sdpa,
  mha: Mha,
  mask: Mask,
  vit: Vit,
};

export function Diagram({ fig, sheet = false, lab = false, hl = NO_HL }) {
  const Fig = FIGS[fig];
  if (!Fig) return null;
  if (!sheet && !lab) return <Fig />;
  return (
    <span className={lab ? 'dl9s-figwrap dl9s-figwrap--lab' : 'dl9s-figwrap dl9s-figwrap--sheet'}>
      <HlCtx.Provider value={hl}>
        <Fig />
      </HlCtx.Provider>
    </span>
  );
}
