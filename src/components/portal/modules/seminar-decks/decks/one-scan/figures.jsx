import { Num, T } from '../../shared/Num';
import { VerdictGlyph, Logo } from '../../shared/chrome';
import { HYPOTHESES, VERDICTS } from '../../shared/meta';
import { FairDots } from '../../shared/BackupParts';
import Exhibit from '../../shared/Exhibit';
import { mediaUrl, useMediaVersion } from '../../engine/media';
import { Glyph, Lock } from './parts';
import { N1, N3, OPTF, POOLED, VAULT130 } from './geometry';
import { BOARD_EVIDENCE, OPTF_CALLOUTS, OPTF_SUMMARY, TWIN } from './content';

/* ============================================================================
   ONE SCAN, START TO FINISH — MOTION GRAPHICS (components only)
   ----------------------------------------------------------------------------
   Each graphic advances in build steps (props `step`, `live`) through CSS
   classes, so export, thumbnails and reduced motion show the step's end
   state with no transition. Every number is a manifest key (<Num>); every
   size and count is computed in geometry.js. Schematics say "schematic".
   ========================================================================== */

const on = (cond) => (cond ? ' is-on' : '');

/* ── N1: windows to scale on the case A beat 1 hold ─────────────────────── */
function WinRect({ r, kind, show, dashed = false }) {
  const per = 2 * (r.w + r.h);
  return (
    <g className={`d1-win is-${kind}${on(show)}`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} className="d1-win__halo" />
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        className={`d1-win__line${dashed ? ' is-dashed' : ''}`}
        style={dashed ? undefined : { strokeDasharray: per, strokeDashoffset: show ? 0 : per }}
      />
    </g>
  );
}

export function N1Windows({ step }) {
  return (
    <svg className="d1-n1" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
      <WinRect r={N1.large} kind="large" show={step >= 3} dashed />
      <WinRect r={N1.psm} kind="psm" show={step >= 1} />
      <WinRect r={N1.small} kind="small" show={step >= 3} />
      <g className={`d1-win__centre${on(step >= 1)}`}>
        <circle cx={N1.cx} cy={N1.cy} r="7" className="d1-win__halo" />
        <circle cx={N1.cx} cy={N1.cy} r="5" />
      </g>
    </svg>
  );
}

function Swatch({ kind }) {
  return (
    <svg className={`d1-swatch is-${kind}`} width="64" height="34" viewBox="0 0 64 34" aria-hidden="true">
      <rect x="4" y="5" width="56" height="24" className="d1-win__halo" />
      <rect x="4" y="5" width="56" height="24" className={`d1-win__line${kind === 'large' ? ' is-dashed' : ''}`} />
    </svg>
  );
}

