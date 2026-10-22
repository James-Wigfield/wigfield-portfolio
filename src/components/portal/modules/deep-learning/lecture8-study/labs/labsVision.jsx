import { useId, useMemo, useRef, useState } from 'react';
import Icon from '../../../../icons';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Token, Arrow, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { gridStep, svgPoint } from '../hooks';
import { useStudy } from '../context';
import { Rich } from '../Rich';
import { pct } from '../attn';
import {
  PX, PATCH, VIT, FEAT, FRISBEE_PATCH, BAR_PITCH, BAND_W, BAND_ROWS, POS_ROWS,
  park, patchBars, linearMasks, posBandMasks, CAPTION, FRISBEE_STEP, attnFor, lookSay,
} from './scene';
import './labsVision.css';

/* ============================================================================
   §15 · VISUAL ATTENTION AND THE VISION TRANSFORMER  (slides 44–46)
   ----------------------------------------------------------------------------
   Both labs draw the same picture: this page's own 96 × 96 pixel park
   (./scene.js), echoing Figure 16-12 without a photo.

   PatchChopperLab     slide 46: ViT treats an image as a sentence of
                       patches. The picture is chopped into 16 × 16 squares
                       (6 × 6 = 36 here), they fly into a row like words,
                       each is flattened to 16 × 16 × 3 = 768 numbers, a
                       linear layer keeps the 768, positional embeddings are
                       added, and the row goes into the transformer. Opens on
                       the whole pipeline; hover or pick a square to see its
                       place in the sequence.
   VisualAttentionLab  slides 44–45, Figure 16-12: the caption "A woman is
                       throwing a frisbee in a park", one word at a time; at
                       each word the scene dims except where the decoder
                       looks, at the resolution of an 8 × 8 grid of CNN
                       feature-map cells. Only "frisbee" is the slide's; the
                       other glows are this page's own illustration.
   ========================================================================== */

/* ── the patch chopper ─────────────────────────────────────────────────── */
const BEATS = [
  { label: 'chop', say: 'Chop the image into little $16 \\times 16$ squares.' },
  { label: 'line up', say: 'Treat the sequence of squares as if it were a sequence of word representations.' },
  { label: 'flatten', say: 'Flatten each square into a $16 \\times 16 \\times 3 = 768$-dimensional vector: the 3 is for the RGB colour channels.' },
  { label: 'linear layer', say: 'A linear layer transforms each vector but retains its dimensionality: still 768 numbers.' },
  { label: '+ positions', say: 'Add positional embeddings, as for a sequence of word embeddings.' },
  { label: 'transformer', say: 'Pass the result to the transformer.' },
];

function chopGeom(narrow) {
  if (narrow) {
    return {
      narrow, W: 360, H: 412, IX: 108, IY: 26, cell: 24, gap: 3,
      RX: 18, pitch: 9, TY: 196, NY: 215, B1Y: 238, BH: 36, LY: 281, LH: 15, B2Y: 303, PY: 359, PH: 10, TRY: 378, TRH: 26,
    };
  }
  return {
    narrow, W: 760, H: 314, IX: 16, IY: 66, cell: 32, gap: 4,
    RX: 236, pitch: 14, TY: 38, NY: 63, B1Y: 88, BH: 50, LY: 146, LH: 17, B2Y: 171, PY: 242, PH: 14, TRY: 270, TRH: 32,
  };
}

const rc = (k) => [Math.floor(k / VIT.cols), k % VIT.cols];

