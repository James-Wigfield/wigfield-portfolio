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
        <button type="button" className="mr-btn mr-btn--quiet mr-stagebar__home" data-mr="home-view" disabled={!ready} onClick={() => viewer?.home()}>
          {active != null ? copy.home : homeLabel || copy.reset}
        </button>
      </div>
    </div>
  );
}
