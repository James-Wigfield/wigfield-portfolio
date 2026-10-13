import { mediaUrl, useMediaVersion } from '../../engine/media';
import { Num, T } from '../../shared/Num';
import { SCANS } from './scans.gen';
import { OPTF_LAYERS, OPTF_VB } from './optf.gen';
import { FIG, S7, S8, S9, S10 } from './geometry';
import { Layer } from './scan';
import { EASE, all, draw, fadeIn, one, pop, rise, track, useTimeline } from './motion';

/* ============================================================================
   PLAIN DECK — SLIDES 7 TO 10 (built)
   ----------------------------------------------------------------------------
   As slides.jsx: each slide draws its FINISHED state in plain markup and CSS;
   its timeline only adds motion when the slide is live. Times are seconds
   from entering the slide; a beat starts no later than (words before its
   phrase / words in the transcript) x read time x 0.85, and all motion ends
   by 75% of the read time. Words on screen come from the transcript ("said")
   or the dissertation; every digit is a manifest key.
   ========================================================================== */

/* ── The figure, in layers ─────────────────────────────────────────────────
   Every layer is the whole figure's canvas with only some of its elements, so
   all of them stack at one origin, inside a holder cropped to what they draw
   (FIG.holder). A skip connection is wiped in from the left: its window
   slides right while the line inside it holds still. */
function FigLayer({ name, a }) {
  useMediaVersion();
  return (
    <img
      className="dp-fig__layer"
      data-a={a ?? name}
      src={mediaUrl(`figures/optf/${name}.svg`)}
      alt=""
      draggable="false"
      style={{ left: FIG.holder.inset, width: FIG.w, height: FIG.h }}
    />
  );
}

function FigHolder({ a, label, style, children }) {
  const h = FIG.holder;
  return (
    <div className="dp-fig" data-a={a} role="img" aria-label={label} style={{ left: h.left, top: h.top, width: h.w, height: h.h, ...style }}>
      {children}
    </div>
  );
}

function SkipLayer({ name }) {
  useMediaVersion();
  const b = OPTF_LAYERS[name];
  const x = b.x0 * FIG.s - 4 + FIG.holder.inset;
  const y = b.y0 * FIG.s - 4;
  const w = (b.x1 - b.x0) * FIG.s + 8;
  const h = (b.y1 - b.y0) * FIG.s + 8;
  return (
    <div className="dp-fig__wipe" data-a={`${name}-win`} data-w={w} style={{ left: x, top: y, width: w, height: h }}>
      <img
        className="dp-fig__layer"
        data-a={`${name}-in`}
        src={mediaUrl(`figures/optf/${name}.svg`)}
        alt=""
        draggable="false"
        style={{ left: FIG.holder.inset - x, top: -y, width: FIG.w, height: FIG.h }}
      />
    </div>
  );
}

/** The network: encoder, Mamba blocks, decoder and skip lines (no input, output or text). */
function Body() {
  return (
    <>
      {FIG.skips.map((n) => <SkipLayer key={n} name={n} />)}
      {FIG.enc.map((n) => <FigLayer key={n} name={n} />)}
      {FIG.mamba.map((n) => <FigLayer key={n} name={n} />)}
      {FIG.dec.map((n) => <FigLayer key={n} name={n} />)}
    </>
  );
}

/** A small picture of the network's blocks (the figure's `body` layers), `t` px per figure unit. */
function NetThumb({ t, a, style }) {
  useMediaVersion();
  const b = FIG.body;
  return (
    <span className="dp-thumb" data-a={a} style={{ width: b.w * t, height: b.h * t, ...style }} aria-hidden="true">
      <img
        src={mediaUrl('figures/optf/body.svg')}
        alt=""
        draggable="false"
        style={{ left: -b.x0 * t, top: -b.y0 * t, width: OPTF_VB.w * t, height: OPTF_VB.h * t }}
      />
    </span>
  );
}

function wipe(root, name, at, d) {
  const win = one(root, `${name}-win`);
  const inner = one(root, `${name}-in`);
  if (!win || !inner) return [];
  const w = Number(win.dataset.w);
  return [
    track(win, [{ t: at, transform: `translateX(${-w}px)` }, { t: at + d, transform: 'translateX(0px)' }], EASE.inOut),
    track(inner, [{ t: at, transform: `translateX(${w}px)` }, { t: at + d, transform: 'translateX(0px)' }], EASE.inOut),
  ];
}

/* ── 7. Architecture ───────────────────────────────────────────────────────
   60 s read (121 words); latest starts: U-shaped encoder-decoder 3.4 s, skip
   connections 4.6, encoder 5.9, decoder 9.7, input 13.9, output 19.0,
   convolutions 24.9, Mamba blocks 27.8, flattened sequences 32.5, eight times
   shorter 36.7 ("about" 36.2), each Mamba block 40.9, six directions 43.8;
   all over by 45 s. Left: dissertation Figure 3.3 in layers (no patch sizes,
   no sequence lengths, organ head hidden, one skip label). The Mamba blocks
   are built faint with their stages, so the figure is whole from the start,
   and come up to full strength when they are named. Right: a key, sequence
   length per stage to scale, and the six reading directions (schematic). */
