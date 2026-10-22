import { useId, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Token, Cone, Arrow, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { weightFill } from '../svgFill';
import { fmt, pct } from '../attn';
import { EN, ES } from '../toys';
import { useToyMT, translateCached, headRows, HEADS, headName, tokName, tokTex, argmax } from './toyLoad';
import { Seg, ToyWait, HatchDef } from './toyParts';
import './labsMasking.css';

/* ============================================================================
   §13 · SELF- vs CROSS-ATTENTION; TRAINING AND INFERENCE  (slides 31, 40–42)
   ----------------------------------------------------------------------------
   SelfCrossLab   one idea: where the queries come from vs the keys and
                  values. Self-attention (encoder): queries, keys and values
                  all "I like soccer". Cross-attention (decoder): queries from
                  "me gusta el fútbol", keys and values from "I like soccer".
                  Cones from the chosen query word onto the key words, as
                  bright as the REAL weights of this page's toy transformer
                  (../toyMT.js, N = 1, 2 heads). Opens on slide 40's example:
                  the decoder at "el", writing "fútbol", looking at "soccer".
   MaskLab        the causal mask and generating ⟨SOS⟩ → … → ⟨EOS⟩ one word
                  at a time (slides 41–42): the toy decoder's masked self-
                  attention as a triangle heatmap (hatch = masked), growing
                  one row and one column per generation step.
                  Honest note: in this 1-layer causal decoder, row i depends
                  only on the positions ≤ i (its own embedding + positional
                  encoding, then attention over positions ≤ i), so the rows
                  an earlier step computes are the same numbers as the final
                  pass's rows drawn here (checked against translate() with a
                  shorter maxOut).
   ========================================================================== */

const OWN = 'weights from this page’s toy transformer · trained by this page, not the slides’ model';

const ATTN_TEX = '\\text{Attention}(\\mathbf{Q},\\mathbf{K},\\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^\\top}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}';

const spread = (n, a, b) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1)));

/* ── self vs cross ─────────────────────────────────────────────────────── */
const MODES = [
  { key: 'self', label: 'self-attention', sub: 'encoder' },
  { key: 'cross', label: 'cross-attention', sub: 'decoder' },
];

function scLayout(narrow) {
  return narrow
    ? { W: 360, H: 290, tokW: 70, tokH: 30, yTop: 64, yBot: 232, top: [44, 316], bot: [66, 294] }
    : { W: 720, H: 270, tokW: 92, tokH: 34, yTop: 58, yBot: 222, top: [262, 652], bot: [312, 602] };
}

function RoleLabel({ x, y, kind, from, narrow }) {
  const role = kind === 'q'
    ? <tspan className="dl8s-t--q">queries</tspan>
    : <><tspan className="dl8s-t--k">keys</tspan><tspan>, </tspan><tspan className="dl8s-t--v">values</tspan></>;
  const side = from === 'decoder' ? 'dec' : 'enc';
  if (narrow) {
    return (
      <text x={x} y={y} className="dl8s-t dl8s-t--b dl8s-selfx-role" style={{ fontSize: 11.5 }}>
        {role}
        <tspan className={`dl8s-selfx-src dl8s-t--${side}`} dx={6}>from the {from}</tspan>
      </text>
    );
  }
  return (
    <g>
      <text x={x} y={y - 3} className="dl8s-t dl8s-selfx-role">{role}</text>
      <text x={x} y={y + 13} className={`dl8s-t dl8s-selfx-src dl8s-t--${side}`}>from the {from}</text>
    </g>
  );
}

