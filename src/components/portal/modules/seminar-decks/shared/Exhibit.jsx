import { mediaUrl, useMediaVersion } from '../engine/media';

/* ============================================================================
   SEMINAR DECKS — EXHIBIT: a dissertation figure or a scan image on a plate
   ----------------------------------------------------------------------------
   Images come only from public/seminar-decks (verified holds, the
   dissertation's figures, option F). Nothing is redrawn or resampled beyond
   the browser's display scaling. `crop` = [x, y, w, h] as fractions of the
   image shows one panel (object-view through a clipping box).
   ========================================================================== */

export default function Exhibit({ src, alt = '', width, height, crop, plate = true, caption, className = '', imgStyle }) {
  useMediaVersion();
  const url = mediaUrl(src);
  let img;
  if (crop) {
    const [cx, cy, cw, ch] = crop;
    img = (
      <span className="sd-exhibit__crop" style={{ width, height, display: 'block', position: 'relative', overflow: 'hidden' }}>
        <img
          src={url}
          alt={alt}
          draggable="false"
          style={{ position: 'absolute', width: `${100 / cw}%`, height: `${100 / ch}%`, left: `${(-cx / cw) * 100}%`, top: `${(-cy / ch) * 100}%`, maxWidth: 'none', ...imgStyle }}
        />
      </span>
    );
  } else {
    img = <img src={url} alt={alt} width={width} height={height} draggable="false" style={{ objectFit: 'contain', ...imgStyle }} />;
  }
  return (
    <figure className={`sd-exhibit${plate ? ' sd-exhibit--plate' : ''} ${className}`}>
      {img}
      {caption && <figcaption data-role="foot">{caption}</figcaption>}
    </figure>
  );
}
