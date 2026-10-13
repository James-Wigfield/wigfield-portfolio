import { useEffect, useState } from 'react';
import { mediaUrl, useMediaVersion } from '../../engine/media';
import { OPTF_RATIO, WIN, rectOf } from './geometry';

/* ============================================================================
   DECK 3 (context) — STAGE PARTS
   ----------------------------------------------------------------------------
   Camera     one large world per slide, framed by { x, y, s } (the world point
              at the viewport centre, and the scale). On entry, a slide may open
              at `from` (where the previous slide's camera left off) and ease to
              its own framing in about 900 ms; each build step can move the
              camera again (1.6 s, narrated).
              Export, thumbnails and reduced motion show the step's framing with
              no transition; reduced motion fades instead of zooming.
   ScanView   a 1920 x 1080 hold frame or clip, cropped and display-scaled;
              overlays drawn in hold px share its transform exactly.
   Windows    the N1 rectangles (manifest sizes, n1 scale) in hold px.
   OptionF    the dissertation's Figure 3.3 (option F) on a light plate,
              revealed by clipping, never redrawn.
   Countdown  the five-second "spot the lesions" timer (a visual timer inside a
              build step; it never advances the slide).
   ========================================================================== */

/** True once this slide has been on screen for two frames in present mode. */
function useEntered(ctx) {
  const active = ctx.phase === 'current' && ctx.mode === 'present';
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [active]);
  return { active, entered };
}

