import { useId } from 'react';
import { M, DIAL_ANGLE, gaugeAngle, tankY, PF_OFFSET } from './geometry';

/* ============================================================================
   BARISTA · THE MACHINE — one shared, state-driven BES876 front elevation
   ----------------------------------------------------------------------------
   An original line-art drawing (not traced from Breville imagery). Every
   part is a named group (`.bxi-m-<part>`) that scenes target with GSAP; the
   look is driven by props:

     leds         { power, one, two, dose, filter, clean, steam }: off|flash|solid
     dial         'left' | 'standby' | 'right'   (hot water · standby · steam)
     lever        0..1   assisted tamp lever travel
     tankLevel    litres (MAX 2) — shown in the side inset
     portafilter  'out' | 'cradle' | 'group'
     filterInTank bool
     highlight    part id → an accent ring
     showTank     adds the translucent tank side-inset (viewBox 500 wide)
     beans        0..1 hopper fill
     gauge        0..1 needle (extraction pressure dial)
     tampCover    bool — false shows the chute + tamp face
     hopper       bool — false lifts it off
     trace        render stroke twins for the boot line-draw

   <MachineArt> is a <g> for scenes to place inside their own SVG; <Machine>
   wraps it in an accessible <svg>. All ids come from useId() so two mounted
   machines never collide.
   ========================================================================== */

const HL = {
  hopper: { x: 52, y: 12, width: 116, height: 96, rx: 8 },
  grind: { x: 32, y: 112, width: 24, height: 42, rx: 6 },
  dose: { cx: 84, cy: 140, r: 15 },
  filter: { cx: 176, cy: 132, r: 12 },
  buttons: { x: 262, y: 122, width: 80, height: 28, rx: 14 },
  one: { cx: 276, cy: 136, r: 14 },
  two: { cx: 302, cy: 136, r: 14 },
  power: { cx: 328, cy: 136, r: 14 },
  leds: { x: 272, y: 160, width: 44, height: 16, rx: 8 },
  gauge: { cx: 226, cy: 152, r: 40 },
  dial: { cx: 356, cy: 154, r: 19 },
  lever: { x: 10, y: 160, width: 48, height: 80, rx: 8 },
  tamp: { x: 70, y: 198, width: 84, height: 94, rx: 10 },
  group: { x: 194, y: 192, width: 64, height: 32, rx: 6 },
  outlet: { x: 262, y: 194, width: 24, height: 34, rx: 6 },
  wand: { x: 300, y: 194, width: 44, height: 126, rx: 10 },
  tip: { cx: 331, cy: 307, r: 13 },
  tray: { x: 48, y: 310, width: 304, height: 48, rx: 8 },
  storage: { x: 70, y: 300, width: 260, height: 22, rx: 6 },
  tankStrip: { x: 216, y: 80, width: 128, height: 26, rx: 6 },
  tank: { x: 384, y: 112, width: 92, height: 206, rx: 10 },
};

function ledClass(state) {
  return `bxi-led bxi-led--${state || 'off'}`;
}

function Button({ id, x, y, state, glyph }) {
  return (
    <g className={`bxi-m-btn bxi-m-btn--${id}`} data-btn={id}>
      <g className={ledClass(state)} data-led={id}>
        <circle className="bxi-led-ring" cx={x} cy={y} r="12" />
      </g>
      <circle className="bxi-m-steel" cx={x} cy={y} r="9.5" />
      <circle className="bxi-m-face" cx={x} cy={y} r="7" />
      {glyph}
    </g>
  );
}

const cup = (x, y) => <path className="bxi-m-glyph" d={`M${x - 2.4} ${y - 1.6}h4.8v2.6a2.4 2.4 0 0 1-4.8 0Z`} />;

