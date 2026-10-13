import { mediaUrl, useMediaVersion } from '../../engine/media';
import { Num, T } from '../../shared/Num';
import { OPTF_VB } from './optf.gen';
import { FIG, S11, S12, S13 } from './geometry';
import { EASE, all, draw, fadeIn, one, pop, rise, track, useTimeline } from './motion';

/* ============================================================================
   PLAIN DECK — SLIDES 11 TO 14 (built)
   ----------------------------------------------------------------------------
   As slides.jsx and slides2.jsx: each slide draws its FINISHED state in plain
   markup and CSS; its timeline only adds motion when the slide is live. Times
   are seconds from entering the slide; a beat starts no later than (words
   before its phrase / words in the transcript) x read time x 0.85, and all
   motion ends by 75% of the read time. Words on screen come from the
   transcript ("said") or the dissertation; every digit is a manifest key.
   Colours: the hybrid is the accent blue and PSMASegmentator grey on every
   slide; the CNN-only version is dark grey, so grey always means
   PSMASegmentator.
   ========================================================================== */

const grow = (el, at, d = 0.9) => track(el, [{ t: at, transform: 'scaleX(0)' }, { t: at + d, transform: 'scaleX(1)' }], EASE.inOut);

/* ── 11. Comparison with PSMASegmentator ───────────────────────────────────
   65 s read (113 words); latest starts: single version 2.0 s, trained only on
   autoPET 4.4, all 100 DEEP-PSMA scans 9.3, 81.4% 16.6, 78.4% 17.6, about
   three points 19.6, more than twice as many scans 26.9, averages five 31.3,
   found more 35.2, more false alarms 38.1, scan by scan 40.1, better on scans
   with many 43.0, worse on scans with few 46.0; all over by 48.75 s. Left:
   the two models' setup as said, and the pooled bars. Right: one dot per
   scan (fair.gen.js), which starts on the zero line and moves to its value. */
function fairTimeline(root, add) {
  add(rise(one(root, 'm-hyb'), 0.3, 0.8, 12));
  add(rise(one(root, 'm-psm'), 0.6, 0.8, 12));
  add(rise(one(root, 'm-sub'), 3.4, 0.8, 10));
  add(rise(one(root, 'kick'), 8.6, 0.8, 10));
  // Pooled F1 (the hybrid, then PSMASegmentator, then the difference); found;
  // flagged and real.
  [15.6, 34.4, 37.3].forEach((at, i) => {
    add(fadeIn(one(root, `lab-${i}`), at, 0.6));
    add(grow(one(root, `bar-${i}-0`), at + 0.2));
    add(fadeIn(one(root, `val-${i}-0`), at + 0.9, 0.5));
    const b = at + (i ? 0.5 : 1.2);
    add(grow(one(root, `bar-${i}-1`), b));
    add(fadeIn(one(root, `val-${i}-1`), b + 0.7, 0.5));
  });
  add(rise(one(root, 'diff'), 19.0, 0.8, 10));
  // The setup, as said: training scans, then models averaged.
  add(rise(one(root, 'm-scans'), 26.2, 0.8, 10));
  add(rise(one(root, 'm-models'), 30.6, 0.8, 10));
  // Scan by scan: the frame, then the dots on the zero line, then each to its value.
  add(fadeIn(one(root, 'dframe'), 39.2, 0.6));
  add(rise(one(root, 'dkick'), 39.2, 0.8, 10));
  const n = S11.pts.length;
  // Staggered left to right by each dot's place on the lesion axis (data-j), not by
  // DOM order: the ties are drawn last so they sit on top.
  all(root, 'dmove').forEach((el) => {
    const at = 40.4 + (Number(el.dataset.j) / n) * 1.0;
    add(track(el, [{ t: at, transform: `translate(0px, ${el.dataset.dy}px)` }, { t: at + 0.8, transform: 'translate(0px, 0px)' }], EASE.inOut));
  });
  all(root, 'dpop').forEach((el) => add(pop(el, 39.6 + (Number(el.closest('[data-j]').dataset.j) / n) * 0.8, 0.4, 0.3)));
  add(rise(one(root, 'dcap'), 41.6, 0.8, 10));
  add(fadeIn(one(root, 'band-high'), 42.4, 0.6));
  add(rise(one(root, 'blab-high'), 42.6, 0.8, 10));
  add(fadeIn(one(root, 'band-low'), 45.2, 0.6));
  add(rise(one(root, 'blab-low'), 45.4, 0.8, 10));
}

function Dot({ p, r }) {
  if (p.kind === 'up') return <circle cx={p.x} cy={p.y} r={r} className="dp11-dot is-up" data-a="dpop" />;
  if (p.kind === 'down') {
    const s = r * 0.85;
    return <rect x={p.x - s} y={p.y - s} width={2 * s} height={2 * s} className="dp11-dot is-down" data-a="dpop" />;
  }
  return <path d={`M ${p.x} ${p.y - r} L ${p.x + r} ${p.y} L ${p.x} ${p.y + r} L ${p.x - r} ${p.y} Z`} className="dp11-dot is-tie" data-a="dpop" />;
}

