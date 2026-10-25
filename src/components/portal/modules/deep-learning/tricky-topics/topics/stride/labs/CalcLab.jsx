import { useRef, useState } from 'react';
import { Stage, Switch, MLine } from '../../../stage';
import { Scrub } from '../../../svgParts';
import { useWidth } from '../../../useWidth';
import { useStudy } from '../../../context';
import { convOut, samePad } from '../../../maths/strideRules.js';
import './stride.css';

/* Step 4 · the stride calculator: the rule and the picture side by side, on
   the slides' own layers. The picture is a ruler of the n inputs: the first
   windows with their hops, the last window, the inputs left over (crossed)
   or the zeros added (hatched). Three controls: which layer (a slide's), its
   stride, its padding — change either and it's your own variant. */

const PRESETS = {
  s18h: { label: 'L3 s18 · height', n: 70, k: 7, s: 1, pad: 'valid', prov: '{s|L3 · slide 18}' },
  s18w: { label: 'L3 s18 · width', n: 120, k: 7, s: 1, pad: 'valid', prov: '{s|L3 · slide 18}' },
  c1: { label: 'AlexNet C1', n: 227, k: 11, s: 4, pad: 'valid', prov: '{s|L3 · slide 39}' },
  s2: { label: 'AlexNet S2', n: 55, k: 3, s: 2, pad: 'valid', prov: '{s|L3 · slide 39}' },
  lc1: { label: 'LeNet-5 C1', n: 32, k: 5, s: 1, pad: 'valid', prov: '{s|L3 · slide 37}' },
  ls2: { label: 'LeNet-5 S2', n: 28, k: 2, s: 2, pad: 'valid', prov: '{s|L3 · slide 37}' },
  l50a: { label: 'L4 s50 · Conv1D 1', n: 56, k: 3, s: 1, pad: 'valid', prov: '{s|L4 · slide 50} {own}' },
  l50b: { label: 'L4 s50 · Conv1D 2', n: 54, k: 3, s: 2, pad: 'valid', prov: '{s|L4 · slide 50} {own}' },
};

