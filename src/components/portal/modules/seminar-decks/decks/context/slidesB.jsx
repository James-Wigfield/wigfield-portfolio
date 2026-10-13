import DemoClip from '../../shared/DemoClip';
import { Logo } from '../../shared/chrome';
import { Num, T } from '../../shared/Num';
import { useJson } from '../../engine/hooks';
import { mediaUrl, useMediaVersion } from '../../engine/media';
import { A4_CROP, B4_CROP, ORG, R6, SIDE, TOK, TOP, WIN_C, WIN_CROP, FAIR, toView } from './geometry';
import { CASE_A_TILE, DOTS, FAIR_GRID, FOLD_X, TILE, VAULT1, VAULT2, dotX, dotY, scanTiles } from './layouts';
import { Camera, ClipGlyph, Hold, OptionF, Reveal, ScanView, Windows } from './stage';
import { Scoreboard } from './slidesA';

/* ============================================================================
   DECK 3 (context) — SLIDES 6 TO 12: inside the window, the organ task, the
   697 scans, the sealed result, the fair comparison, the twin 2x2, and the
   answer with limitations, next step and thanks.
   ========================================================================== */

const cls = (...a) => a.filter(Boolean).join(' ');

/* Option F placement in slide 7's world (and slide 8's, re-based to 0, 0). */
const OF = { x: 1800, w: 2200 };
const OF_H = OF.w * (419.525 / 409.888);
const UNET = 0.715; // option F above its Mamba-block inset
const LANES = { x: 4120, y: 1160 }; // the N2 panel, right of option F in slide 7's world