export function FairSlide({ ctx }) {
  const root = useTimeline(ctx, fairTimeline);
  const { col, bar, rows, plot, low, high } = S11;
  const valKeys = rows.map((r) => r.keys);
  return (
    <div className="dp-stage dp11" ref={root}>
      {/* The two models, with the setup as said. */}
      <p className="dp-label dp11-name" data-a="m-hyb" data-role="chart" style={{ left: col.hyb, top: 262 }}>
        <span className="dp11-sw is-hyb" aria-hidden="true" />Hybrid CNN-Mamba
      </p>
      <div data-a="m-sub" style={{ left: col.hyb + 34, top: 304 }}>
        <p className="dp-label dp-label--muted" data-role="chart">a single version,</p>
        <p className="dp-label dp-label--muted" data-role="chart">trained only on autoPET</p>
      </div>
      <p className="dp-label dp11-name" data-a="m-psm" data-role="chart" style={{ left: col.psm, top: 262 }}>
        <span className="dp11-sw is-psm" aria-hidden="true" />PSMASegmentator
      </p>
      <div className="dp-fill" data-a="m-scans">
        <p className="dp-label dp-at" data-role="chart" style={{ left: col.hyb + 34, top: 398 }}><T>{'{{train.run4_cases}} training scans'}</T></p>
        <p className="dp-label dp-at" data-role="chart" style={{ left: col.psm + 34, top: 398 }}><T>{'{{psm.train}} training scans'}</T></p>
      </div>
      <div className="dp-fill" data-a="m-models">
        <p className="dp-label dp-at" data-role="chart" style={{ left: col.hyb + 34, top: 440 }}>one model</p>
        <p className="dp-label dp-at" data-role="chart" style={{ left: col.psm + 34, top: 440 }}><T>{'{{psm.folds}} models, averaged'}</T></p>
      </div>

      {/* Pooled over the 100 scans: the hybrid's bar above PSMASegmentator's. */}
      <p className="dp-kicker" data-a="kick" data-role="chart" style={{ left: 96, top: 530 }}><T>{'Pooled over {{fair.n}} DEEP-PSMA scans neither model trained on'}</T></p>
      {rows.map((row, i) => (
        <div key={row.name} className="dp-fill">
          <p className="dp-label dp11-bname" data-a={`lab-${i}`} data-role="chart" style={{ right: 1920 - bar.label, top: row.y + 12 }}>
            {i === 0 ? <span data-tick="">F1</span> : row.name}
          </p>
          {[0, 1].map((m) => (
            <div key={m}>
              <span className={`dp11-bar ${m ? 'is-psm' : 'is-hyb'}`} data-a={`bar-${i}-${m}`} style={{ left: bar.x, top: row.y + m * (bar.h + bar.gap), width: row.w[m] }} aria-hidden="true" />
              <p className={`dp-label dp11-val${m ? '' : ' is-hyb'}`} data-a={`val-${i}-${m}`} data-role="chart" style={{ left: bar.x + row.w[m] + 12, top: row.y + m * (bar.h + bar.gap) - 5 }}>
                <Num k={valKeys[i][m]} />
              </p>
            </div>
          ))}
        </div>
      ))}
      <div data-a="diff" style={{ left: bar.x + bar.max + 110, top: rows[0].y - 2 }}>
        <p className="dp-label dp11-diff" data-role="chart"><Num k="fair.df1" /> points</p>
        <p className="dp-tag" data-role="foot"><T>{'{{ci.level}} interval {{fair.df1_lo}} to {{fair.df1_hi}}'}</T></p>
      </div>

      {/* Scan by scan. */}
      <p className="dp-kicker" data-a="dkick" data-role="chart" style={{ left: plot.x0, top: 262 }}>Scan by scan, hybrid minus PSMASegmentator</p>
      <p className="dp-label" data-a="dcap" data-role="chart" style={{ left: plot.x0, top: 306 }}>
        <T>{'Better on {{fair.better}} scans, worse on {{fair.worse}}, tied on {{fair.tied}}'}</T>
      </p>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <rect x={low.x} y={plot.y0} width={low.w} height={plot.y1 - plot.y0} className="dp11-band" data-a="band-low" />
        <rect x={high.x} y={plot.y0} width={high.w} height={plot.y1 - plot.y0} className="dp11-band" data-a="band-high" />
        <g data-a="dframe">
          <path d={`M ${plot.x0} ${plot.y0} V ${plot.y1} H ${plot.x1}`} className="dp11-axis" />
          <line x1={plot.x0} x2={plot.x1} y1={S11.zeroY} y2={S11.zeroY} className="dp11-zero" />
          {S11.yTicks.map((t) => (
            <g key={t.d}>
              <line x1={plot.x0 - 8} x2={plot.x0} y1={t.y} y2={t.y} className="dp11-axis" />
              <text x={plot.x0 - 14} y={t.y + 10} textAnchor="end" className="dp11-tick" data-tick="" data-role="chart">{t.d > 0 ? `+${t.d}` : t.d}</text>
            </g>
          ))}
          {S11.xTicks.map((t) => (
            <g key={t.n}>
              <line x1={t.x} x2={t.x} y1={plot.y1} y2={plot.y1 + 8} className="dp11-axis" />
              <text x={t.x} y={plot.y1 + 40} textAnchor="middle" className="dp11-tick" data-tick="" data-role="chart">{t.n}</text>
            </g>
          ))}
          <text x={plot.x0 + (plot.x1 - plot.x0) / 2} y={plot.y1 + 84} textAnchor="middle" className="dp11-axlab" data-role="chart">Lesions in the scan (log scale)</text>
          <text transform={`translate(${plot.x0 - 70} ${(plot.y0 + plot.y1) / 2}) rotate(-90)`} textAnchor="middle" className="dp11-axlab" data-role="chart">F1 difference, points</text>
        </g>
        {[...S11.pts.map((p, j) => ({ p, j })).filter(({ p }) => p.kind !== 'tie'), ...S11.pts.map((p, j) => ({ p, j })).filter(({ p }) => p.kind === 'tie')].map(({ p, j }) => (
          <g key={p.i} data-a="dmove" data-j={j} data-dy={(S11.zeroY - p.y).toFixed(1)}>
            <Dot p={p} r={S11.r} />
          </g>
        ))}
      </svg>
      <div className="dp11-blab" data-a="blab-low" style={{ left: low.x + 14, top: plot.y0 + 10 }}>
        <p className="dp-label" data-role="chart"><T>{'Fewer than {{fair.lt20_cut}} lesions:'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'worse on {{fair.lt20_lower}} of {{fair.lt20_n}}'}</T></p>
      </div>
      <div className="dp11-blab is-right" data-a="blab-high" style={{ right: 1920 - plot.x1 + 10, top: plot.y0 + 10 }}>
        <p className="dp-label" data-role="chart"><T>{'{{fair.ge100_cut}} or more lesions:'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'better on {{fair.ge100_higher}} of {{fair.ge100_n}}'}</T></p>
      </div>
    </div>
  );
}