export function CalcLab() {
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 600;
  const { printing } = useStudy();
  const [key, setKey] = useState('c1');
  const [sOver, setS] = useState(null);
  const [padOver, setPad] = useState(null);
  const P = PRESETS[printing ? 'c1' : key];
  const s = printing ? P.s : sOver ?? P.s;
  const pad = printing ? P.pad : padOver ?? P.pad;
  const { n, k } = P;
  const own = s !== P.s || pad !== P.pad;
  const out = convOut(n, k, s, pad);
  const zp = pad === 'same' ? samePad(n, k, s) : { left: 0, right: 0 };
  const covered = pad === 'same' ? n : (out - 1) * s + k;
  const left = n - covered;
  const W = narrow ? 340 : 760;
  const H = 150;
  const x0 = 24;
  const x1 = W - 24;
  const tot = n + zp.left + zp.right;
  const X = (i) => x0 + ((i + zp.left) / tot) * (x1 - x0);
  const by = 92;
  const firsts = Array.from({ length: Math.min(3, out) }, (_, i) => i);
  const last = out - 1;
  const pick = (v) => { setKey(v); setS(null); setPad(null); };
  return (
    <Stage
      title="The rule and the picture agree"
      prov={own ? `${P.prov} {own} {beyond}` : `${P.prov} {beyond}`}
      tryThis="Pick a slide’s layer and work its output size on paper. Then change the stride or the padding and predict again."
      caption={pad === 'valid' ? `"valid": the windows must fit inside the ${n} inputs, so ⌊(${n} − ${k}) / ${s}⌋ + 1 = ${out}${left > 0 ? `, and the last ${left} input${left > 1 ? 's are' : ' is'} never read` : ''}.` : `"same": ${zp.left + zp.right} zero${zp.left + zp.right === 1 ? '' : 's'} added so every input is covered; ⌈${n} / ${s}⌉ = ${out}.`}
      challenge={{ text: 'Find AlexNet C1’s 55 and S2’s 27.', done: key === 's2' && !own }}
      maths={
        <>
          <MLine text={pad === 'valid' ? `$\\left\\lfloor \\frac{${n} - ${k}}{${s}} \\right\\rfloor + 1 = \\lfloor ${((n - k) / s).toFixed(2).replace(/\.00$/, '')} \\rfloor + 1 = ${out}$ {beyond}` : `$\\left\\lceil \\frac{${n}}{${s}} \\right\\rceil = \\lceil ${(n / s).toFixed(2).replace(/\.00$/, '')} \\rceil = ${out}$ {beyond}`} />
          <MLine text={'Derived from slide 9’s rule (window $i$ starts at $i \\times s$): the last window must start at most at $n - k$ (“valid”); “same” pads just enough zeros {s|L3 · slide 9}. Checked against TensorFlow for every $n \\le 40$, $k \\le 7$, $s \\le 4$ {own}.'} />
          {!own && <MLine text={`The slide’s size: ${P.label} gives ${out} ${P.prov}.`} />}
        </>
      }
    >
      <div ref={wrap}>
        <label className="dltt-preset">
          <span className="dltt-preset__k">Layer</span>
          <select value={key} onChange={(e) => pick(e.target.value)} aria-label="Which slide's layer">
            {Object.entries(PRESETS).map(([v, p]) => <option key={v} value={v}>{p.label}: n {p.n}, k {p.k}, s {p.s}</option>)}
          </select>
        </label>
        <svg className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n} inputs, kernel ${k}, stride ${s}, ${pad}: ${out} outputs`}>
          <defs>
            <pattern id="calc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" className="dltt-pad-line" /></pattern>
          </defs>
          {zp.left > 0 && <rect x={X(-zp.left)} y={by} width={X(0) - X(-zp.left)} height={18} className="dltt-pad" style={{ fill: 'url(#calc-hatch)' }} />}
          {zp.right > 0 && <rect x={X(n)} y={by} width={X(n + zp.right) - X(n)} height={18} className="dltt-pad" style={{ fill: 'url(#calc-hatch)' }} />}
          <rect x={X(0)} y={by} width={X(covered) - X(0)} height={18} className="dltt-incell" />
          {left > 0 && <rect x={X(covered)} y={by} width={X(n) - X(covered)} height={18} className="dltt-incell dltt-incell--ignored" />}
          {[...firsts, ...(last > 2 ? [last] : [])].map((i) => {
            const a = X(i * s - zp.left);
            const b = X(i * s - zp.left + k);
            const yy = by - 14 - (i === last && last > 2 ? 0 : i * 9);
            return (
              <g key={i}>
                <path d={`M${a + 1} ${by - 2} V${yy} H${b - 1} V${by - 2}`} className="dltt-bracket__path" />
                {i > 0 && i <= 2 && <path d={`M${X((i - 1) * s - zp.left)} ${by - 40} Q ${(X((i - 1) * s - zp.left) + a) / 2} ${by - 56} ${a} ${by - 40}`} className="dltt-hop" />}
              </g>
            );
          })}
          {last > 3 && <text x={(X(2 * s - zp.left + k) + X(last * s - zp.left)) / 2} y={by - 20} textAnchor="middle" className="dltt-t dltt-t--s">…</text>}
          <text x={x0} y={by + 34} className="dltt-t dltt-t--xs">0</text>
          <text x={X(n)} y={by + 34} textAnchor="end" className="dltt-t dltt-t--xs">{n} inputs</text>
          <text x={W / 2} y={30} textAnchor="middle" className="dltt-counter" style={{ fontSize: 30 }}>{n} → {out}</text>
          <text x={W / 2} y={48} textAnchor="middle" className="dltt-t dltt-t--xs">kernel {k} · <tspan className="dltt-t--jump">stride {s}</tspan> · "{pad}"</text>
        </svg>
        <div className="dltt-calc__ctl">
          <Switch label="Padding" value={pad} onChange={setPad} options={[{ value: 'valid', label: '"valid"' }, { value: 'same', label: '"same"' }]} />
          <svg className="dltt-svg dltt-ctl" viewBox={`0 0 ${W} 60`} role="group" aria-label="Stride">
            <text x={20} y={14} className="dltt-t dltt-t--s dltt-t--jump">stride s</text>
            <Scrub x0={30} x1={W - 30} y={38} value={s} min={1} max={4} step={1} onChange={setS} label="Stride" ticks={[1, 2, 3, 4]} />
          </svg>
        </div>
      </div>
    </Stage>
  );
}