function archTimeline(root, add) {
  const stageAt = (i) => 0.3 + i * 0.28; // encoder stage i (0 to 4) drops in
  FIG.enc.forEach((n, i) => add(track(one(root, n), [
    { t: stageAt(i), opacity: 0, transform: 'translateY(-18px)' },
    { t: stageAt(i) + 0.6, opacity: 1, transform: 'translateY(0px)' },
  ])));
  FIG.mamba.forEach((n, j) => {
    const s = stageAt(j + 2);
    const lit = 27.3 + j * 0.35;
    add(track(one(root, n), [
      { t: s, opacity: 0, transform: 'translateY(-18px)' },
      { t: s + 0.6, opacity: 0.16, transform: 'translateY(0px)' },
      { t: lit, opacity: 0.16, transform: 'translateY(0px)', e: EASE.inOut },
      { t: lit + 0.7, opacity: 1, transform: 'translateY(0px)' },
    ]));
  });
  FIG.dec.forEach((n, i) => add(track(one(root, n), [
    { t: 1.7 + i * 0.28, opacity: 0, transform: 'translateY(18px)' },
    { t: 2.3 + i * 0.28, opacity: 1, transform: 'translateY(0px)' },
  ])));
  // top to bottom, each from its encoder stage to its decoder stage
  FIG.skips.forEach((n, i) => wipe(root, n, 2.7 + i * 0.25, 0.8).forEach(add));
  add(fadeIn(one(root, 'skiplab1'), 3.2, 0.6));
  add(rise(one(root, 'lab-enc'), 5.6, 0.8, 14));
  add(rise(one(root, 'lab-dec'), 9.4, 0.8, 14));
  add(track(one(root, 'input'), [{ t: 13.5, opacity: 0, transform: 'translateY(-40px)' }, { t: 14.4, opacity: 1, transform: 'translateY(0px)' }]));
  add(rise(one(root, 'lab-in'), 14.2, 0.8, 12));
  ['output', 'headlab'].forEach((n) => add(track(one(root, n), [{ t: 18.5, opacity: 0, transform: 'translateY(30px)' }, { t: 19.4, opacity: 1, transform: 'translateY(0px)' }])));
  add(rise(one(root, 'lab-out'), 18.9, 0.8, 12));
  add(rise(one(root, 'lab-conv'), 24.5, 0.8, 12));
  add(rise(one(root, 'lab-mamba'), 27.4, 0.8, 12));
  // Sequence length per stage: each bar starts at the length of the one above
  // and shrinks to its own, about an eighth.
  add(rise(one(root, 'seq-title'), 31.8, 0.8, 12));
  add(fadeIn(one(root, 'seq-label-0'), 32.0));
  add(track(one(root, 'seq-bar-0'), [{ t: 32.2, transform: 'scaleX(0)' }, { t: 33.0, transform: 'scaleX(1)' }], EASE.inOut));
  add(fadeIn(one(root, 'seq-costly'), 32.9, 0.6));
  S7.rows.slice(1).forEach((r, j) => {
    const i = j + 1;
    const at = 33.5 + j * 0.8;
    add(track(one(root, `seq-bar-${i}`), [
      { t: at, opacity: 0, transform: `scaleX(${r.ratio.toFixed(3)})` },
      { t: at + 0.05, opacity: 1, transform: `scaleX(${r.ratio.toFixed(3)})`, e: EASE.inOut },
      { t: at + 0.75, opacity: 1, transform: 'scaleX(1)' },
    ]));
    add(fadeIn(one(root, `seq-label-${i}`), at, 0.5));
  });
  add(rise(one(root, 'seq-eight'), 35.3, 0.8, 12));
  // Six directions, then summed.
  add(rise(one(root, 'dir-title'), 39.2, 0.8, 12));
  add(fadeIn(one(root, 'dir-schem'), 39.6));
  all(root, 'cube').forEach((el, i) => add(pop(el, 39.4 + i * 0.08, 0.5, 0.7)));
  S7.cubes.forEach((c, i) => {
    const at = 40.8 + i * 0.4;
    add(draw(one(root, `dir-line-${i}`), at, 0.4));
    add(fadeIn(one(root, `dir-head-${i}`), at + 0.3, 0.2));
    add(fadeIn(one(root, `dir-label-${i}`), at + 0.1, 0.4));
  });
  add(pop(one(root, 'sum'), 43.3, 0.5, 0.6));
  add(fadeIn(one(root, 'sum-label'), 43.5, 0.6));
}

function Swatch({ kind }) {
  return <span className={`dp7-swatch dp7-swatch--${kind}`} aria-hidden="true" />;
}