export function PatchChopperLab() {
  const wrap = useRef(null);
  const uid = useId().replace(/:/g, '');
  const G = chopGeom(useWidth(wrap) < 520);
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null); // { k, where: 'img' | 'row' }
  const img = park();
  const bars = patchBars();
  const lin = linearMasks();
  const posb = posBandMasks();

  const IS = G.cell * VIT.cols;
  const bandW = G.pitch * VIT.count;
  const tile = G.pitch - 1;
  const rowX = (k) => G.RX + k * G.pitch;
  const lit = hover ? hover.k : sel;
  const inRow = beat >= 1;

  // where each flying square sits at this beat
  const placeOf = (k) => {
    const [r, c] = rc(k);
    if (inRow) return { x: rowX(k), y: G.TY, s: tile / PATCH };
    if (beat === 0) return { x: G.IX + c * G.cell + G.gap / 2, y: G.IY + r * G.cell + G.gap / 2, s: (G.cell - G.gap) / PATCH }; // cut apart, in place
    return { x: G.IX + c * G.cell, y: G.IY + r * G.cell, s: G.cell / PATCH };
  };

  const onKey = (e) => {
    const cur = sel ?? 0;
    const [r, c] = rc(cur);
    const nx = gridStep(e.key, { r, c }, VIT.rows, VIT.cols);
    if (nx) { e.preventDefault(); setSel(nx.r * VIT.cols + nx.c); }
  };

  const tip = (() => {
    if (!hover) return null;
    const [r, c] = rc(hover.k);
    const at = hover.where === 'row'
      ? { x: rowX(hover.k) + tile / 2, y: G.TY - 2 }
      : { x: G.IX + c * G.cell + G.cell / 2, y: G.IY + r * G.cell + 2 };
    return <Tip x={at.x} y={at.y} text={`position ${hover.k}`} />;
  })();

  const grow = (on, y) => ({ className: 'dl8s-vit__grow', style: { transform: `scaleY(${on ? 1 : 0})`, transformOrigin: `0px ${y}px` } });
  const masked = (id, role, rows) => (
    <>
      <rect width={BAND_W} height={rows} className={`dl8s-vit__ink dl8s-vit__ink--${role}`} mask={`url(#${uid}-${id}p)`} />
      <rect width={BAND_W} height={rows} className="dl8s-vit__ink dl8s-vit__ink--neg" mask={`url(#${uid}-${id}n)`} />
    </>
  );
  const maskDef = (id, urls, rows) => (
    <>
      <mask id={`${uid}-${id}p`} maskUnits="userSpaceOnUse" x={0} y={0} width={BAND_W} height={rows}>
        <image href={urls.pos} width={BAND_W} height={rows} preserveAspectRatio="none" />
      </mask>
      <mask id={`${uid}-${id}n`} maskUnits="userSpaceOnUse" x={0} y={0} width={BAND_W} height={rows}>
        <image href={urls.neg} width={BAND_W} height={rows} preserveAspectRatio="none" />
      </mask>
    </>
  );
  const [sr, sc] = sel !== null ? rc(sel) : [0, 0];

  return (
    <Stage
      title="An image as a sentence of squares"
      slides="slide 46"
      tryThis="Predict how many squares this picture makes, then press ▶ and hover a square to see its place in the sequence."
      story={<StoryBar story={story} beats={BEATS} />}
      challenge={{ text: 'Find the frisbee’s square: which position does it get?', done: sel === FRISBEE_PATCH }}
      own="96 × 96 image, toy layer · this page’s own"
      maths={
        <>
          <MEq tex={'16 \\times 16 \\times 3 = 768'} />
          <MLine text="Each square has $16 \times 16 = 256$ pixels with 3 numbers each (R, G, B): one vector of 768 numbers (slide 46). The linear layer maps 768 numbers to 768 numbers." />
          <MLine text={`This page’s image is $${PX} \\times ${PX}$ pixels, so it chops into $(${PX}/16) \\times (${PX}/16) = ${VIT.rows} \\times ${VIT.cols} = ${VIT.count}$ squares: a sequence of ${VIT.count}. The slides give no image size.`} />
          {sel !== null && <MLine text={`The square in row ${sr + 1}, column ${sc + 1} is number ${sel} in the sequence.`} />}
          <p className="dl8s-mnote">This page numbers the squares in reading order (left to right, top to bottom). Its linear layer is a toy (one 3 × 3 colour mix applied to every pixel, so 768 numbers stay 768), and the violet band only stands in for the positional embeddings: the slide gives no values for either.</p>
        </>
      }
    >
      <div ref={wrap}>
        <svg className="dl8s-svg dl8s-vit" viewBox={`0 0 ${G.W} ${G.H}`} style={G.narrow ? undefined : { maxWidth: 820 }} role="group" aria-label={`The picture chopped into ${VIT.count} squares of 16 by 16 pixels, lined up as a sequence, beat ${Math.max(beat, 0) + 1} of ${BEATS.length}.`}>
          <defs>
            {maskDef('lin', lin, BAND_ROWS)}
            {maskDef('pos', posb, POS_ROWS)}
          </defs>

          {/* the image, with its 16 × 16 grid (shown once the squares have left) */}
          <text x={G.IX} y={G.IY - (G.narrow ? 8 : 22)} className="dl8s-t dl8s-t--b">the image</text>
          <text x={G.narrow ? G.IX + 70 : G.IX} y={G.IY - 8} className="dl8s-t dl8s-t--xs dl8s-t--m">{PX} × {PX} pixels</text>
          <g className={`dl8s-fade${inRow ? '' : ' dl8s-hide'}`}>
            <image href={img.url} x={G.IX} y={G.IY} width={IS} height={IS} className="dl8s-vit__px" />
            {Array.from({ length: VIT.cols - 1 }, (_, j) => (
              <g key={j}>
                <line x1={G.IX + (j + 1) * G.cell} x2={G.IX + (j + 1) * G.cell} y1={G.IY} y2={G.IY + IS} className="dl8s-vit__cut" />
                <line y1={G.IY + (j + 1) * G.cell} y2={G.IY + (j + 1) * G.cell} x1={G.IX} x2={G.IX + IS} className="dl8s-vit__cut" />
              </g>
            ))}
          </g>
          <g
            className="dl8s-vit__picker"
            role="group"
            tabIndex={0}
            aria-label={sel === null ? 'The 36 squares: arrow keys pick one' : `Square in row ${sr + 1}, column ${sc + 1}: position ${sel} in the sequence`}
            onKeyDown={onKey}
            onFocus={() => { if (sel === null) setSel(0); }}
          >
            {Array.from({ length: VIT.count }, (_, k) => {
              const [r, c] = rc(k);
              return (
                <rect
                  key={k}
                  x={G.IX + c * G.cell}
                  y={G.IY + r * G.cell}
                  width={G.cell}
                  height={G.cell}
                  fill="transparent"
                  onPointerEnter={() => setHover({ k, where: 'img' })}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setSel(k)}
                />
              );
            })}
            {sel !== null && <rect x={G.IX + sc * G.cell} y={G.IY + sr * G.cell} width={G.cell} height={G.cell} className="dl8s-vit__mark" />}
          </g>

          {/* the selected square's column through the whole pipeline */}
          {lit !== null && inRow && <rect x={rowX(lit) - 2} y={G.TY - 3} width={tile + 4} height={G.TRY - G.TY + 1} rx={3} className="dl8s-rowband" />}

          {/* 1–2 · the squares, flying from the picture into a row */}
          <text x={G.RX} y={G.TY - 9} className={`dl8s-t dl8s-t--s dl8s-fade${inRow ? '' : ' dl8s-hide'}`}>{G.narrow ? '36 squares in a row, like words' : `${VIT.count} squares in a row, like the words of a sentence`}</text>
          {Array.from({ length: VIT.count }, (_, k) => {
            const [r, c] = rc(k);
            const at = placeOf(k);
            return (
              <g
                key={k}
                className="dl8s-vit__sq"
                style={{ transform: `translate(${at.x}px, ${at.y}px) scale(${at.s})`, transitionDelay: beat === 1 ? `${k * 14}ms` : '0ms' }}
                onPointerEnter={() => setHover({ k, where: inRow ? 'row' : 'img' })}
                onPointerLeave={() => setHover(null)}
                onClick={() => setSel(k)}
              >
                <svg width={PATCH} height={PATCH} viewBox={`${c * PATCH} ${r * PATCH} ${PATCH} ${PATCH}`}>
                  <image href={img.url} width={PX} height={PX} className="dl8s-vit__px" />
                </svg>
                <rect width={PATCH} height={PATCH} className={`dl8s-vit__edge${k === lit ? ' dl8s-vit__edge--on' : ''}`} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          <g className={`dl8s-fade${inRow ? '' : ' dl8s-hide'}`}>
            {Array.from({ length: VIT.count }, (_, k) => k).filter((k) => k % 5 === 0 || k === lit).map((k) => (
              <text key={k} x={rowX(k) + tile / 2} y={G.NY} textAnchor="middle" className={`dl8s-t dl8s-t--xs dl8s-t--m${k === lit ? ' dl8s-vit__num--on' : ''}`}>{k}</text>
            ))}
          </g>

          {/* 3 · flattened: 768 numbers each (R | G | B, 256 each); each strip
              steps back once the story has moved past it */}
          <g className={`dl8s-fade${beat >= 2 ? (beat > 2 ? (beat < BEATS.length - 1 ? ' dl8s-vit__past' : ' dl8s-vit__settled') : '') : ' dl8s-hide'}`}>
            <text x={G.RX} y={G.B1Y - 7} className="dl8s-t dl8s-t--s">{G.narrow ? 'flattened: 16 × 16 × 3 = 768 each' : 'flattened: 16 × 16 × 3 = 768 numbers each (R, G, B)'}</text>
            <g {...grow(beat >= 2, G.B1Y)}>
              <image href={bars} x={G.RX} y={G.B1Y} width={bandW} height={G.BH} preserveAspectRatio="none" />
            </g>
          </g>

          {/* 4 · the linear layer: still 768 */}
          <g className={`dl8s-fade${beat >= 3 ? (beat > 3 ? (beat < BEATS.length - 1 ? ' dl8s-vit__past' : ' dl8s-vit__settled') : '') : ' dl8s-hide'}`}>
            <rect x={G.RX - 4} y={G.LY} width={bandW + 6} height={G.LH} rx={4} className="dl8s-vit__layer" />
            <text x={G.RX + bandW / 2} y={G.LY + G.LH / 2 + 4} textAnchor="middle" className="dl8s-t dl8s-t--s">{G.narrow ? 'linear layer: 768 → 768' : 'linear layer: 768 numbers in, 768 out'}</text>
            <g {...grow(beat >= 3, G.B2Y)}>
              <svg x={G.RX} y={G.B2Y} width={bandW} height={G.BH} viewBox={`0 0 ${BAND_W} ${BAND_ROWS}`} preserveAspectRatio="none" aria-hidden="true">
                {masked('lin', 'enc', BAND_ROWS)}
              </svg>
            </g>
          </g>

          {/* 5 · + positional embeddings */}
          <g className={`dl8s-fade${beat >= 4 ? (beat > 4 ? (beat < BEATS.length - 1 ? ' dl8s-vit__past' : ' dl8s-vit__settled') : '') : ' dl8s-hide'}`}>
            <text x={G.RX} y={G.PY - 6} className="dl8s-t dl8s-t--s dl8s-t--pos">+ positional embeddings, one per position</text>
            <svg x={G.RX} y={G.PY} width={bandW} height={G.PH} viewBox={`0 0 ${BAND_W} ${POS_ROWS}`} preserveAspectRatio="none" aria-hidden="true">
              {masked('pos', 'pos', POS_ROWS)}
            </svg>
          </g>

          {/* 6 · into the transformer */}
          <g className={`dl8s-fade${beat >= 5 ? '' : ' dl8s-hide'}`}>
            {[0.12, 0.5, 0.88].map((f) => (
              <Arrow key={f} x1={G.RX + bandW * f} y1={G.PY + G.PH + 2} x2={G.RX + bandW * f} y2={G.TRY - 1} on head={4} />
            ))}
            <rect x={G.RX - 4} y={G.TRY} width={bandW + 6} height={G.TRH} rx={6} className="dl8s-vit__tf" />
            <text x={G.RX + bandW / 2} y={G.TRY + G.TRH / 2 + 5} textAnchor="middle" className="dl8s-t dl8s-t--b dl8s-t--enc">transformer</text>
          </g>

          {tip}
        </svg>
      </div>
    </Stage>
  );
}

/* ── visual attention: where the decoder looks, word by word ───────────── */
function attnGeom(narrow) {
  if (narrow) return { narrow, W: 360, H: 408, IX: 36, IY: 24, IS: 288, rows: [[0, 4], [4, 9]], TY: [344, 384], tokH: 30 };
  return { narrow, W: 760, H: 384, IX: 236, IY: 14, IS: 288, rows: [[0, 9]], TY: [350], tokH: 32 };
}
const tokW = (w) => Math.max(30, 16 + w.length * 8.2);

// ▶ and the one sentence for this word; the caption words in the picture are the beats
function CaptionBar({ story, say }) {
  const { playing, play, stop } = story;
  return (
    <div className="dl8s-story">
      <div className="dl8s-story__row dl8s-va__bar">
        <button type="button" className="dl8s-story__play" onClick={playing ? stop : play} aria-label={playing ? 'Pause the caption' : 'Play the caption from its first word'}>
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        <p className="dl8s-story__say" aria-live="polite"><Rich text={say} /></p>
      </div>
    </div>
  );
}

export function VisualAttentionLab() {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const tokRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const G = attnGeom(useWidth(wrap) < 520);
  const { printing } = useStudy();
  const story = useStory(CAPTION.length, { start: FRISBEE_STEP, ms: 1300 });
  const { beat, playing } = story;
  const cur = printing ? FRISBEE_STEP : beat; // print: slide 45's own word
  const [hover, setHover] = useState(null);
  const img = park();
  const cell = G.IS / FEAT;

  const W8 = cur >= 0 ? attnFor(cur) : null;
  const wmax = W8 ? Math.max(...W8.flat()) : 1;
  // how dark a cell's veil is: 0 where the decoder looks most, ~0.9 where it barely looks
  const veil = (r, c) => (W8 ? 0.94 * (1 - Math.min(1, (1.25 * W8[r][c]) / wmax)) : 0);
  const top3 = useMemo(() => (W8 ? W8.flatMap((row, r) => row.map((w, c) => ({ r, c, w }))).sort((a, b) => b.w - a.w).slice(0, 3) : []), [W8]);

  // caption tokens, one or two centred rows
  const toks = (() => {
    const out = [];
    G.rows.forEach(([a, b], ri) => {
      const ws = CAPTION.slice(a, b).map(tokW);
      const total = ws.reduce((s, w) => s + w, 0) + 8 * (ws.length - 1);
      let x = G.narrow ? G.W / 2 - total / 2 : G.IX;
      ws.forEach((w, j) => {
        out.push({ i: a + j, x: x + w / 2, y: G.TY[ri], w });
        x += w + 8;
      });
    });
    return out;
  })();

  const focusTok = (i) => {
    const els = tokRef.current?.querySelectorAll('.dl8s-tok--btn');
    els?.[i]?.focus();
  };
  const onTokKey = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (d !== undefined) next = Math.max(0, Math.min(CAPTION.length - 1, Math.max(beat, 0) + d));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CAPTION.length - 1;
    if (next !== null) { e.preventDefault(); story.go(next); focusTok(next); }
  };

  const onMove = (e) => {
    const pt = svgPoint(e, svgRef.current);
    if (!pt || !W8) return;
    const c = Math.floor((pt.x - G.IX) / cell);
    const r = Math.floor((pt.y - G.IY) / cell);
    setHover(r >= 0 && r < FEAT && c >= 0 && c < FEAT ? { r, c } : null);
  };

  const word = cur >= 0 ? CAPTION[cur] : null;
  const say = cur < 0
    ? 'The decoder has not written a word yet.'
    : cur === FRISBEE_STEP
      ? 'Slide 45: at “frisbee”, *most of its attention was focused on the frisbee*.'
      : `At “${word}”: ${lookSay(cur)} (this page’s own guess).`;
  const ext = (i) => (i === 0 ? -24 : 0); // edge cells reach past the picture, so the blur doesn't fade its border
  const extW = (i) => (i === 0 || i === FEAT - 1 ? 24 : 0);
  const mid = toks.find((t) => t.i === cur);

  return (
    <Stage
      title="At each word, a different part of the picture"
      slides="slides 44–45 · Figure 16-12"
      tryThis="Predict where the decoder looks for “frisbee” and for “park”, then click the words (or press ▶)."
      story={<CaptionBar story={story} say={say} />}
      caption="A CNN turns the image into feature maps; at each word, the decoder RNN’s attention focuses on just the right part of the image (slide 44)."
      own="the drawn park and every glow · this page’s own (only “frisbee” follows slide 45)"
      maths={
        <>
          <MLine text={word ? `At “${word}” (step $t = ${cur}$), the attention gives each of the $${FEAT} \\times ${FEAT} = ${FEAT * FEAT}$ feature-map cells a weight; the weights add up to 1. Largest: ${top3.map(({ r, c, w }) => `row ${r + 1}, column ${c + 1}: ${pct(w)}`).join('; ')}.` : 'No word yet: nothing to weigh.'} />
          <p className="dl8s-mnote">The slides give no formula for visual attention. Like the attention in §6 (slide 20), the weights pick out a weighted sum, here of what the CNN’s feature maps hold at each cell. The 8 × 8 grid and every weight are this page’s own illustration, not a trained model; only “frisbee” follows slide 45 (Figure 16-12).</p>
        </>
      }
    >
      <div ref={wrap}>
        <svg ref={svgRef} className="dl8s-svg dl8s-va" viewBox={`0 0 ${G.W} ${G.H}`} style={G.narrow ? undefined : { maxWidth: 820 }} role="group" aria-label={word ? `Caption word ${cur + 1} of ${CAPTION.length}, “${word}”: the brightest part of the picture is where the decoder looks.` : 'The caption has not started.'}>
          <defs>
            <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={cell / 4} />
            </filter>
            <mask id={`${uid}-veil`} maskUnits="userSpaceOnUse" x={G.IX - 30} y={G.IY - 30} width={G.IS + 60} height={G.IS + 60}>
              <g filter={`url(#${uid}-blur)`}>
                {Array.from({ length: FEAT * FEAT }, (_, n) => {
                  const r = Math.floor(n / FEAT);
                  const c = n % FEAT;
                  return (
                    <rect
                      key={n}
                      x={G.IX + c * cell + ext(c)}
                      y={G.IY + r * cell + ext(r)}
                      width={cell + extW(c)}
                      height={cell + extW(r)}
                      className="dl8s-va__veil"
                      style={{ opacity: veil(r, c) }}
                    />
                  );
                })}
              </g>
            </mask>
            <clipPath id={`${uid}-clip`}>
              <rect x={G.IX} y={G.IY} width={G.IS} height={G.IS} rx={6} />
            </clipPath>
          </defs>

          {/* labels */}
          {G.narrow ? (
            <text x={G.IX} y={G.IY - 8} className="dl8s-t dl8s-t--xs">image · feature-map cells: 8 × 8 here (this page’s)</text>
          ) : (
            <g>
              <text x={G.IX - 18} y={G.IY + 18} textAnchor="end" className="dl8s-t dl8s-t--b">image</text>
              <text x={G.IX - 18} y={G.IY + 34} textAnchor="end" className="dl8s-t dl8s-t--xs">a CNN reads it into</text>
              <text x={G.IX - 18} y={G.IY + 47} textAnchor="end" className="dl8s-t dl8s-t--xs">feature maps (8 × 8 cells here)</text>
              <text x={G.IX - 18} y={G.TY[0] - 4} textAnchor="end" className="dl8s-t dl8s-t--b dl8s-t--dec">decoder</text>
              <text x={G.IX - 18} y={G.TY[0] + 11} textAnchor="end" className="dl8s-t dl8s-t--xs">one word per step</text>
            </g>
          )}

          {/* the picture, dimmed except where the decoder looks */}
          <g clipPath={`url(#${uid}-clip)`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <image href={img.url} x={G.IX} y={G.IY} width={G.IS} height={G.IS} className="dl8s-vit__px" />
            <image href={img.dimUrl} x={G.IX} y={G.IY} width={G.IS} height={G.IS} className="dl8s-vit__px" mask={`url(#${uid}-veil)`} />
            {Array.from({ length: FEAT - 1 }, (_, j) => (
              <g key={j}>
                <line x1={G.IX + (j + 1) * cell} x2={G.IX + (j + 1) * cell} y1={G.IY} y2={G.IY + G.IS} className="dl8s-va__grid" />
                <line y1={G.IY + (j + 1) * cell} y2={G.IY + (j + 1) * cell} x1={G.IX} x2={G.IX + G.IS} className="dl8s-va__grid" />
              </g>
            ))}
            {hover && W8 && <rect x={G.IX + hover.c * cell} y={G.IY + hover.r * cell} width={cell} height={cell} className="dl8s-va__hcell" />}
          </g>
          <rect x={G.IX} y={G.IY} width={G.IS} height={G.IS} rx={6} className="dl8s-va__frame" />

          {/* the caption: the decoder's words, one per step (click one) */}
          {mid && !G.narrow && (
            <path d={`M${mid.x - 6} ${mid.y - G.tokH / 2 - 5} L${mid.x} ${mid.y - G.tokH / 2 - 12} L${mid.x + 6} ${mid.y - G.tokH / 2 - 5} Z`} className="dl8s-va__caret" />
          )}
          <g ref={tokRef} role="group" aria-label="The caption, one word per decoder step (arrow keys move between words)" onKeyDown={onTokKey}>
            {toks.map(({ i, x, y, w }) => (
              <Token
                key={i}
                x={x}
                y={y}
                w={w}
                h={G.tokH}
                word={CAPTION[i]}
                role="dec"
                on={i === cur}
                ghost={cur < 0 || (playing && i > cur)}
                onPick={() => story.go(i)}
                label={`Step ${i}: “${CAPTION[i]}”`}
              />
            ))}
          </g>

          {hover && W8 && <Tip x={G.IX + hover.c * cell + cell / 2} y={G.IY + hover.r * cell + 4} text={`α = ${pct(W8[hover.r][hover.c])}`} />}
        </svg>
      </div>
    </Stage>
  );
}
