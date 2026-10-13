import Clip from '../../../engine/Clip';

/* ============================================================================
   VERDICT DECK — EXHIBIT PLATES
   ----------------------------------------------------------------------------
   Scans are framed exhibits on dark plates, captioned beneath on the paper.
   <Plate width caption>                a dark mount around any exhibit
   <ClipWindow src under state ...>     a 1920 x 1080 clip shown through a
       window: the clip box is `scale` times the window's 16:9 width and
       shifted by `x` and `y` (fractions of the clip), so a plate can frame
       part of the clip at a larger size. Nothing is resampled beyond the
       browser's display scaling, and the clip is never blended.
   ========================================================================== */

export function Plate({ width, caption, className = '', children, tag }) {
  return (
    <figure className={`d2-plate ${className}`} style={{ width }}>
      <div className="d2-plate__mount">
        {tag && <span className="d2-plate__tag" data-role="foot">{tag}</span>}
        {children}
      </div>
      {caption && <figcaption className="d2-plate__cap" data-role="foot">{caption}</figcaption>}
    </figure>
  );
}

export function ClipWindow({ src, under, state, mode, reduced, width, height, clipW, x = 0, y = 0, label }) {
  const clipH = (clipW * 9) / 16;
  return (
    <div className="d2-clipwin" style={{ width, height }}>
      <div className="d2-clipwin__box" style={{ width: clipW, height: clipH, left: -x * clipW, top: -y * clipH }}>
        <Clip src={src} under={under} state={state} mode={mode} reduced={reduced} label={label} />
      </div>
    </div>
  );
}
