import Scene from '../../scene/Scene';
import { lin, seriesPath, bracket } from '../../scene/geom';
import { SERIES } from '../../data/series';
import fig48 from '../../figures/cell48_0.png';

/* ============================================================================
   SCENE — the whole project in one picture
   Real data: Bickley's 392-month record and test window 150 (test_seq[150]
   = record months 151–246); training row 0 for the VAE input. Numbers:
   12-month test MAEs Out [10] / [14] / [17]; 24-month MAEs and both
   baselines Out [18]; 4 codings Out [21]; the six samples are the
   notebook's own figure (Out [23], cell48_0.png), not redrawn.
   ========================================================================== */

const W = 800;
const H = 534;

// band A · the record
const REC = SERIES.bickley;
const N = REC.length;
const RX0 = 40;
const RX1 = 760;
const MR = (RX1 - RX0) / N;
const edge = (m) => RX0 + (m - 1) * MR;
const xr = (m) => edge(m) + MR / 2;
const yr = lin(4, 35, 104, 34);
const S_END = 151; // test_seq[150] starts on record month 151
const BOX = { y: 30, h: 78, w: 96 * MR };

// band B left · one window
const WIN = SERIES.testSeqs['150'];
const ZX0 = 40;
const ZX1 = 330;
const ZM = (ZX1 - ZX0) / 96;
const zedge = (m) => ZX0 + (m - 1) * ZM;
const zx = (m) => zedge(m) + ZM / 2;
const zy = lin(4, 35, 266, 166);
const Z = { top: 162, bot: 268 };

// band B right · the forecasters on one MAE axis
const MX0 = 520;
// the axis ends at 700 so a 390 px stage (about 405 of the 800 units) can show the
// lane labels and the 24-month values together
const MX1 = 700;
const mx = lin(0.95, 1.5, MX0, MX1);
const AX_Y = 294;
const LANES = [
  { k: 'm1', name: 'model 1', sub: '12 months at once', y: 192, v12: 1.25, v24: null },
  { k: 'm2', name: 'model 2', sub: '1 month, rolled ×12', y: 232, v12: 1.407, v24: 1.47 },
  { k: 'm3', name: 'model 3', sub: 'encoder → decoder', y: 272, v12: 1.321, v24: 1.457 },
];
const CLIM = 0.958;
const SNAIVE = 1.235;
const f3 = (v) => v.toFixed(3);
// the page's reference styles (decisions.md, as in Baselines / Horizon): seasonal
// naive grey dashed with filled markers, climatology ink-2 dotted with hollow ones
const BASES = [
  { k: 'cl', name: 'climatology', v: CLIM, line: { stroke: 'var(--ink-2)', strokeDasharray: '1.5 4', strokeLinecap: 'round' }, dot: { fill: 'var(--surface)', stroke: 'var(--ink-2)' }, r: 3.6, dw: 1.6 },
  { k: 'sn', name: 'seasonal naive', v: SNAIVE, line: { stroke: 'var(--dlp2-base)', strokeDasharray: '6 4' }, dot: { fill: 'var(--dlp2-base)', stroke: 'var(--surface)' }, r: 4.2, dw: 1.4 },
];
const BL_TOP = 174;

// model 2's markers are squares and model 3's circles wherever both appear
// (decisions.md); a square of half-side r − 0.5 weighs about the same as a circle of radius r
const SQ = (k) => k === 'm2';
function Mark({ k, cx, cy, r, ...rest }) {
  if (SQ(k)) {
    const h = r - 0.5;
    return <rect x={cx - h} y={cy - h} width={2 * h} height={2 * h} {...rest} />;
  }
  return <circle cx={cx} cy={cy} r={r} {...rest} />;
}
const DOT_R = 5.5;
const LG_X = 574; // the legend's "12", right-aligned; "24 months" ends near x 686

// band C · the VAE
const VSEQ = SERIES.trainSeqs['0'];
const vx = lin(1, 84, 44, 196);
const vy = lin(4, 36, 458, 384);
const ENC = '226,374 292,400 292,440 226,466';
const DEC = '330,400 396,374 396,466 330,440';
const CODE_Y = [388, 406, 424, 442];
const FIG = { x: 438, y: 372, w: 330, h: 330 / (1490 / 593) };

