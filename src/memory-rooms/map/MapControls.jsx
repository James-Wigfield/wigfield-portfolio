import { COPY } from '../copy.js';

const Icon = ({ d }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Zoom in / out / show everything. Required (wheel, drag and pinch are extras). */
export default function MapControls({ onIn, onOut, onReset, canIn = true, canReset = true }) {
  return (
    <div className="mr-mapctl" role="group" aria-label={COPY.map.mapLabel}>
      <button type="button" className="mr-mapctl-btn" data-mr="zoom-in" onClick={onIn} disabled={!canIn} aria-label={COPY.map.zoomIn} title={COPY.map.zoomIn}>
        <Icon d="M8 3v10M3 8h10" />
      </button>
      <button type="button" className="mr-mapctl-btn" data-mr="zoom-out" onClick={onOut} aria-label={COPY.map.zoomOut} title={COPY.map.zoomOut}>
        <Icon d="M3 8h10" />
      </button>
      <button
        type="button"
        className="mr-mapctl-btn"
        data-mr="zoom-reset"
        onClick={onReset}
        disabled={!canReset}
        aria-label={COPY.map.zoomReset}
        title={COPY.map.zoomReset}
      >
        <Icon d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
      </button>
    </div>
  );
}