export function ArchitectureSlide({ ctx }) {
  const root = useTimeline(ctx, archTimeline);
  const at = FIG.at;
  const inR = at(OPTF_LAYERS.input.x1, 0).x + 14;
  const outR = at(FIG.cubeX0, 0).x - 14;
  const enc2 = FIG.box('enc2');
  const dec2 = FIG.box('dec2');
  return (
    <div className="dp-stage dp7" ref={root}>
      <FigHolder label="The hybrid CNN-Mamba network (dissertation Figure 3.3): a U-shaped encoder-decoder with skip connections; CT and PET in, predicted lesions out; Mamba blocks after the convolutions in the three deepest stages">
        <Body />
        <FigLayer name="skiplab1" />
        <FigLayer name="input" />
        <FigLayer name="output" />
        <FigLayer name="headlab" />
      </FigHolder>

      <div className="dp7-lab" data-a="lab-in" style={{ left: inR, top: at(0, 26).y }}>
        <p className="dp-label" data-role="chart">Two channels:</p>
        <p className="dp-label" data-role="chart">CT and PET</p>
      </div>
      <div className="dp7-lab dp7-lab--right" data-a="lab-out" style={{ right: 1920 - outR, top: at(0, 22).y }}>
        <p className="dp-label" data-role="chart">A lesion score</p>
        <p className="dp-label" data-role="chart">for every voxel</p>
      </div>
      <div className="dp7-lab" data-a="lab-enc" style={{ left: 96, top: enc2.y + enc2.h + 14 }}>
        <p className="dp-label" data-role="chart"><b>Encoder</b></p>
        <p className="dp-label dp-label--muted" data-role="chart">downsamples</p>
      </div>
      <div className="dp7-lab" data-a="lab-dec" style={{ left: dec2.x + dec2.w + 20, top: dec2.y + dec2.h / 2 + 4 }}>
        <p className="dp-label" data-role="chart"><b>Decoder</b></p>
        <p className="dp-label dp-label--muted" data-role="chart">upsamples to</p>
        <p className="dp-label dp-label--muted" data-role="chart">full size</p>
      </div>
      {/* What each kind of block is, as a key at the top of the right column. */}
      <p className="dp-label dp7-key" data-a="lab-conv" data-role="chart" style={{ left: S7.x0, top: S7.keyY }}>
        <Swatch kind="conv" />Convolutions in every stage
      </p>
      <p className="dp-label dp7-key dp7-blue" data-a="lab-mamba" data-role="chart" style={{ left: S7.x0, top: S7.keyY + 46 }}>
        <Swatch kind="mamba" />Mamba blocks only in the <Num k="net.mamba_stages" /> deepest stages
      </p>

      {/* Sequence length per stage, to scale. */}
      <p className="dp-kicker dp7-r" data-a="seq-title" data-role="chart" style={{ left: S7.x0, top: S7.seqY }}>Flattened sequence length, to scale</p>
      {S7.rows.map((r, i) => (
        <div key={i}>
          <p className="dp-label dp-label--muted dp7-r" data-a={`seq-label-${i}`} data-role="chart" style={{ left: S7.x0, top: r.y - 4 }}>
            {['Second stage', 'Third stage', 'Fourth stage', 'Fifth stage'][i]}
          </p>
          <span
            className={`dp7-bar${i ? ' is-mamba' : ''}`}
            data-a={`seq-bar-${i}`}
            style={{ left: S7.barX, top: r.y, width: r.w }}
            aria-hidden="true"
          />
        </div>
      ))}
      <p className="dp-tag dp7-costly" data-a="seq-costly" data-role="foot" style={{ right: 1920 - 1824 + 12, top: S7.rows[0].y }}>convolutions only</p>
      <p className="dp-label dp7-r" data-a="seq-eight" data-role="chart" style={{ left: S7.x0, top: S7.rows[3].y + 48 }}>About eight times shorter at each stage</p>

      {/* One Mamba block reads its features in six directions, then sums them (schematic). */}
      <p className="dp-kicker dp7-r" data-a="dir-title" data-role="chart" style={{ left: S7.x0, top: S7.cubeY - 116 }}>Each Mamba block: <Num k="net.dirs" /> directions, summed</p>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        {S7.cubes.map((c, i) => (
          <g key={c.name}>
            <g data-a="cube" className="dp7-cube" style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}>
              <path d={c.faces.top} className="dp7-cube__top" />
              <path d={c.faces.left} className="dp7-cube__left" />
              <path d={c.faces.right} className="dp7-cube__right" />
              <path d={c.faces.grid} className="dp7-cube__grid" />
            </g>
            <path d={c.line} className="dp7-dir" data-a={`dir-line-${i}`} pathLength="1" />
            <path d={c.head} className="dp7-dir dp7-dir--head" data-a={`dir-head-${i}`} />
          </g>
        ))}
        <g data-a="sum" className="dp7-sum" style={{ transformOrigin: `${S7.sum.x}px ${S7.sum.y}px` }}>
          <path d={`M ${S7.cubes[5].cx + 52} ${S7.sum.y} L ${S7.sum.x - 34} ${S7.sum.y}`} className="dp7-sum__arrow" />
          <path d={`M ${S7.sum.x - 44} ${S7.sum.y - 7} L ${S7.sum.x - 34} ${S7.sum.y} L ${S7.sum.x - 44} ${S7.sum.y + 7}`} className="dp7-sum__arrow" />
          <circle cx={S7.sum.x} cy={S7.sum.y} r="28" className="dp7-sum__ring" />
          <text x={S7.sum.x} y={S7.sum.y + 13} textAnchor="middle" className="dp7-sum__glyph">&Sigma;</text>
        </g>
      </svg>
      {S7.cubes.map((c, i) => (
        <p key={c.name} className="dp-label dp7-dirlab" data-a={`dir-label-${i}`} data-role="chart" style={{ left: c.cx - 50, top: c.cy + 64 }}>{c.name}</p>
      ))}
      <p className="dp-label dp7-dirlab" data-a="sum-label" data-role="chart" style={{ left: S7.sum.x - 60, top: S7.sum.y + 64 }}>summed</p>
      <p className="dp-tag dp7-schem" data-a="dir-schem" data-role="foot" style={{ right: 96, top: S7.cubeY + 108 }}>Schematic</p>
    </div>
  );
}

/* ── 8. Organ head and ensemble ────────────────────────────────────────────
   70 s read (116 words); latest starts: earlier version 0.5 s, flagged 1.5,
   normal uptake 10.8, kidneys 14.9, salivary glands 15.9, second output 23.1,
   24 anatomical structures 27.7, training only 29.8, fell from 21 to 7 36.9
   to 39.0, ensemble 43.1, five versions 44.1, averaged 51.3, 10 voxels 56.9
   (early); all over by 52.5 s. The figure carries over from slide 7 and
   shrinks; its organ head's box comes forward (the figure's small text is
   left out). False alarms are counts only: none is drawn on a scan. */
const THUMB8 = 0.3; // px per figure unit for the five versions

