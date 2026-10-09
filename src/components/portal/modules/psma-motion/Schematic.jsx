import { forwardRef } from 'react';

/* ============================================================================
   PSMA MOTION — NETWORK SCHEMATIC
   ----------------------------------------------------------------------------
   The run 5 network as the checkpoints store it (verified in each fold's
   config): five encoder stages with 32 / 64 / 128 / 256 / 320 channels, every
   one convolutional, with Mamba blocks (2, 2, 4) after the convolution in the
   deepest three, each Mamba block reading in six directions, and a mirrored
   decoder with skip connections. The auxiliary organ head is trained but never
   called at inference, so it is not drawn.

   Every stage is drawn as a convolution box; the gold tiles beside the deep
   stages are their Mamba blocks, one tile per block (C4: the deep stages are
   convolution plus Mamba, not Mamba instead of convolution). The legend says
   what the box numbers are (C5).

   Drawn at 1:1 in stage pixels. Numbers come from the manifest (data-k
   attributes) for gate G8. The timeline moves one pulse along the data path
   (the ref'd polyline) instead of animating dashes.
   ========================================================================== */

const STEP_X = 58;
const STEP_Y = 42;
const BW = 86;
const BH = 38;
const TOP = 70;
const ENC_X0 = 140;
const SIZE = { w: 784, h: 416 };
const ROW = 40;   // legend row pitch

function Glyph({ x, y, s, stroke }) {
  // three axes, an arrowhead at both ends of each: the six reading directions
  const head = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const L = 9 * s;
    const p1 = [x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)];
    const p2 = [x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)];
    return `M${x2} ${y2} L${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]} Z`;
  };
  const axes = [[-1, 0, 1, 0], [0, -1, 0, 1], [-0.7, 0.7, 0.7, -0.7]].map(([a, b, c, d]) => [a * 30 * s, b * 30 * s, c * 30 * s, d * 30 * s]);
  return (
    <g transform={`translate(${x} ${y})`}>
      {axes.map(([x1, y1, x2, y2], i) => (
        <g key={i}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={3 * s} />
          <path d={head(x1, y1, x2, y2)} fill={stroke} />
          <path d={head(x2, y2, x1, y1)} fill={stroke} />
        </g>
      ))}
    </g>
  );
}

const Schematic = forwardRef(function Schematic({ features, mambaBlocks, nDirections, look, words, pulseRef }, flowRef) {
  const enc = features.map((f, i) => ({ f, i, cx: ENC_X0 + STEP_X * i, top: TOP + STEP_Y * i }));
  const mid = enc[enc.length - 1].cx;
  const dec = enc.slice(0, -1).map((e) => ({ ...e, cx: 2 * mid - e.cx }));
  const flowPts = [
    [ENC_X0, TOP - 34],
    ...enc.map((e) => [e.cx, e.top + BH / 2]),
    ...dec.slice().reverse().map((d) => [d.cx, d.top + BH / 2]),
    [dec[0].cx, TOP - 34],
  ];
  const gold = look.gold;
  const box = { fill: look.convFill, stroke: look.convStroke, strokeWidth: 2.5 };
  const legendY = enc[enc.length - 1].top + BH + 46;

  return (
    <svg className="psm-schematic" width={SIZE.w} height={SIZE.h} viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} aria-hidden="true">
      <defs>
        <marker id="psm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={look.ink2} />
        </marker>
      </defs>
      {/* input and output */}
      <text x={ENC_X0} y={TOP - 44} className="psm-sch-io" textAnchor="middle" fill={look.ink2}>{words.input}</text>
      <text x={dec[0].cx} y={TOP - 44} className="psm-sch-io" textAnchor="middle" fill={look.ink2}>{words.output}</text>
      <line x1={ENC_X0} y1={TOP - 34} x2={ENC_X0} y2={TOP - 4} stroke={look.ink2} strokeWidth="2.5" markerEnd="url(#psm-arrow)" />
      <line x1={dec[0].cx} y1={TOP - 4} x2={dec[0].cx} y2={TOP - 34} stroke={look.ink2} strokeWidth="2.5" markerEnd="url(#psm-arrow)" />
      {/* skip connections */}
      {dec.map((d) => (
        <line key={`skip${d.i}`} x1={enc[d.i].cx + BW / 2} y1={d.top + BH / 2} x2={d.cx - BW / 2} y2={d.top + BH / 2}
          stroke={look.muted} strokeWidth="2" strokeDasharray="6 7" />
      ))}
      {/* the data path: drawn faintly, the pulse travels along it */}
      <polyline ref={flowRef} points={flowPts.map((p) => p.join(',')).join(' ')} fill="none"
        stroke={look.muted} strokeWidth="2" strokeLinejoin="round" opacity="0.6" />
      {/* encoder: every stage convolutional, with its channel count; gold tiles = its Mamba
          blocks (2, 2, 4). Opaque boxes, so nothing strikes through the numbers. */}
      {enc.map((e) => (
        <g key={`enc${e.i}`}>
          <rect x={e.cx - BW / 2} y={e.top} width={BW} height={BH} rx="6" {...box} />
          <text x={e.cx} y={e.top + 28} textAnchor="middle" className="psm-sch-num" fill={look.ink}
            data-k="method.features">{e.f}</text>
          {Array.from({ length: mambaBlocks[e.i] }, (_, k) => (
            <rect key={k} x={e.cx - BW / 2 - 22 - (k % 2) * 19} y={e.top + 1 + Math.floor(k / 2) * 19}
              width="16" height="16" rx="2" fill={gold} />
          ))}
        </g>
      ))}
      {/* decoder */}
      {dec.map((d) => (
        <rect key={`dec${d.i}`} x={d.cx - BW / 2} y={d.top} width={BW} height={BH} rx="6" {...box} />
      ))}
      {/* the travelling pulse */}
      <circle ref={pulseRef} cx={ENC_X0} cy={TOP - 34} r="9" fill={gold} stroke="#FFFFFF" strokeWidth="3" opacity="0" />
      {/* legend, three rows */}
      <g transform={`translate(0 ${legendY})`}>
        <rect x="0" y="-21" width="26" height="26" rx="4" {...box} />
        <text x="38" y="0" className="psm-sch-lab" fill={look.ink2}>{words.conv}</text>
      </g>
      <g transform={`translate(0 ${legendY + ROW})`}>
        <rect x="4" y="-19" width="18" height="18" rx="2" fill={gold} />
        <text x="38" y="0" className="psm-sch-lab" fill={look.ink2}>{words.mamba}</text>
      </g>
      <g transform={`translate(0 ${legendY + 2 * ROW})`}>
        <Glyph x={13} y={-10} s={0.42} stroke={gold} />
        <text x="38" y="0" className="psm-sch-lab" fill={look.ink2}>
          {words.dirsA} <tspan data-k="method.n_directions">{nDirections}</tspan> {words.dirsB}
        </text>
      </g>
    </svg>
  );
});

export default Schematic;