export function N1Legend({ step }) {
  const rows = [
    { kind: 'psm', name: 'PSMASegmentator', w: 'psm.patch_x_mm', h: 'psm.patch_z_mm', at: 1 },
    { kind: 'small', name: 'My main window (runs 3 to 5)', w: 'patch.small_x_mm', h: 'patch.small_z_mm', at: 3 },
    { kind: 'large', name: 'My large-window test (run 6)', w: 'patch.large_x_mm', h: 'patch.large_z_mm', at: 3 },
  ];
  return (
    <div className={`d1-n1legend${on(step >= 1)}`}>
      <p className="d1-label" data-role="chart">Windows, to scale</p>
      <ul className="d1-n1legend__list">
        {rows.map((r) => (
          <li key={r.kind} className={`d1-n1legend__row is-${r.kind}${on(step >= r.at)}`}>
            <Swatch kind={r.kind} />
            <span className="d1-n1legend__text">
              <span className="d1-n1legend__name" data-role="chart">{r.name}</span>
              <span className="d1-n1legend__size" data-role="chart"><Num k={r.w} /> wide · <Num k={r.h} /> tall</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="d1-note" data-role="foot">Coronal view: left-right by head-toe. Depth (front to back) is not shown. The shared centre is illustrative.</p>
    </div>
  );
}

/* ── N2: Mamba against attention (schematic) ─────────────────────────────── */
const NTOK = 12;
const TOK = { x0: 70, pitch: 76, size: 46 };
const tokX = (i) => TOK.x0 + i * TOK.pitch;

export function N2Sequence() {
  const yM = 136;
  const yA = 372;
  const pairs = [];
  for (let i = 0; i < NTOK; i += 1) for (let j = i + 1; j < NTOK; j += 1) pairs.push([i, j]);
  return (
    <svg className="d1-n2" width="1000" height="600" viewBox="0 0 1000 600" role="img" aria-label="Schematic: Mamba reads tokens in order with a small memory; attention compares every pair">
      <text x="852" y="20" className="d1-svgnote" data-role="foot">schematic</text>
      {/* Mamba: one pass, a small memory carried from token to token */}
      <text x="0" y="40" className="d1-svglabel is-gold" data-role="chart">Mamba</text>
      <text x="150" y="40" className="d1-svgsub" data-role="chart">reads in order, carrying a small memory</text>
      {Array.from({ length: NTOK - 1 }, (_, i) => (
        <path key={i} d={`M ${tokX(i) + TOK.size / 2} ${yM - 6} Q ${tokX(i) + TOK.size / 2 + TOK.pitch / 2} ${yM - 52} ${tokX(i + 1) + TOK.size / 2} ${yM - 6}`} className="d1-n2__hop" />
      ))}
      {Array.from({ length: NTOK }, (_, i) => (
        <rect key={i} x={tokX(i)} y={yM} width={TOK.size} height={TOK.size} rx="5" className="d1-n2__tok" />
      ))}
      <text x="0" y={yM + 98} className="d1-svgsub" data-role="chart">Cost grows with length: double it, double the work.</text>
      {/* Attention: every pair */}
      <text x="0" y={yA - 34} className="d1-svglabel" data-role="chart">Attention</text>
      <text x="190" y={yA - 34} className="d1-svgsub" data-role="chart">compares every pair</text>
      {pairs.map(([i, j]) => {
        const a = tokX(i) + TOK.size / 2;
        const b = tokX(j) + TOK.size / 2;
        const h = 14 + (b - a) * 0.26;
        return <path key={`${i}-${j}`} d={`M ${a} ${yA + TOK.size + 4} Q ${(a + b) / 2} ${yA + TOK.size + 4 + h} ${b} ${yA + TOK.size + 4}`} className="d1-n2__web" />;
      })}
      {Array.from({ length: NTOK }, (_, i) => (
        <rect key={i} x={tokX(i)} y={yA} width={TOK.size} height={TOK.size} rx="5" className="d1-n2__tok is-plain" />
      ))}
      <text x="0" y={yA + 214} className="d1-svgsub" data-role="chart">Cost grows with length squared: double it, four times the work.</text>
    </svg>
  );
}

export function N2Lengths() {
  return (
    <p className="d1-n2len" data-role="chart">
      In my three Mamba stages: <Num k="net.tok3" /> · <Num k="net.tok4" /> · <Num k="net.tok5" /> tokens per direction
    </p>
  );
}

/* ── N6: the hypothesis scoreboard (pending on slide 5, resolved on 12) ── */
export function Board({ resolved = false, compact = false, show = true }) {
  return (
    <ol className={`d1-board${compact ? ' is-compact' : ''}${resolved ? ' is-resolved' : ''}${on(show)}`}>
      {HYPOTHESES.map((h, i) => {
        const state = resolved ? h.verdict : 'pending';
        return (
          <li key={h.id} className={`d1-board__row is-${state}`} style={{ transitionDelay: `${0.12 * i}s` }}>
            <VerdictGlyph state={state} size={compact ? 40 : 46} className="d1-board__glyph" />
            <span className="d1-board__id" data-role={show ? 'chart' : undefined}>{h.id} · {h.name}</span>
            <span className="d1-board__line" data-role={show ? 'chart' : undefined}>
              <T>{resolved ? BOARD_EVIDENCE[h.id] : h.line}</T>
            </span>
            <span className="d1-board__verdict" data-role={show ? 'chart' : undefined}>{VERDICTS[state].label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── N3: 697 tiles, the sealed 130, five folds ──────────────────────────── */
export function N3Tiles({ step }) {
  const { tiles, pool, vault, foldBoxes, fold } = N3;
  return (
    <div className="d1-n3">
      <svg className="d1-n3__svg" width="1728" height="560" viewBox="0 0 1728 560" aria-hidden="true">
        <g className={`d1-n3__vault${on(step >= 1)}`}>
          <rect x={vault.x - 22} y={vault.y - 22} width={vault.w + 44 - (vault.pitch - vault.tile)} height={vault.h + 44 - (vault.pitch - vault.tile)} rx="8" className="d1-n3__vaultbox" />
        </g>
        {tiles.map((t) => {
          const x = step >= 2 ? t.x2 : step >= 1 ? t.x1 : t.x0;
          const y = step >= 2 ? t.y2 : step >= 1 ? t.y1 : t.y0;
          const size = t.test && step >= 1 ? vault.tile : pool.tile;
          return (
            <rect
              key={t.i}
              width={size}
              height={size}
              rx="3"
              className={`d1-tile${t.dp ? ' is-dp' : ''}${t.test ? ' is-test' : ''}`}
              style={{ transform: `translate(${x}px, ${y}px)`, transitionDelay: `${((t.i * 7) % 600) / 1000}s` }}
            />
          );
        })}
      </svg>
      <div className={`d1-n3__cohorts${on(step < 2)}`}>
        <p className="d1-n3__cohort" data-role={step < 2 ? 'chart' : undefined}>
          <span className="d1-tileswatch" aria-hidden="true" />
          autoPET-III · <Num k="data.autopet" /> scans · threshold outlines corrected by an expert
        </p>
        <p className="d1-n3__cohort" data-role={step < 2 ? 'chart' : undefined}>
          <span className="d1-tileswatch is-dp" aria-hidden="true" />
          DEEP-PSMA · <Num k="data.deeppsma" /> scans · SUV <Num k="data.suv" /> or more, normal uptake removed
        </p>
      </div>
      <div className={`d1-n3__vaultlabel${on(step >= 1)}`} style={{ left: vault.x - 22 }}>
        <p className="d1-n3__vaulthead" data-role="chart"><Lock size={34} /> Sealed test set · <Num k="data.test" /> scans</p>
      </div>
      <p className={`d1-n3__vaultsub${on(step >= 1)}`} style={{ left: vault.x - 22 }} data-role="chart">
        <Num k="data.test_autopet" /> autoPET-III + <Num k="data.test_deeppsma" /> DEEP-PSMA, never trained or tuned on
      </p>
      {foldBoxes.map((f, i) => (
        <p key={i} className={`d1-n3__fold${on(step >= 2)}`} style={{ left: f.x, top: fold.y - 76 }} data-role="chart">
          <span className="d1-n3__foldname">{`fold ${i}`}</span>
          <span className="d1-n3__foldn"><Num k={i === 0 ? 'data.fold0' : 'data.fold_n'} /> scans</span>
        </p>
      ))}
      <p className={`d1-n3__foldcap${on(step >= 2)}`} data-role={step >= 2 ? 'body' : undefined}>
        Grouped by patient, both datasets in every fold. Each model trains on four folds and is checked on the fifth.
      </p>
      <div className={`d1-n3__prereg${on(step >= 3)}`} style={{ left: vault.x - 22 }}>
        <p className="d1-label is-gold" data-role="chart">Pre-registered</p>
        <p className="d1-n3__preregtext" data-role={step >= 3 ? 'body' : undefined}>
          <T>{'Fixed before the test: threshold {{inf.thr}}, {{inf.minvox}}-voxel filter, reported rows.'}</T>
        </p>
      </div>
    </div>
  );
}

/* ── N8: option F, revealed region by region under a moving camera ──────── */
export function OptionF({ step }) {
  useMediaVersion();
  const url = mediaUrl('figures/architecture-option-f.svg');
  const cam = OPTF.cams[Math.min(step, OPTF.cams.length - 1)];
  const k = cam.s / OPTF.base;
  const show = { r1: step >= 0, r2: step >= 1, r4: step >= 2, r3: step >= 3 };
  const call = step < OPTF_CALLOUTS.length ? OPTF_CALLOUTS[step] : null;
  const plate = OPTF.plates[Math.min(step, OPTF.plates.length - 1)];
  return (
    <>
    <div className="d1-optf" style={{ left: plate.x, width: plate.w }}>
      <div className="d1-optf__view">
        <div
          className="d1-optf__fig"
          style={{
            width: OPTF.W * OPTF.base,
            height: OPTF.H * OPTF.base,
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${k})`,
          }}
        >
          {['r1', 'r2', 'r3', 'r4'].map((r) => (
            <img
              key={r}
              src={url}
              alt={r === 'r1' ? 'The dissertation\'s architecture figure: the hybrid CNN-Mamba network, with the organ head marked training only' : ''}
              className={`d1-optf__layer${on(show[r])}`}
              style={{ clipPath: OPTF.regions[r] }}
              draggable="false"
            />
          ))}
        </div>
      </div>
      {call && (
        <div key={step} className="d1-optf__call" style={{ left: call.x, top: call.y, width: call.w }}>
          {call.kicker && <p className="d1-optf__kicker" data-role="chart">{call.kicker}</p>}
          {call.lines.map((l, i) => (
            <p key={i} className="d1-optf__text" data-role="body"><T>{l}</T></p>
          ))}
        </div>
      )}
      <p className="d1-optf__src" data-role="foot">The dissertation&apos;s architecture figure, shown as published</p>
    </div>
    {!call && (
      <div className="d1-optf__summary">
        <p className="d1-label is-gold" data-role="chart">{OPTF_SUMMARY.kicker}</p>
        {OPTF_SUMMARY.lines.map((l, i) => (
          <p key={i} className="d1-body" data-role="body"><T>{l}</T></p>
        ))}
      </div>
    )}
    </>
  );
}

/* ── Slide 10: the sealed 130 and the pooled lesion bars ────────────────── */
const CASE_A_TILE = 51; // illustrative position (column 13, row 4), labelled as such

export function SealedGrid({ live }) {
  const pitch = 46;
  const size = 40;
  return (
    <div className="d1-sealed">
      <svg className={`d1-sealed__svg${on(live)}`} width={13 * pitch} height={10 * pitch + 10} viewBox={`0 0 ${13 * pitch} ${10 * pitch + 10}`} aria-hidden="true">
        {VAULT130.map((t) => (
          <rect
            key={t.k}
            x={t.col * pitch + 3}
            y={t.row * pitch + 3}
            width={size}
            height={size}
            rx="4"
            className={`d1-tile is-big${t.dp ? ' is-dp' : ''}${t.k === CASE_A_TILE ? ' is-casea' : ''}`}
            style={{ transitionDelay: `${(t.col + t.row) * 0.03}s` }}
          />
        ))}
      </svg>
      <p className="d1-sealed__tag" style={{ left: (CASE_A_TILE % 13) * pitch + 3 + size + 14, top: Math.floor(CASE_A_TILE / 13) * pitch - 4 }} data-role="chart">Case A</p>
      <p className="d1-sealed__legend" data-role="chart">
        <span className="d1-tileswatch" aria-hidden="true" /> autoPET-III
        <span className="d1-tileswatch is-dp" aria-hidden="true" /> DEEP-PSMA
      </p>
      <p className="d1-note" data-role="foot">One tile per test scan; positions illustrative.</p>
    </div>
  );
}

export function PooledBars({ show }) {
  const W = 720;
  const sc = (n) => (n / POOLED.max) * W;
  const rows = [
    { label: 'Every lesion in the test set', a: POOLED.tp, b: POOLED.fn, bk: 'missed', k: 'r5.sens', name: 'sensitivity' },
    { label: 'Lesions found, plus false alarms', a: POOLED.tp, b: POOLED.fp, bk: 'fa', k: 'r5.ppv', name: 'precision' },
  ];
  return (
    <div className={`d1-pooled${on(show)}`}>
      {rows.map((r, i) => (
        <div key={r.name} className="d1-pooled__row" style={{ transitionDelay: `${0.25 * i}s` }}>
          <p className="d1-pooled__label" data-role={show ? 'chart' : undefined}>{r.label}</p>
          <div className="d1-pooled__barline">
            <svg className="d1-pooled__bar" width={W} height="64" viewBox={`0 0 ${W} 64`} aria-hidden="true">
              <rect x="0" y="0" width={sc(r.a)} height="64" className="d1-seg is-found" style={{ transitionDelay: `${0.25 * i}s` }} />
              <rect x={sc(r.a)} y="0" width={sc(r.b)} height="64" className={`d1-seg is-${r.bk}`} style={{ transitionDelay: `${0.25 * i + 0.35}s` }} />
            </svg>
            <p className="d1-pooled__val">
              <span className="d1-pooled__name" data-role={show ? 'chart' : undefined}>{r.name}</span>
              <span className="d1-pooled__num" data-role={show ? 'chart' : undefined}><Num k={r.k} /></span>
            </p>
          </div>
        </div>
      ))}
      <p className="d1-pooled__key" data-role={show ? 'chart' : undefined}>
        <Glyph kind="found" size={30} /> found <Glyph kind="missed" size={30} /> missed <Glyph kind="fa" size={30} /> false alarm
      </p>
    </div>
  );
}

/* ── N4a: the underdog card ──────────────────────────────────────────────── */
export function Underdog() {
  const rows = [
    ['Models averaged', 'one', <Num k="psm.folds" key="b" />],
    ['Mirrored passes (test-time augmentation)', 'none', <Num k="psm.tta" key="b" />],
    ['Training scans', <Num k="train.run4_cases" key="a" />, <Num k="psm.train" key="b" />],
    ['Parameters', <Num k="net.params" key="a" />, <Num k="psm.params" key="b" />],
  ];
  return (
    <table className="d1-under">
      <thead>
        <tr>
          <th aria-label="Factor" />
          <th className="is-mine" data-role="chart">Run 4 · mine</th>
          <th className="is-psm" data-role="chart">PSMASegmentator</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, a, b]) => (
          <tr key={label}>
            <th scope="row" data-role="chart">{label}</th>
            <td className="is-mine" data-role="chart">{a}</td>
            <td className="is-psm" data-role="chart">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FairResult() {
  return (
    <div className="d1-fairres">
      <p className="d1-label" data-role="chart">Pooled F1, run 4 minus PSMASegmentator</p>
      <p className="d1-fairres__big"><Num k="fair.df1" /></p>
      <p className="d1-fairres__ci" data-role="chart"><T>{'F1 points, interval {{fair.df1_lo}} to {{fair.df1_hi}}'}</T></p>
      <dl className="d1-fairres__trade">
        <dt data-role="chart"><Num k="fair.dsens" /></dt>
        <dd data-role="body">sensitivity: it found more</dd>
        <dt data-role="chart"><Num k="fair.dppv" /></dt>
        <dd data-role="body">precision: more false alarms</dd>
      </dl>
    </div>
  );
}

export function FairDotsPanel() {
  return (
    <div className="d1-dots">
      <FairDots width={1380} height={500} bands />
      <div className="d1-dots__side">
        <p className="d1-dots__key" data-role="chart"><span className="d1-dotkey is-up" aria-hidden="true" /> run 4 higher</p>
        <p className="d1-dots__key" data-role="chart"><span className="d1-dotkey is-down" aria-hidden="true" /> PSMASegmentator higher</p>
        <p className="d1-dots__band" data-role="chart">Shaded: scans with few lesions (left) and many (right)</p>
      </div>
    </div>
  );
}

/* ── N5: the twin, as a slope chart over the 2x2 ─────────────────────────── */
export function TwinSlope({ step }) {
  const { y0, y1, top, bot, xs, xl } = TWIN;
  const y = (f) => bot - ((f - y0) / (y1 - y0)) * (bot - top);
  const val = (k) => TWIN.vals[k];
  const ticks = [76, 78, 80, 82, 84];
  const grown = step >= 1;
  return (
    <svg className={`d1-twin${grown ? ' is-grown' : ''}`} width="960" height="620" viewBox="0 0 960 620" role="img" aria-label="F1 of the hybrid and its CNN-only twin at the small and the large training window">
      {ticks.map((t) => (
        <g key={t}>
          <line x1="120" x2="900" y1={y(t)} y2={y(t)} className="d1-twin__grid" />
          <text x="104" y={y(t) + 10} textAnchor="end" className="d1-twin__tick" data-tick="" data-role="chart">{t}</text>
        </g>
      ))}
      <text transform={`translate(30, ${(top + bot) / 2}) rotate(-90)`} textAnchor="middle" className="d1-twin__axis" data-role="chart">
        F1 on the <Num k="fair.n" svg /> DEEP-PSMA scans
      </text>
      {/* PSMASegmentator, same scans: a reference line only */}
      <line x1="120" x2="900" y1={y(val('psm'))} y2={y(val('psm'))} className="d1-twin__psm" />
      <text x="128" y={y(val('psm')) + 36} className="d1-twin__psmlabel" data-role="chart">
        PSMASegmentator <Num k="fair.psm_f1" svg />
      </text>
      {/* lines draw from the small to the large window at step 1 */}
      <path d={`M ${xs} ${y(val('cs'))} L ${xl} ${y(val('cl'))}`} className="d1-twin__line is-twin" pathLength="1" />
      <path d={`M ${xs} ${y(val('hs'))} L ${xl} ${y(val('hl'))}`} className="d1-twin__line is-hybrid" pathLength="1" />
      <circle cx={xs} cy={y(val('cs'))} r="13" className="d1-twin__pt is-twin" />
      <circle cx={xs} cy={y(val('hs'))} r="13" className="d1-twin__pt is-hybrid" />
      <text x={xs - 28} y={y(val('cs')) - 4} textAnchor="end" className="d1-twin__val is-twin" data-role="chart">twin <Num k="r6.c_small" svg /></text>
      <text x={xs - 28} y={y(val('hs')) + 34} textAnchor="end" className="d1-twin__val is-hybrid" data-role="chart">hybrid <Num k="r6.h_small" svg /></text>
      <g className={`d1-twin__late${on(grown)}`}>
        <circle cx={xl} cy={y(val('cl'))} r="13" className="d1-twin__pt is-twin" />
        <circle cx={xl} cy={y(val('hl'))} r="13" className="d1-twin__pt is-hybrid" />
        <text x={xl + 28} y={y(val('cl')) + 10} className="d1-twin__val is-twin" data-role={grown ? 'chart' : undefined}><Num k="r6.c_large" svg /></text>
        <text x={xl + 28} y={y(val('hl')) + 10} className="d1-twin__val is-hybrid" data-role={grown ? 'chart' : undefined}><Num k="r6.h_large" svg /></text>
        <text x={(xs + xl) / 2} y={(y(val('cs')) + y(val('cl'))) / 2 - 24} textAnchor="middle" className="d1-twin__drop is-twin" data-role={grown ? 'chart' : undefined}><Num k="r6.c_patch" svg /></text>
        <text x={xs + (xl - xs) * 0.62} y={y(val('hs')) + (y(val('hl')) - y(val('hs'))) * 0.62 - 26} className="d1-twin__drop is-hybrid" data-role={grown ? 'chart' : undefined}><Num k="r6.h_patch" svg /></text>
      </g>
      <text x={xs} y="572" textAnchor="middle" className="d1-twin__col" data-role="chart">small window</text>
      <text x={xl} y="572" textAnchor="middle" className={`d1-twin__col${grown ? '' : ' is-faint'}`} data-role="chart">large window</text>
      <text x={xs} y="606" textAnchor="middle" className="d1-twin__colsub" data-role="foot">runs 4 and 6</text>
      <text x={xl} y="606" textAnchor="middle" className={`d1-twin__colsub${grown ? '' : ' is-faint'}`} data-role="foot">run 6</text>
    </svg>
  );
}

/* ── The closing frame: case A beside case B (two holds, never blended) and
   the conclusion, kept on screen through questions ────────────────────── */
const SPLIT_CROP = [230 / 1920, 108 / 1080, 588 / 1920, 858 / 1080];

export function Split() {
  return (
    <div className="d1-split">
      <figure className="d1-split__case">
        <p className="d1-split__kicker" data-role="chart">Case A · autoPET-III</p>
        <Exhibit src="clips/case-a-4-ground-truth.png" alt="Case A held-out scan with its verdicts" crop={SPLIT_CROP} width={400} height={584} plate={false} />
        <p className="d1-split__cap" data-role="chart"><T>{'{{a.found}} of {{a.gt}} found · {{a.fa}} false alarms'}</T></p>
      </figure>
      <figure className="d1-split__case">
        <p className="d1-split__kicker" data-role="chart">Case B · autoPET-III</p>
        <Exhibit src="clips/case-b-4-ground-truth.png" alt="Case B held-out scan with its verdicts" crop={SPLIT_CROP} width={400} height={584} plate={false} />
        <p className="d1-split__cap" data-role="chart"><T>{'{{b.found}} of {{b.gt}} found · {{b.fa}} false alarms'}</T></p>
      </figure>
      <p className="d1-split__key" data-role="chart">
        <Glyph kind="found" size={30} /> found <Glyph kind="missed" size={30} /> missed <Glyph kind="fa" size={30} /> false alarm
      </p>
    </div>
  );
}

export function Thanks() {
  return (
    <div className="d1-thanks">
      <h2 className="d1-thanks__big" data-role="title">Thank you. Questions?</h2>
      <dl className="d1-thanks__recap">
        <dt data-role="chart">What it means</dt>
        <dd data-role="body">Run 4 found more lesions than PSMASegmentator on unseen scans, at lower precision; the twin did as well.</dd>
        <dt data-role="chart">Contribution</dt>
        <dd data-role="body">A fair test on unseen scans; a pre-registered test of what Mamba adds.</dd>
        <dt data-role="chart">Limits</dt>
        <dd data-req="limitations" data-role="body">Two public datasets; one run per cell.</dd>
        <dt data-role="chart">Next</dt>
        <dd data-req="future" data-role="body">Retrain and test on SCGH.</dd>
      </dl>
      <Logo size="large" chip className="d1-thanks__logo" />
    </div>
  );
}
