import { Arrow } from '../../../lecture8-study/svgParts.jsx';
import { OBL, LAYOUT, hwScale, depthPx, extent, cellSize } from './geometry';

/* ============================================================================
   KERNEL RUSH — THE STAGE PICTURES (components only)
   ----------------------------------------------------------------------------
   SpecCard    the layer(s) as the slides' Keras code; after landing each line
               shows the block it produced
   BlockStage  input block (H × W × C slabs) · the kernel falling onto it
               (a conv kernel is as deep as the input: each filter spans all
               input channels, slide 15) · the output block: a ghost that grows
               as you type, then the real block lands, and a wrong block lands
               beside it
   GridStage   the receptive-field view: input grid, output grid, the neuron,
               the window that lands on rows i·s_h … i·s_h + f_h − 1 (slide 9)
   Role colours (stage.css): input --dl8s-enc, kernel --dl8s-q, pooling
   window --dl8s-k, output --dl8s-v; a wrong block uses --dlv-red.
   ========================================================================== */

export function SpecCard({ lines, outs = null, title = null, receipt = null, dims }) {
  return (
    <div className="dla-kr__spec">
      {title && <span className="dla-kr__title">{title}{receipt ? ` · ${receipt}` : ''}</span>}
      <pre className="dla-kr__code" aria-label="Layer specification">
        {lines.map((l, i) => (
          <span key={i} className="dla-kr__ln">
            <span className="dla-kr__lncode">{l}</span>
            {outs && <span className="dla-kr__lnout"> → {dims(outs[i])}</span>}
          </span>
        ))}
      </pre>
    </div>
  );
}

export function Block({ x, y, w, h, d, tone, labels = null, slabs = 0, className = '' }) {
  const dx = d * OBL.x;
  const dy = d * OBL.y;
  const n = Math.max(0, Math.min(slabs, 9));
  const slabLines = [];
  for (let k = 1; k < n; k++) {
    const q = k / n;
    slabLines.push(<path key={k} className="dla-kr-blk__slab" d={`M${x + q * dx},${y - h - q * dy} L${x + w + q * dx},${y - h - q * dy} L${x + w + q * dx},${y - q * dy}`} />);
  }
  return (
    <g className={`dla-kr-blk dla-kr-blk--${tone} ${className}`}>
      {d > 0 && <polygon className="dla-kr-blk__side" points={`${x + w},${y - h} ${x + w + dx},${y - h - dy} ${x + w + dx},${y - dy} ${x + w},${y}`} />}
      {d > 0 && <polygon className="dla-kr-blk__top" points={`${x},${y - h} ${x + dx},${y - h - dy} ${x + w + dx},${y - h - dy} ${x + w},${y - h}`} />}
      <rect className="dla-kr-blk__front" x={x} y={y - h} width={w} height={h} />
      {slabLines}
      {labels?.h != null && (
        <text className="dla-kr-lab dla-halo" x={x - 7} y={y - h / 2 + 4} textAnchor="end"><tspan className="dla-kr-lab__k">H </tspan>{labels.h}</text>
      )}
      {labels?.w != null && (
        <text className="dla-kr-lab dla-halo" x={x + w / 2} y={y + 16} textAnchor="middle"><tspan className="dla-kr-lab__k">W </tspan>{labels.w}</text>
      )}
      {labels?.c != null && (
        <text className="dla-kr-lab dla-halo" x={x + w + dx / 2 + 7} y={y - h - dy / 2 + 1}><tspan className="dla-kr-lab__k">C </tspan>{labels.c}</text>
      )}
    </g>
  );
}

/* A labelled dot caption under a block (an optional second, coloured part). */
function Caption({ x, y, tone, text, extra = null, extraTone = 'kernel' }) {
  return (
    <g className={`dla-kr-cap dla-kr-cap--${tone}`}>
      <circle cx={x + 4} cy={y - 4} r={3.6} />
      <text x={x + 12} y={y} className="dla-kr-cap__t">
        {text}
        {extra && <tspan className={`dla-kr-cap__x dla-kr-cap__x--${extraTone}`} dx={10}>{extra}</tspan>}
      </text>
    </g>
  );
}

