import { useId, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Token, Cone, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { cellFill } from '../svgFill';
import { fmt, fmtVec, pct } from '../attn';
import { Code } from '../../kit';
import { NAMED_CODE } from '../slideData';
import { GRAMMAR, isValidSentence, referenceTranslation } from '../toyMT';
import { mapGeom, plain, arrowUp, arrowRight, arrowDown } from './fig168Geom';
import { Wire, FigBlock, PEGlyph } from './fig168';
import { Seg, ToyWait, HatchDef } from './toyParts';
import { useToyMT, translateCached, headRows, HEADS, headName, tokName, argmax } from './toyLoad';
import './labsTransformer.css';

/* ============================================================================
   §9 · THE TRANSFORMER: OVERVIEW  (slides 29–31, 40; Figure 16-8)
   §14 · IMPLEMENTING THE TRANSFORMER IN KERAS  (slide 43)
   ----------------------------------------------------------------------------
   TransformerMapLab  Figure 16-8 redrawn as outlined blocks (encoder left,
                      decoder right, N× stacks). Hover / focus / tap a block
                      → one sentence from slides 30–31 / 40 / 41. The chosen
                      attention block's three arrows light up: the first two
                      (keys, values — never which is which) and the third
                      (queries), slide 31. Opens with the decoder's upper
                      attention chosen: encoder → keys, values; decoder →
                      queries. Story: a tensor travels up, embed + position →
                      encoder → decoder → linear + softmax, with slide 30's
                      shape tag unchanged all the way. N = 6 / N = 2.
   CodeMapLab         slide 43's code, verbatim, beside one encoder layer.
                      Hover a line (or ↑/↓) → its part of the layer lights.
                      The layers the slide leaves out are dashed.
   ToyTransformerLab  this page's own trained toy transformer, live: build an
                      English sentence from its grammar by clicking the words;
                      the Spanish comes out and the cross-attention shows as
                      cones from the Spanish word being written.
   ========================================================================== */

const ATTN_TEX = '\\text{Attention}(\\mathbf{Q},\\mathbf{K},\\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^\\top}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}';
const spread = (n, a, b) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1)));

/* ── §9 · the map ──────────────────────────────────────────────────────── */
const MAP_BEATS = [
  { label: 'embed + position', say: 'Each embedding layer outputs a 3D tensor of shape [batch size, sequence length, embedding size]; ⊕ adds the positional encodings.' },
  { label: 'encoder', say: 'The encoder’s layers transform the tensor, but its shape remains the same (slide 30).' },
  { label: 'decoder', say: 'The decoder’s layers do the same, and read the encoder’s output through the upper attention.' },
  { label: 'linear + softmax', say: 'Linear and softmax turn the decoder’s output into output probabilities over the Spanish vocabulary.' },
];

const SENT = {
  emb: '**Embedding.** Each embedding layer outputs a 3D tensor of shape [batch size, sequence length, embedding size] (slide 30).',
  pe: '**Positional encoding.** Dense vectors (much like word embeddings) that represent the position of each word in the sentence; each is added to its word’s embedding (slides 31–32).',
  encMHA: '**Multi-Head Attention (encoder).** Self-attention: it updates each word representation by attending to all other words in the same sentence, so all three arrows come from one line (slides 31, 40).',
  an: '**Add & Norm.** A skip connection followed by Addition and Normalisation (slide 30).',
  ff: '**Feed Forward.** Two Dense layers: the first uses ReLU, the second has no activation function (slide 30).',
  decMMHA: '**Masked Multi-Head Attention.** Like the encoder’s, but when it processes a word it doesn’t attend to words located after it: a causal layer (slide 31).',
  decCross: '**Multi-Head Attention (decoder, upper).** Cross-attention, where the decoder pays attention to the words in the English sentence: keys and values from the encoder, queries from the decoder (slides 31, 40).',
  linear: '**Linear.** With the softmax above it, it turns the decoder’s output into the output probabilities (Figure 16-8).',
  softmax: '**Softmax.** It has many neurons, corresponding to the vocabulary size of the target language (slide 41).',
};
const KIND = {
  encEmb: 'emb', decEmb: 'emb', encPE: 'pe', decPE: 'pe', encMHA: 'encMHA', encAN1: 'an', encFF: 'ff', encAN2: 'an',
  decMMHA: 'decMMHA', decAN1: 'an', decCross: 'decCross', decAN2: 'an', decFF: 'ff', decAN3: 'an', linear: 'linear', softmax: 'softmax',
};
const SIDE_NAME = { enc: 'encoder', dec: 'decoder', out: 'output', pos: 'positional encoding' };
// slide 31: the first two arrows into each multi-head attention layer are
// the keys and values (which is which is not said), the third the queries
const ARROW_ROLES = {
  encMHA: { 'e.fanL': 'kv', 'e.fanM': 'kv', 'e.fanR': 'q' },
  decMMHA: { 'd.fanL': 'kv', 'd.fanM': 'kv', 'd.fanR': 'q' },
  decCross: { 'e.out': 'kv', 'x.L': 'kv', 'x.M': 'kv', 'd.q': 'q' },
};
const N_OPTS = [
  { key: 6, label: 'N = 6', sub: '2017 paper' },
  { key: 2, label: 'N = 2', sub: 'slide 43' },
];
const STRIP = [0.85, 0.3, 0.6, 0.15];

