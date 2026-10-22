import { useRef, useState } from 'react';
import { Stage, StoryBar, MLine } from '../stage';
import { Token, Grid, Arrow } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import './labsNmt.css';

/* ============================================================================
   §1 · ENCODER–DECODER NETWORKS FOR NMT  (slides 4–6, Figure 16-3)
   ----------------------------------------------------------------------------
   LongPathLab    Figure 16-3 as a chain of cells: "I like soccer" goes in,
                  the last encoder state is the only bridge, "Me gusta el
                  fútbol <eos>" comes out. Click a word and its path lights
                  up, with a count of the cells it passes through. Opens on
                  soccer → fútbol, the path slide 18 calls "quite long".
   RightWordLab   slide 6's three phrases. A causal reader that has only
                  read "the right" encodes "right" the same way in all
                  three (identical strips); a reader that also looks ahead
                  encodes it three different ways. The strips are the
                  page's own toy values.
   ========================================================================== */

const ENC = ['I', 'like', 'soccer'];
const DEC_IN = ['<sos>', 'Me', 'gusta', 'el', 'fútbol'];
const DEC_OUT = ['Me', 'gusta', 'el', 'fútbol', '<eos>'];
// which English word each Spanish output mostly carries (the page's reading
// of the running example; "el" goes with "soccer"'s noun)
const SOURCE = { 0: 0, 1: 1, 2: 2, 3: 2 };

const BEATS = [
  { label: 'encode', say: 'The encoder reads “I like soccer” one word at a time, passing its state along.' },
  { label: 'one state', say: 'Only the last encoder state crosses to the decoder: the whole sentence squeezed into one vector.' },
  { label: 'decode', say: 'The decoder writes the translation word by word, each step from the previous one.' },
  { label: 'follow “soccer”', say: 'Follow a word: it passes through cell after cell before its translation comes out.' },
];

function geom(narrow) {
  if (narrow) {
    const encX = [70, 160, 250];
    const decX = [46, 118, 190, 262, 334];
    return { W: 380, H: 346, cw: 52, ch: 34, encX, decX, encY: 62, decY: 258, narrow };
  }
  const encX = [70, 160, 250];
  const decX = [380, 466, 552, 638, 724];
  return { W: 780, H: 230, cw: 62, ch: 38, encX, decX, encY: 118, decY: 118, narrow };
}

// the English word each Spanish output is paired with, and back
const TARGET = { 0: 0, 1: 1, 2: 3 };
const pathFor = (pick) => (pick.side === 'e' ? { from: pick.i, to: TARGET[pick.i] } : { from: SOURCE[pick.t] ?? 0, to: pick.t });

