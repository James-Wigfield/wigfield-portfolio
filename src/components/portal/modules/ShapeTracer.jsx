import { useState, useMemo, useEffect, useRef, useId } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Icon from '../icons';
import './ShapeTracer.css';

/* ============================================================================
   SHAPE TRACER — the voxel's journey through the encoder  (University)
   ----------------------------------------------------------------------------
   Layer D of the learning plan: connect the abstract selective scan to the
   ACTUAL Mamba_PSMA network. The network is drawn as a real U-Net PICTURE —
   each feature map is a scaled 3-D slab (tall+thin at full res, short+wide at
   the bottleneck) laid out in the classic U, with skip arrows across it. The
   picture is live: change the patch size and every slab re-sizes.

   Grounded in real code: stages mirror baseline.yaml `model:`
   (features/strides/mamba_blocks); shape arithmetic matches encoder.py
   (Conv3d k3 s2 p1) and mamba_block_3d.py (flatten (B,C,d,h,w)→(B,L,C),
   L=d·h·w, one scan per direction). decoder.py / psma_mamba.py are still stubs,
   so the expanding path is drawn dashed and badged "planned".

   Styled with the portal Reading-Room tokens via the .st-* block in
   ShapeTracer.css so it re-skins with the active theme.
   ========================================================================== */

function Tex({ src, block = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) katex.render(src, ref.current, { throwOnError: false, displayMode: block });
  }, [src, block]);
  return <span ref={ref} className={block ? 'st-tex-block' : 'st-tex-inline'} />;
}

// ── Architecture (from configs/baseline.yaml → model:) ────────────────────────
const ARCH = {
  features: [32, 64, 128, 256, 320],
  strides: [1, 2, 2, 2, 2],
  mambaBlocks: [0, 0, 2, 2, 4],
};
const IN_CH = 2; // channel_order [CT, PET]

const outDim = (n, s) => (s === 1 ? n : Math.floor((n - 1) / s) + 1); // Conv3d k3 s p1
const prod = (a) => a[0] * a[1] * a[2];
const commas = (n) => n.toLocaleString('en-US');
const lerp = (v, a, b, c, d) => (a === b ? d : c + ((v - a) / (b - a)) * (d - c));

function computeArch(patch) {
  const { features, strides, mambaBlocks } = ARCH;
  const stages = [];
  let dims = [...patch];
  let cin = IN_CH;
  for (let i = 0; i < features.length; i++) {
    const dimsIn = [...dims];
    const s = strides[i];
    dims = dims.map((d) => outDim(d, s));
    stages.push({
      idx: i,
      role: i === 0 ? 'stem' : i === features.length - 1 ? 'bottleneck' : 'enc',
      cin, cout: features[i], stride: s, dimsIn, dims: [...dims],
      L: prod(dims), nMamba: mambaBlocks[i],
    });
    cin = features[i];
  }
  const dec = {};
  for (let i = features.length - 2; i >= 0; i--) {
    dec[i] = {
      idx: i, upStride: strides[i + 1], skipCh: features[i], outCh: features[i],
      dims: [...stages[i].dims], fromIdx: i === features.length - 2 ? features.length - 1 : i + 1,
    };
  }
  return { stages, dec };
}

const PRESETS = [
  { label: 'Baseline 64×128×64', patch: [64, 128, 64] },
  { label: 'Cube 96³', patch: [96, 96, 96] },
  { label: 'Cube 128³', patch: [128, 128, 128] },
  { label: 'MultiTalent 192³', patch: [192, 192, 192] },
];

const shape = (c, dims) => `(B, ${c}, ${dims[0]}, ${dims[1]}, ${dims[2]})`;
const roleName = (r) => (r === 'stem' ? 'Stem' : r === 'bottleneck' ? 'Bottleneck' : 'Encoder');

// ── The U-Net picture (SVG) ───────────────────────────────────────────────────
// Fixed layout geometry (module-invariant, so the geo useMemo below only tracks
// the arch): view box, slab depth, row centres, and column x-positions.
const VW = 900, VH = 500, dep = 10;
const rows = [76, 168, 260, 352];      // encoder/decoder row centres (levels 0..3)
const yB = 428;                        // bottleneck row centre
const xE = 244, xD = 656, xB = 450, xOut = 812;