function Stack({ side, box, N, off, lit }) {
  const dir = side === 'enc' ? -1 : 1;
  const behind = Array.from({ length: N - 1 }, (_, i) => N - 1 - i);
  return (
    <g className={`dl8s-fade${lit ? '' : ' dl8s-dim'}`}>
      {behind.map((k) => (
        <rect
          key={k}
          className={`dl8s-tmap-stack dl8s-tmap-stack--${side}`}
          x={box.x + dir * k * off[0]}
          y={box.y - k * off[1]}
          width={box.w}
          height={box.h}
          rx={12}
          style={{ strokeOpacity: 0.55 - k * 0.06 }}
        />
      ))}
      <rect className={`dl8s-tmap-stack dl8s-tmap-stack--main dl8s-tmap-stack--${side}`} x={box.x} y={box.y} width={box.w} height={box.h} rx={12} style={{ strokeOpacity: 0.75 }} />
    </g>
  );
}

export function TransformerMapLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const G = useMemo(() => mapGeom(narrow), [narrow]);
  const { P, Y, boxes } = G;
  const story = useStory(MAP_BEATS.length, { ms: 1700 });
  const { beat } = story;
  const [N, setN] = useState(6);
  const [sel, setSel] = useState('decCross');
  const [hover, setHover] = useState(null);
  const shown = hover ?? sel;
  const roles = ARROW_ROLES[shown] ?? {};
  const at = (b) => beat >= b;
  const name = (b) => `${b.lines.join(' ')} (${SIDE_NAME[b.side]})`;
  const tagOn = beat >= 0 && beat <= 2;
  const tag = G.tag[Math.max(0, Math.min(2, beat))];
  const nLab = narrow
    ? [
      { side: 'enc', x: boxes.enc.x - 5 * P.off[0], y: boxes.enc.y - 5 * P.off[1] - 6, anchor: 'start' },
      { side: 'dec', x: boxes.dec.x + boxes.dec.w + 5 * P.off[0], y: boxes.dec.y - 5 * P.off[1] - 6, anchor: 'end' },
    ]
    : [
      { side: 'enc', x: boxes.enc.x - 5 * P.off[0] - 10, y: boxes.enc.y + boxes.enc.h / 2 + 5, anchor: 'end' },
      { side: 'dec', x: boxes.dec.x + boxes.dec.w + 5 * P.off[0] + 10, y: boxes.dec.y + boxes.dec.h / 2 + 5, anchor: 'start' },
    ];
  const labFs = narrow ? { fontSize: 10 } : undefined;

  return (
    <Stage
      className="dl8s-toy-stage"
      title="The transformer, bottom to top"
      slides="slides 29–31, 40 · Figure 16-8"
      tryThis="Predict where the decoder’s upper attention gets its keys and values, then hover a block or press ▶ to send a sentence up the stacks."
      story={<StoryBar story={story} beats={MAP_BEATS} />}
      caption={SENT[KIND[shown]]}
      own="Figure 16-8 redrawn by this page"
    >
      <div ref={wrap}>
        <div className="dl8s-toy-ctl">
          <Seg label="Number of layers in each stack" options={N_OPTS} value={N} onChange={setN} />
        </div>
        <svg
          className="dl8s-svg"
          viewBox={`0 0 ${G.W} ${G.H}`}
          style={narrow ? undefined : { maxWidth: 860, margin: '0 auto' }}
          role="group"
          aria-label={`Figure 16-8: the encoder on the left and the decoder on the right, ${N} layers each. Blocks are buttons: choose one to read its role.`}
          onPointerLeave={() => setHover(null)}
        >
          {/* the N× stacks */}
          <Stack side="enc" box={boxes.enc} N={N} off={P.off} lit={at(1)} />
          <Stack side="dec" box={boxes.dec} N={N} off={P.off} lit={at(2)} />
          {nLab.map((l) => (
            <g key={l.side} className={`dl8s-fade${at(l.side === 'enc' ? 1 : 2) ? '' : ' dl8s-dim'}`}>
              <text x={l.x} y={l.y} textAnchor={l.anchor} className={`dl8s-t dl8s-tmap-n dl8s-t--${l.side}`} style={narrow ? { fontSize: 12.5 } : undefined}>{N}×</text>
            </g>
          ))}

          {/* wires (the chosen attention block's arrows in role colours) */}
          {G.wires.map((w) => <Wire key={w.id} w={w} on={at(w.beat)} role={roles[w.id]} />)}

          {/* ⊕ and the positional encodings */}
          {[P.ex, P.dx].map((x) => (
            <g key={x} className={`dl8s-fade${at(0) ? '' : ' dl8s-dim'}`}>
              <circle cx={x} cy={Y.plus} r={P.r} className="dl8s-plus__c" />
              <path d={`M${x - P.r * 0.55} ${Y.plus} H${x + P.r * 0.55} M${x} ${Y.plus - P.r * 0.55} V${Y.plus + P.r * 0.55}`} className="dl8s-plus__x" />
            </g>
          ))}
          {[['encPE', G.peE, 'end'], ['decPE', G.peD, 'start']].map(([id, x, anchor]) => (
            <g key={id}>
              <PEGlyph
                id={id}
                x={x}
                y={Y.plus}
                r={P.peR}
                lit={at(0)}
                sel={shown === id}
                onPick={setSel}
                onHover={setHover}
                label={`Positional Encoding (${id === 'encPE' ? 'encoder' : 'decoder'}): ${plain(SENT.pe)}`}
              />
              {!narrow && (
                <g className={`dl8s-fade${at(0) ? '' : ' dl8s-dim'}`}>
                  <text x={anchor === 'end' ? x - P.peR - 6 : x + P.peR + 6} y={Y.plus - 2} textAnchor={anchor} className="dl8s-t dl8s-t--xs dl8s-t--pos">Positional</text>
                  <text x={anchor === 'end' ? x - P.peR - 6 : x + P.peR + 6} y={Y.plus + 10} textAnchor={anchor} className="dl8s-t dl8s-t--xs dl8s-t--pos">Encoding</text>
                </g>
              )}
            </g>
          ))}

          {/* the blocks */}
          {G.blocks.map((b) => (
            <FigBlock
              key={b.id}
              b={b}
              fs={b.lines.length > 1 && narrow ? 10 : P.fs}
              lit={at(b.beat)}
              sel={shown === b.id}
              onPick={setSel}
              onHover={setHover}
              label={`${name(b)}: ${plain(SENT[KIND[b.id]])}`}
            />
          ))}

          {/* inputs and outputs, with the running example */}
          <g className={`dl8s-fade${at(0) ? '' : ' dl8s-dim'}`}>
            <text x={P.ex} y={Y.label} textAnchor="middle" className="dl8s-t dl8s-tmap-lab" style={labFs}>Inputs</text>
            <text x={P.ex} y={Y.words} textAnchor="middle" className="dl8s-t dl8s-t--s dl8s-t--enc" style={labFs}>I like soccer</text>
            <text x={P.dx} y={Y.label} textAnchor="middle" className="dl8s-t dl8s-tmap-lab" style={labFs}>Outputs (shifted right)</text>
            <text x={P.dx} y={Y.words} textAnchor="middle" className="dl8s-t dl8s-t--s dl8s-t--dec" style={labFs}>⟨SOS⟩ me gusta el</text>
          </g>
          <g className={`dl8s-fade${at(3) ? '' : ' dl8s-dim'}`}>
            <text x={P.dx} y={Y.probs} textAnchor="middle" className="dl8s-t dl8s-tmap-lab" style={labFs}>Output Probabilities</text>
            <text x={P.dx} y={Y.probsWords} textAnchor="middle" className="dl8s-t dl8s-t--s dl8s-t--dec" style={labFs}>me gusta el fútbol</text>
          </g>

          {/* cross-attention chosen: name the arrows (slide 31) */}
          {!narrow && shown === 'decCross' && (
            <g>
              {at(1) && (
                <text x={G.xDrop - 7} y={Y.in + 4} textAnchor="end" className="dl8s-t dl8s-tmap-role">
                  <tspan className="dl8s-t--k">keys</tspan>, <tspan className="dl8s-t--v">values</tspan>
                </text>
              )}
              {at(2) && <text x={P.dx + P.fan + 7} y={Y.qSplit - 9} className="dl8s-t dl8s-tmap-role dl8s-t--q">queries</text>}
            </g>
          )}

          {/* the travelling tensor and slide 30's shape tag */}
          <g className={`dl8s-tmap-tag${tagOn ? '' : ' dl8s-hide'}`} style={{ transform: `translate(${tag.x}px, ${tag.y}px)` }} aria-hidden="true">
            {STRIP.map((v, i) => (
              <rect key={i} className="dl8s-tmap-cell" x={i * 10} y={0} width={9} height={9} rx={2} style={{ fill: cellFill(beat >= 2 ? 'dec' : 'enc', v, 1) }} />
            ))}
            <text x={0} y={22}>[batch size,</text>
            <text x={0} y={34}>sequence length,</text>
            <text x={0} y={46}>embedding size]</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}