/* ── 6. My work: inside the window ─────────────────────────────────────── */
function Lanes({ scan, on }) {
  const max = 1240;
  const dirs = ['+x', '-x', '+y', '-y', '+z', '-z'];
  const rows = [
    { st: '3', k: 'net.tok3', n: TOK.s3 },
    { st: '4', k: 'net.tok4', n: TOK.s4 },
    { st: '5', k: 'net.tok5', n: TOK.s5 },
  ];
  return (
    <div className={cls('d3-lanes d3-fadein', on && 'is-on', scan && 'is-scan')} style={{ left: LANES.x, top: LANES.y }}>
      <p className="d3-lanes__h" data-role="chart"><T>{'One Mamba block scans {{net.dirs}} directions. Lengths to scale.'}</T></p>
      {rows.map((r) => {
        const len = (max * r.n) / TOK.s3;
        return (
          <div key={r.st} className="d3-lanes__group">
            <p className="d3-lanes__lab" data-role="chart">
              Stage <span data-tick="">{r.st}</span>
              <span className="d3-lanes__n"><Num k={r.k} /> tokens</span>
            </p>
            <div className="d3-lanes__set">
              {dirs.map((d) => (
                <div key={d} className="d3-lane">
                  {r.st === '3' && <span className="d3-lane__dir" data-role="foot">{d}</span>}
                  <span className="d3-lane__bar" style={{ width: len }} />
                  <span className="d3-lane__head" style={{ '--d3-len': `${len}px`, animationDuration: `${Math.max(0.12, (2.6 * r.n) / TOK.s3)}s` }} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="d3-lanes__foot" data-role="foot">Schematic: one lane per scan direction, one token per feature-map voxel.</p>
    </div>
  );
}

export function InsideSlide({ ctx }) {
  const { step } = ctx;
  const k = 560 / WIN_CROP[2];
  const body = { x: 40, y: 6 };
  const wc = { x: body.x + (WIN_C.x - WIN_CROP[0]) * k, y: body.y + (WIN_C.y - WIN_CROP[1]) * k };
  const f0 = { x: 864, y: 361, s: 1 };
  const f1 = { x: OF.x + OF.w / 2, y: (OF_H * UNET) / 2, s: 0.44, t: 1800 };
  const f2 = { x: OF.x + 0.41 * OF.w, y: 0.545 * OF_H, s: 0.916, t: 1600 }; // stages 2 to 5, the ring and "too costly to scan"
  const f3 = { x: LANES.x + 864, y: LANES.y + 340, s: 1, t: 1800 };
  const scan = ctx.active && step === 3 && ctx.mode === 'present' && !ctx.still;
  const hud = ['', 'Five stages; every stage has convolutions.', 'The deepest three also have Mamba blocks (blue).', ''][step];
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[f0, f1, f2, f3]} from={{ ...f0, x: wc.x + 260, y: wc.y, s: 1.35 }} x={TOP.x} y={TOP.y} w={TOP.w} h={TOP.h}>
        <div className="d3-abs" style={{ left: body.x, top: body.y }}>
          <ScanView crop={WIN_CROP} w={560}>
            <Hold src="clips/case-a-1-scan.png" alt="Case A with my window and PSMASegmentator's, to scale" />
            <Windows show={{ psm: true, small: true }} />
          </ScanView>
        </div>
        <div className={cls('d3-wkey d3-fadeout', step >= 1 && 'is-off')} style={{ left: 660, top: 250 }}>
          <div className="d3-key">
            <span className="d3-key__swatch is-mine" aria-hidden="true" />
            <span className="d3-key__name" data-role="chart">My window (runs 3 to 5)</span>
            <span className="d3-key__mm" data-role="chart"><Num k="patch.small_x_mm" /> x <Num k="patch.small_z_mm" /></span>
          </div>
          <div className="d3-key">
            <span className="d3-key__swatch is-psm" aria-hidden="true" />
            <span className="d3-key__name" data-role="chart">PSMASegmentator</span>
            <span className="d3-key__mm" data-role="chart"><Num k="psm.patch_x_mm" /> x <Num k="psm.patch_z_mm" /></span>
          </div>
          <p className="d3-note" data-role="foot">Left-right x head-toe, to scale on case A. Depth not shown.</p>
        </div>
        <OptionF w={OF.w} x={OF.x} y={0} clip={[0, 0, 1 - UNET, 0]} className={cls('d3-fadein', step >= 1 && 'is-on')}>
          <div className={cls('d3-optf__ring', step === 2 && 'is-on')} style={{ left: 0.325 * OF.w, top: 0.445 * OF_H, width: 0.42 * OF.w, height: 0.255 * OF_H }} />
        </OptionF>
        <Lanes scan={scan} on={step >= 3} />
      </Camera>
      {hud && <p className="d3-hud d3-hud--top" data-role="body">{hud}</p>}
    </div>
  );
}

/* ── 7. My work: teaching it anatomy ───────────────────────────────────── */
function UnitRow({ label, n, k, tone }) {
  return (
    <div className="d3-units__row">
      <p className="d3-units__lab" data-role="chart">{label}</p>
      <div className="d3-units__marks">
        {Array.from({ length: n }, (_, i) => <span key={i} className={`d3-units__m is-${tone}`} />)}
      </div>
      <Num k={k} className="d3-units__n" />
    </div>
  );
}

export function AnatomySlide({ ctx }) {
  const head = { x: 0.72 * OF.w, y: 0.2 * OF_H, s: 0.75 };
  const from = { x: 0.41 * OF.w, y: 0.545 * OF_H, s: 0.916 }; // where slide 6's deep-stage zoom sat
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[{ ...head, t: 1800 }]} from={from} x={TOP.x} y={TOP.y} w={900} h={TOP.h} className="d3-cam--plate">
        <OptionF w={OF.w} clip={[0, 0, 1 - UNET, 0]}>
          <div className="d3-optf__ring is-on" style={{ left: 0.497 * OF.w, top: 0.033 * OF_H, width: 0.168 * OF.w, height: 0.112 * OF_H }} />
        </OptionF>
      </Camera>
      <div className="d3-panel" style={{ left: 1040, top: TOP.y, width: 784 }}>
        <p className="d3-body" data-role="body">
          <T>{'Organ head: {{organ.classes}} classes, background and {{organ.structures}} anatomical structures, from TotalSegmentator CT labels. Training only.'}</T>
        </p>
        <Reveal on={ctx.at(1)} className="d3-units">
          <p className="d3-units__cap" data-role="chart"><T>{'False lesions on the {{organ.neg}} lesion-free validation scans'}</T></p>
          <UnitRow label="Run 3" n={ORG.fc3} k="organ.fc3" tone="hot" />
          <UnitRow label="Run 4, with the organ head" n={ORG.fc4} k="organ.fc4" tone="cool" />
          <p className="d3-note" data-role="foot">Only the organ head changed between the two runs.</p>
        </Reveal>
      </div>
    </div>
  );
}

/* ── 8. Zoom out: 697 scans, 130 sealed, five folds ────────────────────── */
const TILES = scanTiles();

function CaseATile() {
  useMediaVersion();
  // The case A hold, scaled so its body (x 714-1207, y 120-960) fills the tile.
  const k = (TILE.h * 8) / 840;
  return (
    <span className="d3-tile__img">
      <img src={mediaUrl('clips/case-a-1-scan.png')} alt="" draggable="false" style={{ width: 1920 * k, height: 1080 * k, left: -714 * k + (TILE.w * 8 - 493 * k) / 2, top: -120 * k }} />
    </span>
  );
}

export function ScansSlide({ ctx }) {
  const { step } = ctx;
  const a = TILES[CASE_A_TILE].s0;
  const key = (t) => (step === 0 ? t.s0 : step === 1 ? t.s1 : t.s2);
  const vault = step === 1 ? VAULT1 : VAULT2;
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[{ x: TOP.w / 2, y: TOP.h / 2, s: 1, t: 2000 }]} from={{ x: a.x + TILE.w / 2, y: a.y + TILE.h / 2, s: 7 }} x={TOP.x} y={TOP.y} w={TOP.w} h={TOP.h}>
        <div className={cls('d3-vault', step >= 1 && 'is-on')} style={{ left: vault.x - 14, top: vault.y - 14, width: 10 * TILE.px - (TILE.px - TILE.w) + 28, height: 13 * TILE.py - (TILE.py - TILE.h) + 28 }} />
        {TILES.map((t) => {
          const p = key(t);
          return (
            <span
              key={t.i}
              className={cls('d3-tile', t.dp && 'is-dp', t.test && 'is-test', t.i === CASE_A_TILE && 'is-a')}
              style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            >
              {t.i === CASE_A_TILE && <CaseATile />}
            </span>
          );
        })}
        {step === 2 && [0, 1, 2, 3, 4].map((f) => (
          <p key={f} className="d3-foldlab" style={{ left: FOLD_X(f), top: 8 }} data-role="chart">{`Fold ${f}`}</p>
        ))}
        {step >= 1 && (
          <div className="d3-vaultlab" style={{ left: vault.x - 14, top: 548, width: step === 1 ? 600 : 440 }}>
            <p data-role="chart"><T>{'Sealed: {{data.test}} scans ({{data.test_autopet}} + {{data.test_deeppsma}})'}</T></p>
            <p className="d3-vaultlab__sub" data-role="chart">{step === 1 ? 'Never trained on. Scored once.' : 'Scored once, pre-registered'}</p>
          </div>
        )}
      </Camera>
      <div className="d3-tilekey">
        <span className="d3-tilekey__sw" aria-hidden="true" />
        <span data-role="chart"><T>{'autoPET-III · {{data.autopet}} · expert-corrected outlines'}</T></span>
        <span className="d3-tilekey__sw is-dp" aria-hidden="true" />
        <span data-role="chart"><T>{'DEEP-PSMA · {{data.deeppsma}} · SUV {{data.suv}} or more'}</T></span>
        {step === 2 && <span className="d3-tilekey__pool" data-role="chart"><T>{'Folds: {{data.pool}} scans, cohorts kept'}</T></span>}
      </div>
    </div>
  );
}

/* ── 9. Results: the sealed 130 ────────────────────────────────────────── */
export function SealedSlide({ ctx }) {
  const { step } = ctx;
  const view = { x: SIDE.w / 2, y: SIDE.h / 2, s: 1, t: 1800 };
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[view]} from={{ x: SIDE.w / 2, y: 330, s: 1.6 }} x={SIDE.x} y={SIDE.y} w={SIDE.w} h={SIDE.h} className="d3-monitor-cam">
        <ScanView crop={A4_CROP} w={SIDE.w}>
          <Hold src="clips/case-a-4-ground-truth.png" alt="Case A against the expert-corrected labels: found, missed and false alarms marked" />
        </ScanView>
      </Camera>
      {step === 0 && (
        <div className="d3-col" style={{ top: 340 }}>
          <p className="d3-lead" data-role="body"><T>{'Case A, one of the {{data.test}} sealed scans'}</T></p>
          <p className="d3-kick" data-role="foot"><T>{'Of its {{a.gt}} labelled lesions'}</T></p>
          <ul className="d3-legend">
            <li data-role="chart"><ClipGlyph kind="found" /> <span>found</span> <Num k="a.found" className="d3-legend__n" /></li>
            <li data-role="chart"><ClipGlyph kind="missed" /> <span>missed</span> <Num k="a.missed" className="d3-legend__n" /></li>
            <li className="d3-legend__apart" data-role="chart"><ClipGlyph kind="fa" /> <span>false alarms, not lesions</span> <Num k="a.fa" className="d3-legend__n" /></li>
          </ul>
        </div>
      )}
      {step >= 1 && (
        <div className="d3-col" style={{ top: 330 }}>
          <div className="d3-score">
            <p className="d3-score__f1"><Num k="r5.f1" /><span className="d3-score__unit" data-role="chart"><T>{'F1 over all {{data.test}} sealed scans, lesions pooled, in-domain'}</T></span></p>
            <p className="d3-score__row" data-role="body"><Num k="r5.sens" className="d3-score__n" /> sensitivity: share of lesions found</p>
            <p className="d3-score__row" data-role="body"><Num k="r5.ppv" className="d3-score__n" /> precision: share of what it flagged that was real</p>
          </div>
        </div>
      )}
      {step >= 1 && (
        <ul className="d3-legend d3-legend--row" style={{ left: 904, top: 920 }}>
          <li data-role="chart"><ClipGlyph kind="found" size={32} /> found</li>
          <li data-role="chart"><ClipGlyph kind="missed" size={32} /> missed</li>
          <li data-role="chart"><ClipGlyph kind="fa" size={32} /> false alarm</li>
        </ul>
      )}
    </div>
  );
}

