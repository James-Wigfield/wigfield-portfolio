import { Num } from '../../../shared/Num';
import { tilePlan } from '../data';

/* ============================================================================
   VERDICT DECK — N3, THE DATA AND THE PROTOCOL
   ----------------------------------------------------------------------------
   One tile per scan, coloured by cohort (counts from the manifest).
   step 0  all scans in one block
   step 1  the sealed test scans move into a locked vault
   step 2  the pool splits into five folds
   step 3  (the pre-registration stamp is drawn by the slide)
   step 4  the DEEP-PSMA tiles are ringed: unseen by run 4
   ========================================================================== */

const PLAN = tilePlan();
const G0 = { x: 0, y: 70, cols: 41, pitch: 13, size: 10 }; // the block
const F = { x: 0, y: 92, cols: 5, pitch: 14, size: 11, gap: 34 }; // the folds
const V = { x: 572, y: 120, cols: 10, pitch: 14, size: 11 }; // the vault
const foldX = (k) => F.x + k * (F.cols * F.pitch + F.gap);

const POS = (() => {
  const counters = Array(PLAN.nFolds).fill(0);
  let vi = 0;
  // Within each destination, autoPET-III first, then DEEP-PSMA.
  const ordered = [...PLAN.tiles].sort((a, b) => (a.cohort === b.cohort ? a.i - b.i : a.cohort === 'a' ? -1 : 1));
  const out = {};
  ordered.forEach((t) => {
    const g = { x: G0.x + (t.i % G0.cols) * G0.pitch, y: G0.y + Math.floor(t.i / G0.cols) * G0.pitch };
    let v;
    let f;
    if (t.dest === 'test') {
      v = { x: V.x + (vi % V.cols) * V.pitch, y: V.y + Math.floor(vi / V.cols) * V.pitch };
      vi += 1;
      f = v;
    } else {
      const k = t.dest;
      const n = counters[k];
      counters[k] += 1;
      f = { x: foldX(k) + (n % F.cols) * F.pitch, y: F.y + Math.floor(n / F.cols) * F.pitch };
      v = g;
    }
    out[t.i] = { g, v, f, test: t.dest === 'test', cohort: t.cohort, delay: Math.round(t.r * 420) };
  });
  return out;
})();
const VAULT_ROWS = Math.ceil(PLAN.testN / V.cols);
const FOLD_ROWS = Math.ceil(Math.max(...PLAN.foldSizes) / F.cols);

export default function DataTiles({ step, refNum }) {
  const sealed = step >= 1;
  const folded = step >= 2;
  const ringed = step >= 4;
  return (
    <svg className={`d2-n3 d2-step-${step}`} width="720" height="600" viewBox="0 0 720 600" role="img" aria-label="Every scan as a tile: the sealed test set moves into a vault and the rest splits into five folds">
      <g className={`d2-n3__vault${sealed ? ' is-on' : ''}`}>
        <rect x={V.x - 22} y={V.y - 22} width={V.cols * V.pitch + 30} height={VAULT_ROWS * V.pitch + 30} rx="6" className="d2-n3__vault-box" />
        <g transform={`translate(${V.x + (V.cols * V.pitch) / 2 - 15}, ${V.y - 74})`} className="d2-n3__lock">
          <path d="M 7 22 V 14 a 8 8 0 0 1 16 0 V 22" className="d2-n3__shackle" />
          <rect x="0" y="22" width="30" height="24" rx="4" />
        </g>
        <text x={V.x + (V.cols * V.pitch) / 2 - 4} y={V.y + VAULT_ROWS * V.pitch + 52} textAnchor="middle" className="d2-n3__lab" data-role="chart">
          <Num k="data.test" svg /> sealed
        </text>
        <text x={V.x + (V.cols * V.pitch) / 2 - 4} y={V.y + VAULT_ROWS * V.pitch + 88} textAnchor="middle" className="d2-n3__lab d2-n3__lab--muted" data-role="chart">scored once</text>
      </g>
      {Array.from({ length: PLAN.nFolds }, (_, k) => (
        <text key={k} x={foldX(k) + (F.cols * F.pitch) / 2 - 2} y={F.y + FOLD_ROWS * F.pitch + 38} textAnchor="middle" className={`d2-n3__lab d2-n3__fold${folded ? ' is-on' : ''}`} data-role="chart" data-tick="">
          {`fold ${k}`}
        </text>
      ))}
      <text x={foldX(0)} y={F.y - 34} className={`d2-n3__lab d2-n3__fold${folded ? ' is-on' : ''}`} data-role="chart">
        <Num k="data.pool" svg /> in five folds
      </text>
      <g className="d2-n3__legend">
        <rect x="0" y="526" width="22" height="22" className="d2-n3__t is-a" />
        <text x="36" y="546" className="d2-n3__lab" data-role="chart">
          autoPET-III · <Num k="data.autopet" svg /> · expert-corrected <tspan className="d2-n3__ref" data-tick="" data-role="foot">[{refNum ? refNum('jeblick2026') : '?'}]</tspan>
        </text>
        <rect x="0" y="568" width="22" height="22" className="d2-n3__t is-b" />
        <text x="36" y="588" className="d2-n3__lab" data-role="chart">
          DEEP-PSMA · <Num k="data.deeppsma" svg /> · uptake threshold <tspan className="d2-n3__ref" data-tick="" data-role="foot">[{refNum ? refNum('jackson2025') : '?'}]</tspan>
        </text>
      </g>
      <g className="d2-n3__tiles">
        {PLAN.tiles.map((t) => {
          const p = POS[t.i];
          const at = folded ? p.f : sealed ? p.v : p.g;
          const size = folded || (sealed && p.test) ? F.size : G0.size;
          const delay = (sealed && !folded && p.test) || (folded && !p.test) ? p.delay : 0;
          return (
            <rect
              key={t.i}
              width={size}
              height={size}
              rx="1.5"
              className={`d2-n3__t is-${p.cohort}${ringed && p.cohort === 'b' ? ' is-ring' : ''}`}
              style={{ transform: `translate(${at.x}px, ${at.y}px)`, transitionDelay: `${delay}ms` }}
            />
          );
        })}
      </g>
    </svg>
  );
}