/* ── §14 · slide 43's code beside one encoder layer ─────────────────────── */
const CODE = NAMED_CODE.KERAS_TRANSFORMER;
// code line (1-based) → the part of the layer it builds
const LINE_PART = { 1: 'n', 2: 'heads', 3: 'mha', 4: 'dense1', 5: 'mask', 6: 'input', 7: 'n', 8: 'skip', 9: 'mha', 10: 'mha', 11: 'call', 13: 'rest' };
const LINES = Object.keys(LINE_PART).map(Number);
const LINE_SAY = {
  1: '`N = 2`: the loop below stacks N = 2 encoder layers, instead of the 2017 paper’s 6 (slides 30, 43).',
  2: '`num_heads = 8`: the attention layer runs 8 heads, the $H$ of slide 39.',
  3: '`dropout_rate = 0.1`: handed to the attention layer as `dropout=dropout_rate`.',
  4: '`n_units = 128`: the size of the first Dense layer in each Feed Forward block (the ReLU one, slide 30); the code shown never uses it.',
  5: '`encoder_pad_mask`: True for real words, False where the input id is 0 (padding), so attention ignores the padding positions (this page’s note).',
  6: '`Z = encoder_in`: the layer’s input, the word embeddings plus positional encodings of slide 36.',
  7: '`for _ in range(N)`: each pass of the loop builds one encoder layer, so the stack is N layers deep.',
  8: '`skip = Z`: keeps the layer’s input for the skip connection into Add & Norm (the slide stops before using it).',
  9: '`tf.keras.layers.MultiHeadAttention(...)`: one multi-head attention layer per encoder layer.',
  10: '`num_heads=num_heads, key_dim=embed_size, dropout=dropout_rate`: 8 heads; in Keras, `key_dim` is the size of each head.',
  11: '`attn_layer(Z, value=Z, …)`: the query is Z, the value is Z and the key defaults to the value, so all three arrows come from Z: self-attention.',
  13: 'The comment stands for the rest of Figure 16-8’s encoder layer (Add & Norm, Feed Forward, Add & Norm): not shown on slide 43.',
};

// one encoder layer, bottom to top (wide stages, beside the code)
const CM_V = {
  W: 280, H: 360, cx: 162, bw: 140, lane: 82, fan: 38,
  bracket: [40, 304], outY: 28, split: 294, fanY: 280, maskY: 300, inTop: 336, inLab: 352,
};
// the same layer, left to right (narrow stages, above the code)
const CM_H = { W: 352, H: 178, cy: 82 };