export function SelfCrossLab() {
  const wrap = useRef(null);
  const gid = `dl8s-scone-${useId().replace(/:/g, '')}`;
  const narrow = useWidth(wrap) < 520;
  const L = scLayout(narrow);
  const { model, error } = useToyMT();
  const [mode, setMode] = useState('cross');
  const [pick, setPick] = useState({ self: 2, cross: 3 });
  const [head, setHead] = useState('avg');
  const [hover, setHover] = useState(null);

  const r = useMemo(() => (model ? translateCached(model, EN) : null), [model]);
  const cross = mode === 'cross';
  const q = pick[mode];
  const spanish = r ? r.out.slice(0, ES.length) : ES;
  const topWords = cross ? spanish : EN;
  const M = r ? headRows(cross ? r.cross : r.encSelf, head) : null;
  const w = M ? M[q] : EN.map(() => 0);
  const best = argmax(w);
  const topX = cross ? spread(topWords.length, ...L.top) : spread(EN.length, ...L.bot);
  const botX = spread(EN.length, ...L.bot);
  const inWord = r ? tokName(r.decIn[q]) : '';

  const caption = !r
    ? undefined
    : cross
      ? `While writing “${spanish[q]}” (its input is “${inWord}”), the decoder looks mostly at “${EN[best]}”.`
      : `“${EN[q]}” attends to the words of its own sentence, most of all “${EN[best]}”.`;

  const rowName = cross ? `the decoder at “${inWord}”, writing “${spanish[q]}”` : `“${EN[q]}”`;

  return (
    <Stage
      className="dl8s-toy-stage"
      title="Where do the queries come from?"
      slides="slides 31, 40"
      tryThis="Predict where “el” looks while it writes “fútbol”, then flip to self-attention and notice where the queries come from now."
      caption={caption}
      challenge={{ text: 'Find the Spanish word that looks mostly at “like”.', done: !!r && cross && best === 1 }}
      own={OWN}
      maths={r && (
        <>
          <MEq tex={ATTN_TEX} />
          <MLine text={cross
            ? 'Cross-attention: the rows of $\\mathbf{Q}$ come from the decoder (one per Spanish position); the rows of $\\mathbf{K}$ and $\\mathbf{V}$ come from the encoder’s output (one per English word).'
            : 'Self-attention: the rows of $\\mathbf{Q}$, $\\mathbf{K}$ and $\\mathbf{V}$ all come from the same sentence, the encoder’s “I like soccer”.'}
          />
          <MLine text={`Row for ${rowName}, ${headName(head)}: ${w.map((x, j) => `$${fmt(x)}$ on “${EN[j]}”`).join(', ')}. The row adds up to 1.`} />
          <p className="dl8s-mnote">
            These are the softmax weights of this page’s own toy transformer ({model.meta.layers} layer, {model.meta.heads} heads, d_keys = {model.meta.keyDim} per head), trained by this page on 182 sentences of a 208-sentence English → Spanish grammar and read from its final decoding pass. They are not the slides’ model; slide 40 only says the decoder “will probably” look at “soccer” here.
          </p>
        </>
      )}
    >
      <div ref={wrap}>
        <div className="dl8s-toy-ctl">
          <Seg label="Which attention layer" options={MODES} value={mode} onChange={setMode} />
          <Seg label="Which head" options={HEADS} value={head} onChange={setHead} />
        </div>
        {!r ? (
          <ToyWait error={error} minHeight={L.H * 0.8} />
        ) : (
          <svg
            className="dl8s-svg"
            viewBox={`0 0 ${L.W} ${L.H}`}
            role="group"
            aria-label={`${cross ? 'Cross' : 'Self'}-attention, query ${cross ? spanish[q] : EN[q]}: weights ${w.map((x, j) => `${EN[j]} ${pct(x)}`).join(', ')}`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="dl8s-cone__top" />
                <stop offset="1" className="dl8s-cone__bot" />
              </linearGradient>
            </defs>

            {narrow ? (
              <>
                <RoleLabel narrow x={6} y={L.yTop - L.tokH / 2 - 26} kind="q" from={cross ? 'decoder' : 'encoder'} />
                <RoleLabel narrow x={6} y={L.yBot + L.tokH / 2 + 22} kind="kv" from="encoder" />
              </>
            ) : (
              <>
                <RoleLabel x={16} y={L.yTop} kind="q" from={cross ? 'decoder' : 'encoder'} />
                <RoleLabel x={16} y={L.yBot} kind="kv" from="encoder" />
              </>
            )}

            {/* the chosen query's cones onto the keys */}
            {EN.map((word, j) => (
              <Cone
                key={word}
                gid={gid}
                x1={topX[q]}
                y1={L.yTop + L.tokH / 2 + 2}
                x2={botX[j]}
                y2={L.yBot - L.tokH / 2}
                half={L.tokW / 2}
                w={w[j]}
              />
            ))}

            {/* queries (click one) */}
            {topWords.map((word, i) => (
              <Token
                key={`${mode}-${word}`}
                className="dl8s-selfx-tok"
                x={topX[i]}
                y={L.yTop}
                w={L.tokW}
                h={L.tokH}
                word={word}
                role={cross ? 'dec' : 'enc'}
                on={i === q}
                onPick={() => setPick((p) => ({ ...p, [mode]: i }))}
                label={cross ? `Query: the decoder writing “${word}”` : `Query: “${word}”`}
              />
            ))}
            {cross && (
              <text x={topX[q]} y={L.yTop - L.tokH / 2 - 7} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">
                input: {inWord}
              </text>
            )}

            {/* keys and values: the English words, lit by their cone */}
            {EN.map((word, j) => (
              <g key={word} onPointerEnter={() => setHover(j)} onPointerLeave={() => setHover(null)}>
                <Token x={botX[j]} y={L.yBot} w={L.tokW} h={L.tokH} word={word} role="enc" />
                <rect
                  className="dl8s-tok__glow"
                  x={botX[j] - L.tokW / 2 + 2}
                  y={L.yBot - L.tokH / 2 + 2}
                  width={L.tokW - 4}
                  height={L.tokH - 4}
                  rx={5}
                  style={{ opacity: 0.32 * w[j] }}
                />
              </g>
            ))}
            {hover !== null && <Tip x={botX[hover]} y={L.yBot - L.tokH / 2 - 4} text={`weight ${fmt(w[hover])}`} />}
          </svg>
        )}
      </div>
    </Stage>
  );
}

/* ── the causal mask, one generation step at a time ───────────────────── */
const MBEATS = [
  { label: '⟨SOS⟩ → me', say: 'At inference only ⟨SOS⟩ goes into the decoder, and it predicts “me”.' },
  { label: '+ me → gusta', say: '“me” is appended to the decoder’s input and the network is run again: it predicts “gusta”.' },
  { label: '+ gusta → el', say: '“gusta” is appended; each row still sees only itself and the words before it.' },
  { label: '+ el → fútbol', say: '“el” is appended, and its row predicts “fútbol”.' },
  { label: '+ fútbol → ⟨EOS⟩', say: 'With “fútbol” appended the decoder outputs ⟨EOS⟩, and generation stops.' },
];

function maskGeom(narrow) {
  if (narrow) {
    const c = 34;
    const gx = 84;
    return { narrow, W: 352, c, gx, gy: 74, rowTokW: 64, tokH: 26, rowX: gx - 8 - 32, arrowX: [gx + 5 * c + 4, gx + 5 * c + 20], outX: gx + 5 * c + 24 + 33, outTokW: 64 };
  }
  const c = 46;
  const gx = 200;
  return { narrow, W: 640, c, gx, gy: 80, rowTokW: 78, tokH: 30, rowX: gx - 14 - 39, arrowX: [gx + 5 * c + 12, gx + 5 * c + 52], outX: gx + 5 * c + 58 + 42, outTokW: 84 };
}

export function MaskLab() {
  const wrap = useRef(null);
  const hid = `dl8s-hatch-${useId().replace(/:/g, '')}`;
  const G = maskGeom(useWidth(wrap) < 520);
  const { c, gx, gy } = G;
  const story = useStory(MBEATS.length);
  const { beat } = story;
  const { model, error } = useToyMT();
  const [head, setHead] = useState('avg');
  const [hover, setHover] = useState(null);

  const r = useMemo(() => (model ? translateCached(model, EN) : null), [model]);
  const A = r ? headRows(r.decSelf, head) : null;
  const toks = r ? r.decIn : ['<sos>', ...ES];
  const outs = r ? [...r.out, '<eos>'] : [...ES, '<eos>'];
  const n = toks.length;
  const H = gy + n * c + (G.narrow ? 46 : 50);
  const row = hover ? hover.i : Math.max(0, beat);
  const live = A ? A[row].slice(0, row + 1) : [];

  return (
    <Stage
      className="dl8s-toy-stage"
      title="The mask, one word at a time"
      slides="slides 31, 41–42"
      tryThis="Predict how much of the triangle the decoder can see after two words, then press ▶ and watch each new word join the input."
      story={<StoryBar story={story} beats={MBEATS} />}
      own={OWN}
      maths={r && (
        <>
          <MEq tex={ATTN_TEX} />
          <MLine text={`The mask keeps every query from the keys after it (slide 31: it “doesn’t attend to words located after it”), so row $${tokTex(toks[row])}$ shares its weight among ${row + 1} key${row ? 's' : ''}: ${live.map((x, j) => `$${fmt(x)}$ on $${tokTex(toks[j])}$`).join(', ')} (${headName(head)}). The masked keys get weight 0.`} />
          <MLine text={'At inference (slide 42) the decoder starts from $\\langle\\text{SOS}\\rangle$ alone; each predicted word is appended to its input and the network is run again, until it outputs $\\langle\\text{EOS}\\rangle$.'} />
          <p className="dl8s-mnote">
            The rows an earlier step computes are the same numbers as the final pass’s rows drawn here: in this one-layer causal decoder, row i depends only on the words at positions up to i. Weights from this page’s own toy transformer (not the slides’ model).
          </p>
        </>
      )}
    >
      <div ref={wrap}>
        <div className="dl8s-toy-ctl">
          <span />
          <Seg label="Which head" options={HEADS} value={head} onChange={setHead} />
        </div>
        {!A ? (
          <ToyWait error={error} minHeight={H * 0.7} />
        ) : (
          <svg
            className="dl8s-svg"
            viewBox={`0 0 ${G.W} ${H}`}
            style={G.narrow ? undefined : { maxWidth: 700, margin: '0 auto' }}
            role="group"
            aria-label={`Decoder masked self-attention after step ${Math.max(beat, 0) + 1}: the input is ${toks.slice(0, beat + 1).map(tokName).join(' ')}, the newest prediction is ${tokName(outs[Math.max(beat, 0)])}`}
          >
            <defs><HatchDef id={hid} /></defs>

            {/* headers */}
            <text x={G.rowX - G.rowTokW / 2} y={gy - (G.narrow ? 44 : 46)} className="dl8s-t dl8s-t--xs">decoder input · queries</text>
            <text x={G.outX} y={gy - (G.narrow ? 44 : 46)} textAnchor="middle" className="dl8s-t dl8s-t--xs">predicts</text>

            {/* keys: the same words, over the columns */}
            {toks.map((t, j) => (
              <text
                key={`k${j}`}
                x={gx + j * c + c / 2}
                y={gy - 9}
                textAnchor="middle"
                className={`dl8s-t dl8s-t--s dl8s-t--dec dl8s-fade${j <= beat ? '' : ' dl8s-hide'}`}
                style={G.narrow ? { fontSize: 10 } : undefined}
              >
                {tokName(t)}
              </text>
            ))}

            {/* the triangle: weights on/below the diagonal, the hatch above it */}
            {toks.map((_, i) =>
              toks.map((__, j) => {
                const masked = j > i;
                const vis = i <= beat && j <= beat;
                return (
                  <rect
                    key={`${i}-${j}`}
                    className={`dl8s-cell dl8s-mask-cell${vis ? '' : ' dl8s-hide'}`}
                    x={gx + j * c + 1}
                    y={gy + i * c + 1}
                    width={c - 2}
                    height={c - 2}
                    rx={3}
                    style={{ fill: masked ? `url(#${hid})` : weightFill('w', A[i][j]) }}
                    onPointerEnter={() => setHover({ i, j })}
                    onPointerLeave={() => setHover(null)}
                  />
                );
              }),
            )}

            {/* rows: the decoder's input so far (the newest one just appended) */}
            {toks.map((t, i) => (
              <g key={`q${i}`} className={`dl8s-mask-pop${i <= beat ? '' : ' dl8s-hide'}`}>
                <Token x={G.rowX} y={gy + i * c + c / 2} w={G.rowTokW} h={G.tokH} word={tokName(t)} role="dec" on={i === beat && i > 0} />
              </g>
            ))}

            {/* each row predicts the next word */}
            {outs.map((o, i) => (
              <g key={`o${i}`} className={`dl8s-fade${i <= beat ? '' : ' dl8s-hide'}`}>
                <Arrow x1={G.arrowX[0]} y1={gy + i * c + c / 2} x2={G.arrowX[1]} y2={gy + i * c + c / 2} on={i === beat} />
                <g className={`dl8s-mask-pop${i <= beat ? '' : ' dl8s-hide'}${i === beat ? ' dl8s-mask-new' : ''}`}>
                  <Token x={G.outX} y={gy + i * c + c / 2} w={G.outTokW} h={G.tokH} word={tokName(o)} role="dec" ghost={o === '<eos>'} />
                </g>
              </g>
            ))}

            {/* key: the hatch */}
            <g className={`dl8s-fade${beat >= 1 ? '' : ' dl8s-hide'}`}>
              <rect x={gx} y={gy + n * c + 14} width={13} height={13} rx={2} style={{ fill: `url(#${hid})` }} />
              <text x={gx + 20} y={gy + n * c + 25} className="dl8s-t dl8s-t--xs">masked: a word after the query</text>
            </g>

            {hover && hover.i <= beat && hover.j <= beat && (
              <Tip
                x={gx + hover.j * c + c / 2}
                y={gy + hover.i * c}
                text={hover.j > hover.i ? 'masked' : `${tokName(toks[hover.i])} → ${tokName(toks[hover.j])}: ${fmt(A[hover.i][hover.j])}`}
              />
            )}
          </svg>
        )}
      </div>
    </Stage>
  );
}