function designTimeline(root, add) {
  const p = FIG.pose8;
  add(track(one(root, 'fig'), [
    { t: 0.2, transform: 'translate(0px, 0px) scale(1)', e: EASE.inOut },
    { t: 1.3, transform: `translate(${p.dx.toFixed(1)}px, ${p.dy.toFixed(1)}px) scale(${p.k.toFixed(4)})` },
  ]));
  // An earlier version flagged lesions on all seven scans with no lesions.
  add(rise(one(root, 'kick-early'), 0.4, 0.8, 12));
  add(rise(one(root, 'lab-early'), 0.6, 0.8, 12));
  // Normal uptake: the kidneys and the salivary glands.
  add(fadeIn(one(root, 'scan'), 7.4, 1.0));
  add(rise(one(root, 'kick-uptake'), 9.8, 0.8, 12));
  [['kidney', 14.2], ['sal', 15.2]].forEach(([n, at]) => {
    add(fadeIn(one(root, `organ-${n}`), at));
    all(root, `organ-${n}-leader`).forEach((el) => add(draw(el, at, 0.6)));
    all(root, `organ-${n}-dot`).forEach((el) => add(fadeIn(el, at + 0.4, 0.4)));
  });
  // The second output, trained on anatomy and used in training only.
  add(track(one(root, 'organ'), [{ t: 21.8, opacity: 0, transform: 'translateY(16px)' }, { t: 22.7, opacity: 1, transform: 'translateY(0px)' }]));
  add(fadeIn(one(root, 'boxwash'), 22.4, 0.6));
  add(rise(one(root, 'co-1'), 22.2, 0.8, 10));
  add(draw(one(root, 'co-leader'), 22.4, 0.5));
  add(rise(one(root, 'co-2'), 26.8, 0.8, 10));
  add(fadeIn(one(root, 'co-3'), 29.0, 0.8));
  // False alarms on those seven scans: built top down from "With nothing else
  // changed" (31.8): the 21 marks, "21 before", the caption; then they fall to 7.
  all(root, 'mark').forEach((el, i) => add(pop(el, 30.8 + i * 0.02, 0.4, 0.4)));
  add(rise(one(root, 'n-before'), 31.0, 0.8, 12));
  add(fadeIn(one(root, 'fa-caption'), 31.2));
  add(rise(one(root, 'nothing-else'), 31.4, 0.8, 10));
  all(root, 'mark-fill').forEach((el, i) => add(track(el, [{ t: 36.8 + i * 0.05, opacity: 1 }, { t: 37.3 + i * 0.05, opacity: 0 }], EASE.inOut)));
  add(track(one(root, 'n-before-ink'), [{ t: 37.3, opacity: 1 }, { t: 37.9, opacity: 0 }], EASE.inOut));
  add(fadeIn(one(root, 'n-arrow'), 37.3, 0.5));
  add(rise(one(root, 'n-after'), 37.5, 0.8, 12));
  // The final model: five versions of the network, averaged, then the threshold
  // and the size filter.
  add(rise(one(root, 'ens-1'), 40.4, 0.8, 10));
  all(root, 'version').forEach((el, i) => add(pop(el, 42.6 + i * 0.15, 0.5, 0.6)));
  add(rise(one(root, 'ens-2'), 46.4, 0.8, 10));
  add(rise(one(root, 'ens-3'), 48.6, 0.8, 10));
  add(rise(one(root, 'ens-4'), 50.4, 0.8, 10));
}

