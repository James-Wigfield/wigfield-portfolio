import { useEffect, useMemo, useRef, useState } from 'react';
import { MAP } from '../../content/bottleneck';
import { classHomes, nearestHome, familyOf, fill } from '../../maths/bottleneck';
import { loadTsne, loadRecon, useData, decodeImg } from '../../../lecture5-study/fashion';
import { StageHead, Lines } from './Parts';

/* ============================================================================
   BOTTLENECK · STAGE 4 — THE MAP (slides 14–15)
   ----------------------------------------------------------------------------
   This page's own t-SNE map of stacked_encoder's 30 codings of 5,000
   Fashion MNIST validation images (lecture5-study/data/tsne.js), coloured
   by kind of item, each class named at its median point. One validation
   image (X_valid[0..9], recon.js) waits on the right: tap the cluster it
   belongs to (the nearest class name wins; ← → step through them), then
   Drop. Graded by class; the image's own point lights up afterwards.
   ========================================================================== */

function Thumb({ b64, label }) {
  const px = useMemo(() => decodeImg(b64), [b64]);
  const cells = [];
  for (let i = 0; i < px.length; i++) if (px[i] > 8) cells.push(<rect key={i} x={i % 28} y={Math.floor(i / 28)} width="1.02" height="1.02" fillOpacity={px[i] / 255} />);
  return (
    <svg className="dla-bn__thumb" viewBox="0 0 28 28" role="img" aria-label={label} shapeRendering="crispEdges">
      {cells}
    </svg>
  );
}

export function MapStage({ item, round }) {
  const tsne = useData(loadTsne);
  const recon = useData(loadRecon);
  const T = tsne?.TSNE;
  const [pick, setPick] = useState(null);
  const svgRef = useRef(null);
  const live = round.state === 'play' && !round.feedback;
  const fb = round.feedback;

  const map = useMemo(() => {
    if (!T) return null;
    const ext = T.extent;
    const homes = classHomes(T);
    const paths = T.classNames.map(() => []);
    for (let j = 0; j < T.labels.length; j++) paths[T.labels[j]].push(`M${T.x[j]} ${ext[1] - T.y[j]}h0`);
    const order = homes.slice().sort((a, b) => a.x - b.x || b.y - a.y).map((h) => h.k);
    return { ext, homes, d: paths.map((p) => p.join('')), order };
  }, [T]);

  const choose = (k) => { if (live) setPick(k); };
  const submit = () => { if (live && pick !== null) round.submit(pick); };

  useEffect(() => {
    if (!live || !map) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      const at = pick === null ? -1 : map.order.indexOf(pick);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setPick(map.order[(at + 1) % map.order.length]); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setPick(map.order[(at - 1 + map.order.length) % map.order.length]); }
      else if (e.key === 'Enter') { if (tag === 'BUTTON' && !e.target.dataset?.enter) return; e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTap = (e) => {
    const svg = svgRef.current;
    if (!svg || !map || !live) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    choose(nearestHome(map.homes, pt.x, map.ext[1] - pt.y));
  };

  const img = recon?.RECON.items[item.image];
  const name = (k) => MAP.classNames[k];
  const shownPick = fb ? fb.given : pick;

  return (
    <>
      <StageHead item={item} round={round} />
      <div className="dla-stagegrid dla-bn__grid dla-bn__mapgrid">
        <div className={`dla-floor dla-bn__floor${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}>
          {!map ? <p className="dla-loading">{MAP.loading}</p> : (
            <svg
              ref={svgRef}
              className={`dla-svg dla-bn__map${shownPick !== null ? ' dla-bn__map--picked' : ''}`}
              viewBox={`-20 -20 ${map.ext[0] + 40} ${map.ext[1] + 40}`}
              role="img"
              aria-label={`t-SNE map of ${T.count} validation images' codings; ${shownPick !== null ? `${name(shownPick)} cluster chosen` : 'tap a cluster'}`}
              onPointerDown={onTap}
            >
              {map.d.map((d, k) => (
                <path key={k} className={`dla-bn__dots${shownPick === k ? ' dla-bn__dots--on' : ''}`} d={d} style={{ stroke: `var(${MAP.families[familyOf(k)].color})` }} />
              ))}
              {map.homes.map((h) => (
                <text key={h.k} className={`dla-halo dla-bn__cls${shownPick === h.k ? ' dla-bn__cls--on' : ''}${fb && h.k === item.label ? ' dla-bn__cls--ans' : ''}`} x={h.x} y={map.ext[1] - h.y} textAnchor="middle">
                  {name(h.k)}
                </text>
              ))}
              {fb && (
                <g className="dla-bn__landed">
                  <circle cx={T.x[item.image]} cy={map.ext[1] - T.y[item.image]} r="26" />
                  <text className="dla-halo" x={T.x[item.image]} y={map.ext[1] - T.y[item.image] - 36} textAnchor="middle">{MAP.landed}</text>
                </g>
              )}
            </svg>
          )}
          <p className="dla-own dla-bn__ownmap">{MAP.own}</p>
        </div>
        <div className="dla-bn__side dla-bn__item">
          <div className="dla-bn__thumbwrap">
            {img ? <Thumb b64={img.original} label={fill(MAP.itemAria, { n: item.image + 1 })} /> : <span className="dla-bn__thumb dla-bn__thumb--wait" />}
            <span className="dla-bn__itemk">{fill(MAP.itemLabel, { i: item.image })}</span>
          </div>
          <p className="dla-bn__pickname" aria-live="polite">
            <span className="dla-dot" style={{ background: shownPick !== null ? `var(${MAP.families[familyOf(shownPick)].color})` : 'var(--line)' }} />
            {shownPick !== null ? name(shownPick) : MAP.pick}
          </p>
          <button type="button" className="dla-btn dla-btn--primary dla-bn__go" onClick={submit} disabled={!live || pick === null}>
            {MAP.drop} <span className="dla-btn__key">Enter</span>
          </button>
        </div>
      </div>
      <Lines lines={MAP.drawer} />
    </>
  );
}