function makeArt() {
  const recMin = REC.map((r) => r[0]);
  const recMax = REC.map((r) => r[1]);
  const winMin = WIN.map((r) => r[0]);
  const winMax = WIN.map((r) => r[1]);
  return function art(step, uid) {
    const on = (b) => (step >= b ? 1 : 0);
    const hatch = `${uid}hatch`;
    const far = step >= 3;
    return (
      <>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="sv-faint" strokeWidth="1" />
          </pattern>
        </defs>

        {/* ── A · the record and one window ── */}
        <text className="sv-cap" x={24} y={24}>Bickley · the test station · 392 months</text>
        <path className="sv-line sv-max pf-rec" d={seriesPath(recMax, xr, yr)} strokeWidth="1" />
        <path className="sv-line sv-min pf-rec" d={seriesPath(recMin, xr, yr)} strokeWidth="1" />
        <rect className="pf-box" x={edge(S_END)} y={BOX.y} width={BOX.w} height={BOX.h} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.6 }} opacity={on(0)} />
        <g className="pf-zoom" opacity={on(0)}>
          <path className="sv-faint pf-conn" d={`M${edge(S_END)} ${BOX.y + BOX.h}L${ZX0} ${Z.top - 24}`} strokeWidth="0.8" />
          <path className="sv-faint pf-conn" d={`M${edge(S_END + 96)} ${BOX.y + BOX.h}L${ZX1} ${Z.top - 24}`} strokeWidth="0.8" />
          <text className="sv-cap-code" x={ZX0} y={156}>test_seq[150] · one window · 96 months</text>
          <rect className="pf-tgt" x={zedge(73)} y={Z.top} width={ZM * (far ? 24 : 12)} height={Z.bot - Z.top} style={{ fill: 'var(--ink-3)', fillOpacity: 0.16 }} />
          <rect className="pf-hatch" x={zedge(85)} y={Z.top} width={ZM * 12} height={Z.bot - Z.top} fill={`url(#${hatch})`} opacity={far ? 0 : 1} />
          <line className="sv-axis" x1={ZX0} x2={ZX1} y1={Z.bot} y2={Z.bot} />
          <path className="sv-line sv-max pf-win" d={seriesPath(winMax, zx, zy)} strokeWidth="1.5" />
          <path className="sv-line sv-min pf-win" d={seriesPath(winMin, zx, zy)} strokeWidth="1.5" />
          <line className="sv-ink" x1={zedge(73)} x2={zedge(73)} y1={Z.top - 4} y2={Z.bot + 4} strokeWidth="1.2" strokeDasharray="3 3" />
          <path className="sv-ink2" d={bracket(zedge(1) + 1, zedge(73) - 2, Z.bot + 12, -6)} strokeWidth="1.2" />
          <text className="sv-lab-strong" x={(zedge(1) + zedge(73)) / 2} y={Z.bot + 26} textAnchor="middle">X · 72 months in</text>
          <path className="sv-ink2 pf-ybr" d={bracket(zedge(73) + 2, zedge(far ? 97 : 85) - 2, Z.bot + 12, -6)} strokeWidth="1.2" />
          <text className="sv-lab-strong pf-y12" x={(zedge(73) + zedge(85)) / 2} y={Z.bot + 26} textAnchor="middle" opacity={far ? 0 : 1}>y · 12</text>
          <text className="sv-lab pf-held" x={ZX1} y={Z.bot + 42} textAnchor="end" opacity={far ? 0 : 1}>+12 held back</text>
          <text className="sv-lab-strong pf-y24" x={(zedge(73) + zedge(97)) / 2} y={Z.bot + 26} textAnchor="middle" opacity={far ? 1 : 0}>y · 24</text>
        </g>

        {/* ── B · three forecasters ── */}
        <g className="pf-axis" opacity={on(1)}>
          <text className="sv-cap" x={362} y={156}>Part (i) · test MAE, °C</text>
          {[1.0, 1.1, 1.2, 1.3, 1.4, 1.5].map((t) => (
            <g key={t}>
              <line className="sv-grid" x1={mx(t)} x2={mx(t)} y1={176} y2={AX_Y} />
              <line className="sv-axis" x1={mx(t)} x2={mx(t)} y1={AX_Y} y2={AX_Y + 4} />
              <text className="sv-lab" x={mx(t)} y={AX_Y + 16} textAnchor="middle">{t.toFixed(1)}</text>
            </g>
          ))}
          <line className="sv-axis" x1={MX0} x2={MX1} y1={AX_Y} y2={AX_Y} />
        </g>
        {/* 12 and 24 months are the two ends of one connector, not two marker styles:
            every lane marker is filled, model 1's single one is labelled "12 only",
            and hollow / filled stay free for what they mean on later plates */}
        <g className="pf-legend" opacity={on(3)}>
          <text className="sv-lab" x={LG_X} y={156} textAnchor="end">12</text>
          <line className="sv-ink2" x1={LG_X + 9} x2={LG_X + 41} y1={152} y2={152} strokeWidth="2" />
          <circle cx={LG_X + 9} cy={152} r={3.2} style={{ fill: 'var(--ink-2)' }} />
          <circle cx={LG_X + 41} cy={152} r={3.2} style={{ fill: 'var(--ink-2)' }} />
          <text className="sv-lab" x={LG_X + 50} y={156}>24 months</text>
        </g>

        {/* baselines: each line rises out of its marker on the axis */}
        <g className="pf-base" opacity={on(2)}>
          {BASES.map((b) => (
            <g key={b.k}>
              <line className="pf-bl" x1={mx(b.v)} x2={mx(b.v)} y1={AX_Y} y2={BL_TOP} strokeWidth="1.4" fill="none" style={b.line} />
              <circle cx={mx(b.v)} cy={AX_Y} r={b.r} style={b.dot} strokeWidth={b.dw} />
              <text className="sv-lab-strong" x={mx(b.v)} y={AX_Y + 30}>{b.name}</text>
              <text className="sv-lab" x={mx(b.v)} y={AX_Y + 43}>{f3(b.v)}</text>
            </g>
          ))}
        </g>

        {LANES.map((l, j) => (
          <g key={l.k} className={`pf-lane pf-lane-${j}`} opacity={on(1)}>
            <Mark k={l.k} className={`sv-f${l.k}`} cx={368} cy={l.y - 6} r={4.5} />
            <text className="sv-lab-strong" x={378} y={l.y - 2}>{l.name}</text>
            <text className="sv-lab" x={378} y={l.y + 12}>{l.sub}</text>
            <line className="sv-grid" x1={MX0} x2={MX1} y1={l.y} y2={l.y} />
            {l.v24 !== null && (
              <g className="pf-far" opacity={on(3)}>
                <line className={`sv-${l.k} pf-trail`} x1={mx(l.v12)} x2={mx(l.v24)} y1={l.y} y2={l.y} strokeWidth="2" />
                <Mark k={l.k} cx={mx(l.v12)} cy={l.y} r={DOT_R} className={`sv-f${l.k}`} style={{ stroke: 'var(--surface)', strokeWidth: 1.4 }} />
                <text className="sv-lab" x={mx(l.v12)} y={l.y - 10} textAnchor="middle">{f3(l.v12)}</text>
                <text className="sv-num pf-v24" x={mx(l.v24) + 10} y={l.y + 4}>{f3(l.v24)}</text>
              </g>
            )}
            <Mark k={l.k} className={`sv-f${l.k} pf-dot`} cx={mx(far && l.v24 !== null ? l.v24 : l.v12)} cy={l.y} r={DOT_R} style={{ stroke: 'var(--surface)', strokeWidth: 1.4 }} />
            <text className="sv-num pf-v12" x={mx(l.v12) + 10} y={l.y + 4} opacity={l.v24 === null || !far ? 1 : 0}>{f3(l.v12)}</text>
            {l.v24 === null && <text className="sv-lab pf-only" x={mx(l.v12) + 58} y={l.y + 4} opacity={on(3)}>12 only</text>}
          </g>
        ))}

        {/* ── C · part (ii) ── */}
        <g className="pf-vae" opacity={on(4)}>
          <line className="sv-grid" x1={24} x2={W - 24} y1={340} y2={340} />
          <text className="sv-cap" x={24} y={362}>Part (ii) · a VAE on 84-month maximum sequences</text>
          <path className="sv-line sv-min pf-vmin" d={seriesPath(VSEQ.map((r) => r[0]), vx, vy)} strokeWidth="1.3" opacity={0.18} />
          <path className="sv-line sv-max pf-vmax" d={seriesPath(VSEQ.map((r) => r[1]), vx, vy)} strokeWidth="1.6" />
          <text className="sv-lab-strong" x={44} y={482}>train_seq[:, :, 1]</text>
          <text className="sv-lab" x={44} y={496}>maximums only · 84 months</text>
          <path className="sv-ink2 pf-arr" d="M204 420H220M215 416L220 420L215 424" strokeWidth="1.2" fill="none" />
          {/* in beat 5 the encoder box fades back; its label stays at full opacity,
              swapping to ink-3 regular, so it keeps its contrast */}
          <g className="pf-enc">
            <polygon points={ENC} className="sv-box-strong pf-encbox" opacity={step >= 5 ? 0.35 : 1} />
            <text className="sv-lab-strong pf-enct" x={256} y={424} textAnchor="middle" opacity={step >= 5 ? 0 : 1}>encoder</text>
            <text className="sv-lab pf-enct2" x={256} y={424} textAnchor="middle" opacity={step >= 5 ? 1 : 0}>encoder</text>
          </g>
          <g className="pf-codes">
            {CODE_Y.map((y) => (
              <rect key={y} className="pf-code" x={304} y={y} width={14} height={14} style={{ fill: 'var(--ink-2)' }} />
            ))}
            <text className="sv-lab-strong" x={311} y={476} textAnchor="middle">4 codings</text>
          </g>
          <g className="pf-dec">
            <polygon points={DEC} className="sv-box-strong" />
            <text className="sv-lab-strong" x={366} y={424} textAnchor="middle">decoder</text>
          </g>
          <g className="pf-rebuild" opacity={step === 4 ? 1 : 0}>
            <path className="sv-ink2" d="M400 420H420M415 416L420 420L415 424" strokeWidth="1.2" fill="none" />
            <text className="sv-lab" x={428} y={416}>trained to give back</text>
            <text className="sv-lab" x={428} y={430}>its own input</text>
          </g>
        </g>
        <g className="pf-gen" opacity={on(5)}>
          <text className="sv-lab-strong" x={311} y={381} textAnchor="middle">z ~ N(0, I)</text>
          <path className="sv-ink pf-genarr" d={`M400 420H${FIG.x - 6}`} strokeWidth="1.4" />
          <path className="sv-ink" d={`M${FIG.x - 11} 416L${FIG.x - 6} 420L${FIG.x - 11} 424`} strokeWidth="1.4" fill="none" />
          <g className="pf-fig">
            <rect x={FIG.x - 3} y={FIG.y - 3} width={FIG.w + 6} height={FIG.h + 6} style={{ fill: '#fff', stroke: 'var(--line)', strokeWidth: 1 }} />
            <image href={fig48} x={FIG.x} y={FIG.y} width={FIG.w} height={FIG.h} preserveAspectRatio="xMidYMid meet" />
          </g>
          <text className="sv-lab" x={FIG.x} y={FIG.y + FIG.h + 20}>the notebook’s six synthesised sequences</text>
        </g>
      </>
    );
  };
}
const art = makeArt();

