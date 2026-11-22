/* The controls that drive a RoomViewer.
   - StageBar: docked to the bottom edge of the 3D stage (RoomViewer `bar`):
     the photo viewpoints as thumbnails, the Model ⇄ Photo blend slider right
     under the photo, and back-to-the-room / reset.
   - ModeToggle: Model / Scan, in the page panel.
   Pure UI; each reads the instance's state through useViewer.js. */

import { COPY } from '../copy.js';
import { useViewerState, useViewpoint } from './useViewer.js';

const copy = COPY.viewer;

export function ModeToggle({ mode, onChange, disabled }) {
  const scan = mode === 'scan';
  return (
    <div className="mr-ctl">
      <span className="mr-label">{copy.modeLabel}</span>
      <div className="mr-seg" role="group" aria-label={copy.modeLabel}>
        <button type="button" data-mr="mode-model" aria-pressed={!scan} disabled={disabled} onClick={() => onChange('model')}>
          {copy.modeModel}
        </button>
        <button type="button" data-mr="mode-scan" aria-pressed={scan} disabled={disabled} onClick={() => onChange('scan')}>
          {copy.modeScan}
        </button>
      </div>
    </div>
  );
}

/** Room / Plan: the plan cut (everything above 1.2 m clipped away, cut walls inked). */
export function PlanToggle({ on, onChange, disabled }) {
  return (
    <div className="mr-ctl">
      <span className="mr-label">{copy.planLabel}</span>
      <div className="mr-seg" role="group" aria-label={copy.planLabel}>
        <button type="button" data-mr="plan-off" aria-pressed={!on} disabled={disabled} onClick={() => onChange(false)}>
          {copy.planRoom}
        </button>
        <button type="button" data-mr="plan-on" aria-pressed={on} disabled={disabled} onClick={() => onChange(true)} title={copy.planHint}>
          {copy.planCut}
        </button>
      </div>
    </div>
  );
}

/**
 * Spin: the slow turntable. A labelled dot (filled while it turns); it reads the viewer's state, so a drag or a
 * viewpoint that stops the turn shows here at once.
 */
export function SpinToggle({ viewer, className = '' }) {
  const vstate = useViewerState(viewer);
  const ready = !!viewer && vstate.state === 'ready' && vstate.mode !== 'scan';
  const on = Boolean(vstate.spin);
  return (
    <button
      type="button"
      className={`mr-btn mr-btn--quiet mr-spin ${className}`.trim()}
      data-mr="spin"
      aria-pressed={on}
      disabled={!ready}
      title={copy.spinHint}
      onClick={() => viewer?.setSpin(!on)}
    >
      <span className="mr-spin__dot" aria-hidden="true" />
      {copy.spin}
    </button>
  );
}

/**
 * Furnished: the room (or the whole place) with or without its furniture, the walls and floors on their own clean
 * bake. Shown only where an empty bake exists (state.canEmpty).
 */
export function FurnishedToggle({ viewer, className = '' }) {
  const vstate = useViewerState(viewer);
  if (!vstate.canEmpty) return null;
  const ready = !!viewer && vstate.state === 'ready';
  const on = vstate.furnished !== false;
  return (
    <button
      type="button"
      className={`mr-btn mr-btn--quiet mr-spin mr-furnished ${className}`.trim()}
      data-mr="furnished"
      aria-pressed={on}
      disabled={!ready}
      title={copy.furnishedHint}
      onClick={() => viewer?.setFurnished(!on)}
    >
      <span className="mr-spin__dot" aria-hidden="true" />
      {copy.furnished}
    </button>
  );
}

export function BlendSlider({ value, onChange }) {
  return (
    <label className="mr-blend">
      <span className="mr-label" aria-hidden="true">
        {copy.blendModel}
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        data-mr="blend-slider"
        aria-label={copy.blendLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="mr-label" aria-hidden="true">
        {copy.blendPhoto}
      </span>
    </label>
  );
}

/**
 * cameras: scene.cameras; thumbs: { [photo]: url }; homeLabel: what "reset"
 * reads while orbiting (the group page says "Whole building").
 */
export function StageBar({ viewer, cameras = [], thumbs = {}, homeLabel }) {
  const vstate = useViewerState(viewer);
  const vp = useViewpoint(viewer);
  const ready = !!viewer && vstate.state === 'ready';
  const active = vp.photo;
  const showViewpoints = vstate.mode !== 'scan' && cameras.length > 0;
  const light = (n) => viewer?.highlightPhoto(n);

  return (
    <div className="mr-stagebar">
      {showViewpoints && active != null && <BlendSlider value={vp.blend} onChange={(v) => viewer?.setBlend(v)} />}
      <div className="mr-stagebar__row">
        {showViewpoints && (
          <div className="mr-stagebar__vps">
            <span className="mr-label mr-stagebar__label">{copy.viewpoints}</span>
            <div className="mr-vpthumbs" role="group" aria-label={copy.viewpoints}>
              {cameras.map((c) => (
                <button
                  key={c.photo}
                  type="button"
                  className="mr-vpthumb"
                  data-mr="viewpoint"
                  data-photo={c.photo}
                  aria-pressed={active === c.photo}
                  aria-label={copy.viewpoint(c.photo)}
                  title={copy.viewpoint(c.photo)}
                  disabled={!ready}
                  onClick={() => viewer?.flyToPhoto(c.photo)}
                  onPointerEnter={() => light(c.photo)}
                  onPointerLeave={() => light(null)}
                  onFocus={() => light(c.photo)}
                  onBlur={() => light(null)}
                >
                  <span className="mr-vpthumb__img">{thumbs[c.photo] && <img src={thumbs[c.photo]} alt="" draggable="false" />}</span>
                  <span className="mr-vpthumb__n">{copy.thumbCaption(c.photo)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mr-stagebar__end">
          {active == null && <SpinToggle viewer={viewer} />}
          <button type="button" className="mr-btn mr-btn--quiet mr-stagebar__home" data-mr="home-view" disabled={!ready} onClick={() => viewer?.home()}>
            {active != null ? copy.home : homeLabel || copy.reset}
          </button>
        </div>
      </div>
    </div>
  );
}
