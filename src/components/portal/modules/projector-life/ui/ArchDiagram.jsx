import { useRef } from 'react';
import { useWidth } from './store';

/* PROJECTOR LIFE — architecture diagram (Plan tab). Inline SVG on theme
   tokens. The content pipeline runs left → right (cabinet → interface →
   mapper → projector → room) with light flowing along it; Claude sits above
   as the MCP naturalist; the camera (phase 6) closes the loop underneath.
   Narrow containers get a stacked layout instead of a shrunken wide one. */

function Node({ x, y, w, h, k, t, s, tone = 'plain', phase }) {
  return (
    <g className={`pjl-arch__node pjl-arch__node--${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx="4" />
      <text x={x + 12} y={y + 18} className="pjl-arch__k">
        {k}
        {phase && <tspan className="pjl-arch__ph"> · {phase}</tspan>}
      </text>
      <text x={x + 12} y={y + 38} className="pjl-arch__t">
        {t}
      </text>
      {s && (
        <text x={x + 12} y={y + 56} className="pjl-arch__s">
          {s}
        </text>
      )}
    </g>
  );
}

function Flow({ d, dashed, label, lx, ly, anchor = 'middle' }) {
  return (
    <g className={`pjl-arch__flow${dashed ? ' is-dashed' : ''}`}>
      <path d={d} className="pjl-arch__line" markerEnd="url(#pjl-arrow)" />
      {!dashed && <path d={d} className="pjl-arch__pulse" />}
      {label && (
        <text x={lx} y={ly} textAnchor={anchor} className="pjl-arch__lbl">
          {label}
        </text>
      )}
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="pjl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10Z" className="pjl-arch__head" />
      </marker>
    </defs>
  );
}

function Wide() {
  const W = 142;
  const H = 68;
  const Y = 132;
  const xs = [8, 172, 336, 500, 664];
  return (
    <svg viewBox="0 0 820 330" className="pjl-arch__svg" role="img" aria-label="Architecture: the cabinet's sims feed a region-content interface, his mapper warps each region, projectors throw it onto the room; Claude drives regions and life over MCP; a camera calibrates the mapper later.">
      <Defs />
      <Node x={xs[0]} y={Y} w={W} h={H} k="my repo" t="Specimen Cabinet" s="sims as a library" phase="P1" />
      <Node x={xs[1]} y={Y} w={W} h={H} k="the join" t="RegionContent" s="init · step · render" tone="accent" phase="P0" />
      <Node x={xs[2]} y={Y} w={W} h={H} k="his repo" t="Mapper" s="regions · warps" phase="P2" />
      <Node x={xs[3]} y={Y} w={W} h={H} k="hardware" t="Projector 1–3" s="throw · black level" />
      <Node x={xs[4]} y={Y} w={W} h={H} k="the room" t="The She'd" s="18 habitats" tone="room" />
      {[0, 1, 2, 3].map((i) => (
        <Flow key={i} d={`M ${xs[i] + W} ${Y + H / 2} L ${xs[i + 1] - 4} ${Y + H / 2}`} />
      ))}
      {/* what crosses each arrow: labelled under the gap, tied to it by a tick */}
      {['sim / region', 'texture', 'pre-warp', 'light'].map((l, i) => {
        const gx = (xs[i] + W + xs[i + 1]) / 2;
        return (
          <g key={l}>
            <line x1={gx} y1={Y + H / 2 + 4} x2={gx} y2={Y + H + 4} className="pjl-arch__tick" />
            <text x={gx} y={Y + H + 16} textAnchor="middle" className="pjl-arch__lbl">
              {l}
            </text>
          </g>
        );
      })}

      <Node x={290} y={8} w={240} h={H} k="mcp" t="Claude, the naturalist" s="describe · set life · census · name" tone="claude" phase="P1–P5" />
      <Flow d={`M 330 ${8 + H} C 330 105, ${xs[1] + W / 2} 100, ${xs[1] + W / 2} ${Y - 4}`} label="set_region_life · seed_region" lx={196} ly={104} />
      <Flow d={`M 490 ${8 + H} C 490 105, ${xs[2] + W / 2} 100, ${xs[2] + W / 2} ${Y - 4}`} label="describe_region" lx={470} ly={112} anchor="start" />
      <Flow d={`M ${xs[4] + W / 2} ${Y - 4} C ${xs[4] + W / 2} 60, 600 42, 534 42`} dashed label="snapshot · census" lx={722} ly={104} anchor="end" />

      <Node x={500} y={258} w={W} h={H - 6} k="phase 6" t="Camera" s="shadows · calibrate" tone="later" />
      <Flow d={`M ${xs[4] + W / 2} ${Y + H + 4} C ${xs[4] + W / 2} 290, 680 290, ${500 + W + 4} 290`} dashed />
      <Flow d={`M 500 290 C 420 290, ${xs[2] + W / 2} 280, ${xs[2] + W / 2} ${Y + H + 4}`} dashed label="calibrate_room" lx={440} ly={312} />
    </svg>
  );
}

function Tall() {
  const W = 236;
  const H = 62;
  const X = 62;
  const ys = [92, 184, 276, 368, 460];
  const steps = [
    { k: 'my repo', t: 'Specimen Cabinet', s: 'sims as a library', phase: 'P1' },
    { k: 'the join', t: 'RegionContent', s: 'init · step · render', tone: 'accent', phase: 'P0' },
    { k: 'his repo', t: 'Mapper', s: 'regions · warps · masks', phase: 'P2' },
    { k: 'hardware', t: 'Projector 1–3', s: 'throw · black level' },
    { k: 'the room', t: "The She'd", s: '18 habitats', tone: 'room' },
  ];
  const labels = ['sim / region', 'texture', 'pre-warp', 'light'];
  return (
    <svg viewBox="0 0 360 560" className="pjl-arch__svg" role="img" aria-label="Architecture, stacked: cabinet, region-content interface, mapper, projector, room; Claude drives it over MCP.">
      <Defs />
      <Node x={62} y={4} w={W} h={H} k="mcp" t="Claude, the naturalist" s="set life · describe · census" tone="claude" phase="P1–P5" />
      {steps.map((s, i) => (
        <Node key={s.t} x={X} y={ys[i]} w={W} h={H} {...s} />
      ))}
      {labels.map((l, i) => (
        <Flow key={l} d={`M ${X + W / 2} ${ys[i] + H} L ${X + W / 2} ${ys[i + 1] - 4}`} label={l} lx={X + W / 2 + 10} ly={ys[i] + H + 19} anchor="start" />
      ))}
      <Flow d={`M 62 ${4 + H / 2} C 20 ${4 + H / 2}, 20 ${ys[1] + H / 2}, ${X - 4} ${ys[1] + H / 2}`} label="set_region_life" lx={6} ly={ys[1] - 8} anchor="start" />
      <Flow d={`M 298 ${4 + H / 2} C 345 ${4 + H / 2}, 345 ${ys[2] + H / 2}, ${X + W + 4} ${ys[2] + H / 2}`} label="describe_region" lx={354} ly={ys[1] + 30} anchor="end" />
    </svg>
  );
}

export default function ArchDiagram() {
  const ref = useRef(null);
  const w = useWidth(ref);
  return (
    <figure ref={ref} className="pjl-arch">
      {w > 0 && w < 620 ? <Tall /> : <Wide />}
    </figure>
  );
}