function NetFigure({ stages, dec, patch, sel, onSelect }) {
  // Unique marker ids per instance — several NetFigures coexist in the DOM (the
  // screen one + one per stage in the print view) and must not share arrowhead ids.
  const uid = useId().replace(/:/g, '');
  const ahId = `ah${uid}`, ahsId = `ahs${uid}`;

  const geo = useMemo(() => {
    const reses = stages.map((s) => Math.cbrt(prod(s.dims)));
    const rMin = Math.min(...reses), rMax = Math.max(...reses);
    const hOf = (s) => lerp(Math.cbrt(prod(s.dims)), rMin, rMax, 24, 58);
    const wOf = (ch) => lerp(Math.sqrt(ch), Math.sqrt(32), Math.sqrt(320), 20, 56);
    const enc = stages.slice(0, 4).map((s, i) => ({ s, cx: xE, cy: rows[i], w: wOf(s.cout), h: hOf(s) }));
    const bott = { s: stages[4], cx: xB, cy: yB, w: wOf(stages[4].cout), h: hOf(stages[4]) };
    const decs = [0, 1, 2, 3].map((j) => ({ d: dec[j], s: stages[j], cx: xD, cy: rows[j], w: wOf(dec[j].outCh), h: hOf(stages[j]) }));
    const out = { cx: xOut, cy: rows[0], w: 13, h: hOf(stages[0]) };
    return { enc, bott, decs, out };
  }, [stages, dec]);

  const { enc, bott, decs, out } = geo;

  // 3-D slab: top + side + front faces, optional selection halo.
  const slab = (g, cls, key, click, selected) => {
    const x = g.cx - g.w / 2, y = g.cy - g.h / 2;
    return (
      <g key={key} className={`st-box ${cls}${selected ? ' st-box--sel' : ''}`}
         onClick={click} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined}
         onKeyDown={click ? (e) => (e.key === 'Enter' || e.key === ' ') && click() : undefined}>
        {selected && <rect className="st-halo" x={x - 6} y={y - dep - 6} width={g.w + dep + 12} height={g.h + dep + 12} rx={6} />}
        <polygon className="st-face st-face--top" points={`${x},${y} ${x + dep},${y - dep} ${x + g.w + dep},${y - dep} ${x + g.w},${y}`} />
        <polygon className="st-face st-face--side" points={`${x + g.w},${y} ${x + g.w + dep},${y - dep} ${x + g.w + dep},${y - dep + g.h} ${x + g.w},${y + g.h}`} />
        <rect className="st-face st-face--front" x={x} y={y} width={g.w} height={g.h} />
      </g>
    );
  };

  const flow = (x1, y1, x2, y2, k) => <line key={k} className="st-flow" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#${ahId})`} />;

  const encBoxCls = (s) => (s.role === 'bottleneck' ? 'st-box--bottleneck' : s.nMamba > 0 ? 'st-box--mamba' : 'st-box--conv');
  const isSel = (side, idx) => sel.side === side && sel.idx === idx;

  return (
    <svg className="st-fig" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Hybrid CNN–Mamba U-Net architecture diagram">
      <defs>
        <marker id={ahId} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto"><path className="st-ah" d="M0 0 L6 3 L0 6 Z" /></marker>
        <marker id={ahsId} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto"><path className="st-ah st-ah--skip" d="M0 0 L6 3 L0 6 Z" /></marker>
      </defs>

      {/* input arrow into the stem */}
      <text className="st-lbl-io" x={xE} y={38}>input · {shape(IN_CH, patch)}</text>
      {flow(xE, 44, xE, enc[0].cy - enc[0].h / 2 - dep - 2, 'in')}

      {/* flow arrows — encoder down */}
      {[0, 1, 2].map((i) => flow(xE, enc[i].cy + enc[i].h / 2 + dep, xE, enc[i + 1].cy - enc[i + 1].h / 2 - 2, `d${i}`))}
      {flow(xE, enc[3].cy + enc[3].h / 2, xB - bott.w / 2 - dep, yB - bott.h / 2 - dep, 'd3')}
      {/* bottleneck up into decoder */}
      {flow(xB + bott.w / 2 + dep, yB - bott.h / 2 - dep, xD, decs[3].cy + decs[3].h / 2 + dep, 'u3')}
      {[3, 2, 1].map((j) => flow(xD, decs[j].cy - decs[j].h / 2 - dep, xD, decs[j - 1].cy + decs[j - 1].h / 2 - 2, `u${j}`))}
      {/* seg head */}
      {flow(xD + decs[0].w / 2 + dep, rows[0], xOut - out.w / 2 - dep, rows[0], 'seg')}

      {/* skip connections */}
      {[0, 1, 2, 3].map((j) => (
        <g key={`sk${j}`}>
          <line className="st-skipline" x1={xE + enc[j].w / 2 + dep} y1={rows[j]} x2={xD - decs[j].w / 2 - 2} y2={rows[j]} markerEnd={`url(#${ahsId})`} />
          <text className="st-lbl-skip" x={(xE + xD) / 2} y={rows[j] - 6}>skip · {enc[j].s.cout}c</text>
        </g>
      ))}

      {/* encoder slabs + labels */}
      {enc.map((g) => {
        const nm = g.s.idx === 0 ? 'Stem' : `Stage ${g.s.idx}`;
        const lx = g.cx - g.w / 2 - dep - 10;
        return (
          <g key={`e${g.s.idx}`}>
            {slab(g, encBoxCls(g.s), `eb${g.s.idx}`, () => onSelect({ side: 'enc', idx: g.s.idx }), isSel('enc', g.s.idx))}
            <text className="st-lbl st-lbl--r">
              <tspan className="st-lbl-name" x={lx} y={g.cy - 4}>{nm}</tspan>
              <tspan className="st-lbl-shape" x={lx} dy={14}>{g.s.cout}c · {g.s.dims.join('×')}</tspan>
              {g.s.nMamba > 0 && <tspan className="st-lbl-tag st-lbl-tag--m" x={lx} dy={13}>Mamba ×{g.s.nMamba}</tspan>}
            </text>
          </g>
        );
      })}

      {/* bottleneck slab + label (below) */}
      {slab(bott, 'st-box--bottleneck', 'bott', () => onSelect({ side: 'enc', idx: bott.s.idx }), isSel('enc', bott.s.idx))}
      <text className="st-lbl st-lbl--c">
        <tspan className="st-lbl-name" x={xB} y={yB + bott.h / 2 + 18}>Bottleneck</tspan>
        <tspan className="st-lbl-shape" x={xB} dy={14}>{bott.s.cout}c · {bott.s.dims.join('×')}</tspan>
        <tspan className="st-lbl-tag st-lbl-tag--m" x={xB} dy={13}>Mamba ×{bott.s.nMamba} · L={commas(bott.s.L)}</tspan>
      </text>

      {/* decoder slabs + labels (right) */}
      {decs.map((g) => {
        const nm = g.d.idx === 0 ? 'Up → head' : `Up ${g.d.idx}`;
        // Top decoder block: label ABOVE (keeps clear of the seg-head arrow + output);
        // the rest label to the right.
        if (g.d.idx === 0) {
          const topY = g.cy - g.h / 2 - dep - 30;
          return (
            <g key={`dc${g.d.idx}`}>
              {slab(g, 'st-box--dec', `db${g.d.idx}`, () => onSelect({ side: 'dec', idx: g.d.idx }), isSel('dec', g.d.idx))}
              <text className="st-lbl st-lbl--c">
                <tspan className="st-lbl-name" x={g.cx} y={topY}>{nm}</tspan>
                <tspan className="st-lbl-shape" x={g.cx} dy={13}>{g.d.outCh}c · {g.d.dims.join('×')}</tspan>
                <tspan className="st-lbl-tag" x={g.cx} dy={12}>planned</tspan>
              </text>
            </g>
          );
        }
        const rx = g.cx + g.w / 2 + dep + 10;
        return (
          <g key={`dc${g.d.idx}`}>
            {slab(g, 'st-box--dec', `db${g.d.idx}`, () => onSelect({ side: 'dec', idx: g.d.idx }), isSel('dec', g.d.idx))}
            <text className="st-lbl st-lbl--l">
              <tspan className="st-lbl-name" x={rx} y={g.cy - 4}>{nm}</tspan>
              <tspan className="st-lbl-shape" x={rx} dy={14}>{g.d.outCh}c · {g.d.dims.join('×')}</tspan>
              <tspan className="st-lbl-tag" x={rx} dy={13}>planned</tspan>
            </text>
          </g>
        );
      })}

      {/* output slab */}
      {slab(out, 'st-box--out', 'out', undefined, false)}
      <text className="st-lbl-io" x={xOut} y={rows[0] + out.h / 2 + 16}>seg mask</text>
      <text className="st-lbl-io st-lbl-io--dim" x={xOut} y={rows[0] + out.h / 2 + 28}>{shape(1, patch)}</text>
    </svg>
  );
}