/* ── 12. The hybrid and its CNN-only version ───────────────────────────────
   75 s read (134 words); latest starts: same network 3.8 s, without its Mamba
   blocks 4.8, CNN-only version 7.1, also trained only on autoPET 8.1, final
   model's patch 12.8, almost five times larger 16.7, at the smaller patch
   18.6, added little 21.9, no clear difference 23.8, under two points 28.1,
   CNN-only also scored above 31.4, 82.0% 35.2, 78.4% 36.2, can't be credited
   39.0, cost the hybrid 50.0, four and a half 51.9, only about one 56.6; all
   over by 56.25 s (so the CNN-only line comes early). Right: F1 on the 100
   DEEP-PSMA scans, from the final model's patch to the larger one, with each
   patch drawn to scale under its column. Each model is one training run. */
function twinTimeline(root, add) {
  add(rise(one(root, 'c-hyb'), 0.3, 0.8, 12));
  add(rise(one(root, 'same'), 3.2, 0.8, 10));
  // The CNN-only version slides out from behind the hybrid (as on slide 6).
  add(track(one(root, 'c-cnn'), [
    { t: 4.6, opacity: 0, transform: 'translateY(-66px)' },
    { t: 4.8, opacity: 1, transform: 'translateY(-66px)', e: EASE.inOut },
    { t: 5.8, opacity: 1, transform: 'translateY(0px)' },
  ]));
  add(rise(one(root, 'both'), 7.4, 0.8, 10));
  // The chart and the two patches, to scale.
  add(rise(one(root, 'ch-kick'), 11.8, 0.8, 10));
  add(fadeIn(one(root, 'ch-frame'), 12.0, 0.6));
  add(rise(one(root, 'col-0'), 12.2, 0.8, 10));
  add(draw(one(root, 'patch-0'), 12.4, 0.8));
  add(fadeIn(one(root, 'patch-0'), 12.4, 0.4));
  add(fadeIn(one(root, 'scale-tag'), 17.2, 0.6));
  add(fadeIn(one(root, 'once'), 12.8, 0.6));
  add(rise(one(root, 'col-1'), 15.8, 0.8, 10));
  const s = S12.small;
  const l = S12.large;
  add(track(one(root, 'patch-1'), [
    { t: 16.0, opacity: 0, transform: `scale(${(s.w / l.w).toFixed(3)}, ${(s.h / l.h).toFixed(3)})` },
    { t: 16.2, opacity: 1, transform: `scale(${(s.w / l.w).toFixed(3)}, ${(s.h / l.h).toFixed(3)})`, e: EASE.inOut },
    { t: 17.2, opacity: 1, transform: 'scale(1, 1)' },
  ]));
  // At the final model's patch: no clear difference on DEEP-PSMA.
  add(rise(one(root, 'kick-small'), 18.0, 0.8, 10));
  add(pop(one(root, 'p-hyb-0'), 18.2, 0.5, 0.4));
  add(pop(one(root, 'p-cnn-0'), 18.4, 0.5, 0.4));
  add(fadeIn(one(root, 'v-hyb-0'), 18.6, 0.6));
  add(fadeIn(one(root, 'v-cnn-0'), 18.8, 0.6));
  add(rise(one(root, 'note-same'), 23.0, 0.8, 10));
  add(rise(one(root, 'note-ap'), 27.4, 0.8, 10));
  // PSMASegmentator below both, then the CNN-only version's point is ringed.
  add(grow(one(root, 'psm-line'), 30.8, 1.0));
  add(fadeIn(one(root, 'psm-lab'), 34.4, 0.6));
  add(track(one(root, 'ring-cnn'), [
    { t: 34.6, opacity: 0, transform: 'scale(0.6)' },
    { t: 35.0, opacity: 1, transform: 'scale(1)' },
    { t: 36.4, opacity: 0, transform: 'scale(1.25)' },
  ]));
  add(rise(one(root, 'note-credit'), 38.4, 0.8, 10));
  // The larger patch: the hybrid drops about four and a half points, the
  // CNN-only version about one.
  add(draw(one(root, 'l-hyb'), 49.2, 1.2));
  add(pop(one(root, 'p-hyb-1'), 50.2, 0.5, 0.4));
  add(fadeIn(one(root, 'v-hyb-1'), 50.4, 0.6));
  add(rise(one(root, 'e-hyb'), 51.0, 0.8, 10));
  add(draw(one(root, 'l-cnn'), 52.2, 1.0));
  add(pop(one(root, 'p-cnn-1'), 53.0, 0.5, 0.4));
  add(fadeIn(one(root, 'v-cnn-1'), 53.2, 0.6));
  add(rise(one(root, 'e-cnn'), 53.6, 0.8, 10));
}

function Marker({ kind, size = 18 }) {
  const c = size / 2;
  return (
    <svg className="dp12-marker" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {kind === 'hyb'
        ? <circle cx={c} cy={c} r={c - 1} className="dp12-pt is-hyb" />
        : <rect x="1.5" y="1.5" width={size - 3} height={size - 3} className="dp12-pt is-cnn" />}
    </svg>
  );
}

