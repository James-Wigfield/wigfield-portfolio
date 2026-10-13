import { useEffect, useRef, useState } from 'react';
import Clip from '../../engine/Clip';
import { Cite } from '../../shared/chrome';
import { mediaUrl, useMediaVersion } from '../../engine/media';

/* ============================================================================
   ONE SCAN, START TO FINISH — SMALL PARTS (components only)
   ========================================================================== */

/* A hold frame as a still image (the verified PNGs only, display scaling only). */
export function Still({ src, className = '', alt = '' }) {
  useMediaVersion();
  return <img className={`d1-still ${className}`} src={mediaUrl(src)} alt={alt} draggable="false" />;
}

/* A chain of clips on one slide. clips: [{ src, at, under, label }]: clip i
   plays at build step `at`. Only the newest reached clip shows; the next one
   is mounted hidden, paused on its first frame (the current hold), so the
   cut to it is seamless. Earlier clips unmount (their hold is the next
   clip's first frame). */
export function ClipStack({ ctx, clips, hidden = false }) {
  let cur = 0;
  clips.forEach((c, i) => {
    if (ctx.step >= c.at) cur = i;
  });
  return (
    <div className={`d1-clips${hidden ? ' is-off' : ''}`}>
      {clips.map((c, i) => {
        if (i < cur || i > cur + 1) return null;
        return (
          <div key={c.src} className={`d1-clipslot${i > cur ? ' is-next' : ''}`}>
            <Clip src={c.src} state={ctx.clip(c.at)} mode={ctx.mode} reduced={ctx.reduced} under={c.under} label={c.label} onEnded={c.onEnded} />
          </div>
        );
      })}
    </div>
  );
}

/* The title slide's slow, dimmed loop of case A's turn. The A1 clip turns
   once between about 2.6 s and 8.3 s and both ends face front (measured
   against its hold frame), so looping that span has no jump. Plays only on
   the current slide in present mode; otherwise, or if the video fails, the
   hold frame (marked as a clip so the media gate's forced failure sees it). */
const LOOP_FROM = 2.6;
const LOOP_TO = 8.3;

export function TitleLoop({ ctx }) {
  useMediaVersion();
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const live = ctx.mode === 'present' && ctx.phase === 'current' && !ctx.reduced && !failed;
  const url = mediaUrl('clips/case-a-1-scan.mp4');
  const poster = mediaUrl('clips/case-a-1-scan.png');

  useEffect(() => {
    const el = ref.current;
    if (!el || !live) return undefined;
    const rewind = () => {
      try {
        el.currentTime = LOOP_FROM;
      } catch {
        /* not seekable yet */
      }
    };
    const onTime = () => {
      if (el.currentTime >= LOOP_TO) rewind();
    };
    const onEnded = () => {
      rewind();
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    };
    const start = () => {
      el.playbackRate = 0.6;
      rewind();
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    };
    // A failed load falls back to the hold frame. Listened for natively (the
    // React onError prop did not fire for a failed <video> in testing), and
    // checked once after mount in case the error came first.
    const onError = () => setFailed(true);
    const check = window.setTimeout(() => {
      if (el.error) setFailed(true);
    }, 0);
    el.addEventListener('error', onError);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    if (el.readyState >= 1) start();
    else el.addEventListener('loadedmetadata', start, { once: true });
    return () => {
      window.clearTimeout(check);
      el.removeEventListener('error', onError);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('loadedmetadata', start);
      el.pause();
    };
  }, [live, url]);

  return (
    <div className="d1-loop sd-clip" data-bleed="" data-clip="clips/case-a-1-scan.mp4" data-clip-state={live ? 'play' : 'hold'} aria-hidden="true">
      {live
        ? <video ref={ref} className="d1-loop__media" src={url} poster={poster} muted playsInline preload="auto" disablePictureInPicture />
        : <img className="d1-loop__media" src={poster} alt="" draggable="false" />}
    </div>
  );
}

/* Verdict marker shapes as the clips draw them: found = circle, missed =
   dashed square, false alarm = diamond (each with its colour and a dot). */
export function Glyph({ kind, size = 34 }) {
  const s = size;
  const c = s / 2;
  if (kind === 'found') {
    return (
      <svg className="d1-glyph is-found" width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
        <circle cx={c} cy={c} r={s * 0.4} fill="none" strokeWidth={s * 0.11} />
        <circle cx={c} cy={c} r={s * 0.17} className="d1-glyph__dot" />
      </svg>
    );
  }
  if (kind === 'missed') {
    const r = s * 0.38;
    return (
      <svg className="d1-glyph is-missed" width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
        <rect x={c - r} y={c - r} width={2 * r} height={2 * r} fill="none" strokeWidth={s * 0.11} strokeDasharray={`${s * 0.16} ${s * 0.1}`} />
        <circle cx={c} cy={c} r={s * 0.15} className="d1-glyph__dot" />
      </svg>
    );
  }
  const r = s * 0.44;
  return (
    <svg className="d1-glyph is-fa" width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <path d={`M ${c} ${c - r} L ${c + r} ${c} L ${c} ${c + r} L ${c - r} ${c} Z`} fill="none" strokeWidth={s * 0.11} strokeLinejoin="round" />
      <circle cx={c} cy={c} r={s * 0.15} className="d1-glyph__dot" />
    </svg>
  );
}

/* A small lock for the sealed test set (original artwork). */
export function Lock({ size = 40 }) {
  return (
    <svg className="d1-lock" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M12 18 V12 a8 8 0 0 1 16 0 V18" fill="none" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="8" y="18" width="24" height="17" rx="3" />
    </svg>
  );
}

/* An in-text citation marker at footnote size (the shared <Cite> scaled to
   the surrounding text would fall under the 20 px floor in small labels). */
export function Ref({ k, ctx }) {
  return <span className="d1-ref" data-role="foot"><Cite k={k} refNum={ctx.refNum} /></span>;
}