export function DesignSlide({ ctx }) {
  const root = useTimeline(ctx, designTimeline);
  const at8 = FIG.at8;
  const p = FIG.pose8;
  const ob = OPTF_LAYERS.organ;
  const coX = (at8(ob.x0, 0).x + at8(266.8, 0).x) / 2; // the box's centre (its right edge is x 266.8)
  const boxTop = at8(0, ob.y0).y;
  const uBottom = at8(0, OPTF_LAYERS.body.y1).y;
  const sc = S8.scan;
  const o = S8.organs;
  const labelR = sc.x - 34;
  const kidneyLabelY = Math.max(o.kidney[0].y, o.kidney[1].y) + 66;
  const vw = FIG.body.w * THUMB8;
  return (
    <div className="dp-stage dp8" ref={root}>
      <FigHolder
        a="fig"
        label="The network of slide 7 with its organ head (training only)"
        style={{ transform: `translate(${p.dx}px, ${p.dy}px) scale(${p.k})` }}
      >
        <Body />
        <FigLayer name="input" />
        <FigLayer name="output" />
        <FigLayer name="organ" />
      </FigHolder>

      {/* Callout over the organ head's box. */}
      <div className="dp8-callout" style={{ left: at8(OPTF_LAYERS.input.x1, 0).x + 18, top: boxTop - 104 }}>
        <p className="dp-label" data-role="chart">
          <b data-a="co-1">Second output</b><span data-a="co-3">, used during training only</span>
        </p>
        <p className="dp-label" data-a="co-2" data-role="chart"><T>{'outlines {{organ.structures}} anatomical structures'}</T></p>
      </div>
      <span className="dp8-boxwash" data-a="boxwash" style={{ left: at8(ob.x0, 0).x, top: boxTop, width: at8(266.8, 0).x - at8(ob.x0, 0).x, height: at8(0, 55).y - boxTop }} aria-hidden="true" />
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <path d={`M ${coX} ${boxTop - 30} L ${coX} ${boxTop - 2}`} className="dp-leader" data-a="co-leader" pathLength="1" />
      </svg>

      {/* The final model, under the network: five versions of it. */}
      <div className="dp8-ens" style={{ left: 96, top: uBottom + 18 }}>
        <p className="dp-label" data-a="ens-1" data-role="chart"><b><T>{'Final model: {{inf.models}} versions'}</T></b></p>
        <div className="dp8-versions">
          {Array.from({ length: 5 }, (_, i) => <NetThumb key={i} t={THUMB8} a="version" style={{ marginRight: i < 4 ? 22 : 0, width: vw }} />)}
        </div>
        <p className="dp-label dp-label--muted" data-a="ens-2" data-role="chart">each trained on a different portion of the data</p>
        <p className="dp-label dp-label--muted" data-a="ens-3" data-role="chart"><T>{'averaged voxel by voxel; threshold {{inf.thr}}'}</T></p>
        <p className="dp-label dp-label--muted" data-a="ens-4" data-role="chart"><T>{'predicted lesions under {{inf.minvox}} voxels removed'}</T></p>
      </div>

      {/* An earlier version, on the scans with no lesions. */}
      <p className="dp-kicker" data-a="kick-early" data-role="chart" style={{ left: S8.x0, top: 300 }}>Earlier version</p>
      <div data-a="lab-early" style={{ left: S8.x0, top: 344 }}>
        <p className="dp-label" data-role="chart"><T>{'Flagged lesions in all {{organ.neg}}'}</T></p>
        <p className="dp-label" data-role="chart">scans that had no lesions</p>
      </div>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        {S8.marks.map((m, i) => (
          <g key={i} data-a="mark" className="dp8-mark" style={{ transformOrigin: `${m.x}px ${m.y}px` }}>
            <circle cx={m.x} cy={m.y} r="7.5" className="dp8-mark__ring" />
            {m.kept
              ? <circle cx={m.x} cy={m.y} r="7.5" className="dp8-mark__fill" />
              : <circle cx={m.x} cy={m.y} r="7.5" className="dp8-mark__fill is-gone" data-a="mark-fill" />}
          </g>
        ))}
      </svg>
      <p className="dp8-count" data-role="chart" style={{ left: S8.x0, top: 494 }}>
        <span data-a="n-before" className="dp8-count__n is-before">
          <Num k="organ.fc3" />
          <span className="dp8-count__ink" data-a="n-before-ink" aria-hidden="true"><Num k="organ.fc3" /></span>
          <span className="dp-tag dp8-count__lab" data-role="foot">before</span>
        </span>
        <span data-a="n-arrow" className="dp8-count__arrow" aria-hidden="true">&rarr;</span>
        <span data-a="n-after" className="dp8-count__n">
          <Num k="organ.fc4" />
          <span className="dp-tag dp8-count__lab" data-role="foot">with the organ head</span>
        </span>
      </p>
      <div style={{ left: S8.x0, top: 632 }}>
        <p className="dp-label" data-a="fa-caption" data-role="chart">false alarms on those scans</p>
        <p className="dp-label dp-label--muted" data-a="nothing-else" data-role="chart">with nothing else changed</p>
      </div>

      {/* Normal uptake, on the scan of slide 2 (no lesion outlines). */}
      <p className="dp-kicker dp8-uptake" data-a="kick-uptake" data-role="chart" style={{ right: 1920 - labelR, top: 300 }}>Normal uptake</p>
      <div className="dp-fill" data-a="scan">
        <Layer src="figures/plain-a-pet.png" box={sc} alt="Whole-body PSMA PET projection, the scan of slide 2" />
      </div>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        {o.sal.map((q, i) => <path key={`s${i}`} d={`M ${labelR + 10} ${o.sal[0].y + 6} L ${q.x} ${q.y}`} className="dp-leader" data-a="organ-sal-leader" pathLength="1" />)}
        {/* the leaders cross the dark kidneys, so they get a white casing */}
        {o.kidney.map((q, i) => <path key={`kc${i}`} d={`M ${labelR + 10} ${kidneyLabelY} L ${q.x} ${q.y}`} className="dp-leader dp8-leader-case" data-a="organ-kidney-leader" pathLength="1" />)}
        {o.kidney.map((q, i) => <path key={`k${i}`} d={`M ${labelR + 10} ${kidneyLabelY} L ${q.x} ${q.y}`} className="dp-leader" data-a="organ-kidney-leader" pathLength="1" />)}
        {o.sal.map((q, i) => <circle key={`sd${i}`} cx={q.x} cy={q.y} r="3.5" className="dp-anchor" data-a="organ-sal-dot" />)}
        {o.kidney.map((q, i) => <circle key={`kd${i}`} cx={q.x} cy={q.y} r="3.5" className="dp-anchor" data-a="organ-kidney-dot" />)}
      </svg>
      <p className="dp-label dp8-organ" data-a="organ-sal" data-role="chart" style={{ right: 1920 - labelR, top: o.sal[0].y + 6 }}>Salivary glands</p>
      <p className="dp-label dp8-organ" data-a="organ-kidney" data-role="chart" style={{ right: 1920 - labelR, top: kidneyLabelY }}>Kidneys</p>
    </div>
  );
}

/* ── 9. Data and testing ───────────────────────────────────────────────────
   70 s read (127 words); latest starts: autoPET-III 3.7 s, 58 with no lesions
   5.2, its labels 9.4, DEEP-PSMA 16.4, every scan has lesions 20.6, its labels
   23.0, 130 sealed 30.5, never trained on 32.8, five-fold 37.9, five versions
   40.3, scoring 42.6, same script 46.4, found 47.3, F1 52.5, Dice 56.2 (early);
   all over by 52.5 s. One tile per scan, with the real fold and test mixes. */
const FLY = { test: 29.6, pool: 36.4, spread: 0.8, dur: 1.0 };
const RULE_DY = -55; // the schematic, moved up under the scoring line

