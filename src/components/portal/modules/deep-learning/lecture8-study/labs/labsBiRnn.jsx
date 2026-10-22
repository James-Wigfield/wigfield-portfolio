import { useRef } from 'react';
import { Stage, StoryBar, MLine } from '../stage';
import { Token, Grid } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import './labsBiRnn.css';

/* ============================================================================
   §2 · BIDIRECTIONAL RNNs AND LSTMs  (slides 7–8, Figure 16-5)
   ----------------------------------------------------------------------------
   BiReadersLab  one story: a forward reader sweeps "I like soccer" left to
                 right, a backward reader right to left; at each word the two
                 states are concatenated into one output (two coloured
                 halves). Then the bidirectional LSTM's four final states —
                 forward h and c, backward h and c, in that order (slide 8's
                 comments: 0 & 2 short-term, 1 & 3 long-term) — fold into
                 two: encoder_state[::2] and encoder_state[1::2].
                 Every number is a toy value (3 per direction).
   ========================================================================== */

const WORDS = ['I', 'like', 'soccer'];
// toy per-step states, 3 numbers per direction
const FWD = [[0.7, -0.2, 0.3], [0.2, 0.8, -0.4], [-0.3, 0.5, 0.9]];
const BWD = [[0.4, 0.6, -0.5], [-0.6, 0.3, 0.7], [0.8, -0.4, 0.2]];
const C_FWD = [0.5, -0.7, 0.6];
const C_BWD = [-0.2, 0.9, -0.6];
// the four final states, in the order Keras returns them
const FINAL = [
  { k: 0, name: 'h →', what: 'forward short-term', v: FWD[2], dir: 'f' },
  { k: 1, name: 'c →', what: 'forward long-term', v: C_FWD, dir: 'f' },
  { k: 2, name: 'h ←', what: 'backward short-term', v: BWD[0], dir: 'b' },
  { k: 3, name: 'c ←', what: 'backward long-term', v: C_BWD, dir: 'b' },
];

const BEATS = [
  { label: 'forward', say: 'The forward layer reads left to right: “I”, then “like”, then “soccer”.' },
  { label: 'backward', say: 'The backward layer reads the same words right to left.' },
  { label: 'concatenate', say: 'At each word the two outputs are concatenated: one output that has seen both sides.' },
  { label: 'four states', say: 'A bidirectional LSTM ends with four states: short-term and long-term, forward and backward.' },
  { label: 'fold into two', say: '`[::2]` joins the two short-term states, `[1::2]` the two long-term ones: two states the decoder can take.' },
];

// forward halves in the encoder's teal, backward halves in amber; `delay`
// staggers a reader's sweep across the words
function Strip({ x, y, v, c, dir, faded = false, delay = 0 }) {
  return (
    <g className={`dl8s-bi__strip dl8s-bi__strip--${dir} dl8s-fade${faded ? ' dl8s-hide' : ''}`} style={{ transitionDelay: faded ? '0s' : `${delay}s` }}>
      <Grid x={x} y={y} M={[v]} c={c} role={dir === 'f' ? 'enc' : 'bwd'} max={1} frame={false} />
      <rect className="dl8s-bi__frame" x={x - 1} y={y - 1} width={v.length * c + 2} height={c + 2} rx={3} />
    </g>
  );
}