export function TwinSlide({ ctx }) {
  const root = useTimeline(ctx, twinTimeline);
  const { plot, cols, hyb, cnn } = S12;
  const r = 10;
  const sq = (p, a) => <rect x={p.x - r * 0.9} y={p.y - r * 0.9} width={r * 1.8} height={r * 1.8} className="dp12-pt is-cnn" data-a={a} />;
  const ci = (p, a) => <circle cx={p.x} cy={p.y} r={r} className="dp12-pt is-hyb" data-a={a} />;
  const line = (pts, kind, a) => <path d={`M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`} className={`dp12-line is-${kind}`} data-a={a} pathLength="1" />;
  return (
    <div className="dp-stage dp12" ref={root}>
      {/* The two networks. */}
      <div className="dp12-chips" style={{ left: 96, top: 262 }}>
        <span className="dp6-chip is-hybrid" data-a="c-hyb" data-role="chart"><Marker kind="hyb" />Hybrid CNN-Mamba</span>
        <span className="dp6-chip dp6-chip--cnn" data-a="c-cnn" data-role="chart"><Marker kind="cnn" />CNN-only version</span>
      </div>
      <p className="dp-label dp-label--muted" data-a="same" data-role="chart" style={{ left: 96, top: 412 }}>Same network, every Mamba block removed</p>
      <p className="dp-label dp-label--muted" data-a="both" data-role="chart" style={{ left: 96, top: 454 }}>Both trained only on autoPET</p>

      <p className="dp-kicker" data-a="kick-small" data-role="chart" style={{ left: 96, top: 548 }}>At the final model&apos;s patch</p>
      <p className="dp-label" data-a="note-same" data-role="chart" style={{ left: 96, top: 592 }}>No clear difference on DEEP-PSMA</p>
      <p className="dp-label dp-label--muted" data-a="note-ap" data-role="chart" style={{ left: 96, top: 634 }}>
        <T>{'autoPET test set (secondary): hybrid {{r6.gap_small_ap}} points'}</T>
      </p>
      <div data-a="note-credit" style={{ left: 96, top: 724 }}>
        <p className="dp-label dp12-credit" data-role="chart">Gain over PSMASegmentator</p>
        <p className="dp-label dp12-credit" data-role="chart">not credited to Mamba</p>
      </div>
      <p className="dp-tag" data-a="once" data-role="foot" style={{ left: 96, top: 918 }}>Each model trained once</p>

      {/* F1 on the 100 DEEP-PSMA scans. */}
      <p className="dp-kicker" data-a="ch-kick" data-role="chart" style={{ left: plot.x0, top: 262 }}><T>{'F1 on the {{fair.n}} DEEP-PSMA scans'}</T></p>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <g data-a="ch-frame">
          <path d={`M ${plot.x0} ${plot.y0 - 10} V ${plot.y1}`} className="dp12-axis" />
          {S12.ticks.map((t) => (
            <g key={t.f}>
              <line x1={plot.x0 - 8} x2={plot.x0} y1={t.y} y2={t.y} className="dp12-axis" />
              <line x1={plot.x0} x2={plot.x1} y1={t.y} y2={t.y} className="dp12-grid" />
              <text x={plot.x0 - 14} y={t.y + 10} textAnchor="end" className="dp12-tick" data-tick="" data-role="chart">{t.f}</text>
            </g>
          ))}
          {cols.map((x) => <line key={x} x1={x} x2={x} y1={plot.y0 - 10} y2={plot.y1} className="dp12-grid" />)}
        </g>
        <g className="dp12-psmg" data-a="psm-line" style={{ transformOrigin: `${plot.x0}px ${S12.psmY}px` }}>
          <line x1={plot.x0} x2={plot.x1} y1={S12.psmY} y2={S12.psmY} className="dp12-psm" />
        </g>
        {line(hyb, 'hyb', 'l-hyb')}
        {line(cnn, 'cnn', 'l-cnn')}
        <circle cx={cnn[0].x} cy={cnn[0].y} r="22" className="dp12-ring" data-a="ring-cnn" />
        <g className="dp12-ptg">{ci(hyb[0], 'p-hyb-0')}</g>
        <g className="dp12-ptg">{sq(cnn[0], 'p-cnn-0')}</g>
        <g className="dp12-ptg">{ci(hyb[1], 'p-hyb-1')}</g>
        <g className="dp12-ptg">{sq(cnn[1], 'p-cnn-1')}</g>
        {/* The two patches, to scale (coronal view). */}
        <rect x={S12.small.x} y={S12.small.y} width={S12.small.w} height={S12.small.h} className="dp12-patch" data-a="patch-0" pathLength="1" />
        <rect x={S12.large.x} y={S12.large.y} width={S12.large.w} height={S12.large.h} className="dp12-patch dp12-grow" data-a="patch-1" style={{ transformOrigin: `${cols[1]}px ${S12.top}px` }} />
      </svg>
      <p className="dp-label dp12-v is-hyb" data-a="v-hyb-0" data-role="chart" style={{ right: 1920 - cols[0] + 34, top: hyb[0].y - 12 }}><Num k="r6.h_small" /></p>
      <p className="dp-label dp12-v" data-a="v-cnn-0" data-role="chart" style={{ right: 1920 - cols[0] + 34, top: cnn[0].y - 30 }}><Num k="r6.c_small" /></p>
      <p className="dp-label dp12-v is-hyb" data-a="v-hyb-1" data-role="chart" style={{ left: cols[1] + 22, top: hyb[1].y - 18 }}><Num k="r6.h_large" /></p>
      <p className="dp-label dp-label--muted" data-a="e-hyb" data-role="chart" style={{ left: cols[1] + 102, top: hyb[1].y - 18 }}><T>{'{{r6.h_patch}} points'}</T></p>
      <p className="dp-label dp12-v" data-a="v-cnn-1" data-role="chart" style={{ left: cols[1] + 22, top: cnn[1].y - 18 }}><Num k="r6.c_large" /></p>
      <p className="dp-label dp-label--muted" data-a="e-cnn" data-role="chart" style={{ left: cols[1] + 102, top: cnn[1].y - 18 }}><T>{'{{r6.c_patch}} points'}</T></p>
      <p className="dp-label dp-label--muted" data-a="psm-lab" data-role="chart" style={{ left: plot.x0 + 14, top: S12.psmY + 14 }}>
        <T>{'PSMASegmentator, {{fair.psm_f1}}'}</T>
      </p>
      {/* The columns: each patch's name, size and batch size. */}
      {[0, 1].map((c) => (
        <div key={c} className="dp12-col" data-a={`col-${c}`} style={{ left: cols[c] - 180, top: plot.y1 + 18 }}>
          <p className="dp-label" data-role="chart">{c ? 'Almost five times larger' : <>Final model&apos;s patch</>}</p>
          <p className="dp-tag" data-role="foot">
            <T>{c ? '{{patch.large_vox}} voxels, batch size {{r6.batch_large}}' : '{{patch.small_vox}} voxels, batch size {{r6.batch_small}}'}</T>
          </p>
        </div>
      ))}
      <p className="dp-tag" data-a="scale-tag" data-role="foot" style={{ left: S12.large.x + S12.large.w + 22, top: S12.large.y + S12.large.h - 28 }}>Coronal view, to scale</p>
    </div>
  );
}