const asBlock = (s) => (s && s.length === 3 ? s : s && s.length === 1 ? [1, 1, s[0]] : null);
const lab = (s, flat) => (flat ? { c: s[2] } : { h: s[0], w: s[1], c: s[2] });
const fmtB = (s, flat) => (flat ? `(${s[2]},)` : s.join(' × '));

export function BlockStage({ stage, narrow, t, landed, wrong, given, preview, labels: L10n, kernelLabel }) {
  const L = narrow ? LAYOUT.narrow : LAYOUT.wide;
  const [ih, iw, ic] = stage.input;
  const sc = hwScale(Math.max(ih, iw), L.S, L.maxK);
  const dp = (c) => depthPx(c, L.dScale);
  const flat = stage.out.length === 1; // GlobalAvgPool2D → (C,)
  const base = L.base;
  const inX = L.inX;
  const inW = sc(iw);
  const inH = sc(ih);
  const inD = dp(ic);
  const inExt = extent(inW, inH, inD);

  // the kernel (a conv filter is as deep as the input; a pooling window is flat)
  const [kh, kw] = stage.kernel;
  const kind = stage.kind;
  const kW = kind === 'gap' ? inW : Math.max(8, sc(kw));
  const kH = kind === 'gap' ? inH : Math.max(8, sc(kh));
  const kD = kind === 'conv' ? inD : 0;
  const landY = base - inH + kH + (kind === 'gap' ? 0 : 3);
  const startY = kH + kD * OBL.y + 10;
  const fall = Math.max(0, landY - startY);
  const ky = -(1 - t) * fall;
  const kX = inX + (kind === 'gap' ? 0 : 3);

  // the output region
  const outX = narrow ? inX : inX + inExt.w + 140;
  const outBase = narrow ? L.base2 : base;
  const arrow = narrow
    ? { x1: inX + inW / 2, y1: base + 46, x2: inX + inW / 2, y2: base + 76 }
    : { x1: inX + inExt.w + 22, y1: base - 34, x2: outX - 56, y2: base - 34 };

  const real = asBlock(stage.out);
  const draw = (s) => ({ w: sc(s[1]) ?? 9, h: sc(s[0]) ?? 9, d: dp(s[2]) ?? 3 });
  const realG = draw(real);
  const realExt = extent(realG.w, realG.h, realG.d);

  // before landing: the ghost the player is building (empty slots at the input's size)
  const pv = preview ? asBlock(preview) : null;
  const pvFill = pv ? [pv[0] ?? (flat ? 1 : ih), pv[1] ?? (flat ? 1 : iw), pv[2] ?? ic] : null;
  const pvG = pvFill ? draw(pvFill) : null;
  const pvTyped = preview && preview.some((v) => v != null);
  const pvLabels = pv ? (flat ? { c: pv[2] ?? '?' } : { h: pv[0] ?? '?', w: pv[1] ?? '?', c: pv[2] ?? '?' }) : null;

  // after a wrong answer: the player's block beside the real one
  const yours = wrong && given ? asBlock(given) : null;
  const yoursG = yours ? draw(yours.map((v) => (Number.isFinite(v) && v > 0 ? v : 1))) : null;
  const yoursX = outX + realExt.w + (narrow ? 34 : 46);

  return (
    <svg className="dla-svg dla-kr-svg" viewBox={`0 0 ${L.W} ${L.H}`} role="img" aria-label={`Input block ${stage.input.join(' by ')}; ${stage.lines.join(', then ')}${landed ? `; output ${stage.out.join(' by ')}` : '; output not sized yet'}`}>
      <Block x={inX} y={base} w={inW} h={inH} d={inD} tone="in" labels={lab(stage.input, false)} slabs={ic} />
      <Caption x={inX} y={base + 34} tone="in" text={`${L10n.input} ${fmtB(stage.input, false)}`} extra={kernelLabel} extraTone={kind === 'conv' ? 'kernel' : 'pool'} />

      <g className={`dla-kr-fall${landed ? ' dla-kr-fall--landed' : ''}`} style={{ transform: `translateY(${ky}px)` }}>
        <Block x={kX} y={landY} w={kW} h={kH} d={kD} tone={kind === 'conv' ? 'kernel' : 'pool'} className={landed ? 'dla-kr-blk--landed' : ''} />
      </g>

      <Arrow {...arrow} on={landed} />
      <text className="dla-kr-lab dla-kr-lab--layer dla-halo" x={narrow ? arrow.x1 + 12 : (arrow.x1 + arrow.x2) / 2} y={narrow ? (arrow.y1 + arrow.y2) / 2 + 4 : arrow.y1 - 10} textAnchor={narrow ? 'start' : 'middle'}>{stage.layer}</text>

      {!landed && pvG && (
        <g>
          <Block x={outX} y={outBase} w={pvG.w} h={pvG.h} d={pvG.d} tone={pvTyped ? 'preview' : 'ghost'} labels={pvLabels} slabs={pv[2] ?? 0} />
          <Caption x={outX} y={outBase + 34} tone="ghost" text={`${L10n.output} ?`} />
        </g>
      )}
      {landed && (
        <g className="dla-kr-land">
          <Block x={outX} y={outBase} w={realG.w} h={realG.h} d={realG.d} tone="out" labels={lab(real, flat)} slabs={real[2]} />
          <Caption x={outX} y={outBase + 34} tone="out" text={narrow && wrong ? L10n.real : `${wrong ? L10n.real : L10n.output} ${fmtB(real, flat)}`} />
        </g>
      )}
      {landed && yours && (
        <g className="dla-kr-yours">
          <Block x={yoursX} y={outBase} w={yoursG.w} h={yoursG.h} d={yoursG.d} tone="yours" labels={lab(yours, flat)} slabs={Math.min(yours[2] || 1, 9)} />
          <Caption x={yoursX} y={outBase + 34} tone="yours" text={narrow ? L10n.yours : `${L10n.yours} ${fmtB(yours, flat)}`} />
        </g>
      )}
    </svg>
  );
}