function LayerV({ part, hid }) {
  const { cx, bw, lane, fan, split, fanY } = CM_V;
  const hb = bw / 2;
  const on = (p) => part === p;
  const b = (id, y, h, lines, side = 'enc') => ({ id, x: cx - hb, y, w: bw, h, lines, side });
  const mha = b('mha', 202, 42, ['Multi-Head Attention']);
  const an1 = b('an1', 166, 20, ['Add & Norm']);
  const ff = b('ff', 80, 72, ['Feed Forward']);
  const an2 = b('an2', 46, 20, ['Add & Norm']);
  const d1 = { id: 'd1', x: cx - 56, y: 125, w: 112, h: 22, lines: ['Dense · ReLU'], side: 'enc' };
  const d2 = { id: 'd2', x: cx - 56, y: 99, w: 112, h: 22, lines: ['Dense'], side: 'enc' };
  const mhaB = mha.y + mha.h;
  const maskX = cx + 56;
  const kv = on('call') ? 'kv' : undefined;
  const [bTop, bBot] = CM_V.bracket;
  return (
    <svg className="dl8s-svg" viewBox={`0 0 ${CM_V.W} ${CM_V.H}`} role="img" aria-label="One encoder layer of Figure 16-8: multi-head attention, then Add & Norm, Feed Forward and Add & Norm (dashed: not in slide 43's code), inside an N× bracket.">
      <defs><HatchDef id={hid} size={5} /></defs>
      {/* N× bracket */}
      <path className={`dl8s-codemap-bracket${on('n') ? ' dl8s-codemap-bracket--on' : ''}`} d={`M58 ${bTop} H48 V${bBot} H58`} />
      <text x={36} y={(bTop + bBot) / 2} textAnchor="middle" transform={`rotate(-90 36 ${(bTop + bBot) / 2})`} className={`dl8s-codemap-note${on('n') ? ' dl8s-codemap-note--on' : ''}`}>N× · N = 2 (instead of 6)</text>

      {/* input Z = encoder_in */}
      <path className={`dl8s-codemap-wire${on('input') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${cx} ${CM_V.inTop} V${split}`} />
      <text x={cx} y={CM_V.inLab} textAnchor="middle" className={`dl8s-codemap-note dl8s-t--m${on('input') ? ' dl8s-codemap-note--on' : ''}`}>Z = encoder_in</text>

      {/* skip = Z: around the attention into Add & Norm */}
      <path className={`dl8s-codemap-wire${on('skip') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${cx} ${split} H${lane} V${an1.y + 10} H${cx - hb}`} />
      <polygon className={`dl8s-codemap-head${on('skip') ? ' dl8s-codemap-head--on' : ''}`} points={arrowRight(cx - hb, an1.y + 10, 6)} />

      {/* the three arrows into attention, all from Z */}
      <Wire w={{ d: `M${cx} ${split} V${fanY}` }} on />
      <Wire w={{ d: `M${cx} ${fanY} H${cx - fan} V${mhaB}`, head: arrowUp(cx - fan, mhaB, 6) }} on role={kv} />
      <Wire w={{ d: `M${cx} ${fanY} V${mhaB}`, head: arrowUp(cx, mhaB, 6) }} on role={kv} />
      <Wire w={{ d: `M${cx} ${fanY} H${cx + fan} V${mhaB}`, head: arrowUp(cx + fan, mhaB, 6) }} on role={on('call') ? 'q' : undefined} />

      {/* the padding mask into attention */}
      <g className={on('mask') || on('call') ? 'dl8s-codemap-mask--on' : ''}>
        <path className={`dl8s-codemap-wire${on('mask') || on('call') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${maskX} ${CM_V.maskY} V${mhaB}`} />
        <polygon className={`dl8s-codemap-head${on('mask') || on('call') ? ' dl8s-codemap-head--on' : ''}`} points={arrowUp(maskX, mhaB, 6)} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} className="dl8s-codemap-maskcell" x={maskX - 25 + i * 10} y={CM_V.maskY} width={9} height={9} rx={1.5} style={{ fill: i >= 3 ? `url(#${hid})` : 'var(--dl8s-floor)' }} />
        ))}
        <text x={maskX} y={CM_V.maskY + 22} textAnchor="middle" className={`dl8s-codemap-note${on('mask') ? ' dl8s-codemap-note--on' : ''}`}>padding: id 0</text>
      </g>

      {/* the attention block and its 8 heads */}
      <g className={`dl8s-codemap-heads${on('heads') || on('mha') ? ' dl8s-codemap-heads--on' : ''}`}>
        {[7, 6, 5, 4, 3, 2, 1].map((k) => (
          <rect key={k} x={mha.x + k * 2.6} y={mha.y - k * 1.3} width={mha.w} height={mha.h} rx={6} style={{ fill: 'var(--dl8s-floor)' }} />
        ))}
      </g>
      <FigBlock b={mha} fs={11.5} sub="8 heads" className={on('mha') || on('call') ? 'dl8s-codemap-on' : ''} />

      {/* the rest of the layer: not in the slide's code */}
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${cx} ${mha.y} V${an1.y + an1.h}`} />
      <path className={`dl8s-codemap-wire dl8s-codemap-wire--dash${on('rest') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${cx} ${an1.y} V${ff.y + ff.h}`} />
      <polygon className={`dl8s-codemap-head${on('rest') ? ' dl8s-codemap-head--on' : ''}`} points={arrowUp(cx, ff.y + ff.h, 6)} />
      <path className={`dl8s-codemap-wire dl8s-codemap-wire--dash${on('rest') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${cx} ${an1.y - 8} H${lane} V${an2.y + 10} H${cx - hb}`} />
      <polygon className={`dl8s-codemap-head${on('rest') ? ' dl8s-codemap-head--on' : ''}`} points={arrowRight(cx - hb, an2.y + 10, 6)} />
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${cx} ${ff.y} V${an2.y + an2.h}`} />
      <FigBlock b={an1} fs={11.5} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
      <g>
        <rect className={`dl8s-codemap-ff${on('rest') ? ' dl8s-codemap-ff--on' : ''}`} x={ff.x} y={ff.y} width={ff.w} height={ff.h} rx={6} />
        <text x={cx} y={ff.y + 13} textAnchor="middle" className="dl8s-t dl8s-t--b" style={{ fontSize: 11.5 }}>Feed Forward</text>
        <FigBlock b={d2} fs={10.5} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
        <FigBlock b={d1} fs={10.5} dash className={on('dense1') || on('rest') ? 'dl8s-codemap-on' : ''} />
        {on('dense1') && <text x={cx + 62} y={d1.y + 15} className="dl8s-codemap-note dl8s-codemap-note--on dl8s-t--m">128</text>}
      </g>
      <FigBlock b={an2} fs={11.5} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${cx} ${an2.y} V${CM_V.outY}`} />
      <polygon className="dl8s-codemap-head" points={arrowUp(cx, CM_V.outY, 6)} />
      <text x={cx + 8} y={CM_V.outY + 10} className="dl8s-codemap-note dl8s-t--m">Z</text>
      <text x={cx} y={14} textAnchor="middle" className={`dl8s-codemap-note${on('rest') ? ' dl8s-codemap-note--on' : ''}`}>dashed: not shown on slide 43</text>
    </svg>
  );
}

function LayerH({ part, hid }) {
  const { cy } = CM_H;
  const on = (p) => part === p;
  const mha = { id: 'mha', x: 54, y: cy - 30, w: 74, h: 60, lines: ['Multi-Head', 'Attention'], side: 'enc' };
  const an1 = { id: 'an1', x: 142, y: cy - 21, w: 38, h: 42, lines: ['Add &', 'Norm'], side: 'enc' };
  const ff = { x: 200, y: cy - 34, w: 80, h: 68 };
  const d1 = { id: 'd1', x: 205, y: cy - 14, w: 34, h: 42, lines: ['Dense', 'ReLU'], side: 'enc' };
  const d2 = { id: 'd2', x: 242, y: cy - 14, w: 33, h: 42, lines: ['Dense'], side: 'enc' };
  const an2 = { id: 'an2', x: 294, y: cy - 21, w: 38, h: 42, lines: ['Add &', 'Norm'], side: 'enc' };
  const split = 30;
  const fanX = 40;
  const kv = on('call') ? 'kv' : undefined;
  const maskX = 104;
  const mB = mha.y + mha.h;
  return (
    <svg className="dl8s-svg" viewBox={`0 0 ${CM_H.W} ${CM_H.H}`} style={{ maxWidth: 520, margin: '0 auto' }} role="img" aria-label="One encoder layer, left to right: multi-head attention, then Add & Norm, Feed Forward and Add & Norm (dashed: not in slide 43's code), inside an N× bracket.">
      <defs><HatchDef id={hid} size={5} /></defs>
      <text x={237} y={12} textAnchor="middle" className={`dl8s-codemap-note${on('rest') ? ' dl8s-codemap-note--on' : ''}`}>dashed: not shown on slide 43</text>

      {/* input, skip, the three arrows */}
      <text x={4} y={cy - 6} className={`dl8s-codemap-note dl8s-t--m${on('input') ? ' dl8s-codemap-note--on' : ''}`}>Z</text>
      <path className={`dl8s-codemap-wire${on('input') ? ' dl8s-codemap-wire--on' : ''}`} d={`M4 ${cy} H${split}`} />
      <path className={`dl8s-codemap-wire${on('skip') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${split} ${cy} V24 H${an1.x + an1.w / 2} V${an1.y}`} />
      <polygon className={`dl8s-codemap-head${on('skip') ? ' dl8s-codemap-head--on' : ''}`} points={arrowDown(an1.x + an1.w / 2, an1.y, 6)} />
      <Wire w={{ d: `M${split} ${cy} H${fanX}` }} on />
      <Wire w={{ d: `M${fanX} ${cy} V${cy - 16} H${mha.x}`, head: arrowRight(mha.x, cy - 16, 6) }} on role={kv} />
      <Wire w={{ d: `M${fanX} ${cy} H${mha.x}`, head: arrowRight(mha.x, cy, 6) }} on role={kv} />
      <Wire w={{ d: `M${fanX} ${cy} V${cy + 16} H${mha.x}`, head: arrowRight(mha.x, cy + 16, 6) }} on role={on('call') ? 'q' : undefined} />

      {/* the padding mask */}
      <g className={on('mask') || on('call') ? 'dl8s-codemap-mask--on' : ''}>
        <path className={`dl8s-codemap-wire${on('mask') || on('call') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${maskX} ${cy + 46} V${mB}`} />
        <polygon className={`dl8s-codemap-head${on('mask') || on('call') ? ' dl8s-codemap-head--on' : ''}`} points={arrowUp(maskX, mB, 6)} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} className="dl8s-codemap-maskcell" x={maskX - 25 + i * 10} y={cy + 46} width={9} height={9} rx={1.5} style={{ fill: i >= 3 ? `url(#${hid})` : 'var(--dl8s-floor)' }} />
        ))}
        <text x={maskX + 30} y={cy + 54} className={`dl8s-codemap-note${on('mask') ? ' dl8s-codemap-note--on' : ''}`}>padding: id 0</text>
      </g>

      {/* attention + heads */}
      <g className={`dl8s-codemap-heads${on('heads') || on('mha') ? ' dl8s-codemap-heads--on' : ''}`}>
        {[7, 6, 5, 4, 3, 2, 1].map((k) => (
          <rect key={k} x={mha.x + k * 1.5} y={mha.y - k * 1.8} width={mha.w} height={mha.h} rx={6} style={{ fill: 'var(--dl8s-floor)' }} />
        ))}
      </g>
      <FigBlock b={mha} fs={10} sub="8 heads" className={on('mha') || on('call') ? 'dl8s-codemap-on' : ''} />

      {/* the rest (dashed) */}
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${mha.x + mha.w} ${cy} H${an1.x}`} />
      <path className={`dl8s-codemap-wire dl8s-codemap-wire--dash${on('rest') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${an1.x + an1.w} ${cy} H${ff.x}`} />
      <polygon className={`dl8s-codemap-head${on('rest') ? ' dl8s-codemap-head--on' : ''}`} points={arrowRight(ff.x, cy, 6)} />
      <path className={`dl8s-codemap-wire dl8s-codemap-wire--dash${on('rest') ? ' dl8s-codemap-wire--on' : ''}`} d={`M${an1.x + an1.w + 9} ${cy} V24 H${an2.x + an2.w / 2} V${an2.y}`} />
      <polygon className={`dl8s-codemap-head${on('rest') ? ' dl8s-codemap-head--on' : ''}`} points={arrowDown(an2.x + an2.w / 2, an2.y, 6)} />
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${ff.x + ff.w} ${cy} H${an2.x}`} />
      <FigBlock b={an1} fs={9.5} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
      <rect className={`dl8s-codemap-ff${on('rest') ? ' dl8s-codemap-ff--on' : ''}`} x={ff.x} y={ff.y} width={ff.w} height={ff.h} rx={6} />
      <text x={ff.x + ff.w / 2} y={ff.y + 13} textAnchor="middle" className="dl8s-t dl8s-t--b" style={{ fontSize: 9.5 }}>Feed Forward</text>
      <FigBlock b={d1} fs={9} dash className={on('dense1') || on('rest') ? 'dl8s-codemap-on' : ''} />
      <FigBlock b={d2} fs={9} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
      {on('dense1') && <text x={d1.x + d1.w / 2} y={d1.y + d1.h + 12} textAnchor="middle" className="dl8s-codemap-note dl8s-codemap-note--on dl8s-t--m">128</text>}
      <FigBlock b={an2} fs={9.5} dash className={on('rest') ? 'dl8s-codemap-on' : ''} />
      <path className="dl8s-codemap-wire dl8s-codemap-wire--dash" d={`M${an2.x + an2.w} ${cy} H${CM_H.W - 4}`} />
      <polygon className="dl8s-codemap-head" points={arrowRight(CM_H.W - 4, cy, 6)} />
      <text x={CM_H.W - 12} y={cy - 6} className="dl8s-codemap-note dl8s-t--m">Z</text>

      {/* N× bracket */}
      <path className={`dl8s-codemap-bracket${on('n') ? ' dl8s-codemap-bracket--on' : ''}`} d={`M${split} ${CM_H.H - 32} V${CM_H.H - 24} H${CM_H.W - 18} V${CM_H.H - 32}`} />
      <text x={(split + CM_H.W - 18) / 2} y={CM_H.H - 8} textAnchor="middle" className={`dl8s-codemap-note${on('n') ? ' dl8s-codemap-note--on' : ''}`}>N× · N = 2 (instead of 6)</text>
    </svg>
  );
}

