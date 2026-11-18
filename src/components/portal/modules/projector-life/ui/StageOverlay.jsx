import { useEffect, useRef } from 'react';
import Icon from '../../../icons';
import { CAMERA_VIEWS } from '../params.js';
import { PRESETS } from '../presets.js';
import Glyph from './glyphs';
import { CoverageView } from './widgets';
import { patchName } from './geom';
import { useStats } from './store';

/* ============================================================================
   PROJECTOR LIFE — everything drawn OVER the 3-D stage (always dark)
     top-left   scene card (preset name, ‹ › to cycle), seed hint, the
                Coverage · Raw · Mapped switch, the coverage read-out
     top-right  transport (play/pause, step, reseed, clear, PNG, reset,
                fullscreen), camera views, fps
     bottom     labels over the engine's projector-output insets (rects come
                from stats.insets) and the unfolded-room net (a DOM canvas we
                own and hand to stage.setNetCanvas)
   The overlay root ignores the pointer so orbit/click-to-seed reach the
   canvas; only the controls themselves take events.
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, '0');

function TBtn({ label, onClick, children, disabled, pressed }) {
  return (
    <button type="button" className="pjl-tbtn" onClick={onClick} aria-label={label} title={label} disabled={disabled} aria-pressed={pressed}>
      {children}
    </button>
  );
}

function NetInset({ stage, show, short }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(e.contentRect.width * dpr));
      const h = Math.max(1, Math.round(e.contentRect.height * dpr));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [show]);
  useEffect(() => {
    if (!stage) return undefined;
    stage.setNetCanvas(show ? ref.current : null);
    return () => stage.setNetCanvas(null);
  }, [stage, show]);
  if (!show) return null;
  return (
    <figure className="pjl-net">
      <figcaption className="pjl-ov__label">{short ? 'room, unfolded' : 'the room, unfolded'}</figcaption>
      <canvas ref={ref} className="pjl-net__canvas" aria-label="The room's patches laid flat as a net, with the simulations running on them" role="img" />
    </figure>
  );
}

export default function StageOverlay({
  stage, values, scene, preset, onPreset, onQuiet, onReset, onView, fs, onFullscreen, stageWidth, loading, err, onRetry,
}) {
  const s = useStats(stage);
  const idx = Math.max(0, PRESETS.findIndex((p) => p.id === scene.presetId));
  const cycle = (d) => onPreset(PRESETS[(idx + d + PRESETS.length) % PRESETS.length]);
  const playing = s ? s.playing : true;
  const view = s?.view || scene.view;
  const narrow = stageWidth > 0 && stageWidth < 560;
  const count = values['proj.count'] || 1;
  const showNet = !!values['aid.netInset'] && !(narrow && count > 1);
  const insets = Array.isArray(s?.insets) ? s.insets : [];
  const covOn = !!values['proj.coverage'];
  const showCompare = !!preset?.compare || values['map.mode'] === 'raw' || covOn;
  const compare = covOn ? 'coverage' : values['map.mode'];
  const pickCompare = (v) => {
    if (v === 'coverage') onQuiet({ 'proj.coverage': true });
    else onQuiet({ 'proj.coverage': false, 'map.mode': v });
  };
  const seed = s?.lastSeed?.patchId;

  return (
    <div className="pjl-ov">
      <div className="pjl-ov__shade pjl-ov__shade--top" aria-hidden="true" />
      <div className="pjl-ov__shade pjl-ov__shade--bot" aria-hidden="true" />

      <div className="pjl-ov__grid">
        <div className="pjl-ov__scene">
          <div className="pjl-ov__kicker">
            scene {pad2(idx + 1)} / {pad2(PRESETS.length)}
            {scene.edited && <span className="pjl-ov__edited"> · edited</span>}
          </div>
          <div className="pjl-ov__title">
            <button type="button" className="pjl-ov__arrow" onClick={() => cycle(-1)} aria-label="Previous scene">
              <Glyph name="chevL" size={16} />
            </button>
            <h2 className="pjl-ov__name" aria-live="polite">
              {preset?.name || 'Custom'}
            </h2>
            <button type="button" className="pjl-ov__arrow" onClick={() => cycle(1)} aria-label="Next scene">
              <Glyph name="chevR" size={16} />
            </button>
          </div>
          {preset?.blurb && <div className="pjl-ov__blurb">{preset.blurb}</div>}
          <div className="pjl-ov__hint">
            <span className={`pjl-dot ${seed ? 'pjl-dot--s-floor' : 'pjl-dot--live'}`} />
            {seed ? `seeded · ${patchName(seed)} — click again` : 'click a surface to seed life'}
          </div>
          {showCompare && (
            <div className="pjl-ov__compare" role="radiogroup" aria-label="What the projector shows">
              {[
                { v: 'coverage', l: 'Coverage' },
                { v: 'raw', l: 'Raw' },
                { v: 'mapped', l: 'Mapped' },
              ].map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={compare === o.v} className={`pjl-ov__cmp${compare === o.v ? ' is-on' : ''}`} onClick={() => pickCompare(o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
          )}
          {covOn && (
            <div className="pjl-ov__cov">
              <CoverageView coverage={s?.coverage || null} dark />
            </div>
          )}
        </div>

        <div className="pjl-ov__tools">
          <div className="pjl-ov__transport" role="toolbar" aria-label="Simulation">
            <TBtn label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? stage?.pause() : stage?.play())} disabled={!stage}>
              <Icon name={playing ? 'pause' : 'play'} size={15} />
            </TBtn>
            <TBtn label="Step one tick" onClick={() => stage?.step()} disabled={!stage}>
              <Glyph name="step" size={15} />
            </TBtn>
            <TBtn label="Reseed life" onClick={() => stage?.reseed()} disabled={!stage}>
              <Glyph name="reseed" size={15} />
            </TBtn>
            <TBtn label="Clear life" onClick={() => stage?.clear()} disabled={!stage}>
              <Glyph name="clear" size={15} />
            </TBtn>
            <span className="pjl-ov__sep" aria-hidden="true" />
            <TBtn label="Save PNG" onClick={() => stage?.savePNG(`projector-life-${scene.presetId || 'scene'}.png`)} disabled={!stage}>
              <Glyph name="camera" size={15} />
            </TBtn>
            <TBtn label="Reset everything to the default scene" onClick={onReset} disabled={!stage}>
              <Glyph name="reset" size={15} />
            </TBtn>
            <span className="pjl-ov__sep" aria-hidden="true" />
            <TBtn label={fs ? 'Leave fullscreen (Esc)' : 'Fullscreen'} onClick={onFullscreen}>
              <Icon name={fs ? 'compress' : 'expand'} size={15} />
            </TBtn>
          </div>
          <div className="pjl-ov__views" role="radiogroup" aria-label="Camera">
            {CAMERA_VIEWS.map((v) => (
              <button key={v.value} type="button" role="radio" aria-checked={view === v.value} title={v.label} className={`pjl-ov__view${view === v.value ? ' is-on' : ''}`} onClick={() => onView(v.value)} disabled={!stage}>
                {v.short || v.label}
              </button>
            ))}
          </div>
          {values['aid.fps'] && s?.ready && (
            <div className="pjl-ov__fps">
              <b>{Math.round(s.fps || 0)}</b> fps<span className="pjl-ov__fpsms"> · {(s.frameMs || 0).toFixed(1)} ms</span>
            </div>
          )}
        </div>
      </div>

      {values['aid.projInset'] &&
        insets.map((r) => (
          <span key={r.index} className="pjl-ov__label pjl-ov__inset" style={{ left: r.x, top: Math.max(0, r.y - 18), maxWidth: insets.length > 1 ? r.w + 4 : undefined }}>
            {insets.length > 1 && narrow ? `p${r.index + 1} output` : insets.length > 1 || narrow ? `projector ${r.index + 1} output` : `what projector ${r.index + 1} actually outputs`}
          </span>
        ))}

      <NetInset stage={stage} show={showNet} short={narrow} />

      {(loading || err) && (
        <div className="pjl-ov__load" role="status">
          {err ? (
            <>
              <div className="pjl-ov__loadk">
                <span className="pjl-dot pjl-dot--err" />
                the stage didn&rsquo;t start
              </div>
              <div className="pjl-ov__loaderr">{err}</div>
              <button type="button" className="pjl-ov__retry" onClick={onRetry}>
                Try again
              </button>
            </>
          ) : (
            <>
              <svg className="pjl-ov__oct" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
                <polygon points="-0.383,-0.924 0.383,-0.924 0.924,-0.383 0.924,0.383 0.383,0.924 -0.383,0.924 -0.924,0.383 -0.924,-0.383" pathLength="100" />
                <polygon className="pjl-ov__oct-roof" points="-0.383,-0.924 0,0 0.383,-0.924 0,0 0.924,-0.383 0,0 0.924,0.383 0,0 0.383,0.924 0,0 -0.383,0.924 0,0 -0.924,0.383 0,0 -0.924,-0.383 0,0" pathLength="100" />
              </svg>
              <div className="pjl-ov__loadk">lighting the she&rsquo;d</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
