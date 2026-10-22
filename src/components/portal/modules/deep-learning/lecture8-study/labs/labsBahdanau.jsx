import { useId, useMemo, useRef, useState } from 'react';
import { Stage, StoryBar, MLine, MEq } from '../stage';
import { Token, Grid, Cone, Arrow, Knob, Tip } from '../svgParts';
import { useStory } from '../story';
import { useWidth } from '../useWidth';
import { softmax, weightedSum, fmt, fmtVec, pct } from '../attn';
import { EN, ES, Y, E_SCORES } from '../toys';

/* ============================================================================
   §6 · ATTENTION: WHERE DOES THE DECODER LOOK?  (slides 19–23, Figure 16-7)
   ----------------------------------------------------------------------------
   The decoder's output words on top, the encoder's words and outputs y(i)
   below. For the chosen decoder step t, a cone of light from ⊕ falls on
   each encoder word, as bright as its weight α(t,i): where the decoder
   looks. The alignment model's scores e(t,i) are the handles beside the
   words; softmax turns them into the weights; ⊕ holds the weighted sum
   Σ α y that goes up into the decoder. Opens on t = 3 ("fútbol"), slide
   23's case, with "soccer" already lit. Story: score → softmax → sum.
   ========================================================================== */

const BEATS = [
  { label: 'score', say: 'The alignment model scores each encoder output $\\mathbf{y}_{(i)}$ against the decoder’s state: one score $e_{(t,i)}$ each.' },
  { label: 'softmax', say: 'Softmax turns the three scores into weights $\\alpha_{(t,i)}$ that add up to 1: the beams.' },
  { label: 'weighted sum', say: 'The weighted sum of the encoder outputs goes up into the decoder for this step.' },
];

const clone = (M) => M.map((r) => [...r]);

function layout(narrow) {
  if (narrow) {
    return {
      W: 380, H: 372, tokW: 70, tokH: 30, knobDx: 50,
      dec: [50, 136, 222, 308], enc: [52, 172, 292],
      yDec: 50, yPlus: 118, yEnc: 268, yKnobTop: 236, yKnobBot: 300, yStrip: 304,
    };
  }
  return {
    W: 760, H: 372, tokW: 88, tokH: 34, knobDx: 64,
    dec: [240, 360, 480, 600], enc: [250, 420, 590],
    yDec: 50, yPlus: 120, yEnc: 268, yKnobTop: 232, yKnobBot: 304, yStrip: 304,
  };
}

