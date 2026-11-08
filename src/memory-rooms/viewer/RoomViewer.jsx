/* Thin React wrapper around the plain RoomViewer class: owns one instance for
   the component's lifetime, keeps it sized (ResizeObserver), loads `source`
   when it changes, and tears everything down on unmount.

     <RoomViewer source={{ scene, glbUrl, posterUrl, posterLowUrl, photos, scanUrl }} onViewer={setViewer} bar={<StageBar …/>} />
     <RoomViewer source={{ rooms: [...] }} />           // a group (building)

   `onViewer(instance | null)` hands the instance to the page, which drives it
   (viewpoints, blend, mode) and listens to its events. `bar` is page chrome
   docked to the bottom edge of the stage (viewpoints, blend slider); its
   height is reported to the viewer so the photo and the opening view sit
   above it. Anything passed as children is drawn over the stage too. */

import { useEffect, useRef, useState } from 'react';
import { RoomViewer as Viewer } from './RoomViewer.js';
import { COPY } from '../copy.js';
import './viewer.css';

const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export default function RoomViewer({ source, onViewer, label, bar, className = '', children }) {
  const hostRef = useRef(null);
  const barRef = useRef(null);
  const viewerRef = useRef(null);
  const onViewerRef = useRef(onViewer);
  const [snap, setSnap] = useState({ state: 'loading', progress: 0, mode: 'model' });
  const [touched, setTouched] = useState(false);
  const [inViewpoint, setInViewpoint] = useState(false);

  useEffect(() => {
    onViewerRef.current = onViewer;
  }, [onViewer]);

  // one instance per mount
  useEffect(() => {
    const host = hostRef.current;
    const viewer = new Viewer(host);
    viewerRef.current = viewer;
    const offs = [
      viewer.on('state', setSnap),
      viewer.on('interact', () => setTouched(true)),
      viewer.on('viewpoint', (vp) => setInViewpoint(vp.photo != null)),
    ];
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) viewer.setSize(box.width, box.height);
    });
    ro.observe(host);
    onViewerRef.current?.(viewer);
    return () => {
      ro.disconnect();
      for (const off of offs) off();
      onViewerRef.current?.(null);
      viewerRef.current = null;
      viewer.dispose();
    };
  }, []);

  // the docked bar's height keeps the photo and the opening view clear of it
  const hasBar = !!bar;
  useEffect(() => {
    const viewer = viewerRef.current;
    const el = barRef.current;
    if (!viewer) return undefined;
    if (!hasBar || !el) {
      viewer.setInsets({ bottom: 0 });
      return undefined;
    }
    const ro = new ResizeObserver(() => viewer.setInsets({ bottom: el.offsetHeight }));
    ro.observe(el);
    viewer.setInsets({ bottom: el.offsetHeight });
    return () => ro.disconnect();
  }, [hasBar]);

  // load whenever the source object changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!source) viewer.clear();
    else if (source.rooms) viewer.loadGroup(source);
    else viewer.load(source);
  }, [source]);

  const copy = COPY.viewer;
  const scan = snap.mode === 'scan';
  const showHint = snap.state === 'ready' && !touched && !inViewpoint;

  return (
    <div className={`mr-viewer ${className}`.trim()}>
      <div className="mr-viewer__host" ref={hostRef} role="region" aria-label={label || copy.label('')} />

      {snap.state === 'error' && (
        <div className="mr-viewer__error" role="alert">
          <p>{scan ? copy.errorScan : copy.error}</p>
          <button type="button" className="mr-btn" onClick={() => viewerRef.current?.retry()}>
            {copy.retry}
          </button>
        </div>
      )}

      <div className="mr-viewer__bottom">
        {snap.state === 'loading' && (
          <div className="mr-viewer__status" role="status">
            <span className="mr-label">
              {scan ? copy.loadingScan : copy.loading}
              {snap.progress > 0 && snap.progress < 1 ? ` · ${copy.percent(snap.progress)}` : ''}
            </span>
            <span className="mr-viewer__bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.max(0.04, snap.progress || 0)})` }} />
            </span>
          </div>
        )}
        {showHint && (
          <p className="mr-viewer__hint mr-label" aria-hidden="true">
            {isTouch() ? copy.hintTouch : copy.hint}
          </p>
        )}
        {bar && (
          <div className="mr-viewer__dock" ref={barRef}>
            {bar}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