function testedTimeline(root, add) {
  // Labels of the two datasets.
  add(rise(one(root, 'ap'), 3.2, 0.8, 12));
  add(fadeIn(one(root, 'ap-neg'), 5.0, 0.6));
  add(rise(one(root, 'ap-lab'), 9.0, 0.8, 10));
  add(rise(one(root, 'dp'), 15.6, 0.8, 12));
  add(fadeIn(one(root, 'dp-all'), 19.0, 0.6));
  add(rise(one(root, 'dp-lab'), 22.6, 0.8, 10));
  // Tiles: autoPET-III from the start, DEEP-PSMA when it is named; then the test
  // set flies to the sealed box, and the rest to the five folds.
  all(root, 't').forEach((el) => {
    const t = S9.tiles[Number(el.dataset.i)];
    const appear = t.kind === 'dp' ? 15.6 + t.r * 0.8 : 0.3 + t.r * 1.2;
    const fly = (t.dest === 'test' ? FLY.test : FLY.pool) + t.r * FLY.spread;
    const from = `translate(${t.from.x - t.to.x}px, ${t.from.y - t.to.y}px)`;
    add(track(el, [
      { t: appear, opacity: 0, transform: from },
      { t: appear + 0.4, opacity: 1, transform: from },
      { t: fly, opacity: 1, transform: from, e: EASE.inOut },
      { t: fly + FLY.dur, opacity: 1, transform: 'translate(0px, 0px)' },
    ]));
  });
  all(root, 't-fill').forEach((el, i) => add(track(el, [{ t: 5.0 + (i % 12) * 0.05, opacity: 1 }, { t: 5.6 + (i % 12) * 0.05, opacity: 0 }], EASE.inOut)));
  // The sealed box.
  add(fadeIn(one(root, 'box'), 29.4, 0.6));
  add(draw(one(root, 'box-line'), 29.4, 1.0));
  add(rise(one(root, 'box-n'), 30.3, 0.8, 10));
  add(pop(one(root, 'lock'), 31.4, 0.5, 0.6));
  add(rise(one(root, 'box-lab'), 32.4, 0.8, 10));
  // Folds, then the five versions they gave.
  add(rise(one(root, 'folds-lab'), 36.2, 0.8, 10));
  all(root, 'version').forEach((el, i) => add(pop(el, 39.2 + i * 0.12, 0.5, 0.6)));
  add(rise(one(root, 'versions-lab'), 39.6, 0.8, 10));
  // One scoring script for both models.
  add(rise(one(root, 'score-kick'), 42.2, 0.8, 10));
  add(rise(one(root, 'score-line'), 42.4, 0.8, 10));
  add(fadeIn(one(root, 'script-by'), 43.4, 0.6));
  // The any-overlap rule, schematic: a lesion touched by a prediction is found;
  // a prediction touching no lesion is a false alarm.
  add(fadeIn(one(root, 'rule'), 46.4, 0.6));
  add(track(one(root, 'pred-a'), [{ t: 46.6, opacity: 0, transform: 'translate(34px, 26px)' }, { t: 47.4, opacity: 1, transform: 'translate(0px, 0px)' }]));
  add(fadeIn(one(root, 'tag-pred'), 47.0, 0.5));
  add(track(one(root, 'found-tint'), [{ t: 47.5, opacity: 0 }, { t: 47.9, opacity: 1 }]));
  add(rise(one(root, 'found-lab'), 47.6, 0.7, 10));
  add(pop(one(root, 'pred-b'), 48.0, 0.5, 0.6));
  add(track(one(root, 'fa-tint'), [{ t: 48.5, opacity: 0 }, { t: 48.9, opacity: 1 }]));
  add(rise(one(root, 'fa-lab'), 48.6, 0.7, 10));
  add(rise(one(root, 'm-f1'), 50.0, 0.7, 10));
  add(rise(one(root, 'm-dice'), 50.8, 0.7, 10));
}

const BLOB_A = 'M 1290 600 C 1300 576 1336 574 1346 596 C 1356 618 1336 646 1310 640 C 1290 636 1282 616 1290 600 Z';
const BLOB_B = 'M 1622 582 C 1636 558 1676 564 1680 590 C 1684 616 1656 630 1636 622 C 1618 614 1612 596 1622 582 Z';

