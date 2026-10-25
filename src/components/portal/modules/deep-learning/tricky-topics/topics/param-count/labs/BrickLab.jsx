import { useRef, useState } from 'react';
import { Stage, Switch, MLine, MEq } from '../../../stage';
import { Scrub, Box3, Bead, Counter } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { layerCounts } from '../../../maths/paramRules';
import './param.css';

/* Step 6 · the filter brick. One filter is a k × k × 3 brick of weights
   plus one bias bead; the layer is `filters` copies. The image (left) can
   be any size: the count doesn't move — that's the aha. Under it, L3 slide
   22's comparison on a log scale: the conv layer vs a dense layer with one
   neuron per pixel, each wired to every input (h·w neurons × h·w·3 inputs,
   the footnote's weights-only count), which explodes as the image grows.
   Controls: kernel size, filters, image size. Opens on slide 22's layer. */

const SIZES = { mnist: [28, 28], s18: [70, 120], s22: [150, 100], big: [224, 224] };
const SIZE_LABEL = { mnist: '28 × 28', s18: '70 × 120', s22: '150 × 100', big: '224 × 224' };
const fmt = (v) => Math.round(v).toLocaleString('en-US');
// big counts the way slide 22 writes them: “675 million”
const fmtBig = (v) => (v >= 1e6 ? `${Number((v / 1e6).toPrecision(4))} million` : fmt(v));
const C_IN = 3;