/* ── 13. Discussion (draft transcript) ─────────────────────────────────────
   About 72 s read (130 words, untimed: words / 108 a minute); latest starts:
   is real 2.8 s, something both 6.6, not from Mamba 9.4, a 2024 retest 10.9,
   its Mamba layers 16.1, linear cost 23.1, larger patch still 27.4, a batch size
   of one 29.3, my abstract 31.6, about half 34.5, test-time augmentation 40.1,
   eight times 41.6, same number of passes 44.9, slightly faster 47.7, slightly
   less memory 49.6, main limits 51.5; all over by 54.2 s. Three columns for the
   three parts of the transcript, then the limits. Times are on the
   dissertation's RTX 4090 benchmark (the abstract's home-PC figures are kept
   off this slide). */
const THUMB13 = 0.6; // px per figure unit for the two network pictures

/** The network's blocks (dissertation Figure 3.3's layers), with or without its Mamba blocks. */
function MiniNet({ t, mamba, a, fadeA, style }) {
  useMediaVersion();
  const b = FIG.body;
  const img = (n, extra) => (
    <img
      key={n}
      src={mediaUrl(`figures/optf/${n}.svg`)}
      alt=""
      draggable="false"
      data-a={extra}
      style={{ left: -b.x0 * t, top: -b.y0 * t, width: OPTF_VB.w * t, height: OPTF_VB.h * t }}
    />
  );
  return (
    <span className="dp-thumb dp13-net" data-a={a} style={{ width: b.w * t, height: b.h * t, ...style }} aria-hidden="true">
      {[...FIG.skips, ...FIG.enc, ...FIG.dec].map((n) => img(n))}
      {mamba && FIG.mamba.map((n) => img(n))}
      {/* The CNN-only version's Mamba blocks, gone at rest; the timeline fades them out. */}
      {!mamba && fadeA && <span className="dp13-gone" data-a={fadeA}>{FIG.mamba.map((n) => img(n))}</span>}
    </span>
  );
}