export function BeamsLab() {
  const wrap = useRef(null);
  const gid = `dl8s-cone-${useId().replace(/:/g, '')}`;
  const narrow = useWidth(wrap) < 520;
  const L = layout(narrow);
  const story = useStory(BEATS.length);
  const { beat } = story;
  const [t, setT] = useState(3);
  const [scores, setScores] = useState(() => clone(E_SCORES));
  const [hover, setHover] = useState(null);

  const e = scores[t];
  const alpha = useMemo(() => softmax(e), [e]);
  const ctx = useMemo(() => weightedSum(alpha, Y), [alpha]);
  const edited = scores.some((r, i) => r.some((v, j) => v !== E_SCORES[i][j]));
  const challengeDone = t === 1 && softmax(scores[1])[2] >= 0.6;

  const setScore = (i, v) => setScores((prev) => prev.map((r, ti) => (ti === t ? r.map((x, j) => (j === i ? v : x)) : r)));
  const pick = (ti) => { setT(ti); if (beat < 2) story.go(2); };

  const xs = L.dec[t];
  const cell = narrow ? 13 : 15;
  const stripW = 4 * cell;
  const showBeams = beat >= 1;
  const showSum = beat >= 2;

  return (
    <Stage
      title="Where does the decoder look?"
      slides="slides 20–23 · Figure 16-7"
      tryThis="Predict where “me” and “gusta” look, click them, then drag a score handle and watch every beam re-balance."
      story={<StoryBar story={story} beats={BEATS} />}
      challenge={{ text: 'Make “gusta” look mostly at “soccer”.', done: challengeDone }}
      maths={
        <>
          <MLine text={`Step $t = ${t}$, the decoder outputs “${ES[t]}”. The alignment model’s scores: ${e.map((v, i) => `$e_{(${t},${i})} = ${fmt(v)}$`).join(', ')}.`} />
          <MEq tex={'\\alpha_{(t,i)} = \\frac{\\exp\\big(e_{(t,i)}\\big)}{\\sum\\limits_{i\'} \\exp\\big(e_{(t,i\')}\\big)}'} />
          <MLine text={`${alpha.map((a, i) => `$\\alpha_{(${t},${i})} = ${fmt(a)}$`).join(', ')}: they add up to 1.`} />
          <MEq tex={'\\widetilde{\\mathbf{h}}_{(t)} = \\sum_{i} \\alpha_{(t,i)} \\mathbf{y}_{(i)}'} />
          <MLine text={`$= ${alpha.map((a, i) => `${fmt(a)}\\,\\mathbf{y}_{(${i})}`).join(' + ')} = ${fmtVec(ctx)}$, with this page’s toy outputs ${Y.map((y, i) => `$\\mathbf{y}_{(${i})} = ${fmtVec(y)}$`).join(', ')}.`} />
          <p className="dl8s-mnote">The weighted sum is written out on slide 25 (Luong); slide 20 describes it in words. The scores here are this page’s own toy values, not a trained alignment model.</p>
        </>
      }
    >
      <div ref={wrap} className="dl8s-beams">
        {edited && (
          <button type="button" className="dl8s-floorbtn dl8s-noprint" onClick={() => setScores(clone(E_SCORES))}>reset scores</button>
        )}
        <svg className="dl8s-svg" viewBox={`0 0 ${L.W} ${L.H}`} role="group" aria-label={`Decoder step ${t} (${ES[t]}): attention weights ${alpha.map((a, i) => `${EN[i]} ${pct(a)}`).join(', ')}`}>
          {/* row labels */}
          {!narrow && (
            <g>
              <text x={8} y={L.yDec - 4} className="dl8s-t dl8s-t--b dl8s-t--dec">decoder</text>
              <text x={8} y={L.yDec + 13} className="dl8s-t dl8s-t--xs">outputs, step t</text>
              <text x={8} y={L.yEnc - 4} className="dl8s-t dl8s-t--b dl8s-t--enc">encoder</text>
              <text x={8} y={L.yEnc + 13} className="dl8s-t dl8s-t--xs">words, outputs y(i)</text>
              <text x={8} y={L.yEnc + 26} className="dl8s-t dl8s-t--xs">handles = scores e(t,i)</text>
            </g>
          )}
          {narrow && (
            <g>
              <text x={6} y={14} className="dl8s-t dl8s-t--xs dl8s-t--dec">decoder outputs</text>
              <text x={6} y={L.H - 4} className="dl8s-t dl8s-t--xs dl8s-t--enc">encoder words and outputs y(i)</text>
            </g>
          )}

          {/* cones of light: ⊕ → each encoder word, as bright as its weight */}
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="dl8s-cone__top" />
              <stop offset="1" className="dl8s-cone__bot" />
            </linearGradient>
          </defs>
          {EN.map((w, i) => (
            <Cone
              key={w}
              gid={gid}
              x1={xs}
              y1={L.yPlus + 12}
              x2={L.enc[i]}
              y2={L.yEnc - L.tokH / 2}
              half={L.tokW / 2}
              w={showBeams ? alpha[i] : 0}
            />
          ))}

          {/* ⊕ and the context strip, then up into the decoder */}
          <g className={`dl8s-fade${showSum ? '' : ' dl8s-dim'}`}>
            <Arrow x1={xs} y1={L.yPlus - 13} x2={xs} y2={L.yDec + L.tokH / 2 + 3} on={showSum} />
          </g>
          <g className="dl8s-plus">
            <circle cx={xs} cy={L.yPlus} r={12} className="dl8s-plus__c" />
            <path d={`M${xs - 6} ${L.yPlus} H${xs + 6} M${xs} ${L.yPlus - 6} V${L.yPlus + 6}`} className="dl8s-plus__x" />
          </g>
          <g className={`dl8s-fade${showSum ? '' : ' dl8s-hide'}`}>
            <Grid x={xs + 20} y={L.yPlus - cell / 2} M={[ctx]} c={cell} role="enc" max={1} frame={false} />
            {!narrow && <text x={xs + 20 + stripW + 8} y={L.yPlus + 4} className="dl8s-t dl8s-t--xs">Σ α y</text>}
          </g>

          {/* decoder output words (click = choose the step) */}
          {ES.map((w, ti) => (
            <g key={w}>
              <text x={L.dec[ti]} y={L.yDec - L.tokH / 2 - 7} textAnchor="middle" className="dl8s-t dl8s-t--xs dl8s-t--m">t = {ti}</text>
              <Token
                x={L.dec[ti]}
                y={L.yDec}
                w={L.tokW}
                h={L.tokH}
                word={w}
                role="dec"
                on={ti === t}
                ghost={ti > t}
                onPick={() => pick(ti)}
                label={`Decoder step ${ti}: ${w}`}
              />
            </g>
          ))}

          {/* encoder words (lit by their cone), their outputs y(i), and the
              score handle beside each word */}
          {EN.map((w, i) => (
            <g key={w} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <Token x={L.enc[i]} y={L.yEnc} w={L.tokW} h={L.tokH} word={w} role="enc" />
              <rect
                className="dl8s-tok__glow"
                x={L.enc[i] - L.tokW / 2 + 2}
                y={L.yEnc - L.tokH / 2 + 2}
                width={L.tokW - 4}
                height={L.tokH - 4}
                rx={5}
                style={{ opacity: showBeams ? 0.32 * alpha[i] : 0 }}
              />
              <Grid x={L.enc[i] - stripW / 2} y={L.yEnc + L.tokH / 2 + 8} M={[Y[i]]} c={cell} role="enc" max={1} frame={false} />
              {!narrow && <text x={L.enc[i] - stripW / 2 - 6} y={L.yEnc + L.tokH / 2 + 8 + cell - 3} textAnchor="end" className="dl8s-t dl8s-t--xs dl8s-t--m">y({i})</text>}
              <Knob
                x={L.enc[i] + L.knobDx}
                yTop={L.yKnobTop}
                yBot={L.yKnobBot}
                value={e[i]}
                grow={beat >= 0 ? 1 : 0}
                onChange={(v) => { setScore(i, v); if (beat < 2) story.go(2); }}
                label={`Score e(${t},${i}) for “${w}”`}
              />
              {i === 0 && !narrow && <text x={L.enc[i] + L.knobDx} y={L.yKnobTop - 10} textAnchor="middle" className="dl8s-t dl8s-t--xs">score</text>}
            </g>
          ))}

          {/* numbers on demand: hover an encoder word */}
          {hover !== null && (
            <Tip x={L.enc[hover]} y={L.yEnc - L.tokH / 2 - 4} text={`e = ${fmt(e[hover])} → α = ${pct(alpha[hover])}`} />
          )}
        </svg>
      </div>
    </Stage>
  );
}