export function BrickLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [kRaw, setK] = useState(5);
  const [fRaw, setF] = useState(200);
  const [sizeRaw, setSize] = useState('s22');
  const k = printing ? 5 : kRaw;
  const filters = printing ? 200 : fRaw;
  const sizeKey = printing ? 's22' : sizeRaw;
  const [ih, iw] = SIZES[sizeKey];
  const conv = layerCounts({ t: 'conv2d', filters, k, pad: 'same' }, [[ih, iw, C_IN]]).total;
  const dense = ih * iw * (ih * iw * C_IN); // L3 slide 22's footnote: neurons × inputs, weights only
  const W = narrow ? 360 : 780;
  const H = narrow ? 300 : 250;

  // the image slab, scaled so 224 fills the space
  const sc = (narrow ? 90 : 120) / 224;
  const slab = { x: 24, y: narrow ? 30 : 40, w: iw * sc, h: ih * sc };
  const bx = narrow ? 170 : 300;
  const bs = 9 * k;
  const stack = Math.min(6, Math.max(1, Math.round(Math.log2(filters + 1))));
  const logX = (v) => (narrow ? 20 : 60) + (Math.log10(Math.max(1, v)) / 12) * (W - (narrow ? 40 : 120));
  const ly = narrow ? 228 : 190;
  return (
    <Stage
      title="A filter is a brick plus a bead, and the image size doesn’t matter"
      prov="{s|L3 · slides 19, 22}"
      tryThis="Change the image size first and watch the count: does it move? Then change the kernel and the filters."
      caption="Every position of the image reuses the same filters, so only $k$, the input channels and the number of filters enter the count. The dense layer’s bar is slide 22’s footnote: one neuron per pixel, each wired to every input."
      challenge={{ text: 'Make a layer with exactly 4,736 parameters (slide 19’s Conv2D(32, 7)).', done: conv === 4736 }}
      maths={
        <>
          <MEq tex={'(k \\times k \\times c_{\\text{in}} + 1) \\times \\text{filters}'} />
          <MLine text={`Here: $(${k} \\times ${k} \\times ${C_IN} + 1) \\times ${filters} = ${conv.toLocaleString('en-US')}$, for a ${SIZE_LABEL[sizeKey]} image or any other.`} />
          <MLine text="Slide 22: $(5 \times 5 \times 3 + 1) \times 200 = 15{,}200$; a dense layer “would have $150^2 \times 100^2 \times 3 = 675$ million” {s|L3 · slide 22}." />
          <MLine text={`This image’s dense equivalent: $(${ih} \\times ${iw}) \\times (${ih} \\times ${iw} \\times 3)$ = ${fmtBig(dense)} weights (the footnote’s formula, biases left out) {own}.`} />
        </>
      }
    >
      <div ref={wrap}>
        <Switch label="Image size" value={sizeKey} onChange={setSize} options={Object.keys(SIZES).map((v) => ({ value: v, label: SIZE_LABEL[v] }))} />
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A ${ih} by ${iw} RGB image; ${filters} filters of ${k} by ${k} by 3 plus a bias each: ${conv} parameters; a dense layer would need ${fmt(dense)}`}>
          <Box3 x={slab.x} y={slab.y + 10} w={slab.w} h={slab.h} d={14} axes={{ w: { role: 'wd', label: iw }, h: { role: 'h', label: ih }, d: { role: 'c', label: 3 } }} />
          <text x={slab.x} y={slab.y - 4} className="dltt-t dltt-t--xs">the image</text>
          {/* the filters: a fanned stack of bricks, each with its bias bead */}
          {Array.from({ length: stack }, (_, i) => (
            <g key={i} className="dltt-brick" style={{ opacity: i === stack - 1 ? 1 : 0.35 + (0.5 * i) / stack }}>
              <Box3 x={bx + i * 8} y={(narrow ? 70 : 80) - i * 6} w={bs} h={bs} d={12} axes={i === stack - 1 ? { w: { role: 'wd', label: k }, h: { role: 'h', label: k }, d: { role: 'c', label: 3 } } : {}} className="dltt-brick__box" />
              <Bead x={bx + i * 8 + bs + 16} y={(narrow ? 70 : 80) - i * 6 + bs / 2} r={5} />
            </g>
          ))}
          <text x={bx} y={(narrow ? 70 : 80) + bs + 34} className="dltt-t dltt-t--s">× {filters} filter{filters > 1 ? 's' : ''}</text>
          <g transform={`translate(${narrow ? W - 64 : W - 110} ${narrow ? 120 : 105})`}>
            <Counter x={0} y={0} value={conv} size={narrow ? 26 : 38} label={`${conv} parameters`} />
            <text x={0} y={20} textAnchor="middle" className="dltt-t dltt-t--s">parameters</text>
          </g>
          {/* slide 22's comparison on a log scale */}
          <line x1={logX(1)} y1={ly + 28} x2={logX(1e12)} y2={ly + 28} className="dltt-ax" />
          {[0, 3, 6, 9, 12].map((e) => (
            <text key={e} x={logX(10 ** e)} y={ly + 42} textAnchor="middle" className="dltt-t dltt-t--xs dltt-t--m">{e === 0 ? '1' : `10${['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰', '¹¹', '¹²'][e]}`}</text>
          ))}
          <rect x={logX(1)} y={ly - 4} width={logX(conv) - logX(1)} height={10} rx={2} className="dltt-vbar dltt-vbar--w" />
          <text x={logX(conv) + 6} y={ly + 5} className="dltt-t dltt-t--xs dltt-t--m">conv {fmt(conv)}</text>
          <rect x={logX(1)} y={ly + 10} width={logX(dense) - logX(1)} height={10} rx={2} className="dltt-vbar dltt-vbar--nt" />
          <text x={narrow ? logX(1) : Math.min(logX(dense) + 6, W - 150)} y={narrow ? ly + 58 : ly + 19} className="dltt-t dltt-t--xs dltt-t--m">dense {fmtBig(dense)}</text>
        </svg>
        <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} ${narrow ? 120 : 64}`} role="group" aria-label="Kernel size and number of filters">
          <text x={20} y={16} className="dltt-t dltt-t--s">kernel k × k</text>
          <Scrub x0={30} x1={narrow ? W - 30 : W / 2 - 40} y={40} value={k} min={1} max={7} step={1} onChange={setK} label="Kernel size" ticks={[1, 3, 5, 7]} />
          <text x={narrow ? 20 : W / 2 + 10} y={narrow ? 76 : 16} className="dltt-t dltt-t--s">filters</text>
          <Scrub x0={narrow ? 30 : W / 2 + 20} x1={W - 30} y={narrow ? 100 : 40} value={filters} min={1} max={256} step={1} big={16} onChange={setF} label="Number of filters" ticks={[1, 32, 64, 128, 200, 256]} />
        </svg>
      </div>
    </Stage>
  );
}
