import { useScene } from '../sceneKit';
import { Brush, SteamTool, Disc, Tablet, Sachet, AllenKey, Razor, FilterCart, Basket, Portafilter, Jug, Bowl, Bubbles, TurnArrow, Caption, Place } from '../parts';
import Stage from '../Stage';

/* ============================================================================
   SCENE · KIT IN USE — each box item doing its one job   (IB p.8 and uses)
   ----------------------------------------------------------------------------
   brush   sweeps grinds off a burr          tool    pin pokes, spanner turns
   disc    basket → disc → tablet stack      tablets dissolves with a fizz
   sachet  powder into 1 L, dissolves        allen   short end in, anti-clockwise
   razor   trims an over-dosed puck          filter  date dial forward 3 months
   ========================================================================== */

const LABEL = {
  brush: 'The brush sweeps grinds off the lower burr.',
  tool: 'The pin clears a hole in the wand tip; the spanner end unscrews it.',
  disc: 'The 1 CUP basket, then the cleaning disc, then a tablet.',
  tablets: 'A tablet dissolving in hot water.',
  sachet: 'Descaling powder dissolving in a litre of water.',
  allen: 'The Allen key turning the shower-screen screw anti-clockwise.',
  razor: 'The Razor trimming an over-dosed puck level.',
  filter: 'The filter’s date dial turning three months ahead.',
};

function build(item) {
  return (tl, q) => {
    const a = q('.bxi-kt-a');
    const b = q('.bxi-kt-b');
    const c = q('.bxi-kt-c');
    switch (item) {
      case 'brush':
        tl.set(a, { x: 0, y: 0 }, 0);
        tl.set(c, { opacity: 1, x: 0, y: 0 }, 0);
        [[-24, -6], [0, -12], [24, -6], [0, 0], [-16, -4], [16, -4], [0, 0]].forEach(([x, y], i) =>
          tl.to(a, { x, y, duration: 0.25, ease: 'sine.inOut' }, 0.2 + i * 0.25),
        );
        tl.to(c, { x: (i) => (i % 2 ? 40 : -40), y: (i) => -20 - i * 4, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.4);
        break;
      case 'tool':
        tl.set(a, { x: 0, y: 30, rotation: 0 }, 0);
        tl.set(b, { opacity: 0 }, 0);
        tl.to(a, { y: 0, duration: 0.5 }, 0.2);
        tl.to(a, { y: -6, duration: 0.15, yoyo: true, repeat: 3 }, 0.8);
        tl.to(a, { y: -63, duration: 0.5 }, 1.6);
        tl.to(b, { opacity: 1, duration: 0.2 }, 2.1);
        tl.to(a, { rotation: -140, svgOrigin: '160 87', duration: 1 }, 2.2);
        break;
      case 'disc':
        tl.fromTo(a, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 0.2);
        tl.fromTo(b, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 0.8);
        tl.fromTo(c, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, 1.4);
        break;
      case 'tablets':
        tl.fromTo(a, { y: -70, opacity: 1, scale: 1, transformOrigin: '50% 50%' }, { y: 0, duration: 0.6, ease: 'power2.in' }, 0.2);
        tl.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8);
        tl.to(a, { scale: 0.05, opacity: 0, duration: 1.6 }, 1);
        break;
      case 'sachet':
        tl.fromTo(a, { rotation: 0, transformOrigin: '50% 0%' }, { rotation: -110, duration: 0.6 }, 0.2);
        tl.fromTo(b, { opacity: 0, y: -10 }, { opacity: 1, y: 22, duration: 0.7, stagger: 0.06, ease: 'power1.in' }, 0.7);
        tl.to(b, { opacity: 0, duration: 0.5, stagger: 0.04 }, 1.5);
        tl.fromTo(c, { opacity: 0, rotation: 0, transformOrigin: '50% 50%' }, { opacity: 1, rotation: 540, duration: 1.2 }, 1.5);
        tl.to(a, { rotation: 0, duration: 0.4 }, 1.6);
        break;
      case 'allen':
        tl.fromTo(a, { rotation: 0, svgOrigin: '160 100' }, { rotation: -540, svgOrigin: '160 100', duration: 2, ease: 'power1.inOut' }, 0.3);
        tl.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.2);
        break;
      case 'razor':
        tl.set(b, { attr: { ry: 9 } }, 0);
        tl.fromTo(a, { x: -60, y: -20, rotation: 0 }, { x: 0, y: 0, duration: 0.5 }, 0.2);
        tl.to(a, { rotation: 12, svgOrigin: '160 84', duration: 0.25, yoyo: true, repeat: 5 }, 0.8);
        tl.to(b, { attr: { ry: 2.5 }, duration: 1.4 }, 0.8);
        tl.to(c, { opacity: 1, y: 20, duration: 0.6, stagger: 0.1 }, 1.2);
        break;
      case 'filter':
        tl.fromTo(a, { rotation: 0 }, { rotation: -90, duration: 1.2, ease: 'power2.inOut' }, 0.3);
        tl.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.4);
        break;
      default:
        break;
    }
  };
}