export function CodeMapLab() {
  const wrap = useRef(null);
  const codeRef = useRef(null);
  const hid = `dl8s-cmhatch-${useId().replace(/:/g, '')}`;
  const stack = useWidth(wrap) < 760;
  const [line, setLine] = useState(9);
  const part = LINE_PART[line];
  const hl = line === 9 || line === 10 ? [9, 10] : [line];

  const lineOf = (target) => {
    const el = target?.closest?.('.dlk-code__line');
    if (!el || !codeRef.current?.contains(el)) return null;
    return [...codeRef.current.querySelectorAll('.dlk-code__line')].indexOf(el) + 1;
  };
  const onPoint = (e) => {
    const i = lineOf(e.target);
    if (i && LINE_PART[i]) setLine(i);
  };
  const onKey = (e) => {
    const k = LINES.indexOf(line);
    const next = { ArrowDown: LINES[Math.min(LINES.length - 1, k + 1)], ArrowUp: LINES[Math.max(0, k - 1)], Home: LINES[0], End: LINES[LINES.length - 1] }[e.key];
    if (next !== undefined) { e.preventDefault(); setLine(next); }
  };

  const fig = stack ? <LayerH part={part} hid={hid} /> : <LayerV part={part} hid={hid} />;
  const code = (
    <div
      ref={codeRef}
      className="dl8s-codemap__code"
      tabIndex={0}
      role="group"
      aria-label="Slide 43's code, one line at a time: hover a line, or use the up and down arrow keys"
      onPointerOver={onPoint}
      onClick={onPoint}
      onKeyDown={onKey}
    >
      <Code code={CODE} meta="slide 43 · verbatim" hl={hl} />
    </div>
  );

  return (
    <Stage
      className="dl8s-toy-stage"
      title="Slide 43’s code, line by line"
      slides="slide 43 · Figure 16-8"
      tryThis="Predict which part of the layer `encoder_pad_mask` feeds, then hover the lines (or use ↑ ↓) and watch the layer light up."
      caption={LINE_SAY[line]}
      own="the padding example (3 words, 2 pads) is this page’s own"
    >
      <div ref={wrap} className={`dl8s-codemap${stack ? ' dl8s-codemap--stack' : ''}`}>
        {stack ? <><div className="dl8s-codemap__fig">{fig}</div>{code}</> : <>{code}<div className="dl8s-codemap__fig">{fig}</div></>}
        <p className="dl8s-tmap-sr" aria-live="polite">{`Line ${line}: ${plain(LINE_SAY[line])}`}</p>
      </div>
    </Stage>
  );
}