export function TestedSlide({ ctx }) {
  const root = useTimeline(ctx, testedTimeline);
  const { box } = S9;
  const lockX = box.x + box.w / 2;
  const vb = S9.versions;
  return (
    <div className="dp-stage dp9" ref={root}>
      {/* The two datasets. */}
      <div className="dp9-legend">
        <p className="dp-label" data-a="ap" data-role="chart">
          <span className="dp9-key is-pos" aria-hidden="true" /><b>autoPET-III:</b> <Num k="data.autopet" /> scans
          <span data-a="ap-neg">, <span className="dp9-key is-neg" aria-hidden="true" /><Num k="data.autopet_neg" /> with no lesions</span>
        </p>
        <p className="dp-label dp-label--muted dp9-sub" data-a="ap-lab" data-role="chart">labels: SUV threshold, then corrected by an expert</p>
        <p className="dp-label" data-a="dp" data-role="chart">
          <span className="dp9-key is-dp" aria-hidden="true" /><b>DEEP-PSMA:</b> <Num k="data.deeppsma" /> scans
          <span data-a="dp-all">, advanced disease, every scan has lesions</span>
        </p>
        <p className="dp-label dp-label--muted dp9-sub" data-a="dp-lab" data-role="chart">labels: SUV threshold, normal uptake removed by a physician</p>
      </div>

      {/* The sealed test set. */}
      <div className="dp9-box" data-a="box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" className="dp9-box__line" data-a="box-line" pathLength="1" />
        <g data-a="lock" className="dp9-lock" style={{ transformOrigin: `${lockX}px ${box.y}px` }}>
          <path d={`M ${lockX - 9} ${box.y - 4} V ${box.y - 14} a 9 9 0 0 1 18 0 V ${box.y - 4}`} className="dp9-lock__shackle" />
          <rect x={lockX - 15} y={box.y - 6} width="30" height="24" rx="4" className="dp9-lock__body" />
        </g>
      </svg>
      <div className="dp9-boxlab" style={{ left: box.x - 4, top: box.y + box.h + 14 }}>
        <p className="dp-label" data-a="box-n" data-role="chart"><b><T>{'{{data.test}} sealed away'}</T></b></p>
        <div data-a="box-lab">
          <p className="dp-label dp-label--muted" data-role="chart">never trained on,</p>
          <p className="dp-label dp-label--muted" data-role="chart">scored once</p>
        </div>
      </div>

      {/* The five folds, and the five versions in the ensemble (one row, not one per fold). */}
      <p className="dp-label" data-a="folds-lab" data-role="chart" style={{ left: S9.folds[0].x, top: S9.folds[0].y - 54 }}>
        <b><T>{'The other {{data.pool}}:'}</T></b> five-fold cross-validation
      </p>
      {vb.map((p, k) => <NetThumb key={k} t={S9.thumb} a="version" style={{ left: p.x, top: p.y }} />)}
      <p className="dp-label dp-label--muted dp9-center" data-a="versions-lab" data-role="chart" style={{ left: vb[0].x, width: vb[4].x + FIG.body.w * S9.thumb - vb[0].x, top: vb[0].y + FIG.body.h * S9.thumb + 10 }}>
        the five versions in the ensemble
      </p>

      {/* One tile per scan, at its final place (the timeline flies it there). */}
      {S9.tiles.map((t) => (
        <span key={t.i} className={`dp9-t is-${t.kind}`} data-a="t" data-i={t.i} style={{ left: t.to.x, top: t.to.y }}>
          {t.kind === 'neg' && <span className="dp9-t__fill" data-a="t-fill" />}
        </span>
      ))}

      {/* Scoring. */}
      <p className="dp-kicker dp9-score" data-a="score-kick" data-role="chart" style={{ top: 262 }}>Scoring</p>
      <div className="dp9-score" data-a="score-line" style={{ top: 306 }}>
        <p className="dp-label" data-role="chart"><b>My model</b> and <b>PSMASegmentator</b></p>
        <p className="dp-label" data-role="chart">used the same scoring script</p>
      </div>
      <p className="dp-tag dp9-score" data-a="script-by" data-role="foot" style={{ top: 384 }}>written by Joel Noble, used with his permission</p>

      <div className="dp-fill" data-a="rule">
        <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
          <g transform={`translate(0 ${RULE_DY})`}>
            {/* found: a lesion outline touched by a predicted blob */}
            <g data-a="pred-a"><path d={BLOB_A} className="dp9-pred" /></g>
            <circle cx="1262" cy="590" r="44" className="dp9-les" />
            <g data-a="found-tint">
              <path d={BLOB_A} className="dp9-pred is-found" />
              <circle cx="1262" cy="590" r="44" className="dp9-les is-found" />
            </g>
            {/* false alarm: a predicted blob touching no lesion */}
            <g data-a="pred-b" className="dp9-popb"><path d={BLOB_B} className="dp9-pred" /></g>
            <g data-a="fa-tint"><path d={BLOB_B} className="dp9-pred is-fa" /></g>
          </g>
        </svg>
        <p className="dp-tag dp9-tag" data-role="foot" style={{ left: 1180, top: 590 + RULE_DY - 78 }}>lesion</p>
        <p className="dp-tag dp9-schem" data-role="foot" style={{ right: 96, top: 664 + RULE_DY + 118 }}>Schematic</p>
      </div>
      <p className="dp-tag dp9-tag" data-a="tag-pred" data-role="foot" style={{ left: 1364, top: 600 + RULE_DY - 14 }}>prediction</p>
      <div className="dp9-rulelab" data-a="found-lab" style={{ left: 1180, top: 664 + RULE_DY }}>
        <p className="dp-label" data-role="chart"><b>Found:</b> a lesion that any</p>
        <p className="dp-label" data-role="chart">predicted voxel touches</p>
      </div>
      <div className="dp9-rulelab" data-a="fa-lab" style={{ left: 1560, top: 664 + RULE_DY }}>
        <p className="dp-label" data-role="chart"><b>False alarm:</b> a</p>
        <p className="dp-label" data-role="chart">prediction touching</p>
        <p className="dp-label" data-role="chart">no lesion</p>
      </div>
      <p className="dp-label dp9-metric" data-a="m-f1" data-role="chart" style={{ top: 774 }}>
        <b><span data-tick="">F1</span></b> balances lesions found against false alarms
      </p>
      <p className="dp-label dp9-metric" data-a="m-dice" data-role="chart" style={{ top: 824 }}>
        <b>Dice</b> shows how well the outlines match
      </p>
    </div>
  );
}

/* ── 10. Test-set results ──────────────────────────────────────────────────
   67 s read (123 words); latest starts: F1 7.9 s, found 82% 9.7, flagged and
   real 12.5, Dice 17.1, same F1 on both 19.0, autoPET 24.5, DEEP-PSMA 30.6,
   PSMASegmentator trained on autoPET 39.8, my model trained on DEEP-PSMA 44.4,
   fair comparison 48.6; all over by 50.3 s. Left: dissertation Figure 4.7 (b)'s
   test scan, in its colours. No PSMASegmentator or 2022 figures, no Dice per
   cohort, no intervals. */
function OutlineSet({ list, kind, a }) {
  const sc = S10.scan;
  return (
    <svg className={`dp-outlines dp10-o dp10-o--${kind}`} data-a={a} style={{ left: sc.x, top: sc.y, width: sc.w, height: sc.h }} viewBox={`0 0 ${SCANS.C.w} ${SCANS.C.h}`} preserveAspectRatio="none" aria-hidden="true">
      {list.map((l) => (
        <g key={`${l.cx}-${l.cy}`} className="dp-les">
          <path d={l.d} className="dp-les__fill" />
          <path d={l.d} className="dp-les__casing" />
          <path d={l.d} className="dp-les__edge" />
        </g>
      ))}
    </svg>
  );
}

function resultsTimeline(root, add) {
  add(fadeIn(one(root, 'scan'), 0.3, 1.0));
  add(rise(one(root, 'kick'), 3.4, 0.8, 10));
  add(rise(one(root, 'f1'), 6.4, 0.9, 20));
  add(rise(one(root, 'found'), 9.2, 0.8, 14));
  add(fadeIn(one(root, 'o-found'), 9.4, 0.8));
  add(fadeIn(one(root, 'o-missed'), 11.0, 0.8));
  add(rise(one(root, 'real'), 12.0, 0.8, 14));
  add(fadeIn(one(root, 'o-fa'), 13.0, 0.8));
  add(fadeIn(one(root, 'legend'), 13.0, 0.8));
  add(rise(one(root, 'dice'), 16.6, 0.8, 14));
  // Cohort bars: the same F1, a different balance.
  all(root, 'group').forEach((el, i) => add(rise(el, 18.4 + i * 0.2, 0.8, 10)));
  all(root, 'bname').forEach((el, i) => add(fadeIn(el, 18.5 + i * 0.12, 0.6)));
  all(root, 'bar').forEach((el, i) => add(track(el, [{ t: 18.6 + i * 0.12, transform: 'scaleX(0)' }, { t: 19.6 + i * 0.12, transform: 'scaleX(1)' }], EASE.inOut)));
  all(root, 'val').forEach((el, i) => add(fadeIn(el, 19.4 + i * 0.12, 0.5)));
  // the two F1 bars, then each cohort's balance: the others dim and return
  const dim = (name, from, to) => all(root, name).forEach((el) => add(track(el, [
    { t: from, opacity: 1 }, { t: from + 0.4, opacity: 0.3 }, { t: to, opacity: 0.3 }, { t: to + 0.5, opacity: 1 },
  ], EASE.inOut)));
  dim('not-f1', 20.4, 23.4);
  dim('dim-ap', 24.2, 29.4);
  dim('dim-dp', 30.2, 37.2);
  add(rise(one(root, 'note-ap'), 39.2, 0.8, 10));
  add(rise(one(root, 'note-dp'), 44.2, 0.8, 10));
  add(rise(one(root, 'fair'), 47.8, 0.8, 10));
}