// ── Per-stage detail (shared by the interactive spotlight + the PDF view) ─────
const SEL_NONE = { side: 'none', idx: -1 };
const noop = () => {};

function stageHeading(s) {
  const nm = s.idx === 0 ? 'Stem' : `Stage ${s.idx}`;
  return `${nm} · ${roleName(s.role)} · ${s.nMamba > 0 ? `Conv + Mamba ×${s.nMamba}` : 'Conv only'}`;
}
function decHeading(d) {
  return `${d.idx === 0 ? 'Final up-step → seg head' : `Up-step ${d.idx}`} · planned`;
}

function StageDetail({ stage, nDir, version, bottleneckL }) {
  const dState = version === 'mamba1' ? 16 : 128;
  return (
    <>
      <div className="st-transform">
        <code className="st-shape-in">{shape(stage.cin, stage.dimsIn)}</code>
        <span className="st-arrow"><Icon name="arrowRight" size={15} /><em>ConvBlock3D{stage.stride === 2 ? ' · stride 2 (halve)' : ' · stride 1'}</em></span>
        <code className="st-shape-out">{shape(stage.cout, stage.dims)}</code>
      </div>
      {stage.nMamba > 0 ? (
        <>
          <p className="st-spot-lead">
            Then <strong>×{stage.nMamba} MambaBlock3D</strong>, each shape-preserving: pre-norm →{' '}
            <strong>{nDir} directional scan{nDir > 1 ? 's' : ''}</strong> → sum → + residual. Inside one
            direction the volume is unrolled to a sequence, scanned, and folded back:
          </p>
          <div className="st-flatten">
            <code>{shape(stage.cout, stage.dims)}</code>
            <span className="st-fl-step"><Icon name="arrowRight" size={13} /><em>flatten</em></span>
            <code>(B, {commas(stage.L)}, {stage.cout})</code>
            <span className="st-fl-step"><Icon name="arrowRight" size={13} /><em>selective scan</em></span>
            <code>(B, {commas(stage.L)}, {stage.cout})</code>
            <span className="st-fl-step"><Icon name="arrowRight" size={13} /><em>reshape</em></span>
            <code>{shape(stage.cout, stage.dims)}</code>
          </div>
          <div className="st-facts">
            <div className="st-fact"><span>sequence length <Tex src="L = d\cdot h\cdot w" /></span><code>{commas(stage.L)}</code></div>
            <div className="st-fact"><span>scans per block</span><code>{nDir}</code></div>
            <div className="st-fact"><span>total scans (this stage)</span><code>{stage.nMamba * nDir}</code></div>
            <div className="st-fact"><span>version · d_state</span><code>{version === 'mamba1' ? 'Mamba-1' : 'Mamba-2'} · {dState}</code></div>
          </div>
          <p className="st-spot-note">
            The scan is <Tex src="O(L)" /> — cost grows linearly with the {commas(stage.L)} tokens, not
            quadratically. That’s the whole reason Mamba can afford global context here where attention
            (<Tex src="O(L^2)" />) could not.
          </p>
        </>
      ) : (
        <p className="st-spot-note st-spot-note--why">
          <strong>No Mamba here — on purpose.</strong> A scan at this stage would be{' '}
          <strong>L = {commas(stage.L)}</strong> tokens ({stage.dims.join('×')}), about{' '}
          <strong>{Math.round(stage.L / bottleneckL).toLocaleString('en-US')}×</strong> the bottleneck’s{' '}
          {commas(bottleneckL)}. Global context is bought where it’s cheap — the deep, low-resolution stages —
          while the shallow stages stay pure convolution. That is exactly why{' '}
          <code>mamba_blocks = [0, 0, 2, 2, 4]</code>.
        </p>
      )}
    </>
  );
}