export function MachineArt({
  leds = {},
  dial = 'standby',
  lever = 0,
  tankLevel = 1.6,
  portafilter = 'group',
  filterInTank = true,
  highlight = null,
  showTank = false,
  beans = 0.7,
  gauge = 0,
  tampCover = true,
  hopper = true,
  trace = false,
}) {
  const idp = `bxm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pf = PF_OFFSET[portafilter] || PF_OFFSET.group;
  const beanTop = M.hopper.base - (M.hopper.base - M.hopper.top - 6) * Math.min(1, Math.max(0, beans));
  const waterY = tankY(tankLevel);
  const hl = highlight === 'tank' && !showTank ? HL.tankStrip : HL[highlight];
  const hlShape = !hl ? null : 'r' in hl ? <circle {...hl} /> : <rect {...hl} />;
  const pfHl = highlight === 'portafilter' && portafilter !== 'out';

  return (
    <g className="bxi-m">
      <defs>
        <clipPath id={`${idp}-wipe`} clipPathUnits="userSpaceOnUse">
          <rect className="bxi-m-wiperect" x="0" y="0" width={M.wInset} height={M.h} />
        </clipPath>
        <clipPath id={`${idp}-hopper`} clipPathUnits="userSpaceOnUse">
          <path d="M64 32 L156 32 L145 90 L75 90 Z" />
        </clipPath>
        <clipPath id={`${idp}-tank`} clipPathUnits="userSpaceOnUse">
          <rect x={M.tank.x + 2} y={M.tank.y} width={M.tank.w - 4} height={M.tank.bottom - M.tank.y - 2} rx="5" />
        </clipPath>
      </defs>

      <g className="bxi-m-art" clipPath={`url(#${idp}-wipe)`}>
        {/* Water tank — its top shows behind the cup tray */}
        <rect className="bxi-m-glass" x="222" y="86" width="116" height="16" rx="3" />

        {/* Bean hopper (A) — lifts off as a unit */}
        <g className="bxi-m-hopper" style={{ opacity: hopper ? 1 : 0 }}>
          <path className="bxi-m-glass" d="M62 30 L158 30 L146 92 L74 92 Z" />
          <g clipPath={`url(#${idp}-hopper)`}>
            <rect className="bxi-m-beans" x="60" y={beanTop} width="100" height={M.hopper.base - beanTop + 2} />
            <g className="bxi-m-beantex" style={{ opacity: beans > 0.05 ? 1 : 0 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <ellipse key={i} cx={78 + i * 13} cy={Math.max(beanTop + 7, 40)} rx="4" ry="2.6" className="bxi-m-bean" />
              ))}
            </g>
          </g>
          <rect className="bxi-m-dark" x="56" y="18" width="108" height="14" rx="6" />
          <rect className="bxi-m-steel" x="70" y="91" width="80" height="11" rx="3" />
          <path className="bxi-m-glyph" d="M107 94.5 l3 3.5 l3 -3.5" />
        </g>

        {/* Cup-warming tray + main housing */}
        <rect className="bxi-m-steel" x="46" y="100" width="308" height="10" rx="4" />
        <rect className="bxi-m-body" x="50" y="108" width="300" height="216" rx="12" />
        <rect className="bxi-m-panel" x="58" y="116" width="284" height="80" rx="8" />
        <rect className="bxi-m-bay" x="164" y="206" width="176" height="118" rx="6" />

        {/* Grind-size dial (left flank, 25 settings) */}
        <g className="bxi-m-grind">
          <rect className="bxi-m-steel" x="40" y="116" width="12" height="34" rx="3" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} className="bxi-m-knurl" x1="41" x2="51" y1={120 + i * 5} y2={120 + i * 5} />
          ))}
        </g>

        {/* Assisted tamp lever (E) — rotates down about its pivot */}
        <g className="bxi-m-lever" transform={`rotate(${-95 * lever} ${M.lever.x} ${M.lever.y})`}>
          <path className="bxi-m-arm" d={`M${M.lever.x} ${M.lever.y} L32 182`} />
          <rect className="bxi-m-dark" x="22" y="164" width="16" height="26" rx="7" transform="rotate(-22 30 177)" />
        </g>
        <circle className="bxi-m-steel" cx={M.lever.x} cy={M.lever.y} r="6" />

        {/* Grinder column: tamp cover (I) over the chute, grinding cradle (J) */}
        <g className="bxi-m-chute">
          <rect className="bxi-m-dark" x="96" y="208" width="32" height="44" rx="4" />
          <ellipse className="bxi-m-steel" cx="112" cy="250" rx="16" ry="4" />
        </g>
        <g className="bxi-m-cover" style={{ opacity: tampCover ? 1 : 0 }}>
          <rect className="bxi-m-steel" x="80" y="202" width="64" height="60" rx="12" />
          <path className="bxi-m-sheen" d="M90 210 v42" />
        </g>
        <rect className="bxi-m-dark" x="74" y="262" width="76" height="22" rx="4" />
        <rect className="bxi-m-bay" x="90" y="266" width="44" height="6" rx="2" />

        {/* Grinder controls: DOSE (B), tamp light (C), auto/manual (D), dose level (F), manual dose dial (G) */}
        <Button id="dose" {...M.buttons.dose} state={leds.dose} glyph={<circle className="bxi-m-glyph" cx="84" cy="140" r="2.6" />} />
        <g className={ledClass(leds.tamp)} data-led="tamp">
          <rect className="bxi-led-off" x="102" y="125" width="8" height="5" rx="2" />
          <rect className="bxi-led-glow" x="102" y="125" width="8" height="5" rx="2" />
        </g>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} className={i === 2 ? 'bxi-m-level bxi-m-level--ideal' : 'bxi-m-level'} x="116" y={124 + i * 7} width="9" height="4.5" rx="1.5" />
        ))}
        <circle className="bxi-m-led-dim" cx="102" cy="160" r="1.8" />
        <circle className="bxi-m-led-dim" cx="102" cy="167" r="1.8" />
        <circle className="bxi-m-steel" cx="120" cy="182" r="9" />
        <path className="bxi-m-glyph" d="M120 175 v5" />

        {/* FILTER (K) */}
        <Button id="filter" {...M.buttons.filter} state={leds.filter} glyph={<path className="bxi-m-glyph" d="M173 131h6M174 133.5h4" />} />

        {/* Espresso extraction pressure gauge (L) */}
        <g className="bxi-m-gauge">
          <circle className="bxi-m-steel" cx={M.gauge.x} cy={M.gauge.y} r="33" />
          <circle className="bxi-m-face" cx={M.gauge.x} cy={M.gauge.y} r="27.5" />
          <path
            className="bxi-m-zone"
            d={arc(M.gauge.x, M.gauge.y, 22, 0, 60)}
          />
          {Array.from({ length: 13 }, (_, i) => {
            const a = ((-120 + i * 20 - 90) * Math.PI) / 180;
            const r1 = i % 3 === 0 ? 19 : 22;
            return (
              <line
                key={i}
                className="bxi-m-tick"
                x1={M.gauge.x + Math.cos(a) * r1}
                y1={M.gauge.y + Math.sin(a) * r1}
                x2={M.gauge.x + Math.cos(a) * 25.5}
                y2={M.gauge.y + Math.sin(a) * 25.5}
              />
            );
          })}
          <g transform={`translate(${M.gauge.x} ${M.gauge.y})`}>
            <g className="bxi-m-needle" transform={`rotate(${gaugeAngle(gauge)})`}>
              <path className="bxi-m-needlepath" d="M-1.7 4 L0 -23 L1.7 4 Z" />
            </g>
            <circle className="bxi-m-dark" r="3.6" />
          </g>
        </g>

        {/* 1 CUP · 2 CUP (N), POWER (O) */}
        <Button id="one" {...M.buttons.one} state={leds.one} glyph={cup(276, 136)} />
        <Button id="two" {...M.buttons.two} state={leds.two} glyph={<>{cup(299.4, 136)}{cup(304.6, 136)}</>} />
        <Button
          id="power"
          {...M.buttons.power}
          state={leds.power}
          glyph={<path className="bxi-m-glyph" d="M325.6 133.2a3.6 3.6 0 1 0 4.8 0M328 131.6v3.6" />}
        />

        {/* Maintenance (CLEAN/DESCALE, Q) and water/steam/heating (R) lights */}
        {['clean', 'steam'].map((id) => (
          <g key={id} className={ledClass(leds[id])} data-led={id}>
            <rect className="bxi-led-off" x={M.leds[id].x - 6} y={M.leds[id].y - 2.6} width="12" height="5.2" rx="2.6" />
            <rect className="bxi-led-glow" x={M.leds[id].x - 6} y={M.leds[id].y - 2.6} width="12" height="5.2" rx="2.6" />
          </g>
        ))}

        {/* Steam / hot water dial (P) on the right flank */}
        <g className="bxi-m-dialgroup">
          <circle className="bxi-m-steel" cx={M.dial.x} cy={M.dial.y} r="12" />
          <circle className="bxi-m-face" cx={M.dial.x} cy={M.dial.y} r="8" />
          <g className="bxi-m-dial" transform={`rotate(${DIAL_ANGLE[dial] ?? 0} ${M.dial.x} ${M.dial.y})`}>
            <path className="bxi-m-pointer" d={`M${M.dial.x} ${M.dial.y - 10} v8`} />
          </g>
        </g>

        {/* Group head (H) with the shower screen */}
        <g className="bxi-m-group">
          <rect className="bxi-m-steel" x="200" y="196" width="52" height="15" rx="3" />
          <rect className="bxi-m-steel" x="204" y="209" width="44" height="7" rx="2" />
          <g className="bxi-m-screen">
            <ellipse className="bxi-m-screenface" cx="226" cy="216.5" rx="20" ry="3" />
            <circle className="bxi-m-dark" cx="226" cy="216.5" r="1.3" />
          </g>
        </g>

        {/* Hot water outlet (S) */}
        <g className="bxi-m-outlet">
          <rect className="bxi-m-steel" x="268" y="198" width="12" height="15" rx="2" />
          <rect className="bxi-m-steel" x="271" y="212" width="6" height="9" rx="1.5" />
        </g>

        {/* Steam wand (U) — 360° swivel, tip at the end */}
        <g className="bxi-m-wand">
          <path className="bxi-m-tube" d="M312 208 L329 301" />
          <path className="bxi-m-grip" d="M314.5 216 L319.5 244" />
          <circle className="bxi-m-steel" cx={M.wandPivot.x} cy={M.wandPivot.y} r="5.5" />
          <g className="bxi-m-tip" transform="rotate(-10.4 330.5 306)">
            <rect className="bxi-m-steel" x="326.5" y="299" width="8" height="13" rx="2.4" />
            <circle className="bxi-m-hole" cx="328.8" cy="310.6" r="0.9" />
            <circle className="bxi-m-hole" cx="330.5" cy="311.2" r="0.9" />
            <circle className="bxi-m-hole" cx="332.2" cy="310.6" r="0.9" />
          </g>
        </g>

        {/* Drip tray (V): grid, front, full indicator window */}
        <g className="bxi-m-tray">
          <rect className="bxi-m-steel" x="168" y="313" width="168" height="6" rx="2" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} className="bxi-m-slot" x1={178 + i * 13} x2={178 + i * 13} y1="314.5" y2="317.5" />
          ))}
          <rect className="bxi-m-tray-front" x="54" y="322" width="292" height="30" rx="7" />
          <rect className="bxi-m-window" x="302" y="328" width="22" height="18" rx="3" />
          <rect className="bxi-m-float" x="306" y="338" width="14" height="5" rx="2" />
        </g>
        <rect className="bxi-m-dark" x="70" y="352" width="30" height="6" rx="2" />
        <rect className="bxi-m-dark" x="300" y="352" width="30" height="6" rx="2" />

        {/* Portafilter (T) — in the group, the cradle, or out */}
        <g
          className="bxi-m-pf"
          transform={`translate(${pf.x} ${pf.y})`}
          style={{ opacity: portafilter === 'out' ? 0 : 1 }}
        >
          <rect className="bxi-m-steel" x="202" y="216" width="48" height="5" rx="2" />
          <path className="bxi-m-steel" d="M206 220 L246 220 L240 234 L212 234 Z" />
          <rect className="bxi-m-steel" x="214" y="233" width="6" height="7" rx="1.5" />
          <rect className="bxi-m-steel" x="232" y="233" width="6" height="7" rx="1.5" />
          <circle className="bxi-m-dark" cx="226" cy="228" r="7.5" />
          <circle className="bxi-m-steel" cx="226" cy="228" r="3" />
        </g>

        {/* Tank side-inset (M): translucent, live level, filter on its post */}
        {showTank && (
          <g className="bxi-m-tankinset">
            <text className="bxi-m-caption" x={M.tank.x + M.tank.w / 2} y="108" textAnchor="middle">
              TANK · SIDE
            </text>
            <rect className="bxi-m-glass" x={M.tank.x} y={M.tank.y} width={M.tank.w} height={M.tank.bottom - M.tank.y} rx="6" />
            <g clipPath={`url(#${idp}-tank)`}>
              <rect
                className="bxi-m-water bxi-m-tankwater"
                x={M.tank.x}
                y={waterY}
                width={M.tank.w}
                height={M.tank.bottom - waterY + 2}
              />
            </g>
            <line className="bxi-m-mark" x1={M.tank.x + M.tank.w - 14} x2={M.tank.x + M.tank.w + 4} y1={M.tank.max} y2={M.tank.max} />
            <text className="bxi-m-caption" x={M.tank.x + M.tank.w + 6} y={M.tank.max + 2.5}>MAX</text>
            <line className="bxi-m-mark" x1={M.tank.x + M.tank.w - 14} x2={M.tank.x + M.tank.w + 4} y1={M.tank.min} y2={M.tank.min} />
            <text className="bxi-m-caption" x={M.tank.x + M.tank.w + 6} y={M.tank.min + 2.5}>MIN</text>
            <rect className="bxi-m-steel" x="426" y="282" width="8" height="26" rx="2" />
            <g className="bxi-m-filter" style={{ opacity: filterInTank ? 1 : 0 }}>
              <rect className="bxi-m-dark" x="419" y="236" width="22" height="48" rx="4" />
              <circle className="bxi-m-face" cx="430" cy="232" r="8" />
              <path className="bxi-m-glyph" d="M430 226 v5" />
            </g>
          </g>
        )}
      </g>

      {hlShape && <g className="bxi-m-hl" aria-hidden="true">{hlShape}</g>}
      {pfHl && (
        <rect className="bxi-m-hl" x={198 + pf.x} y={212 + pf.y} width="56" height="32" rx="8" aria-hidden="true" />
      )}

      {/* Boot line-draw: stroke twins, hidden in the finished frame */}
      {trace && (
        <g className="bxi-m-traces" aria-hidden="true">
          <rect className="bxi-m-trace" x="50" y="108" width="300" height="216" rx="12" />
          <path className="bxi-m-trace" d="M62 30 L158 30 L146 92 L74 92 Z" />
          <rect className="bxi-m-trace" x="56" y="18" width="108" height="14" rx="6" />
          <rect className="bxi-m-trace" x="164" y="206" width="176" height="118" rx="6" />
          <circle className="bxi-m-trace" cx={M.gauge.x} cy={M.gauge.y} r="33" />
          <rect className="bxi-m-trace" x="80" y="202" width="64" height="60" rx="12" />
          <rect className="bxi-m-trace" x="200" y="196" width="52" height="15" rx="3" />
          <path className="bxi-m-trace" d="M312 208 L329 301" />
          <rect className="bxi-m-trace" x="54" y="322" width="292" height="30" rx="7" />
          <circle className="bxi-m-trace" cx={M.dial.x} cy={M.dial.y} r="12" />
        </g>
      )}
    </g>
  );
}

/** SVG arc path on a circle, angles in degrees clockwise from 12 o'clock. */
function arc(cx, cy, r, a0, a1) {
  const p = (a) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(cx + Math.cos(t) * r).toFixed(2)} ${(cy + Math.sin(t) * r).toFixed(2)}`;
  };
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

export default function Machine({ label = 'Breville Barista Express Impress, front view', className = '', children, viewBox, ...props }) {
  const vb = viewBox || `0 0 ${props.showTank ? M.wInset : M.w} ${M.h}`;
  return (
    <svg className={`bxi-machine ${className}`} viewBox={vb} role="img" aria-label={label}>
      <title>{label}</title>
      <MachineArt {...props} />
      {children}
    </svg>
  );
}