export function ResultsSlide({ ctx }) {
  const root = useTimeline(ctx, resultsTimeline);
  const sc = S10.scan;
  const { bar } = S10;
  const names = ['F1', 'Found', 'Flagged and real'];
  return (
    <div className="dp-stage dp10" ref={root}>
      <div className="dp-fill" data-a="scan">
        <Layer src="figures/plain-c-pet.png" box={sc} alt="Whole-body PSMA PET projection of a sealed test scan, with found, missed and false-alarm outlines" />
      </div>
      <OutlineSet list={SCANS.C.found} kind="found" a="o-found" />
      <OutlineSet list={SCANS.C.missed} kind="missed" a="o-missed" />
      <OutlineSet list={SCANS.C.falseAlarm} kind="fa" a="o-fa" />

      {/* The headline. */}
      <p className="dp-kicker dp10-mid" data-a="kick" data-role="chart" style={{ top: 268 }}><T>{'Sealed test set, {{data.test}} scans'}</T></p>
      <div className="dp10-mid dp10-f1" data-a="f1" style={{ top: 316 }}>
        <p className="dp10-f1__k" data-role="body"><span data-tick="">F1</span></p>
        <p className="dp10-f1__n" data-role="chart"><Num k="r5.f1" /></p>
      </div>
      <div className="dp10-mid dp10-row" data-a="found" style={{ top: 478 }}>
        <p className="dp10-row__n" data-role="chart"><Num k="r5.found_round" /></p>
        <p className="dp-label" data-role="chart">Found</p>
      </div>
      <div className="dp10-mid dp10-row" data-a="real" style={{ top: 548 }}>
        <p className="dp10-row__n" data-role="chart"><Num k="r5.prec_round" /></p>
        <p className="dp-label" data-role="chart">Flagged and real</p>
      </div>
      <div className="dp10-mid" data-a="dice" style={{ top: 618 }}>
        <div className="dp10-row">
          <p className="dp10-row__n" data-role="chart"><Num k="r5.dsc" /></p>
          <p className="dp-label" data-role="chart">Dice</p>
        </div>
        <p className="dp-tag dp10-dicenote" data-role="foot"><T>{'over the {{data.test_pos}} scans with lesions'}</T></p>
      </div>
      <div className="dp10-mid dp10-legend" data-a="legend" style={{ top: 730 }}>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-found" aria-hidden="true" />Found</p>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-missed" aria-hidden="true" />Missed</p>
        <p className="dp-label" data-role="chart"><span className="dp10-key is-fa" aria-hidden="true" />False alarm</p>
        <p className="dp-tag dp10-scannote" data-role="foot">The scan: one sealed DEEP-PSMA test scan, its cohort&apos;s median case by <span data-tick="">F1</span></p>
      </div>

      {/* By cohort. */}
      {S10.groups.map((g, gi) => (
        <div key={g.name} className="dp10-group" data-a="group" style={{ top: g.y }}>
          <p className="dp-label" data-role="chart">
            <b>{g.name}</b>, <Num k={gi ? 'data.test_deeppsma' : 'data.test_autopet'} /> scans
          </p>
        </div>
      ))}
      {S10.groups.flatMap((g, gi) => g.rows.map((r, i) => {
        // Which emphasis phases dim this row: the F1 rows step back while each
        // cohort's balance is spoken, the other rows while the equal F1 is.
        const own = gi === 0 ? 'dim-dp' : 'dim-ap';
        const [d1, d2] = i === 0 ? ['dim-ap', 'dim-dp'] : ['not-f1', own];
        return (
          <div key={r.k} className="dp-fill" data-a={d1}>
            <div className="dp-fill" data-a={d2}>
              <p className="dp-label dp10-bname" data-a="bname" data-role="chart" style={{ right: 1920 - (bar.x - 16), top: r.y - 4 }}>
                {i === 0 ? <span data-tick="">F1</span> : names[i]}
              </p>
              <span className={`dp10-bar is-${['f1', 'found', 'real'][i]}`} data-a="bar" style={{ left: bar.x, top: r.y, width: r.w }} aria-hidden="true" />
              <p className="dp-label dp10-bval" data-a="val" data-role="chart" style={{ left: bar.x + r.w + 12, top: r.y - 4 }}><Num k={r.k} /></p>
            </div>
          </div>
        );
      }))}
      <p className="dp-label dp-label--muted dp10-note" data-a="note-ap" data-role="chart" style={{ top: S10.groups[0].rows[2].y + 52 }}>
        PSMASegmentator trained on these scans
      </p>
      <p className="dp-label dp-label--muted dp10-note" data-a="note-dp" data-role="chart" style={{ top: S10.groups[1].rows[2].y + 52 }}>
        <T>{'My model trained on {{data.pool_deeppsma}} of the {{data.deeppsma}}'}</T>
      </p>
      <p className="dp-label dp10-note dp10-fair" data-a="fair" data-role="chart" style={{ top: S10.groups[1].rows[2].y + 112 }}>
        Neither dataset here gives a fair comparison
      </p>
    </div>
  );
}