export function BiReadersLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 560;
  const story = useStory(BEATS.length);
  const { beat } = story;
  const c = narrow ? 11 : 14;
  const W = narrow ? 380 : 760;
  const H = narrow ? 470 : 262;
  const wx = narrow ? [70, 190, 310] : [80, 210, 340];
  const yTok = narrow ? 170 : 172;
  const yOut = yTok - 70;
  const showF = beat >= 0;
  const showB = beat >= 1;
  const joined = beat >= 2;
  // final-state panel
  const px = narrow ? 40 : 446;
  const py = narrow ? 262 : 34;

  return (
    <Stage
      title="Two readers, one sentence"
      slides="slides 7–8 · Figure 16-5"
      tryThis="Predict what the output above “like” has seen, press ▶, then watch the four final states fold into two."
      story={<StoryBar story={story} beats={BEATS} />}
      own="toy numbers · this page’s own (3 per direction)"
      maths={
        <>
          <MLine text="At each step: output = [forward output ; backward output], so it is twice as wide (Figure 16-5’s “Concatenate”)." />
          <MLine text="`encoder_state` = [h →, c →, h ←, c ←] (items 0–3). `encoder_state[::2]` = items 0 and 2, the two short-term states; `encoder_state[1::2]` = items 1 and 3, the two long-term states (slide 8’s comments)." />
          <MLine text="With slide 8’s `LSTM(256)` each concatenated state is 512 wide (this page’s working)." />
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl8s-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="A bidirectional layer over I like soccer, and its four final states folding into two">
          {/* the two readers' sweeps */}
          <g className={`dl8s-fade${beat >= 0 ? '' : ' dl8s-hide'}`}>
            <path className="dl8s-bi__sweep dl8s-bi__sweep--f" d={`M${wx[0] - 30} ${yTok + 30} H${wx[2] + 30}`} />
            <text x={wx[0] - 30} y={yTok + 46} className="dl8s-t dl8s-t--xs">forward →</text>
          </g>
          <g className={`dl8s-fade${showB ? '' : ' dl8s-hide'}`}>
            <path className="dl8s-bi__sweep dl8s-bi__sweep--b" d={`M${wx[2] + 30} ${yTok + 56} H${wx[0] - 30}`} />
            <text x={wx[2] + 30} y={yTok + 72} textAnchor="end" className="dl8s-t dl8s-t--xs">← backward</text>
          </g>

          {WORDS.map((w, i) => {
            const half = 3 * c;
            const xL = wx[i] - half - (joined ? 0 : 4);
            const xR = wx[i] + (joined ? 0 : 4);
            return (
              <g key={w}>
                <Token x={wx[i]} y={yTok} w={narrow ? 70 : 84} h={30} word={w} role="enc" />
                <line className={`dl8s-bi__up dl8s-fade${beat >= 0 ? '' : ' dl8s-hide'}`} x1={wx[i]} y1={yTok - 16} x2={wx[i]} y2={yOut + c + 4} />
                <Strip x={xL} y={yOut} v={FWD[i]} c={c} dir="f" faded={!showF} delay={0.35 * i} />
                <Strip x={xR} y={yOut} v={BWD[i]} c={c} dir="b" faded={!showB} delay={0.35 * (2 - i)} />
                <text x={wx[i]} y={yOut - 10} textAnchor="middle" className={`dl8s-t dl8s-t--xs dl8s-t--m dl8s-fade${joined ? '' : ' dl8s-hide'}`}>ŷ({i})</text>
              </g>
            );
          })}

          {/* the four final states, then folded into two */}
          <g className={`dl8s-fade${beat >= 3 ? '' : ' dl8s-hide'}`}>
            <text x={px} y={py} className="dl8s-t dl8s-t--b">final states</text>
            {FINAL.map((f, n) => {
              const y = py + 18 + n * (c + 12);
              return (
                <g key={f.k}>
                  <text x={px} y={y + c - 2} className="dl8s-t dl8s-t--xs dl8s-t--m">{f.k}</text>
                  <text x={px + 14} y={y + c - 2} className="dl8s-t dl8s-t--s">{f.name}</text>
                  <Strip x={px + 46} y={y} v={f.v} c={c} dir={f.dir} />
                </g>
              );
            })}
          </g>
          <g className={`dl8s-fade${beat >= 4 ? '' : ' dl8s-hide'}`}>
            {/* [::2] joins rows 0 and 2 (the short-term states), [1::2] rows 1
                and 3 (the long-term ones); the two folds cross on purpose */}
            {[
              { lab: 'short-term', code: '[::2] → 0 & 2', rows: [0, 2], at: 0, labelAbove: true },
              { lab: 'long-term', code: '[1::2] → 1 & 3', rows: [1, 3], at: 3, labelAbove: false },
            ].map((g) => {
              const rowY = (n) => py + 18 + n * (c + 12);
              const fx = px + 46 + 3 * c + (narrow ? 34 : 40);
              const x0 = px + 46 + 3 * c + 4;
              const gy = rowY(g.at);
              return (
                <g key={g.lab}>
                  {g.rows.map((n) => (
                    <path key={n} className="dl8s-bi__fold" d={`M${x0} ${rowY(n) + c / 2} C ${fx - 20} ${rowY(n) + c / 2}, ${fx - 20} ${gy + c / 2}, ${fx - 6} ${gy + c / 2}`} />
                  ))}
                  <Strip x={fx} y={gy} v={FINAL[g.rows[0]].v} c={c} dir="f" />
                  <Strip x={fx + 3 * c} y={gy} v={FINAL[g.rows[1]].v} c={c} dir="b" />
                  <text x={fx} y={g.labelAbove ? gy - 6 : gy + c + 14} className="dl8s-t dl8s-t--xs"><tspan className="dl8s-t--b">{g.lab}</tspan> · <tspan className="dl8s-t--m">{g.code}</tspan></text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </Stage>
  );
}
