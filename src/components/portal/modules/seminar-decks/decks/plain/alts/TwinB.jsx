import Clip from '../../../engine/Clip';
import { mediaUrl, useMediaVersion } from '../../../engine/media';
import { Num, T } from '../../../shared/Num';
import { S12 } from '../geometry';
import { EASE, draw, fadeIn, isLive, one, pop, rise, track, useTimeline } from '../motion';
import { S4_12 } from './s4_12.gen';
import { useAt } from './useAt';
import './s4_12.css';

/* ============================================================================
   SLIDE 12, SECOND OPTION — Mamba Blocks and Patch Size
   ----------------------------------------------------------------------------
   The main slide (slides3.jsx, TwinSlide) with its two flat patches replaced
   by the patches to scale on a whole-body scan (scan A, the scan of slide 2),
   one copy under each column (clips/plain-a-grow1.mp4,
   tools/seminar-decks/make_plain_3d_s4_12.py): the final model's patch
   (patch.small_*_mm) under the first, and under the second the same patch
   growing into the larger one (patch.large_mm), as the main slide's second
   patch grows, both at 0.25 px per mm. (The first build also turned both
   scans twice; the design critic found the turns added nothing the
   transcript says and competed with the chart, so they were cut, 14 Oct.)
   No PSMASegmentator patch is drawn here. Chart, words and every other beat
   are the main slide's.
   75 s read (134 words); latest starts: final model's patch 12.8 s, almost
   five times larger 16.7, at the smaller patch 18.6, added little 21.9, the
   larger patch was where 42.3, cost the hybrid 50.0, four and a half 51.9,
   only about one 56.6; all over by 56.25 s.
   ========================================================================== */

const X = S4_12.s12;
const grow = (el, at, d = 0.9) => track(el, [{ t: at, transform: 'scaleX(0)' }, { t: at + d, transform: 'scaleX(1)' }], EASE.inOut);

function timeline(root, add) {
  add(rise(one(root, 'c-hyb'), 0.3, 0.8, 12));
  add(rise(one(root, 'same'), 3.2, 0.8, 10));
  // The CNN-only version slides out from behind the hybrid (as on slide 6).
  add(track(one(root, 'c-cnn'), [
    { t: 4.6, opacity: 0, transform: 'translateY(-66px)' },
    { t: 4.8, opacity: 1, transform: 'translateY(-66px)', e: EASE.inOut },
    { t: 5.8, opacity: 1, transform: 'translateY(0px)' },
  ]));
  add(rise(one(root, 'both'), 7.4, 0.8, 10));
  // The chart; the scan with the final model's patch under the first column.
  add(rise(one(root, 'ch-kick'), 11.8, 0.8, 10));
  add(fadeIn(one(root, 'ch-frame'), 12.0, 0.6));
  add(rise(one(root, 'col-0'), 12.2, 0.8, 10));
  // The clip (starts at 12.2): the first scan, then the second fades in with
  // its column (15.8) and its patch grows (16.2 to 17.2). Then the still (the
  // clip's last frame) takes over underneath and the clip goes.
  const [c1] = X.clips;
  add(track(one(root, 'bodies-1'), [
    { t: c1[0], opacity: 0 }, { t: c1[0] + 0.4, opacity: 1 }, { t: c1[1] - 0.2, opacity: 1 }, { t: c1[1], opacity: 0 },
  ], EASE.inOut));
  add(track(one(root, 'bodies-still'), [{ t: c1[1] - 0.4, opacity: 0 }, { t: c1[1] - 0.1, opacity: 1 }], EASE.inOut));
  add(fadeIn(one(root, 'scale-tag'), 17.2, 0.6));
  add(fadeIn(one(root, 'once'), 12.8, 0.6));
  add(rise(one(root, 'col-1'), 15.8, 0.8, 10));
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

export function TwinSlideB({ ctx }) {
  useMediaVersion();
  const root = useTimeline(ctx, timeline);
  const live = isLive(ctx);
  const next = ctx.mode === 'present' && ctx.phase === 'next' && !ctx.still;
  // Each clip waits, paused and preloaded on its first frame, until the slide reaches it.
  const go1 = useAt(live, X.clips[0][0]);
  const { plot, cols, hyb, cnn } = S12;
  const r = 10;
  const sq = (p, a) => <rect x={p.x - r * 0.9} y={p.y - r * 0.9} width={r * 1.8} height={r * 1.8} className="dp12-pt is-cnn" data-a={a} />;
  const ci = (p, a) => <circle cx={p.x} cy={p.y} r={r} className="dp12-pt is-hyb" data-a={a} />;
  const line = (pts, kind, a) => <path d={`M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`} className={`dp12-line is-${kind}`} data-a={a} pathLength="1" />;
  const box = { left: X.left, top: X.top, width: X.w, height: X.h };
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
      {/* Each patch to scale on a whole-body scan; the clip brings in the second and grows its patch. */}
      <div className="dpx12-still" data-a="bodies-still" style={box}>
        <img src={mediaUrl('clips/plain-a-grow1.png')} alt="" aria-hidden="true" draggable="false" />
      </div>
      {(live || next) && (
        <div className="dpx12-clip" data-a="bodies-1" style={box}>
          <Clip src="plain-a-grow1" state={go1 ? 'play' : 'start'} mode={ctx.mode} reduced={ctx.reduced} label="The two patches to scale on a whole-body scan: the final model's patch, and the larger one growing from it" />
        </div>
      )}
      <p className="dp-tag dpx12-tag" data-a="scale-tag" data-role="foot" style={{ right: 1920 - X.left + 14, top: X.top + X.h - 54 }}>
        Both to scale,<br />on the same scan
      </p>
    </div>
  );
}