function discussionTimeline(root, add) {
  // The gain over PSMASegmentator, and where it most likely comes from.
  add(rise(one(root, 'k1'), 0.3, 0.8, 10));
  add(rise(one(root, 'gain'), 2.0, 0.8, 14));
  add(fadeIn(one(root, 'gain-ci'), 2.6, 0.6));
  add(pop(one(root, 'net-hyb'), 5.4, 0.5, 0.7));
  add(pop(one(root, 'net-cnn'), 5.7, 0.5, 0.7));
  add(track(one(root, 'net-cnn-mb'), [{ t: 5.7, opacity: 1 }, { t: 6.3, opacity: 1 }, { t: 7.1, opacity: 0 }], EASE.inOut));
  add(fadeIn(one(root, 'net-labs'), 5.9, 0.6));
  add(draw(one(root, 'brace'), 7.4, 0.6));
  add(rise(one(root, 'share'), 8.4, 0.8, 10));
  add(rise(one(root, 'umamba'), 10.4, 0.8, 10));
  add(rise(one(root, 'umamba-2'), 15.4, 0.8, 10));
  // Linear cost in practice: the larger patch still needed batch size 1.
  add(track(one(root, 'div-0'), [{ t: 22.2, transform: 'scaleY(0)' }, { t: 23.0, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'k2'), 22.4, 0.8, 10));
  add(fadeIn(one(root, 'f1'), 22.8, 0.6));
  all(root, 'sp').forEach((el, i) => add(pop(el, 23.0 + i * 0.2, 0.5, 0.6)));
  add(rise(one(root, 'f1-lab'), 23.4, 0.8, 10));
  add(fadeIn(one(root, 'f2'), 26.6, 0.6));
  const s = S13.small[0];
  const l = S13.large;
  add(track(one(root, 'lp'), [
    { t: 26.8, opacity: 0, transform: `scale(${(s.w / l.w).toFixed(3)}, ${(s.h / l.h).toFixed(3)})` },
    { t: 27.0, opacity: 1, transform: `scale(${(s.w / l.w).toFixed(3)}, ${(s.h / l.h).toFixed(3)})`, e: EASE.inOut },
    { t: 28.0, opacity: 1, transform: 'scale(1, 1)' },
  ]));
  add(rise(one(root, 'f2-lab'), 28.6, 0.8, 10));
  add(rise(one(root, 'batch'), 28.9, 0.8, 10));
  // Time per scan: default settings, then the same number of passes.
  add(track(one(root, 'div-1'), [{ t: 30.8, transform: 'scaleY(0)' }, { t: 31.6, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'k3'), 31.0, 0.8, 10));
  add(fadeIn(one(root, 'k3-tag'), 31.4, 0.6));
  add(fadeIn(one(root, 'legend'), 31.6, 0.6));
  add(rise(one(root, 'h-def'), 33.8, 0.8, 10));
  add(grow(one(root, 'b-def-0'), 34.2));
  add(grow(one(root, 'b-def-1'), 34.4, 1.1));
  add(fadeIn(one(root, 'v-def-0'), 35.0, 0.5));
  add(fadeIn(one(root, 'v-def-1'), 35.4, 0.5));
  add(fadeIn(one(root, 'h-passes'), 39.4, 0.6));
  add(rise(one(root, 'h-same'), 44.2, 0.8, 10));
  add(grow(one(root, 'b-same-0'), 44.4));
  // PSMASegmentator's bar arrives at its default length and shrinks to its
  // time at the same number of passes.
  const shrink = (S13.time.w.p40 / S13.time.w.p5).toFixed(3);
  add(track(one(root, 'b-same-1'), [
    { t: 44.6, opacity: 0, transform: `scaleX(${shrink})` },
    { t: 44.9, opacity: 1, transform: `scaleX(${shrink})`, e: EASE.inOut },
    { t: 46.1, opacity: 1, transform: 'scaleX(1)' },
  ]));
  add(fadeIn(one(root, 'v-same-0'), 45.0, 0.5));
  add(fadeIn(one(root, 'v-same-1'), 46.1, 0.5));
  add(rise(one(root, 'faster'), 47.0, 0.8, 10));
  add(rise(one(root, 'memory'), 49.4, 0.8, 10));
  // The limits.
  add(track(one(root, 'lim-rule'), [{ t: 50.6, transform: 'scaleX(0)' }, { t: 51.4, transform: 'scaleX(1)' }], EASE.inOut));
  add(rise(one(root, 'lim-k'), 50.8, 0.8, 10));
  add(rise(one(root, 'lim-1'), 51.2, 0.8, 10));
  add(rise(one(root, 'lim-2'), 52.4, 0.8, 10));
}

export function DiscussionSlide({ ctx }) {
  const root = useTimeline(ctx, discussionTimeline);
  const { c, div, f1, f2, time } = S13;
  const bw = FIG.body.w * THUMB13;
  const netY = 446;
  const netGap = 70;
  const braceY = netY + FIG.body.h * THUMB13 + 54;
  const braceR = c[0] + 2 * bw + netGap;
  const tx = time.x;
  const bars = [
    { a: 'def', y: 438, w: [time.w.h5, time.w.p40], k: ['eff.h5', 'eff.p40'] },
    { a: 'same', y: 584, w: [time.w.h5, time.w.p5], k: ['eff.h5', 'eff.p5'] },
  ];
  return (
    <div className="dp-stage dp13" ref={root}>
      {/* 1. The gain over PSMASegmentator. */}
      <p className="dp-kicker" data-a="k1" data-role="chart" style={{ left: c[0], top: 262 }}>Gain over PSMASegmentator</p>
      <p className="dp13-gain" data-a="gain" data-role="chart" style={{ left: c[0], top: 300 }}>
        <span className="dp13-gain__n"><Num k="fair.df1" /></span> points of pooled <span data-tick="">F1</span>
      </p>
      <p className="dp-label dp-label--muted" data-a="gain-ci" data-role="chart" style={{ left: c[0], top: 388 }}>
        <T>{'{{ci.level}} interval {{fair.df1_lo}} to {{fair.df1_hi}}'}</T>
      </p>
      <MiniNet t={THUMB13} mamba a="net-hyb" style={{ left: c[0], top: netY }} />
      <MiniNet t={THUMB13} mamba={false} a="net-cnn" fadeA="net-cnn-mb" style={{ left: c[0] + bw + netGap, top: netY }} />
      <div className="dp-fill" data-a="net-labs">
        <p className="dp-tag dp-at" data-role="foot" style={{ left: c[0], top: netY + FIG.body.h * THUMB13 + 8 }}>Hybrid CNN-Mamba</p>
        <p className="dp-tag dp-at" data-role="foot" style={{ left: c[0] + bw + netGap, top: netY + FIG.body.h * THUMB13 + 8 }}>CNN-only version</p>
      </div>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <path d={`M ${c[0] + 4} ${braceY - 12} V ${braceY} H ${braceR - 4} V ${braceY - 12} M ${(c[0] + braceR) / 2} ${braceY} V ${braceY + 12}`} className="dp-leader dp13-brace" data-a="brace" pathLength="1" />
      </svg>
      <div data-a="share" style={{ left: c[0], top: braceY + 22 }}>
        <p className="dp-label" data-role="chart">Most likely something both</p>
        <p className="dp-label" data-role="chart">networks share, not Mamba</p>
      </div>
      <p className="dp-label dp13-um" data-a="umamba" data-role="chart" style={{ left: c[0], top: 728 }}>
        <T>{'U-Mamba retest, {{lit.umamba_year}}:'}</T>
      </p>
      <div className="dp13-um" data-a="umamba-2" style={{ left: c[0], top: 762 }}>
        <p className="dp-label dp-label--muted" data-role="chart">no effect from its Mamba layers</p>
        <p className="dp-label dp-label--muted" data-role="chart">against a strong CNN</p>
      </div>

      {/* 2. Patch size and batch size: the patches to scale, one training batch per frame. */}
      <span className="dp13-div" data-a="div-0" style={{ left: div[0], top: 262 }} aria-hidden="true" />
      <p className="dp-kicker" data-a="k2" data-role="chart" style={{ left: c[1], top: 262 }}>Patch size and batch size</p>
      <svg className="dp-overlay" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
        <rect x={f1.x} y={f1.y} width={f1.w} height={f1.h} rx="10" className="dp13-frame" data-a="f1" />
        {S13.small.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} className="dp13-patch" data-a="sp" style={{ transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px` }} />)}
        <rect x={f2.x} y={f2.y} width={f2.w} height={f2.h} rx="10" className="dp13-frame" data-a="f2" />
        <rect x={S13.large.x} y={S13.large.y} width={S13.large.w} height={S13.large.h} className="dp13-patch" data-a="lp" style={{ transformOrigin: `${S13.large.x}px ${S13.large.y + S13.large.h}px` }} />
      </svg>
      <div data-a="f1-lab" style={{ left: f1.x, top: S13.base + 14 }}>
        <p className="dp-label" data-role="chart"><b><T>{'Batch size {{r6.batch_small}}'}</T></b></p>
        <p className="dp-tag" data-role="foot">final model&apos;s patch</p>
      </div>
      <div data-a="f2-lab" style={{ left: f2.x, top: S13.base + 14 }}>
        <p className="dp-label" data-role="chart"><b><T>{'Batch size {{r6.batch_large}}'}</T></b></p>
        <p className="dp-tag" data-role="foot">almost five times larger</p>
      </div>
      <div data-a="batch" style={{ left: c[1], top: 760 }}>
        <p className="dp-label" data-role="chart">The larger patch still</p>
        <p className="dp-label" data-role="chart"><T>{'needed batch size {{r6.batch_large}}'}</T></p>
      </div>

      {/* 3. Time per scan. */}
      <span className="dp13-div" data-a="div-1" style={{ left: div[1], top: 262 }} aria-hidden="true" />
      <p className="dp-kicker" data-a="k3" data-role="chart" style={{ left: tx, top: 262 }}>Mean time per scan</p>
      <p className="dp-tag" data-a="k3-tag" data-role="foot" style={{ left: tx, top: 300 }}>
        <T>{'one {{eff.gpu}}, {{eff.n}} sealed DEEP-PSMA test scans'}</T>
      </p>
      <p className="dp-label dp13-legend" data-a="legend" data-role="chart" style={{ left: tx, top: 336 }}>
        <span className="dp11-sw is-hyb" aria-hidden="true" />Hybrid
        <span className="dp11-sw is-psm dp13-sw2" aria-hidden="true" />PSMASegmentator
      </p>
      <p className="dp-label dp13-h" data-a="h-def" data-role="chart" style={{ left: tx, top: 394 }}>
        Default settings<span data-a="h-passes"><T>{': {{eff.passes_h}} against {{eff.passes_p}} passes'}</T></span>
      </p>
      <p className="dp-label dp13-h" data-a="h-same" data-role="chart" style={{ left: tx, top: 540 }}>Same number of passes</p>
      {bars.flatMap((g) => [0, 1].map((m) => (
        <div key={`${g.a}-${m}`}>
          <span className={`dp11-bar ${m ? 'is-psm' : 'is-hyb'}`} data-a={`b-${g.a}-${m}`} style={{ left: tx, top: g.y + m * 34, width: g.w[m] }} aria-hidden="true" />
          <p className={`dp-label dp11-val${m ? '' : ' is-hyb'}`} data-a={`v-${g.a}-${m}`} data-role="chart" style={{ left: tx + g.w[m] + 12, top: g.y + m * 34 - 5 }}><Num k={g.k[m]} /></p>
        </div>
      )))}
      <p className="dp-label" data-a="faster" data-role="chart" style={{ left: tx, top: 662 }}>PSMASegmentator slightly faster</p>
      <div data-a="memory" style={{ left: tx, top: 724 }}>
        <p className="dp-label dp13-h" data-role="chart">Peak memory</p>
        <p className="dp-label dp13-mem" data-role="chart">
          <span className="dp11-sw is-hyb" aria-hidden="true" /><span className="dp13-mem__v is-hyb"><Num k="eff.vram_h" /></span>
          <span className="dp11-sw is-psm dp13-sw2" aria-hidden="true" /><span className="dp13-mem__v"><Num k="eff.vram_p" /></span>
        </p>
      </div>

      {/* The limits. */}
      <div className="dp-fill" data-req="limitations">
        <span className="dp13-rule" data-a="lim-rule" aria-hidden="true" />
        <p className="dp-kicker dp-at" data-a="lim-k" data-role="chart" style={{ left: 96, top: 878 }}>Limits</p>
        <div className="dp-at" data-a="lim-1" style={{ left: 250, top: 876 }}>
          <p className="dp-label" data-role="chart">Each model in the CNN-only comparison trained once</p>
          <p className="dp-tag" data-role="foot"><T>{'against a spread of about {{r6.seed_spread}} F1 points between the final model\'s five versions'}</T></p>
        </div>
        <div className="dp-at" data-a="lim-2" style={{ left: 1110, top: 876 }}>
          <p className="dp-label" data-role="chart">Not like-for-like with PSMASegmentator</p>
          <p className="dp-tag" data-role="foot">most setup differences favour PSMASegmentator</p>
        </div>
      </div>
    </div>
  );
}

/* ── 14. Conclusion (draft transcript) ─────────────────────────────────────
   About 45 s read (81 words, untimed: words / 108 a minute); latest starts:
   sealed test set 2.4 s, 84.3% 7.1, on scans neither 7.6, found lesions more
   effectively 11.3, a CNN-only version did 15.1, so the credit 18.4, next 21.7,
   open source 24.6, can retrain 28.8, Sir Charles Gairdner 31.6, thank you 34.0; all over by 33.75 s.
   Slide 6's two questions return with their pairs of models, each now with
   the transcript's answer. */
function closeTimeline(root, add) {
  add(rise(one(root, 'k'), 0.3, 0.8, 10));
  add(rise(one(root, 'f1'), 1.0, 0.9, 20));
  add(track(one(root, 'bar1'), [{ t: 6.6, transform: 'scaleY(0)' }, { t: 7.3, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'chips1'), 6.8, 0.8, 12));
  add(rise(one(root, 'a1'), 10.4, 0.9, 16));
  add(fadeIn(one(root, 'n1'), 11.4, 0.6));
  add(track(one(root, 'bar2'), [{ t: 14.2, transform: 'scaleY(0)' }, { t: 14.9, transform: 'scaleY(1)' }], EASE.inOut));
  add(rise(one(root, 'hyb2'), 14.3, 0.7, 12));
  add(fadeIn(one(root, 'vs2'), 15.0, 0.5));
  const cnn = one(root, 'cnn');
  const hyb = one(root, 'hyb2');
  const dx = hyb && cnn ? hyb.offsetLeft - cnn.offsetLeft : 0;
  add(track(cnn, [
    { t: 14.6, opacity: 0, transform: `translateX(${dx}px)` },
    { t: 14.8, opacity: 1, transform: `translateX(${dx}px)`, e: EASE.inOut },
    { t: 15.8, opacity: 1, transform: 'translateX(0px)' },
  ]));
  add(rise(one(root, 'a2'), 14.9, 0.9, 16));
  add(fadeIn(one(root, 'a2-credit'), 18.1, 0.7));
  add(fadeIn(one(root, 'n2'), 16.2, 0.6));
  add(track(one(root, 'next-rule'), [{ t: 20.8, transform: 'scaleX(0)' }, { t: 21.6, transform: 'scaleX(1)' }], EASE.inOut));
  add(rise(one(root, 'next'), 21.0, 0.9, 12));
  add(rise(one(root, 'next-2'), 27.6, 0.9, 10));
  add(rise(one(root, 'thanks'), 31.0, 1.0, 20));
}

export function CloseSlide({ ctx }) {
  const root = useTimeline(ctx, closeTimeline);
  return (
    <div className="dp-stage dp14" ref={root}>
      <p className="dp-kicker" data-a="k" data-role="chart" style={{ left: 96, top: 262 }}>Final model, sealed test set</p>
      <div className="dp10-f1" data-a="f1" style={{ left: 96, top: 310 }}>
        <p className="dp10-f1__k" data-role="body"><span data-tick="">F1</span></p>
        <p className="dp10-f1__n" data-role="chart"><Num k="r5.f1" /></p>
      </div>
      <p className="dp14-thanks" data-a="thanks" data-role="body" style={{ left: 96, top: 784 }}>Thank you</p>

      <div className="dp14-rq">
        <section className="dp6-part">
          <span className="dp6-bar" data-a="bar1" aria-hidden="true" />
          <p className="dp6-chips" data-a="chips1" data-role="chart">
            <span className="dp6-chip is-hybrid">Hybrid CNN-Mamba</span>
            <span className="dp6-vs">vs</span>
            <span className="dp6-chip">PSMASegmentator</span>
          </p>
          <p className="dp14-a" data-a="a1" data-role="body">Found lesions more effectively overall, on scans neither model had seen</p>
          <div className="dp14-n" data-a="n1">
            <p className="dp-label dp-label--muted" data-role="chart"><T>{'single version trained only on autoPET: pooled F1 {{fair.r4_f1}} against {{fair.psm_f1}}'}</T></p>
            <p className="dp-label dp-label--muted" data-role="chart">found more lesions, with more false alarms</p>
          </div>
        </section>
        <section className="dp6-part">
          <span className="dp6-bar" data-a="bar2" aria-hidden="true" />
          <p className="dp6-chips" data-role="chart">
            <span className="dp6-chip is-hybrid" data-a="hyb2">Hybrid CNN-Mamba</span>
            <span className="dp6-vs" data-a="vs2">vs</span>
            <span className="dp6-chip dp6-chip--cnn" data-a="cnn">CNN-only version</span>
          </p>
          <p className="dp14-a" data-a="a2" data-role="body">
            A CNN-only version did about as well,<span data-a="a2-credit"> so the credit doesn&apos;t go to Mamba</span>
          </p>
          <p className="dp-label dp-label--muted dp14-n" data-a="n2" data-role="chart">
            <T>{'F1 {{r6.c_small}}% for the CNN-only version, {{r6.h_small}}% for the hybrid'}</T>
          </p>
        </section>
      </div>

      <span className="dp14-rule" data-a="next-rule" aria-hidden="true" />
      <div className="dp14-next" data-a="next" data-req="future">
        <p className="dp-kicker" data-role="chart">Next step</p>
        <p className="dp-label dp14-next__t" data-role="chart">The code will be released open source, so the UWA Medical Physics Research Group</p>
        <p className="dp-label dp14-next__t" data-a="next-2" data-role="chart">can retrain and test it on Sir Charles Gairdner Hospital data</p>
      </div>
    </div>
  );
}