export function GridStage({ stage, narrow, t, landed, wrong, given, preview, labels: L10n }) {
  const L = narrow ? LAYOUT.narrow : LAYOUT.wide;
  const [nh, nw] = stage.input;
  const [mh, mw] = stage.out;
  const c = cellSize(Math.max(nh, nw), narrow);
  const inX = narrow ? 44 : 70;
  const inY = narrow ? 34 : 44;
  const [fh, fw] = stage.kernel;
  const outX = narrow ? inX : inX + nw * c + Math.max(120, fw * c + 60);
  const outY = narrow ? inY + nh * c + 66 : inY + Math.max(0, ((nh - mh) * c) / 2);
  const [i, j] = stage.neuron;
  const [fr, fc] = stage.field;
  const rows = stage.axis === 'rows';
  const n = rows ? nh : nw;

  // the window waits beside the grid and slides down it as the clock runs (its
  // position gives nothing away), then lands on its field
  const wx = landed ? inX + fc * c : inX + nw * c + 22;
  const wy = landed ? inY + fr * c : inY + t * Math.max(0, (nh - fh) * c);

  const band = (pair) => {
    if (!pair || pair[0] == null) return null;
    const a = Math.max(0, Math.min(n - 1, pair[0]));
    const b = Math.max(a, Math.min(n - 1, pair[1] ?? pair[0]));
    return rows
      ? { x: inX - 3, y: inY + a * c, w: nw * c + 6, h: (b - a + 1) * c }
      : { x: inX + a * c, y: inY - 3, w: (b - a + 1) * c, h: nh * c + 6 };
  };
  const pvBand = !landed ? band(preview) : null;
  const yourBand = landed && wrong && given ? band(given) : null;
  const realTxt = `${rows ? 'rows' : 'columns'} ${rows ? fr : fc} to ${(rows ? fr + fh : fc + fw) - 1}`;

  const grid = (x, y, r, k) => {
    let d = '';
    for (let q = 1; q < r; q++) d += `M${x},${y + q * c}h${k * c}`;
    for (let q = 1; q < k; q++) d += `M${x + q * c},${y}v${r * c}`;
    return d;
  };
  const neuronX = outX + j * c;
  const neuronY = outY + i * c;
  const cone = narrow
    ? `${inX + fc * c},${inY + (fr + fh) * c} ${inX + (fc + fw) * c},${inY + (fr + fh) * c} ${neuronX + c},${neuronY} ${neuronX},${neuronY}`
    : `${inX + (fc + fw) * c},${inY + fr * c} ${inX + (fc + fw) * c},${inY + (fr + fh) * c} ${neuronX},${neuronY + c} ${neuronX},${neuronY}`;
  const capY = narrow ? inY + nh * c + 22 : inY + nh * c + 26;

  return (
    <svg className="dla-svg dla-kr-svg" viewBox={`0 0 ${L.W} ${L.H}`} role="img" aria-label={`Input grid ${nh} by ${nw}; ${stage.lines[0]}; output grid ${mh} by ${mw}; the neuron at row ${i}, column ${j}${landed ? `; it sees ${realTxt}` : ''}`}>
      {/* input grid with row and column numbers (counted from 0, as on slide 9) */}
      <rect className="dla-kr-grid dla-kr-grid--in" x={inX} y={inY} width={nw * c} height={nh * c} />
      <path className="dla-kr-gridl" d={grid(inX, inY, nh, nw)} />
      {Array.from({ length: nh }, (_, r) => (
        <text key={`r${r}`} className={`dla-kr-idx${rows ? ' dla-kr-idx--on' : ''}`} x={inX - 5} y={inY + r * c + c / 2 + 3.5} textAnchor="end">{r}</text>
      ))}
      {Array.from({ length: nw }, (_, k) => (
        <text key={`c${k}`} className={`dla-kr-idx${!rows ? ' dla-kr-idx--on' : ''}`} x={inX + k * c + c / 2} y={inY - 5} textAnchor="middle">{k}</text>
      ))}

      {pvBand && <rect className="dla-kr-band dla-kr-band--preview" {...{ x: pvBand.x, y: pvBand.y, width: pvBand.w, height: pvBand.h }} />}
      {landed && <polygon className="dla-kr-cone dla-kr-land" points={cone} />}
      {landed && <rect className="dla-kr-field dla-kr-land" x={inX + fc * c} y={inY + fr * c} width={fw * c} height={fh * c} />}
      {yourBand && <rect className="dla-kr-band dla-kr-band--yours dla-kr-yours" {...{ x: yourBand.x, y: yourBand.y, width: yourBand.w, height: yourBand.h }} />}

      <g className={`dla-kr-fall${landed ? ' dla-kr-fall--landed' : ''}`} style={{ transform: `translate(${wx}px, ${wy}px)` }}>
        <rect className="dla-kr-window" x={0} y={0} width={fw * c} height={fh * c} />
      </g>

      {/* output grid and the neuron */}
      <rect className="dla-kr-grid dla-kr-grid--out" x={outX} y={outY} width={mw * c} height={mh * c} />
      <path className="dla-kr-gridl" d={grid(outX, outY, mh, mw)} />
      {Array.from({ length: mh }, (_, r) => (
        <text key={`or${r}`} className="dla-kr-idx" x={outX - 5} y={outY + r * c + c / 2 + 3.5} textAnchor="end">{r}</text>
      ))}
      {Array.from({ length: mw }, (_, k) => (
        <text key={`oc${k}`} className="dla-kr-idx" x={outX + k * c + c / 2} y={outY - 5} textAnchor="middle">{k}</text>
      ))}
      <rect className="dla-kr-neuron" x={neuronX} y={neuronY} width={c} height={c} />
      <text className="dla-kr-lab dla-halo" x={outX + mw * c + 8} y={neuronY + c / 2 + 4}>{L10n.neuron} ({i}, {j})</text>

      <Caption x={inX} y={capY} tone={landed ? 'out' : 'in'} text={landed ? `${wrong ? L10n.real : L10n.field}: ${realTxt}` : `${L10n.input} ${nh} × ${nw}`} />
      {yourBand && <Caption x={inX} y={capY + 18} tone="yours" text={`${L10n.yours}: ${rows ? 'rows' : 'columns'} ${given[0]} to ${given[1]}`} />}
      <Caption x={outX} y={outY + mh * c + 22} tone="ghost" text={`${L10n.output} ${mh} × ${mw}`} />
    </svg>
  );
}