/* ── §14 · the page's own toy transformer, live ─────────────────────────── */
const SLOT_NAME = { s: 'subject', v: 'verb', a: 'adjective', n: 'noun' };
const MASS = new Set(GRAMMAR.massNouns.map((x) => x.en));
const OPTIONS = {
  s: GRAMMAR.subjects.map((x) => x.en),
  v: GRAMMAR.verbs.map((x) => x.en),
  a: [null, ...GRAMMAR.adjectives.map((x) => x.en)],
  n: [...GRAMMAR.massNouns, ...GRAMMAR.pluralNouns].map((x) => x.en),
};
// opens on its best picture: "viejas" looking back at "old" across the reordering
const START = { s: 'we', v: 'love', a: 'old', n: 'movies' };
const wordsOf = (S) => [S.s, S.v, ...(S.a ? [S.a] : []), S.n];

function toyLayout(narrow) {
  return narrow
    ? { narrow, W: 360, H: 270, tokH: 30, yTop: 74, yBot: 222, outW: 64, inW: 72, top: { 4: [50, 310], 5: [38, 322] }, bot: { 3: [66, 294], 4: [46, 314] } }
    : { narrow, W: 720, H: 258, tokH: 34, yTop: 70, yBot: 212, outW: 90, inW: 92, top: { 4: [272, 638], 5: [250, 660] }, bot: { 3: [300, 610], 4: [272, 638] } };
}

