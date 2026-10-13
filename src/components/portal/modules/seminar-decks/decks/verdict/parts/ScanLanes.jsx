import { Num } from '../../../shared/Num';
import { BLOCK, LANES, TOKENS, tokenShade } from '../data';

/* ============================================================================
   VERDICT DECK — N2, THE SELECTIVE SCAN (schematic)
   ----------------------------------------------------------------------------
   step 0  a 3D block of deep features (a 4 x 3 x 3 schematic)
   step 1  it flattens into a line of tokens, then six lanes: the same tokens
           in six orders (each token keeps its shade, so the orders differ)
   step 2  every lane is read once, left to right, carrying a fixed-size state
   step 3  attention over the same tokens: every pair, an all-pairs web
   All motion is CSS transitions keyed on the step; stills show the end state.
   The real token counts (net.tok3/4/5) are bound to the manifest.
   ========================================================================== */

const S = 44; // cube edge
const D = S * 0.354; // cabinet-projection depth offset
const O = { x: 40, y: 262 }; // front-bottom-left of the block
const L0 = { x: 392, y: 34 }; // first lane, first cell
const PITCH = 21.5;
const CW = 18;
const CH = 30;
const LANE_GAP = 46;
const WEB_Y = 470;
const N = TOKENS.length;

const front = (t) => ({ x: O.x + t.x * S + t.y * D, y: O.y - (t.z + 1) * S - t.y * D });
const mix = (rgb, w, k) => {
  const c = rgb.match(/\d+/g).map(Number).map((u) => Math.round(u + (w - u) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// Back to front: far depth first, then bottom to top, then left to right.
const CUBES = [...TOKENS].sort((a, b) => (b.y - a.y) || (a.z - b.z) || (a.x - b.x));

const ARCS = (() => {
  const out = [];
  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      const xi = L0.x + i * PITCH + CW / 2;
      const xj = L0.x + j * PITCH + CW / 2;
      const rx = (xj - xi) / 2;
      const ry = Math.min(116, rx * 0.34 + 6);
      out.push(`M ${xi} ${WEB_Y} A ${rx} ${ry} 0 0 1 ${xj} ${WEB_Y}`);
    }
  }
  return out;
})();

export default function ScanLanes({ step }) {
  const flat = step >= 1;
  const read = step >= 2;
  const web = step >= 3;
  const laneW = N * PITCH;
  return (
    <svg className={`d2-n2 d2-step-${step}`} width="1240" height="548" viewBox="0 0 1240 548" role="img" aria-label="Schematic: a 3D block of features flattened into six token lanes, each read once; attention compares every pair">
      {/* The block */}
      <g className={`d2-n2__block${flat ? ' is-flat' : ''}`}>
        {CUBES.map((t) => {
          const f = front(t);
          const c = tokenShade(t.i);
          return (
            <g key={t.i}>
              <path d={`M ${f.x} ${f.y} h ${S} l ${D} ${-D} h ${-S} Z`} fill={mix(c, 255, 0.35)} className="d2-n2__face" />
              <path d={`M ${f.x + S} ${f.y} l ${D} ${-D} v ${S} l ${-D} ${D} Z`} fill={mix(c, 0, 0.22)} className="d2-n2__face" />
              <rect x={f.x} y={f.y} width={S} height={S} fill={c} className="d2-n2__face" />
            </g>
          );
        })}
      </g>
      <text x={O.x} y={322} className="d2-n2__cap" data-role="chart">Deep features</text>
      <text x={O.x} y={362} className="d2-n2__cap d2-n2__cap--muted" data-role="chart">(schematic)</text>
      <g className={`d2-n2__counts${flat ? ' is-on' : ''}`}>
        <text x={O.x} y={418} className="d2-n2__cap" data-role="chart">Real tokens per order:</text>
        <text x={O.x} y={456} className="d2-n2__cap" data-role="chart">
          <Num k="net.tok3" svg />, <Num k="net.tok4" svg />, <Num k="net.tok5" svg />
        </text>
      </g>

      {/* Six lanes: lane 0 is the tokens flying out of the block */}
      {LANES.map((lane, k) => (
        <text key={lane.id} x={L0.x - 18} y={L0.y + k * LANE_GAP + 24} textAnchor="end" className={`d2-n2__lane-id${flat ? ' is-on' : ''}`} style={{ transitionDelay: `${flat ? 700 + k * 90 : 0}ms` }} data-role="chart">{lane.id}</text>
      ))}
      <g className="d2-n2__fly">
        {TOKENS.map((t) => {
          const f = front(t);
          const p = LANES[0].order.indexOf(t.i);
          const x = flat ? L0.x + p * PITCH : f.x + S / 2 - CW / 2;
          const y = flat ? L0.y : f.y + S / 2 - CH / 2;
          return (
            <rect
              key={t.i}
              width={CW}
              height={CH}
              rx="2"
              fill={tokenShade(t.i)}
              className={`d2-n2__tok${flat ? ' is-on' : ''}`}
              style={{ transform: `translate(${x}px, ${y}px)`, transitionDelay: flat ? `${t.i * 14}ms` : '0ms' }}
            />
          );
        })}
      </g>
      {LANES.slice(1).map((lane, k0) => {
        const k = k0 + 1;
        return (
          <g key={lane.id} className={`d2-n2__lane${flat ? ' is-on' : ''}`} style={{ transitionDelay: `${flat ? 700 + k * 90 : 0}ms`, '--d2-ly': `${-k * LANE_GAP}px` }}>
            {lane.order.map((ti, p) => (
              <rect key={ti} x={L0.x + p * PITCH} y={L0.y + k * LANE_GAP} width={CW} height={CH} rx="2" fill={tokenShade(ti)} />
            ))}
          </g>
        );
      })}

      {/* One pass per lane, carrying a fixed-size state */}
      {LANES.map((lane, k) => (
        <g key={lane.id} className={`d2-n2__pass${read ? ' is-on' : ''}`} style={{ '--d2-pd': `${k * 70}ms` }}>
          <rect x={L0.x - 4} y={L0.y + k * LANE_GAP - 4} width={laneW + 4} height={CH + 8} className="d2-n2__read" style={{ transformOrigin: `${L0.x - 4}px 0px` }} />
          <rect x={L0.x - 10} y={L0.y + k * LANE_GAP - 7} width="9" height={CH + 14} rx="3" className="d2-n2__head" style={{ transform: `translateX(${read ? laneW + 8 : 0}px)` }} />
        </g>
      ))}
      <text x={L0.x} y={338} className={`d2-n2__say${read ? ' is-on' : ''}`} data-role="chart">
        <tspan className="d2-n2__say-k">Mamba</tspan> reads each order once: cost grows with length
      </text>

      {/* Attention: every pair */}
      <g className={`d2-n2__webwrap${web ? ' is-on' : ''}`}>
        <g className="d2-n2__web" style={{ transformOrigin: `0px ${WEB_Y}px` }}>
          {ARCS.map((d) => <path key={d} d={d} />)}
        </g>
        {TOKENS.map((t) => (
          <rect key={t.i} x={L0.x + t.i * PITCH} y={WEB_Y} width={CW} height={CH} rx="2" fill={tokenShade(t.i)} />
        ))}
        <text x={L0.x} y={WEB_Y + 72} className="d2-n2__say is-on" data-role="chart">
          <tspan className="d2-n2__say-k">Attention</tspan> compares every pair: cost grows with length squared
        </text>
      </g>
    </svg>
  );
}