// a timeline position: a bare beat label plus ONE summed offset (GSAP keeps only
// the first offset of 'b1+=1+=0.25' and silently drops the rest)
const pos = (label, off = 0) => (off ? `${label}+=${off}` : label);

function build(tl, { q, beat }) {
  const draw = (els, label, dur, off = 0) =>
    els.forEach((p) => {
      const L = p.getTotalLength();
      tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut', immediateRender: true }, pos(label, off));
    });
  // a fade that starts from 1 must not render its start state before play (t = 0 has it hidden)
  const fade = (sel, at, dur = 0.4, from = 0, to = 1) => tl.fromTo(q(sel), { opacity: from }, { opacity: to, duration: dur, immediateRender: from === 0 }, at);

  tl.set(q('.pf-box, .pf-zoom, .pf-axis, .pf-legend, .pf-base, .pf-lane, .pf-far, .pf-only, .pf-vae, .pf-gen, .pf-rebuild, .pf-y24'), { opacity: 0, immediateRender: true }, 0);
  tl.set(q('.pf-box'), { attr: { x: edge(1) }, immediateRender: true }, 0);
  tl.set(q('.pf-tgt'), { attr: { width: ZM * 12 }, immediateRender: true }, 0);
  tl.set(q('.pf-hatch, .pf-y12, .pf-held, .pf-v12'), { opacity: 1, immediateRender: true }, 0);
  tl.set(q('.pf-vmin, .pf-encbox, .pf-enct'), { opacity: 1, immediateRender: true }, 0);
  // a lane's moving marker: a square (model 2) moves by x, a circle by cx
  const dotAt = (l, v) => (SQ(l.k) ? { x: mx(v) - (DOT_R - 0.5) } : { cx: mx(v) });
  LANES.forEach((l, j) => {
    if (l.v24 !== null) tl.set(q(`.pf-lane-${j} .pf-dot`), { attr: dotAt(l, l.v12), immediateRender: true }, 0);
  });

  // 0 · one test window
  beat(0, 0);
  draw(q('.pf-rec'), 'b0', 1.4);
  fade('.pf-box', 'b0+=0.9', 0.3);
  tl.fromTo(q('.pf-box'), { attr: { x: edge(1) } }, { attr: { x: edge(S_END) }, duration: 1.3, ease: 'power2.inOut' }, 'b0+=1.2');
  fade('.pf-zoom', 'b0+=2.5', 0.3);
  draw(q('.pf-conn'), 'b0', 0.4, 2.5);
  draw(q('.pf-win'), 'b0', 1.0, 2.8);

  // 1 · three forecasters
  beat(1, '+=0.8');
  fade('.pf-axis', 'b1', 0.4);
  LANES.forEach((l, j) => {
    const off = 0.3 + j * 0.7;
    tl.fromTo(q(`.pf-lane-${j}`), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4 }, pos('b1', off));
    tl.fromTo(q(`.pf-lane-${j} .pf-dot`), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(1.3)' }, pos('b1', off + 0.25));
  });

  // 2 · two baselines
  beat(2, '+=0.9');
  fade('.pf-base', 'b2', 0.3);
  // each line grows up from its marker; the dash pattern is anchored at the foot (y1), so it does not crawl
  tl.fromTo(q('.pf-bl'), { attr: { y2: AX_Y } }, { attr: { y2: BL_TOP }, duration: 0.7, ease: 'power2.out', stagger: 0.25 }, 'b2');

  // 3 · out to 24 months
  beat(3, '+=1.0');
  fade('.pf-legend', 'b3', 0.4);
  tl.fromTo(q('.pf-tgt'), { attr: { width: ZM * 12 } }, { attr: { width: ZM * 24 }, duration: 0.6 }, 'b3');
  fade('.pf-hatch, .pf-y12, .pf-held', 'b3', 0.3, 1, 0);
  tl.fromTo(q('.pf-ybr'), { attr: { d: bracket(zedge(73) + 2, zedge(85) - 2, Z.bot + 12, -6) } }, { attr: { d: bracket(zedge(73) + 2, zedge(97) - 2, Z.bot + 12, -6) }, duration: 0.6 }, 'b3');
  fade('.pf-y24', 'b3+=0.4', 0.3);
  LANES.forEach((l, j) => {
    if (l.v24 === null) return;
    const at = 'b3+=0.6';
    fade(`.pf-lane-${j} .pf-far`, at, 0.2);
    fade(`.pf-lane-${j} .pf-v12`, at, 0.2, 1, 0);
    tl.fromTo(q(`.pf-lane-${j} .pf-dot`), { attr: dotAt(l, l.v12) }, { attr: dotAt(l, l.v24), duration: 1.1, ease: 'power2.inOut' }, at);
    tl.fromTo(q(`.pf-lane-${j} .pf-trail`), { attr: { x2: mx(l.v12) } }, { attr: { x2: mx(l.v24) }, duration: 1.1, ease: 'power2.inOut' }, at);
    tl.fromTo(q(`.pf-lane-${j} .pf-v24`), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b3+=1.6');
  });
  fade('.pf-only', 'b3+=1.6', 0.4);

  // 4 · part (ii)
  beat(4, '+=1.0');
  fade('.pf-vae', 'b4', 0.3);
  draw(q('.pf-vmin, .pf-vmax'), 'b4', 0.9);
  tl.fromTo(q('.pf-vmin'), { opacity: 1 }, { opacity: 0.18, duration: 0.5, immediateRender: false }, 'b4+=1.1');
  tl.fromTo(q('.pf-vmax'), { y: 0 }, { y: -4, duration: 0.25, yoyo: true, repeat: 1 }, 'b4+=1.1');
  tl.fromTo(q('.pf-enc, .pf-codes, .pf-dec'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.35 }, 'b4+=1.4');
  fade('.pf-rebuild', 'b4+=2.5', 0.4);

  // 5 · six made-up sequences
  beat(5, '+=1.1');
  fade('.pf-rebuild', 'b5', 0.3, 1, 0);
  fade('.pf-encbox', 'b5', 0.4, 1, 0.35);
  fade('.pf-enct', 'b5', 0.4, 1, 0);
  fade('.pf-enct2', 'b5', 0.4);
  fade('.pf-gen', 'b5+=0.2', 0.3);
  // each coding dims and relights in turn, as a fresh z is drawn: it fades down over
  // 0.1 s first (a single 0.2 → 1 fromTo snapped it from 1 to 0.2 in one frame)
  tl.fromTo(q('.pf-code'), { opacity: 1 }, { opacity: 0.2, duration: 0.1, stagger: 0.1, immediateRender: false }, 'b5+=0.3');
  tl.fromTo(q('.pf-code'), { opacity: 0.2 }, { opacity: 1, duration: 0.25, stagger: 0.1, immediateRender: false }, 'b5+=0.4');
  draw(q('.pf-genarr'), 'b5', 0.4, 0.7);
  tl.fromTo(q('.pf-fig'), { opacity: 0, scale: 0.94, transformOrigin: '0% 50%' }, { opacity: 1, scale: 1, duration: 0.6 }, 'b5+=1.0');
  tl.to({}, { duration: 1.4 });
}

const BEATS = [
  {
    t: 'One test window', fx: 0,
    c: 'Bickley’s 392-month record is cut into overlapping 96-month windows. A model reads the first 72 months and forecasts the next 12; the last 12 wait for section 9.',
  },
  {
    t: 'Three forecasters', fx: 0.89,
    c: 'Model 1 predicts all 12 months at once; model 2 predicts one month and runs 12 times, each pass after the first reading its own earlier outputs; model 3 encodes 72 months and decodes 12.',
  },
  {
    t: 'Two baselines with no parameters', fx: 0.89,
    c: 'Climatology repeats the station’s own average year from the 72 input months (0.958); seasonal naive repeats the last 12 months (1.235). On Bickley every model finishes behind both.',
  },
  {
    t: 'Out to 24 months', fx: 0.89,
    c: 'Run on for 24 months, model 3 loses more than model 2 (1.321 → 1.457 against 1.407 → 1.470) but stays just ahead. Model 1 can only output 12 months, and the baselines barely move.',
  },
  {
    t: 'Part (ii): 84 months into 4 numbers', fx: 0.1,
    c: 'A VAE takes only the maximum channel of the 84-month training sequences, squeezes each one into 4 numbers (codings) and is trained to rebuild it.',
  },
  {
    t: 'Six made-up sequences', fx: 0.86,
    c: 'Codes drawn from N(0, I) and decoded give new 84-month sequences with the right level and shape, but smoother than real data. These six are the notebook’s own figure.',
  },
];

export default function ProjectFlowScene({ id = 'project' }) {
  return (
    <Scene
      id={id}
      label="The project in one picture: a 96-month window on Bickley's record split into 72 input and 12 target months; the 12-month test MAE of three GRU models against two baselines, models 2 and 3 run out to 24 months; then a VAE squeezing 84-month maximum sequences into 4 numbers (codings) and the notebook's six synthesised sequences"
      viewBox={`0 0 ${W} ${H}`}
      beats={BEATS}
      art={art}
      build={build}
      keyframes={[5]}
    />
  );
}