export function ToyTransformerLab() {
  const wrap = useRef(null);
  const gid = `dl8s-toycone-${useId().replace(/:/g, '')}`;
  const L = toyLayout(useWidth(wrap) < 520);
  const { model, error } = useToyMT();
  const [S, setS] = useState(START);
  const [t, setT] = useState(4);
  const [slot, setSlot] = useState(null);
  const [head, setHead] = useState('avg');
  const [hover, setHover] = useState(null);

  const words = wordsOf(S);
  const valid = isValidSentence(words);
  const r = model && valid ? translateCached(model, words) : null;
  const out = r ? r.out : [];
  const tt = Math.max(0, Math.min(t, out.length - 1));
  const w = r ? headRows(r.cross, head)[tt] : [];
  const best = r ? argmax(w) : 0;
  const ref = referenceTranslation(words);
  const ok = !!r && !!ref && out.join(' ') === ref.join(' ');
  const held = !!model && model.heldOut.has(words.join(' '));

  // the English row: subject, verb, [adjective or its empty slot], noun
  const slots = MASS.has(S.n) ? ['s', 'v', 'n'] : ['s', 'v', 'a', 'n'];
  const botX = spread(slots.length, ...L.bot[slots.length]);
  const wordX = [];
  slots.forEach((k, i) => { if (k !== 'a' || S.a) wordX.push(botX[i]); });
  const topX = out.length ? spread(out.length, ...(L.top[out.length] ?? L.top[5])) : [];

  const choose = (k, v) => {
    setS((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'n' && MASS.has(v)) next.a = null;
      return next;
    });
    setT({ s: 0, v: 1, a: v ? 4 : 3, n: 3 }[k]);
  };

  const small = L.narrow ? 'dl8s-toy-sm' : '';
  const status = r ? `${ok ? '✓ the grammar’s translation' : '✗ not the grammar’s translation'}${held ? ' · held out: never seen in training' : ''}` : '';

  return (
    <Stage
      className="dl8s-toy-stage"
      title="This page’s toy transformer, live"
      slides="slides 40–43 · this page’s model"
      tryThis="Predict where “viejas” looks although Spanish moves the adjective to the end, then click the English words to build “I like soccer”."
      caption={r ? `While writing “${out[tt]}”, the decoder looks mostly at “${words[best]}”.` : undefined}
      challenge={{ text: 'Build a sentence the model never saw in training.', done: held }}
      own="this page’s toy transformer, trained by this page — not the slides’ model"
      maths={r && (
        <>
          <MEq tex={ATTN_TEX} />
          <MLine text={`“${words.join(' ')}” → “${out.join(' ')}”${ok ? ', the grammar’s own translation' : ''}. Greedy decoding: $\\langle\\text{SOS}\\rangle$ goes in, each predicted word is appended, until $\\langle\\text{EOS}\\rangle$ (slide 42).`} />
          <MLine text={`Cross-attention for “${out[tt]}” (the decoder at “${tokName(r.decIn[tt])}”), over ${words.map((x) => `“${x}”`).join(', ')}: head 1 $${fmtVec(r.cross[0][0][tt])}$, head 2 $${fmtVec(r.cross[0][1][tt])}$; ${headName(head)} is drawn.`} />
          <p className="dl8s-mnote">
            This page’s own toy, not the slides’ model: N = {model.meta.layers}, embedding size {model.meta.dModel}, {model.meta.heads} heads with d_keys = {model.meta.keyDim} each, Feed Forward {model.meta.ffn} units (ReLU) then {model.meta.dModel}, {model.meta.params.toLocaleString('en-AU')} parameters. Trained by this page with Keras on {model.meta.nTrain} of the grammar’s 208 sentences; {model.meta.nHeldOut} were held out (“I like soccer” was trained on).
          </p>
        </>
      )}
    >
      <div ref={wrap}>
        <div className="dl8s-toy-ctl">
          <span />
          <Seg label="Which head" options={HEADS} value={head} onChange={setHead} />
        </div>
        {!r ? (
          <ToyWait error={error} minHeight={L.H * 0.8} />
        ) : (
          <svg
            className="dl8s-svg"
            viewBox={`0 0 ${L.W} ${L.H}`}
            role="group"
            aria-label={`${words.join(' ')} translates to ${out.join(' ')}. While writing ${out[tt]}, cross-attention weights: ${w.map((x, j) => `${words[j]} ${pct(x)}`).join(', ')}`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="dl8s-cone__top" />
                <stop offset="1" className="dl8s-cone__bot" />
              </linearGradient>
            </defs>

            {/* row labels and the status line */}
            {L.narrow ? (
              <>
                <text x={6} y={L.yTop - L.tokH / 2 - 12} className="dl8s-t dl8s-t--b dl8s-t--dec" style={{ fontSize: 11.5 }}>Spanish out <tspan className="dl8s-t--xs" dx={4}>the decoder writes</tspan></text>
                <text x={6} y={L.yBot + L.tokH / 2 + 20} className="dl8s-t dl8s-t--b dl8s-t--enc" style={{ fontSize: 11.5 }}>English in <tspan className="dl8s-t--xs" dx={4}>click a word to change it</tspan></text>
                <text x={6} y={16} className="dl8s-toy-ok">{ok ? '✓ the grammar’s translation' : ''}<tspan className="dl8s-toy-held">{held ? ' · never seen in training' : ''}</tspan></text>
              </>
            ) : (
              <>
                <text x={16} y={L.yTop - 3} className="dl8s-t dl8s-t--b dl8s-t--dec">Spanish out</text>
                <text x={16} y={L.yTop + 13} className="dl8s-t dl8s-t--xs">the decoder writes</text>
                <text x={16} y={L.yBot - 3} className="dl8s-t dl8s-t--b dl8s-t--enc">English in</text>
                <text x={16} y={L.yBot + 13} className="dl8s-t dl8s-t--xs">click a word to change it</text>
                <text x={L.W - 8} y={18} textAnchor="end" className="dl8s-toy-ok">{ok ? '✓ the grammar’s translation' : ''}<tspan className="dl8s-toy-held">{held ? ' · held out: never seen in training' : ''}</tspan></text>
              </>
            )}

            {/* cones from the Spanish word being written onto the English words */}
            {words.map((x, j) => (
              <Cone
                key={`${j}-${slots.length}`}
                gid={gid}
                x1={topX[tt]}
                y1={L.yTop + L.tokH / 2 + 2}
                x2={wordX[j]}
                y2={L.yBot - L.tokH / 2}
                half={L.inW / 2}
                w={w[j]}
              />
            ))}

            {/* Spanish out (click one) */}
            {out.map((x, i) => (
              <Token
                key={`${i}-${x}`}
                className={small}
                x={topX[i]}
                y={L.yTop}
                w={L.outW}
                h={L.tokH}
                word={x}
                role="dec"
                on={i === tt}
                onPick={() => setT(i)}
                label={`Spanish word ${i + 1}: ${x}. Show where the decoder looks while writing it`}
              />
            ))}

            {/* English in: each word is a slot (click to change it) */}
            {slots.map((k, i) => {
              const ghost = k === 'a' && !S.a;
              const j = ghost ? -1 : wordX.indexOf(botX[i]);
              return (
                <g key={k} onPointerEnter={() => setHover(j >= 0 ? j : null)} onPointerLeave={() => setHover(null)}>
                  <Token
                    className={small}
                    x={botX[i]}
                    y={L.yBot}
                    w={L.inW}
                    h={L.tokH}
                    word={ghost ? (L.narrow ? '+ adj.' : '+ adjective') : S[k]}
                    role="enc"
                    ghost={ghost}
                    on={slot === k}
                    onPick={() => setSlot((cur) => (cur === k ? null : k))}
                    label={ghost ? 'Add an adjective' : `${SLOT_NAME[k]}: ${S[k]}. Change it`}
                  />
                  {j >= 0 && (
                    <rect
                      className="dl8s-tok__glow"
                      x={botX[i] - L.inW / 2 + 2}
                      y={L.yBot - L.tokH / 2 + 2}
                      width={L.inW - 4}
                      height={L.tokH - 4}
                      rx={5}
                      style={{ opacity: 0.32 * (w[j] ?? 0) }}
                    />
                  )}
                </g>
              );
            })}
            {hover !== null && wordX[hover] !== undefined && <Tip x={wordX[hover]} y={L.yBot - L.tokH / 2 - 4} text={`weight ${fmt(w[hover])}`} />}
          </svg>
        )}
        {r && slot && (
          <div className="dl8s-toy-opts dl8s-noprint" role="group" aria-label={`Choose the ${SLOT_NAME[slot]}`} onKeyDown={(e) => { if (e.key === 'Escape') setSlot(null); }}>
            <span className="dl8s-toy-opts__k">{SLOT_NAME[slot]}</span>
            {OPTIONS[slot].map((o) => (
              <button
                key={o ?? 'none'}
                type="button"
                className={`dl8s-toy-opt${o === null ? ' dl8s-toy-opt--none' : ''}`}
                aria-pressed={S[slot] === o}
                onClick={() => choose(slot, o)}
              >
                {o ?? 'none'}
              </button>
            ))}
          </div>
        )}
        <p className="dl8s-tmap-sr" aria-live="polite">{r ? `${words.join(' ')}: ${out.join(' ')}. ${status}` : ''}</p>
      </div>
    </Stage>
  );
}