function DecDetail({ dec, stages }) {
  return (
    <>
      <div className="st-transform">
        <code className="st-shape-in">{shape(ARCH.features[dec.fromIdx], stages[dec.fromIdx].dims)}</code>
        <span className="st-arrow"><Icon name="arrowRight" size={15} /><em>ConvTranspose3d · stride {dec.upStride}</em></span>
        <code>{shape(dec.outCh, dec.dims)}</code>
        <span className="st-arrow"><Icon name="arrowRight" size={15} /><em>concat skip {dec.skipCh}c</em></span>
        <code>{shape(dec.outCh + dec.skipCh, dec.dims)}</code>
        <span className="st-arrow"><Icon name="arrowRight" size={15} /><em>ConvBlock3D</em></span>
        <code className="st-shape-out">{shape(dec.outCh, dec.dims)}</code>
      </div>
      <p className="st-spot-note">
        The decoder mirrors the encoder’s strides exactly, so the mask lands back at the input patch resolution.
        This path is still a stub in <code>decoder.py</code> / <code>psma_mamba.py</code> — the shapes shown are
        the planned design, not running code yet.
      </p>
    </>
  );
}

// ── Print / PDF view: expands EVERY stage (diagram highlighted + full detail) ─
// Hidden on screen; revealed only while printing. Built as a static knowledge
// source (e.g. to feed a NotebookLM video), so nothing is behind a click.
function PrintView({ stages, dec, patch, nDir, version, bottleneckL }) {
  return (
    <div className="st-print" aria-hidden="true">
      <header className="st-print-cover">
        <p className="st-print-kicker">Mamba_PSMA · Honours · Hybrid CNN–Mamba U-Net</p>
        <h1 className="st-print-title">Encoder Shape Trace</h1>
        <p className="st-print-sub">
          A stage-by-stage trace of a PET+CT patch through the segmentation encoder. Input{' '}
          <code>{shape(IN_CH, patch)}</code> → output <code>{shape(1, patch)}</code>. Channel/stride/Mamba layout
          from <code>baseline.yaml</code>; shapes verified against <code>encoder.py</code>. The expanding
          (decoder) path is the planned design — <code>decoder.py</code>/<code>psma_mamba.py</code> are stubs.
        </p>
        <div className="st-print-theory">
          <p className="st-card-label">The selective-scan recurrence (run at each Mamba stage)</p>
          <Tex block src="\bar A_t = \exp(\Delta_t A),\quad \bar B_t = \Delta_t B,\quad h_t = \bar A_t\,h_{t-1} + \bar B_t\,x_t,\quad y_t = C_t\,h_t" />
          <p className="st-print-note">
            with <Tex src="\Delta_t = \mathrm{softplus}(\text{bias} + \text{gain}\cdot x_t)" /> chosen per token
            from the input (the “selective” mechanism). It runs along the flattened voxel sequence of length{' '}
            <Tex src="L = d\cdot h\cdot w" /> at each stage below.
          </p>
        </div>
      </header>

      <section className="st-print-stage">
        <h2 className="st-print-h2">Overview — the full network</h2>
        <NetFigure stages={stages} dec={dec} patch={patch} sel={SEL_NONE} onSelect={noop} />
      </section>

      {stages.map((s) => (
        <section className="st-print-stage" key={`ps${s.idx}`}>
          <h2 className="st-print-h2">
            {s.idx === 0 ? 'Stem' : `Stage ${s.idx}`}{s.role === 'bottleneck' ? ' — bottleneck' : ''}
          </h2>
          <NetFigure stages={stages} dec={dec} patch={patch} sel={{ side: 'enc', idx: s.idx }} onSelect={noop} />
          <p className="st-card-label">{stageHeading(s)}</p>
          <StageDetail stage={s} nDir={nDir} version={version} bottleneckL={bottleneckL} />
        </section>
      ))}

      {[3, 2, 1, 0].map((j) => (
        <section className="st-print-stage" key={`pd${j}`}>
          <h2 className="st-print-h2">Decoder — {j === 0 ? 'up → seg head' : `up-step ${j}`}</h2>
          <NetFigure stages={stages} dec={dec} patch={patch} sel={{ side: 'dec', idx: j }} onSelect={noop} />
          <p className="st-card-label">{decHeading(dec[j])}</p>
          <DecDetail dec={dec[j]} stages={stages} />
        </section>
      ))}
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────
export default function ShapeTracer() {
  const [patch, setPatch] = useState([64, 128, 64]);
  const [presetLabel, setPresetLabel] = useState(PRESETS[0].label);
  const [nDir, setNDir] = useState(6);
  const [version, setVersion] = useState('mamba1');
  const [sel, setSel] = useState({ side: 'enc', idx: 2 });

  const { stages, dec } = useMemo(() => computeArch(patch), [patch]);
  const dState = version === 'mamba1' ? 16 : 128;
  const bottleneckL = stages[stages.length - 1].L;

  const setDim = (i, raw) => {
    const v = Math.max(8, Math.min(320, Math.round(Number(raw) || 0)));
    setPatch((p) => p.map((d, j) => (j === i ? v : d)));
    setPresetLabel('custom');
  };
  const applyPreset = (p) => { setPatch(p.patch); setPresetLabel(p.label); };

  // Download PDF: reveal the expanded print view, open the browser print dialog
  // ("Save as PDF"), then restore. No dependency — the PDF keeps SVG + text as
  // crisp vectors, ideal as a NotebookLM source.
  const downloadPdf = () => {
    const prevTitle = document.title;
    document.title = 'Mamba_PSMA — Encoder Shape Trace';
    document.body.classList.add('st-printing');
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.body.classList.remove('st-printing');
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 60000); // fallback if afterprint never fires
    window.print();
  };

  const selStage = sel.side === 'enc' ? stages[sel.idx] : null;
  const selDec = sel.side === 'dec' ? dec[sel.idx] : null;

  const mamba2Bad = version === 'mamba2'
    ? stages.filter((s) => s.nMamba > 0 && (2 * s.cout) % 64 !== 0).map((s) => s.cout)
    : [];

  return (
    <div className="pt-module st">
      <div className="st-screen">
      <div>
        <p className="st-kicker">University · Mamba_PSMA · Interactive</p>
        <h2 className="st-title">Shape Tracer</h2>
        <p className="pt-module__intro">
          A PET+CT patch enters as <code>{shape(IN_CH, patch)}</code> and leaves as a segmentation mask the same
          size. In between it’s squeezed through five encoder stages. The diagram below is the real network —
          each block is a feature map drawn to scale (tall + thin at full resolution, short + wide at the
          bottleneck). <strong>Click any block</strong> to see its shape transform, and at the deep stages the{' '}
          <strong>3-D → sequence → 3-D</strong> trick that lets the selective scan run over a volume. Every
          number comes from <code>baseline.yaml</code> and matches <code>encoder.py</code>.
        </p>
        <div className="st-actions">
          <button className="st-dl" onClick={downloadPdf}>
            <Icon name="download" size={15} /> Download PDF
          </button>
          <span className="st-dl-hint">
            opens the print dialog — choose “Save as PDF”. The PDF expands <strong>every stage</strong> (diagram +
            detail) as a static source for NotebookLM.
          </span>
        </div>
      </div>

      {/* Controls */}
      <section className="pt-card st-controls">
        <div className="st-ctl-row">
          <div className="st-ctl">
            <span className="st-ctl-lbl">Patch size (D · H · W)</span>
            <div className="st-dims">
              {['D', 'H', 'W'].map((ax, i) => (
                <label key={ax} className="st-dim"><span>{ax}</span>
                  <input type="number" min="8" max="320" value={patch[i]} onChange={(e) => setDim(i, e.target.value)} />
                </label>
              ))}
            </div>
          </div>
          <div className="st-ctl">
            <span className="st-ctl-lbl">Presets</span>
            <div className="st-chips">
              {PRESETS.map((p) => (
                <button key={p.label} className={`st-chip${presetLabel === p.label ? ' st-chip--on' : ''}`}
                        onClick={() => applyPreset(p)}>{p.label}</button>
              ))}
              {presetLabel === 'custom' && <span className="st-chip st-chip--on st-chip--custom">Custom</span>}
            </div>
          </div>
        </div>
        <div className="st-ctl-row">
          <div className="st-ctl">
            <span className="st-ctl-lbl">Scan directions <code>{nDir}</code></span>
            <input className="st-range" type="range" min="1" max="6" step="1" value={nDir}
                   onChange={(e) => setNDir(Number(e.target.value))} />
            <p className="st-ctl-note">1 = one axis · 2 = bidirectional · 6 = all ±x, ±y, ±z (one Mamba per direction, summed).</p>
          </div>
          <div className="st-ctl">
            <span className="st-ctl-lbl">SSM version</span>
            <div className="st-seg">
              <button className={`st-seg-btn${version === 'mamba1' ? ' st-seg-btn--on' : ''}`} onClick={() => setVersion('mamba1')}>Mamba-1</button>
              <button className={`st-seg-btn${version === 'mamba2' ? ' st-seg-btn--on' : ''}`} onClick={() => setVersion('mamba2')}>Mamba-2 (SSD)</button>
            </div>
            <p className="st-ctl-note">
              d_state = <code>{dState}</code>.{' '}
              {mamba2Bad.length
                ? `⚠ Mamba-2 needs expand·dim divisible by 64 — stage dims ${mamba2Bad.join(', ')} would fail.`
                : 'affects state size, not shapes.'}
            </p>
          </div>
        </div>
      </section>

      {/* The picture */}
      <section className="pt-card st-net">
        <div className="st-net-head">
          <span className="st-col-tag">Encoder — contracting</span>
          <span className="st-col-tag st-col-tag--right">Decoder — expanding <em>(planned)</em></span>
        </div>
        <div className="st-fig-wrap">
          <NetFigure stages={stages} dec={dec} patch={patch} sel={sel} onSelect={setSel} />
        </div>
        <div className="st-legend">
          <span className="st-leg"><span className="st-sw st-sw--conv" /> conv only</span>
          <span className="st-leg"><span className="st-sw st-sw--mamba" /> + Mamba</span>
          <span className="st-leg"><span className="st-sw st-sw--bott" /> bottleneck</span>
          <span className="st-leg"><span className="st-sw st-sw--dec" /> decoder (planned)</span>
          <span className="st-leg st-leg--hint">click a block for detail</span>
        </div>
      </section>

      {/* Spotlight */}
      {selStage && (
        <section className="pt-card st-spot">
          <p className="st-card-label">{stageHeading(selStage)}</p>
          <StageDetail stage={selStage} nDir={nDir} version={version} bottleneckL={bottleneckL} />
        </section>
      )}

      {selDec && (
        <section className="pt-card st-spot">
          <p className="st-card-label">{decHeading(selDec)}</p>
          <DecDetail dec={selDec} stages={stages} />
        </section>
      )}

      {/* Takeaway */}
      <section className="pt-card st-takeaway">
        <p className="st-card-label">How this connects</p>
        <div className="st-take-grid">
          <div className="st-take"><span className="st-take-n">01</span>
            <p><strong>One scan, many voxels.</strong> The recurrence you drove on the Selective Scan tab runs
              along <Tex src="L" /> here — but <Tex src="L" /> is now a flattened patch of voxels. Same maths,
              different length.</p>
          </div>
          <div className="st-take"><span className="st-take-n">02</span>
            <p><strong>Shapes are config, not code.</strong> Every block above comes from the{' '}
              <code>features</code> / <code>strides</code> / <code>mamba_blocks</code> lists in{' '}
              <code>baseline.yaml</code>. Change the patch and the whole picture re-sizes — that’s the
              config-driven encoder.</p>
          </div>
          <div className="st-take"><span className="st-take-n">03</span>
            <p><strong>Depth buys context cheaply.</strong> <Tex src="L" /> shrinks 8× per downsample, so global
              scanning is affordable only deep. Full-res would be L = {commas(prod(patch))} — why the stem is
              convolution only.</p>
          </div>
        </div>
      </section>
      </div>{/* .st-screen */}

      <PrintView stages={stages} dec={dec} patch={patch} nDir={nDir} version={version} bottleneckL={bottleneckL} />
    </div>
  );
}