/* ── 10. Results: the fair comparison on 100 unseen scans ──────────────── */
function FairTiles({ step }) {
  const d = useJson('data/fair-per-case.json');
  const cases = d?.cases ?? [];
  const G = FAIR_GRID;
  return (
    <>
      {cases.map(([n, diff], i) => {
        const sign = diff > 0 ? 'up' : diff < 0 ? 'down' : 'tie';
        const grid = { x: G.x + (i % 10) * G.px + G.w / 2, y: G.y + Math.floor(i / 10) * G.py + G.h / 2 };
        const dot = { x: dotX(n) + ((i % 5) - 2) * 1.2, y: dotY(diff) };
        const p = step >= 2 ? dot : grid;
        const turn = step >= 2 && sign === 'tie' ? 45 : 0;
        return (
          <span
            key={i}
            className={cls('d3-ft', step >= 2 && `is-dot is-${sign}`)}
            style={{ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${turn}deg)` }}
          />
        );
      })}
    </>
  );
}

function DivergingBars() {
  const z = 690; // zero line, px from the panel's left
  const ppp = 40; // px per point
  const rows = [
    { name: 'F1', v: FAIR.df1, k: 'fair.df1', ci: true },
    { name: 'Sensitivity', v: FAIR.dsens, k: 'fair.dsens' },
    { name: 'Precision', v: FAIR.dppv, k: 'fair.dppv' },
  ];
  return (
    <div className="d3-div">
      <p className="d3-div__h" data-role="chart"><T>{'Run 4 minus PSMASegmentator, pooled over {{fair.n}} scans (points)'}</T></p>
      <svg width="1168" height="420" viewBox="0 0 1168 420" className="d3-div__svg">
        {[-10, -5, 0, 5, 10].map((t) => (
          <g key={t}>
            <line x1={z + t * ppp} x2={z + t * ppp} y1="20" y2="350" className={t === 0 ? 'd3-div__zero' : 'd3-div__grid'} />
            <text x={z + t * ppp} y="392" textAnchor="middle" className="d3-div__tick" data-tick="" data-role="chart">{t > 0 ? `+${t}` : t}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 40 + i * 104;
          const x0 = Math.min(z, z + r.v * ppp);
          const w = Math.abs(r.v * ppp);
          return (
            <g key={r.name} className={r.v > 0 ? 'is-up' : 'is-down'}>
              <text x="0" y={y + 46} className="d3-div__name" data-role="chart">{r.name}</text>
              <rect x={x0} y={y + 14} width={w} height="48" className="d3-div__bar" />
              {r.ci && <line x1={z + FAIR.lo * ppp} x2={z + FAIR.hi * ppp} y1={y + 38} y2={y + 38} className="d3-div__ci" />}
              <text x={r.v > 0 ? z + r.v * ppp + (r.ci ? 92 : 16) : x0 - 16} y={y + 48} textAnchor={r.v > 0 ? 'start' : 'end'} className="d3-div__val" data-role="chart">
                <Num k={r.k} svg />
              </text>
            </g>
          );
        })}
      </svg>
      <p className="d3-div__ci-note" data-role="chart"><T>{'F1 interval {{fair.df1_lo}} to {{fair.df1_hi}}: above zero'}</T></p>
    </div>
  );
}

function DotAxes() {
  const ticksX = [2, 5, 10, 20, 50, 100, 200];
  const ticksY = [-40, -20, 0, 20, 40];
  return (
    <svg className="d3-dots" width="1728" height="722" viewBox="0 0 1728 722" aria-hidden="false">
      <rect x={dotX(1.6)} y={DOTS.t} width={dotX(19.5) - dotX(1.6)} height={DOTS.b - DOTS.t} className="d3-dots__band" />
      <rect x={dotX(99.5)} y={DOTS.t} width={dotX(260) - dotX(99.5)} height={DOTS.b - DOTS.t} className="d3-dots__band" />
      <text x={dotX(1.6) + 14} y={DOTS.t + 36} className="d3-dots__bandlab" data-role="chart">Under <Num k="fair.lt20_cut" svg /> lesions</text>
      <text x={dotX(99.5) + 14} y={DOTS.t + 36} className="d3-dots__bandlab" data-role="chart"><Num k="fair.ge100_cut" svg /> or more</text>
      {ticksY.map((t) => (
        <g key={t}>
          <line x1={DOTS.l} x2={DOTS.r} y1={dotY(t)} y2={dotY(t)} className={t === 0 ? 'd3-dots__zero' : 'd3-dots__grid'} />
          <text x={DOTS.l - 14} y={dotY(t) + 10} textAnchor="end" className="d3-dots__tick" data-tick="" data-role="chart">{t > 0 ? `+${t}` : t}</text>
        </g>
      ))}
      {ticksX.map((t) => (
        <text key={t} x={dotX(t)} y={DOTS.b + 38} textAnchor="middle" className="d3-dots__tick" data-tick="" data-role="chart">{t}</text>
      ))}
      <text x={(DOTS.l + DOTS.r) / 2} y={DOTS.b + 84} textAnchor="middle" className="d3-dots__lab" data-role="chart">Lesions in the scan (log scale)</text>
      <text transform={`translate(34, ${(DOTS.t + DOTS.b) / 2}) rotate(-90)`} textAnchor="middle" className="d3-dots__lab" data-role="chart">Run 4 minus PSMASegmentator</text>
    </svg>
  );
}

export function FairSlide({ ctx }) {
  const { step } = ctx;
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[{ x: TOP.w / 2, y: TOP.h / 2, s: 1, t: 1600 }]} from={{ x: 250, y: 400, s: 1.8 }} x={TOP.x} y={TOP.y} w={TOP.w} h={TOP.h}>
        {step < 2 && <p className="d3-fairlab" data-role="chart"><T>{'{{fair.n}} DEEP-PSMA scans, unseen by both'}</T></p>}
        {step >= 2 && <DotAxes />}
        <FairTiles step={step} />
        {step === 0 && (
          <div className="d3-card" style={{ left: 560, top: 70 }}>
            <p className="d3-card__k" data-role="foot">The underdog</p>
            <table className="d3-card__t">
              <thead>
                <tr><th data-role="chart" /><th data-role="chart">Run 4</th><th data-role="chart">PSMASegmentator</th></tr>
              </thead>
              <tbody>
                <tr><td data-role="chart">Training scans</td><td data-role="chart"><Num k="train.run4_cases" /></td><td data-role="chart"><Num k="psm.train" /></td></tr>
                <tr><td data-role="chart">Models at inference</td><td data-role="chart">one</td><td data-role="chart"><Num k="psm.folds" /></td></tr>
                <tr><td data-role="chart">Mirrored passes</td><td data-role="chart">none</td><td data-role="chart"><Num k="psm.tta" /></td></tr>
                <tr><td data-role="chart">Parameters</td><td data-role="chart"><Num k="net.params" /></td><td data-role="chart"><Num k="psm.params" /></td></tr>
              </tbody>
            </table>
          </div>
        )}
        {step === 1 && (
          <div className="d3-abs" style={{ left: 560, top: 70 }}>
            <DivergingBars />
          </div>
        )}
        {step >= 2 && (
          <div className="d3-fairsum">
            <p data-role="chart"><T>{'Scan by scan: run 4 better on {{fair.better}}, worse on {{fair.worse}}, tied on {{fair.tied}}'}</T></p>
            <p className="d3-fairsum__pool" data-role="chart"><T>{'Pooled F1 {{fair.df1}} ({{fair.df1_lo}} to {{fair.df1_hi}})'}</T></p>
          </div>
        )}
      </Camera>
      {step === 1 && <p className="d3-hud" data-role="body">A trade: more lesions found, more false alarms.</p>}
    </div>
  );
}

/* ── 11. Results: the twin 2x2, the window growing ─────────────────────── */
function TwinChart({ step }) {
  const y = (v) => 36 + (84 - v) * 30;
  const xs = 230;
  const xl = 680;
  const grown = step >= 1;
  return (
    <svg className={cls('d3-twin', grown && 'is-grown', step >= 2 && 'is-ref')} width="920" height="330" viewBox="0 0 920 330" aria-hidden="false">
      {[76, 78, 80, 82, 84].map((t) => (
        <g key={t}>
          <line x1="90" x2="760" y1={y(t)} y2={y(t)} className="d3-twin__grid" />
          <text x="76" y={y(t) + 10} textAnchor="end" className="d3-twin__tick" data-tick="" data-role="chart">{t}</text>
        </g>
      ))}
      <text x={xs} y="320" textAnchor="middle" className="d3-twin__x" data-role="chart">Small window</text>
      <text x={xl} y="320" textAnchor="middle" className="d3-twin__x" data-role="chart">Large window</text>
      {step >= 2 && (
        <g className="d3-twin__psm">
          <line x1="90" x2="760" y1={y(R6.psm)} y2={y(R6.psm)} />
          <text x="100" y={y(R6.psm) + 38} data-role="chart">PSMASegmentator <Num k="fair.psm_f1" svg /></text>
        </g>
      )}
      <g className="d3-twin__s is-twin">
        <line x1={xs} y1={y(R6.cs)} x2={xl} y2={y(R6.cl)} pathLength="1000" className="d3-twin__line" />
        <rect x={xs - 10} y={y(R6.cs) - 10} width="20" height="20" />
        <rect x={xl - 10} y={y(R6.cl) - 10} width="20" height="20" className="d3-twin__end" />
        <text x={xs - 22} y={y(R6.cs) - 4} textAnchor="end" data-role="chart"><Num k="r6.c_small" svg /></text>
        <text x={xl + 24} y={y(R6.cl) + 10} className="d3-twin__end" data-role="chart">Twin <Num k="r6.c_large" svg /></text>
      </g>
      <g className="d3-twin__s is-hybrid">
        <line x1={xs} y1={y(R6.hs)} x2={xl} y2={y(R6.hl)} pathLength="1000" className="d3-twin__line" />
        <circle cx={xs} cy={y(R6.hs)} r="11" />
        <circle cx={xl} cy={y(R6.hl)} r="11" className="d3-twin__end" />
        <text x={xs - 22} y={y(R6.hs) + 26} textAnchor="end" data-role="chart"><Num k="r6.h_small" svg /></text>
        <text x={xl + 24} y={y(R6.hl) + 10} className="d3-twin__end" data-role="chart">Hybrid <Num k="r6.h_large" svg /></text>
      </g>
      {!grown && (
        <g className="d3-twin__names">
          <text x={xs + 30} y={y(R6.cs) - 16} className="is-twin" data-role="chart">Twin</text>
          <text x={xs + 30} y={y(R6.hs) + 38} className="is-hybrid" data-role="chart">Hybrid</text>
        </g>
      )}
    </svg>
  );
}

export function TwinSlide({ ctx }) {
  const { step } = ctx;
  const c = toView(WIN_CROP, SIDE.w, WIN_C);
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[{ x: SIDE.w / 2, y: SIDE.h / 2, s: 1, t: 1600 }]} from={{ x: c.x, y: c.y, s: 1.6 }} x={SIDE.x} y={SIDE.y} w={SIDE.w} h={SIDE.h} className="d3-monitor-cam">
        <ScanView crop={WIN_CROP} w={SIDE.w}>
          <Hold src="clips/case-a-1-scan.png" alt="Case A with the training window growing from the small patch to the large one, to scale" />
          <Windows show={{ psm: step >= 1 }} grow={step >= 1 ? 1 : 0} />
        </ScanView>
      </Camera>
      {step >= 1 && (
        <div className="d3-scankey" style={{ left: SIDE.x, top: SIDE.y, width: SIDE.w, height: 40 }}>
          <span className="d3-key__swatch is-psm" aria-hidden="true" />
          <span data-role="chart">PSMASegmentator's deployed window</span>
        </div>
      )}
      <div className="d3-scankey" style={{ left: SIDE.x, top: SIDE.y + SIDE.h - 58, width: SIDE.w }}>
        <span className="d3-key__swatch is-mine" aria-hidden="true" />
        <span data-role="chart">{step >= 1 ? 'Large training window (run 6)' : 'Small training window (runs 3 to 5)'}</span>
      </div>
      <div className="d3-abs d3-twincol" style={{ left: 904, top: 318, width: 920 }}>
        <p className="d3-twinlab" data-role="chart"><T>{'F1 on the {{fair.n}} unseen scans'}</T></p>
        <TwinChart step={step} />
        <Reveal on={ctx.at(1)} as="p" className="d3-twinnote d3-late" data-role="chart"><T>{'Interaction {{r6.inter}} points: real under the pre-registered rule'}</T></Reveal>
        {step >= 2 && (
          <>
            <p className="d3-body d3-twinspeed" data-role="body">Speed at equal passes: no faster in mean time, no lower in peak memory.</p>
            <p className="d3-twintta" data-role="chart">
              <T>{"The abstract's {{abs.home_h}} against {{abs.home_p}} s, and {{eff.h5}} against {{eff.p40}} in the dissertation, both come from PSMASegmentator's eight-pass test-time augmentation."}</T>
            </p>
            <p className="d3-note" data-role="foot">Only run 4's gap to PSMASegmentator was tested with an interval.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 12. What it means: answer, limits, next step, thanks ──────────────── */
function Limits({ compact = false }) {
  return (
    <ul className={cls('d3-limits', compact && 'is-compact')} data-req="limitations">
      <li data-role="body">{compact ? 'One run per run 6 cell' : <T>{'One training run per run 6 cell; large window at batch size {{r6.batch_large}}'}</T>}</li>
      <li data-role="body">{compact ? 'Two label conventions' : <T>{'Two label conventions; only {{data.test_neg}} lesion-free test scans'}</T>}</li>
      <li data-role="body">{compact ? 'No SCGH test, no clinical validation' : 'Not tested on Sir Charles Gairdner (SCGH) data; not clinical validation'}</li>
    </ul>
  );
}

export function AnswerSlide({ ctx }) {
  const { step } = ctx;
  return (
    <div className="d3-s">
      {step === 0 && (
        <>
          <div className="d3-wide" style={{ top: 280 }}>
            <Scoreboard verdicts />
          </div>
          <p className="d3-wide d3-body d3-accent" style={{ top: 700 }} data-role="body">
            The project offers a fair test on unseen scans and a pre-registered test of what Mamba adds.
          </p>
        </>
      )}
      {step === 1 && (
        <>
          <div className="d3-monitor" style={{ left: SIDE.x, top: 262 }}>
            <ScanView crop={B4_CROP} w={560}>
              <Hold src="clips/case-b-4-ground-truth.png" alt="Case B: both lesions found and 14 false alarms" />
            </ScanView>
          </div>
          <div className="d3-panel" style={{ left: 740, top: 300, width: 1084 }}>
            <p className="d3-kick" data-role="foot">Limitations</p>
            <Limits />
            <p className="d3-note d3-caseb" data-role="foot">
              <T>{'Left, case B: both lesions found, {{b.fa}} false alarms. Lowest F1 where one is defined, picked by rule; not the worst scan.'}</T>
            </p>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="d3-wide d3-body d3-accent" style={{ top: 280 }} data-req="future" data-role="body">
            Next: retrain and score on the Sir Charles Gairdner Hospital (SCGH) cohort, once the code is released.
          </p>
          <div className="d3-demo" style={{ left: TOP.x, top: 400, width: TOP.w, height: 584 }}>
            <DemoClip state={ctx.clip(2)} mode={ctx.mode} reduced={ctx.reduced} layout="row" />
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="d3-panel d3-final" style={{ left: TOP.x, top: 280, width: 960 }}>
            <p className="d3-kick" data-role="foot">Verdicts</p>
            <Scoreboard verdicts compact />
            <p className="d3-body d3-accent" data-role="body">A fair test on unseen scans; a pre-registered test of what Mamba adds</p>
            <p className="d3-kick" data-role="foot">Limits</p>
            <Limits compact />
            <p className="d3-body" data-req="future" data-role="body">Next: retrain on the SCGH cohort</p>
          </div>
          <div className="d3-thanks">
            <p className="d3-thanks__t" data-role="title">Thank you.</p>
            <p className="d3-thanks__q" data-role="title">Questions?</p>
            <Logo size="large" chip />
          </div>
        </>
      )}
    </div>
  );
}