export function Camera({ ctx, frames, from, x = 0, y = 0, w, h, className = '', children }) {
  const { active, entered } = useEntered(ctx);
  const f = frames[Math.min(ctx.step, frames.length - 1)];
  const opening = !!from && active && !entered && ctx.dir === 'forward' && ctx.step === 0 && !ctx.still;
  const cur = opening ? from : f;
  const live = active && entered && !ctx.still;
  const xfade = ctx.reduced && ctx.mode === 'present' && active;
  const t = `translate(${w / 2 - cur.x * cur.s}px, ${h / 2 - cur.y * cur.s}px) scale(${cur.s})`;
  return (
    <div className={`d3-cam ${className}`} style={{ left: x, top: y, width: w, height: h }} data-bleed="">
      <div
        className={`d3-cam__world${live ? ' is-live' : ''}${xfade ? ' is-xfade' : ''}`}
        style={{
          transform: t,
          // Entry moves (into step 0) run at about 900 ms so the title lands first;
          // narrated build-step moves keep their own, slower timing.
          transitionDuration: live ? `${ctx.step === 0 ? cur.te ?? 900 : cur.t ?? 1600}ms` : undefined,
          animationName: xfade ? (ctx.step % 2 ? 'd3-xfade-a' : 'd3-xfade-b') : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A fade-in for elements that should not zoom (reduced motion keeps it as a cross-fade). */
export function Reveal({ on, as = 'div', className = '', style, children, ...rest }) {
  const Tag = as;
  return (
    <Tag className={`d3-rev${on ? ' is-on' : ''} ${className}`} style={style} {...rest}>
      {children}
    </Tag>
  );
}

export function ScanView({ crop, w, x, y, className = '', children }) {
  const k = w / crop[2];
  const h = crop[3] * k;
  const pos = x === undefined ? {} : { position: 'absolute', left: x, top: y };
  return (
    <div className={`d3-scan ${className}`} style={{ width: w, height: h, ...pos }} data-bleed="">
      <div className="d3-scan__frame" style={{ transform: `scale(${k}) translate(${-crop[0]}px, ${-crop[1]}px)` }}>
        {children}
      </div>
    </div>
  );
}

export function Hold({ src, alt = '', className = '', style }) {
  useMediaVersion();
  return <img className={`d3-hold ${className}`} src={mediaUrl(src)} alt={alt} draggable="false" style={style} />;
}

/**
 * The N1 rectangles in hold px. show: { psm, small, large }; grow (0 or 1)
 * draws one rectangle that scales from the small window to the large one.
 */
export function Windows({ show = {}, grow, draw = false, className = '' }) {
  const r = (k) => rectOf(WIN[k]);
  const L = r('large');
  return (
    <svg className={`d3-wins ${className}`} viewBox="0 0 1920 1080" aria-hidden="true">
      {show.psm && <rect className="d3-win d3-win--psm" x={r('psm').x} y={r('psm').y} width={r('psm').w} height={r('psm').h} />}
      {show.large && <rect className="d3-win d3-win--large" x={L.x} y={L.y} width={L.w} height={L.h} />}
      {show.small && (
        <rect className={`d3-win d3-win--mine${draw ? ' is-draw' : ''}`} x={r('small').x} y={r('small').y} width={r('small').w} height={r('small').h} pathLength="1000" />
      )}
      {grow !== undefined && (
        <rect
          className="d3-win d3-win--mine d3-win--grow"
          x={L.x}
          y={L.y}
          width={L.w}
          height={L.h}
          style={{ transform: grow ? 'scale(1, 1)' : `scale(${WIN.small.w / WIN.large.w}, ${WIN.small.h / WIN.large.h})` }}
        />
      )}
    </svg>
  );
}

/**
 * Option F on a white plate. `clip` = [top, right, bottom, left] insets as
 * fractions of the figure, so a stage of the reveal shows one region only.
 */
export function OptionF({ w, x = 0, y = 0, clip = [0, 0, 0, 0], className = '', children }) {
  useMediaVersion();
  const h = w * OPTF_RATIO;
  const [t, r, b, l] = clip.map((c) => `${(c * 100).toFixed(2)}%`);
  return (
    <div className={`d3-optf ${className}`} style={{ left: x, top: y, width: w, height: h, clipPath: `inset(${t} ${r} ${b} ${l})` }}>
      <img src={mediaUrl('figures/architecture-option-f.svg')} width={w} height={h} alt="The hybrid CNN-Mamba network (dissertation Figure 3.3, option F)" draggable="false" />
      {children}
    </div>
  );
}

/** Verdict shapes as the case clips draw them: ring = found, dashed square = missed, diamond = false alarm. */
export function ClipGlyph({ kind, size = 40 }) {
  const s = size;
  const c = s / 2;
  if (kind === 'found') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" className="d3-cg d3-cg--found">
        <circle cx={c} cy={c} r={s * 0.4} fill="none" strokeWidth={s * 0.1} />
        <circle cx={c} cy={c} r={s * 0.18} />
      </svg>
    );
  }
  if (kind === 'missed') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" className="d3-cg d3-cg--missed">
        <rect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} fill="none" strokeWidth={s * 0.1} strokeDasharray={`${s * 0.16} ${s * 0.1}`} />
        <circle cx={c} cy={c} r={s * 0.16} />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" className="d3-cg d3-cg--fa">
      <path d={`M ${c} ${s * 0.06} L ${s * 0.94} ${c} L ${c} ${s * 0.94} L ${s * 0.06} ${c} Z`} fill="none" strokeWidth={s * 0.1} />
      <circle cx={c} cy={c} r={s * 0.15} />
    </svg>
  );
}

/**
 * The five-second timer. `run` starts the CSS animations (present mode, entered
 * forward); otherwise it shows its end state. The frame drains around `box`.
 */
export function Countdown({ run, box, className = '' }) {
  const { x, y, w, h } = box;
  const digits = [5, 4, 3, 2, 1];
  return (
    <div className={`d3-count${run ? ' is-running' : ' is-done'} ${className}`}>
      <svg className="d3-count__frame" style={{ left: x - 10, top: y - 10 }} width={w + 20} height={h + 20} aria-hidden="true">
        <rect x="5" y="5" width={w + 10} height={h + 10} pathLength="1000" />
      </svg>
      <div className="d3-count__digits" aria-live="off">
        {digits.map((n, i) => (
          <span key={n} className="d3-count__digit" data-tick="" style={{ animationDelay: `${i}s` }}>{n}</span>
        ))}
        <span className="d3-count__end" data-role="body">Time.</span>
      </div>
    </div>
  );
}
