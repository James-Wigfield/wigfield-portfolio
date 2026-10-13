import { useEffect, useRef, useState } from 'react';
import { clipPath, mediaUrl, posterOf, useMediaVersion } from './media';

/* ============================================================================
   SEMINAR DECKS — CLIP
   ----------------------------------------------------------------------------
   One rendered motion clip (H.264, 1920 x 1080, ends on a still hold) with its
   PNG hold as poster and fallback. `state`:
     'start'  paused on its first frame (neighbour slides preload this way)
     'play'   plays from the start once, then holds the last frame (no loop,
              no rewind)
     'hold'   shows the hold frame (the PNG, which is the clip's last frame)
   `under` is an image drawn beneath the video until its first frame decodes:
   pass the previous clip's hold, which is this clip's first frame, and a chain
   of clips cuts without a seam. Outside present mode (thumbnails, previews,
   export) and under reduced motion the clip is its hold frame only. If the
   video fails to load or play, the hold frame shows instead.
   `loop` (opt-in, default off): while playing, the clip starts again at its
   end instead of holding; its PNG is then a poster, not the last frame.
   ========================================================================== */

export default function Clip({ src, state = 'start', under, mode = 'present', reduced = false, className = '', style, onEnded, onTime, label, loop = false }) {
  useMediaVersion();
  const video = useRef(null);
  const [failed, setFailed] = useState(false);
  const path = clipPath(src);
  const url = mediaUrl(path);
  const posterUrl = mediaUrl(posterOf(path));
  const underUrl = under ? mediaUrl(under.endsWith('.png') ? under : posterOf(clipPath(under))) : null;
  const still = mode !== 'present' || reduced || failed;

  // A missing or unplayable file: show the hold frame. React's onError is not
  // reliable for a media source that fails before or while it loads, so the
  // element is watched directly as well.
  useEffect(() => {
    const el = video.current;
    if (!el || still) return undefined;
    const onFail = () => setFailed(true);
    el.addEventListener('error', onFail);
    if (el.error) queueMicrotask(onFail);
    return () => el.removeEventListener('error', onFail);
  }, [still, url]);

  useEffect(() => {
    const el = video.current;
    if (!el || still) return;
    if (state === 'play') {
      try {
        el.currentTime = 0;
      } catch {
        /* not seekable yet; play() starts at 0 anyway */
      }
      const p = el.play();
      if (p && p.catch) {
        p.catch((e) => {
          if (el.error || e?.name === 'NotSupportedError') setFailed(true);
        });
      }
    } else {
      el.pause();
      if (state === 'start') {
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    }
  }, [state, still, url]);

  // Report the playhead while playing (for overlays synced to the clip).
  useEffect(() => {
    const el = video.current;
    if (!el || still || !onTime || state !== 'play') return undefined;
    let raf = 0;
    const tick = () => {
      onTime(el.currentTime, el.duration || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, still, onTime]);

  const showHold = still || state === 'hold';

  return (
    <div className={`sd-clip ${className}`} style={style} data-clip={path} data-clip-state={showHold ? 'hold' : state}>
      {underUrl && !showHold && <img className="sd-clip__under" src={underUrl} alt="" draggable="false" />}
      {!still && (
        <video
          ref={video}
          className="sd-clip__video"
          src={url}
          muted
          loop={loop}
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label={label}
          onEnded={onEnded}
          onError={() => setFailed(true)}
        />
      )}
      {showHold && <img className="sd-clip__hold" src={posterUrl} alt={label ?? ''} draggable="false" />}
    </div>
  );
}