export default function SceneKit({ item = 'brush' }) {
  const api = useScene(build(item), { name: `kit-${item}`, rebuild: item });

  return (
    <Stage {...api} name={`In use · ${item}`} viewBox="0 0 320 180" label={LABEL[item]}>
      {item === 'brush' && (
        <>
          <ellipse className="bxi-s-dark" cx="160" cy="110" rx="70" ry="18" />
          <ellipse className="bxi-s-steel2" cx="160" cy="110" rx="34" ry="9" />
          <path className="bxi-s-thin" d="M134 110 q26 -10 52 0 M140 114 q20 -7 40 0" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} className="bxi-p-crumb bxi-kt-c" cx={144 + i * 8} cy={106 + (i % 2) * 4} r="2" style={{ opacity: 0 }} />
          ))}
          <Place x={0} y={0} className="bxi-kt-a">
            <Brush x={176} y={96} r={-20} />
          </Place>
          <Caption x={160} y={160} anchor="middle">lower burr · brush only</Caption>
        </>
      )}
      {item === 'tool' && (
        <>
          <path className="bxi-s-steel2" d="M152 0 h16 l-2 70 h-12 Z" />
          <rect className="bxi-s-steel" x="150" y="70" width="20" height="34" rx="5" />
          {[-5, 0, 5].map((d) => (
            <circle key={d} className="bxi-s-dark" cx={160 + d} cy="101" r="1.6" />
          ))}
          <Place x={160} y={104} className="bxi-kt-a">
            <g transform="rotate(90)">
              <SteamTool x={0} y={0} />
            </g>
          </Place>
          <g className="bxi-kt-b"><TurnArrow x={160} y={87} r={22} ccw /></g>
          <Caption x={210} y={60}>pin: holes</Caption>
          <Caption x={210} y={74}>spanner: the tip</Caption>
        </>
      )}
      {item === 'disc' && (
        <>
          <Portafilter x={140} y={96} s={1.2} />
          <Basket x={140} y={97} s={1.08} className="bxi-kt-a" />
          <Disc x={140} y={106} s={1.2} className="bxi-kt-b" />
          <Tablet x={140} y={100} s={1.2} className="bxi-kt-c" />
          <Caption x={140} y={160} anchor="middle">1 CUP basket · disc · tablet</Caption>
        </>
      )}
      {item === 'tablets' && (
        <>
          <Bowl x={160} y={100} w={150} />
          <Tablet x={160} y={112} s={1.4} className="bxi-kt-a" />
          <g className="bxi-kt-b">
            <Bubbles x={150} y={116} spread={14} />
            <Bubbles x={174} y={118} spread={10} />
          </g>
          <Caption x={160} y={168} anchor="middle">cycle: one · basket soak: one</Caption>
        </>
      )}
      {item === 'sachet' && (
        <>
          <Jug x={160} y={96} s={1.3} level={0.75} label="1 L" />
          <Place x={140} y={40} className="bxi-kt-a">
            <Sachet x={0} y={0} s={0.9} />
          </Place>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} className="bxi-s-scale bxi-kt-b" cx={150 + i * 4} cy={72 + (i % 2) * 3} r="1.7" style={{ opacity: 0 }} />
          ))}
          <path className="bxi-s-accentline bxi-kt-c" d="M150 130 a10 4 0 1 0 20 0 a10 4 0 1 0 -20 0" />
        </>
      )}
      {item === 'allen' && (
        <>
          <circle className="bxi-s-steel" cx="160" cy="100" r="56" />
          <circle className="bxi-s-face" cx="160" cy="100" r="44" />
          <circle className="bxi-s-steel2" cx="160" cy="100" r="8" />
          <Place x={0} y={0} className="bxi-kt-a">
            <AllenKey x={160} y={100} r={-90} s={1.2} />
          </Place>
          <g className="bxi-kt-b"><TurnArrow x={160} y={100} r={22} ccw /></g>
          <Caption x={232} y={60}>short end in</Caption>
          <Caption x={232} y={74}>anti-clockwise</Caption>
          <Caption x={232} y={88}>to loosen</Caption>
        </>
      )}
      {item === 'razor' && (
        <>
          <Basket x={160} y={96} s={1.6} />
          <ellipse className="bxi-s-coffee bxi-kt-b" cx="160" cy="96" rx="34" ry="2.5" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="bxi-p-crumb bxi-kt-c" cx={196 + i * 4} cy={90} r="1.8" style={{ opacity: 0 }} />
          ))}
          <Place x={160} y={84} className="bxi-kt-a">
            <Razor x={0} y={0} s={1.2} />
          </Place>
          <Caption x={160} y={160} anchor="middle">a dosing tool, not a cleaning one</Caption>
        </>
      )}
      {item === 'filter' && (
        <>
          <FilterCart x={160} y={70} s={1.8} month={3} dialClass="bxi-kt-a" />
          <g className="bxi-kt-b">
            <Caption x={214} y={52} tone="accent">+3 months</Caption>
          </g>
          <Caption x={214} y={100}>soak 5 min</Caption>
          <Caption x={214} y={114}>rinse 5 s</Caption>
        </>
      )}
    </Stage>
  );
}