export function LongPathLab() {
  const wrap = useRef(null);
  const G = geom(useWidth(wrap) < 560);
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [pick, setPick] = useState({ side: 'e', i: 2 });
  const { from, to } = pathFor(pick);
  const cells = [...Array.from({ length: 3 - from }, (_, k) => ['e', from + k]), ...Array.from({ length: to + 1 }, (_, k) => ['d', k])];
  const lit = beat >= 3;
  const onPath = (side, i) => lit && cells.some(([s, k]) => s === side && k === i);
  const choose = (p) => { setPick(p); if (beat < 3) story.go(3); };

  const { cw, ch } = G;
  const encOn = beat >= 0;
  const bridgeOn = beat >= 1;
  const decOn = (t) => beat >= 2 || (beat === 1 && t === 0);

  return (
    <Stage
      title="The long path from “soccer” to “fútbol”"
      slides="slides 5, 18 · Figure 16-3"
      tryThis="Predict how many cells “soccer” passes through before “fútbol” comes out, then click other words to compare."
      story={<StoryBar story={story} beats={BEATS} />}
      caption="Only the last encoder state reaches the decoder, so every word must survive the whole trip through it."
      own="the word-to-word pairing is this page’s reading"
      maths={
        <>
          <MLine text={`Path for “${ENC[from]}” → “${DEC_OUT[to]}”: ${cells.map(([s, k]) => (s === 'e' ? `encoder step ${k}` : `decoder step ${k}`)).join(' → ')}: **${cells.length} cells**.`} />
          <p className="dl8s-mnote">Figure 16-3 draws the encoder’s own outputs greyed out (unused): only the last encoder cell’s state crosses into the first decoder cell. Slide 18 calls the path from “soccer” to “fútbol” quite long; [§6](#s06) shortens it.</p>
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl8s-svg" viewBox={`0 0 ${G.W} ${G.H}`} role="group" aria-label={`Figure 16-3 as a chain of cells. Path for ${ENC[from]} to ${DEC_OUT[to]}: ${cells.length} cells.`}>
          {/* region labels */}
          <text x={G.encX[0] - cw / 2} y={G.narrow ? 14 : 22} className="dl8s-t dl8s-t--b dl8s-t--enc">encoder</text>
          <text x={G.decX[0] - cw / 2} y={G.narrow ? G.decY + ch / 2 + 34 : 22} className="dl8s-t dl8s-t--b dl8s-t--dec">decoder</text>

          {/* encoder cells: chained left to right, outputs unused (dashed) */}
          {ENC.map((w, i) => {
            const x = G.encX[i];
            return (
              <g key={w} className={`dl8s-fade${encOn ? '' : ' dl8s-dim'}`}>
                {i > 0 && <Arrow x1={G.encX[i - 1] + cw / 2} y1={G.encY} x2={x - cw / 2 - 2} y2={G.encY} on={onPath('e', i - 1) && onPath('e', i)} />}
                <line className="dl8s-lp__unused" x1={x} y1={G.encY - ch / 2} x2={x} y2={G.encY - ch / 2 - 22} />
                <rect className={`dl8s-lp__cell dl8s-lp__cell--enc${onPath('e', i) ? ' dl8s-lp__cell--on' : ''}`} x={x - cw / 2} y={G.encY - ch / 2} width={cw} height={ch} rx={8} />
                <Arrow x1={x} y1={G.encY + ch / 2 + 26} x2={x} y2={G.encY + ch / 2 + 3} on={onPath('e', i) && i === from} />
                <Token x={x} y={G.encY + ch / 2 + 44} w={cw + 8} h={28} word={w} role="enc" on={pick.side === 'e' && pick.i === i} onPick={() => choose({ side: 'e', i })} label={`Follow “${w}”`} />
              </g>
            );
          })}

          {/* the bridge: last encoder state → first decoder cell */}
          <g className={`dl8s-fade${bridgeOn ? '' : ' dl8s-dim'}`}>
            {G.narrow ? (
              // round the outside, between the two rows of words
              <path className={`dl8s-lp__bridge${lit ? ' dl8s-lp__bridge--on' : bridgeOn ? ' dl8s-lp__bridge--now' : ''}`} d={`M${G.encX[2] + cw / 2} ${G.encY} H ${G.W - 24} V ${(G.encY + G.decY) / 2 + 6} H 10 V ${G.decY} H ${G.decX[0] - cw / 2 - 3}`} />
            ) : (
              <path className={`dl8s-lp__bridge${lit ? ' dl8s-lp__bridge--on' : bridgeOn ? ' dl8s-lp__bridge--now' : ''}`} d={`M${G.encX[2] + cw / 2} ${G.encY} L ${G.decX[0] - cw / 2 - 3} ${G.decY}`} />
            )}
          </g>

          {/* decoder cells: inputs below, outputs above */}
          {DEC_OUT.map((w, t) => {
            const x = G.decX[t];
            const on = decOn(t);
            return (
              <g key={w} className={`dl8s-fade${on ? '' : ' dl8s-dim'}`}>
                {t > 0 && <Arrow x1={G.decX[t - 1] + cw / 2} y1={G.decY} x2={x - cw / 2 - 2} y2={G.decY} on={onPath('d', t - 1) && onPath('d', t)} />}
                <rect className={`dl8s-lp__cell dl8s-lp__cell--dec${onPath('d', t) ? ' dl8s-lp__cell--on' : ''}`} x={x - cw / 2} y={G.decY - ch / 2} width={cw} height={ch} rx={8} />
                <text x={x} y={G.decY + ch / 2 + 18} textAnchor="middle" className="dl8s-t dl8s-t--xs">{DEC_IN[t]}</text>
                <Arrow x1={x} y1={G.decY - ch / 2 - 3} x2={x} y2={G.decY - ch / 2 - 22} on={lit && t === to} />
                {t < 4 ? (
                  <Token x={x} y={G.decY - ch / 2 - 40} w={cw + 8} h={28} word={w} role="dec" on={pick.side === 'd' && pick.t === t} onPick={() => choose({ side: 'd', t })} label={`Trace “${w}”`} />
                ) : (
                  <text x={x} y={G.decY - ch / 2 - 35} textAnchor="middle" className="dl8s-t dl8s-t--s">{w}</text>
                )}
              </g>
            );
          })}

          {/* the count */}
          <g className={`dl8s-fade${lit ? '' : ' dl8s-hide'}`}>
            <text x={G.narrow ? G.W / 2 : (G.encX[2] + G.decX[0]) / 2} y={G.narrow ? G.H - 8 : G.H - 10} textAnchor="middle" className="dl8s-t dl8s-t--b">
              “{ENC[from]}” → “{DEC_OUT[to]}”: through {cells.length} cells
            </text>
          </g>
        </svg>
      </div>
    </Stage>
  );
}

/* ── the right ___ (slide 6) ─────────────────────────────────────────────── */
const PHRASES = [
  { next: 'arm', words: ['the', 'right', 'arm'] },
  { next: 'person', words: ['the', 'right', 'person'] },
  { next: 'to criticize', words: ['the', 'right', 'to', 'criticize'] },
];
// toy encodings of "right": what a reader has after "the right" (the same
// for all three), and what it has once it has also read the next word
const CAUSAL = [0.6, -0.3, 0.4, 0.1];
const AHEAD = [
  [0.9, -0.7, 0.2, 0.5],
  [-0.2, 0.8, 0.7, -0.4],
  [0.3, 0.1, -0.8, 0.9],
];

export function RightWordLab() {
  const [ahead, setAhead] = useState(false);
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const W = narrow ? 360 : 640;
  const rowH = 74;
  const x0 = narrow ? 8 : 40;
  const gap = narrow ? 6 : 10;
  const ww = (w) => Math.max(narrow ? 34 : 44, w.length * (narrow ? 7.4 : 8.6) + 18);

  return (
    <Stage
      title="“The right ___”"
      slides="slide 6"
      tryThis="Predict whether the three “right”s get the same encoding, then let the reader look ahead."
      caption={ahead ? 'Looking at the next word, each “right” gets its own encoding.' : 'A causal reader has only seen “the right”, so all three encodings of “right” are identical.'}
      maths={<MLine text={`Encoding of “right” (toy, d = 4): ${ahead ? AHEAD.map((v, k) => `${PHRASES[k].next}: [${v.join(', ')}]`).join('; ') : `[${CAUSAL.join(', ')}] in all three phrases`}.`} />}
    >
      <div ref={wrap}>
        <div className="dl8s-rw__switch" role="group" aria-label="How the reader reads">
          <button type="button" className={`dl8s-rw__opt${!ahead ? ' dl8s-rw__opt--on' : ''}`} aria-pressed={!ahead} onClick={() => setAhead(false)}>left to right only (causal)</button>
          <button type="button" className={`dl8s-rw__opt${ahead ? ' dl8s-rw__opt--on' : ''}`} aria-pressed={ahead} onClick={() => setAhead(true)}>also looks ahead</button>
        </div>
        <svg className="dl8s-svg" viewBox={`0 0 ${W} ${PHRASES.length * rowH + 10}`} style={{ maxWidth: 720 }} role="img" aria-label={ahead ? 'Three different encodings of right' : 'Three identical encodings of right'}>
          {PHRASES.map((ph, r) => {
            let x = x0;
            const boxes = ph.words.map((w) => {
              const b = { w, x, width: ww(w) };
              x += b.width + gap;
              return b;
            });
            const right = boxes[1];
            const next = boxes[2];
            const y = r * rowH + 24;
            const vec = ahead ? AHEAD[r] : CAUSAL;
            return (
              <g key={ph.next}>
                {/* what the encoding of "right" was built from */}
                <path className="dl8s-rw__arc" d={`M${boxes[0].x + boxes[0].width / 2} ${y - 15} Q ${(boxes[0].x + right.x + right.width) / 2} ${y - 34} ${right.x + right.width / 2 - 6} ${y - 15}`} />
                <path className={`dl8s-rw__arc dl8s-rw__arc--ahead dl8s-fade${ahead ? '' : ' dl8s-hide'}`} d={`M${next.x + next.width / 2} ${y - 15} Q ${(right.x + next.x + next.width) / 2} ${y - 34} ${right.x + right.width / 2 + 6} ${y - 15}`} />
                {boxes.map((b, k) => (
                  <Token key={b.w + k} x={b.x + b.width / 2} y={y} w={b.width} h={28} word={b.w} role="enc" on={k === 1} ghost={!ahead && k > 1} />
                ))}
                <Grid x={right.x + right.width / 2 - 2 * (narrow ? 11 : 13)} y={y + 20} M={[vec]} c={narrow ? 11 : 13} role="enc" max={1} frame={false} />
                {!ahead && r > 0 && <text x={right.x + right.width / 2 + 2 * (narrow ? 11 : 13) + 8} y={y + 20 + (narrow ? 9 : 10)} className="dl8s-t dl8s-t--xs">= same</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </Stage>
  );
}
