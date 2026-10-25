import { useRef } from 'react';
import { useHeroBeats } from '../../../hero';
import { useWidth } from '../../../useWidth';
import TensorGlyph from '../../../TensorGlyph';
import './shapes.css';

/* The opener's hero: an image as a box of numbers. Height and width light
   up (70 rows, 120 columns), the colour channels give it depth (3), a second
   image stacks behind (a batch of 2), and the tuple assembles in the axis
   colours: (2, 70, 120, 3) — L3 slide 17's TensorShape. */

const BEATS = 5;

export function ShapesHero({ run }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const narrow = useWidth(wrap) < 520;
  const beat = useHeroBeats(BEATS, { run, ref, ms: 1000 });
  const shape = beat >= 2 ? [70, 120, 3] : [70, 120, 1];
  const lit = beat === 0 ? 'h' : beat === 1 ? 'w' : beat === 2 ? 'c' : beat === 3 ? 'batch' : null;
  const W = narrow ? 340 : 640;
  const H = narrow ? 290 : 220;
  const part = (i) => (beat >= i ? '' : ' dltt-hide');
  return (
    <div ref={wrap}>
      <svg ref={ref} className="dltt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two RGB images of 70 rows by 120 columns: the shape (2, 70, 120, 3)">
        <TensorGlyph x={narrow ? 60 : 50} y={narrow ? 10 : 18} shape={shape} kind="image" batch={beat >= 3 ? 2 : undefined} fit={narrow ? [240, 170] : [300, 190]} lit={lit} />
        <g transform={`translate(${narrow ? W / 2 : 470} ${narrow ? 222 : 96})`}>
          <text x={0} y={0} textAnchor="middle" className="dltt-t dltt-t--m dltt-shero__tuple" style={{ fontSize: narrow ? 22 : 26 }}>
            (<tspan className={`dltt-axt--batch dltt-fade${part(3)}`}>2</tspan>
            <tspan className={`dltt-fade${part(3)}`}>, </tspan>
            <tspan className="dltt-axt--h">70</tspan>, <tspan className={`dltt-axt--wd dltt-fade${part(1)}`}>120</tspan>
            <tspan className={`dltt-fade${part(2)}`}>, </tspan>
            <tspan className={`dltt-axt--c dltt-fade${part(2)}`}>3</tspan>)
          </text>
          <text x={0} y={narrow ? 26 : 30} textAnchor="middle" className="dltt-t dltt-t--xs">
            <tspan className="dltt-axt--batch">batch</tspan> · <tspan className="dltt-axt--h">height</tspan> · <tspan className="dltt-axt--wd">width</tspan> · <tspan className="dltt-axt--c">channels</tspan>
          </text>
        </g>
      </svg>
    </div>
  );
}
