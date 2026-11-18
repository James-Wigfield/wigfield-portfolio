/* "See it in your space": the spot page's AR entry (a lazy chunk; the heavy
   parts load on demand from here: ar/usdz.js + three's USDZExporter, ar/xr.js,
   ar/qr.js + qrcode-generator).

   - iPhone / iPad: two AR Quick Look links (tabletop 1:20, life size 1:1), each
     a real <a rel="ar"> around one image, as Safari requires; the USDZ is made
     in the browser from the loaded room (ar/usdz.js) as soon as the panel opens.
   - Android Chrome: two buttons that start WebXR immersive-ar inside the viewer
     (ar/xr.js), with an overlay over the camera (scale, reset, exit).
   - Desktop: a QR code that opens this spot on a phone with ?ar=1 (the panel
     then starts open there).
   - A phone without either: one line saying so. */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COPY } from '../copy.js';
import { mediaNamed, mediaOf } from '../lib/api.js';
import { paths } from '../routes.js';
import { useViewerState } from '../viewer/useViewer.js';
import { arKind, isTouchDevice } from './support.js';
import './ar.css';

const SCALES = ['tabletop', 'life'];

const CubeIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M10 2.5 3.5 6v8L10 17.5 16.5 14V6L10 2.5Zm0 0v7.5m0 0L3.5 6M10 10l6.5-4M10 10v7.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

function tileImage(spot) {
  return (mediaNamed(spot, 'render', 'marker') || mediaNamed(spot, 'render', 'hero') || mediaOf(spot, 'thumb')[0])?.url || '';
}

export default function ArEntry({ spot, viewer, startOpen = false }) {
  const c = COPY.ar;
  const [kind, setKind] = useState(null);
  const [open, setOpen] = useState(startOpen);
  const vstate = useViewerState(viewer);
  const ready = Boolean(viewer) && vstate.state === 'ready' && vstate.mode !== 'scan';

  useEffect(() => {
    let alive = true;
    arKind().then((k) => alive && setKind(k));
    return () => {
      alive = false;
    };
  }, []);

  if (!kind) return null;
  const panelId = `mr-ar-${spot.id}`;
  return (
    <section className="mr-ar" data-mr="ar" data-ar-kind={kind}>
      <button
        type="button"
        className="mr-btn mr-btn--lg mr-btn--block mr-ar__open"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        data-mr="ar-open"
      >
        <CubeIcon />
        {c.open}
      </button>
      {open && (
        <div className="mr-ar__panel" id={panelId} data-mr="ar-panel">
          {kind === 'quicklook' && <QuickLook spot={spot} viewer={viewer} ready={ready} />}
          {kind === 'webxr' && <WebXr spot={spot} viewer={viewer} ready={ready} />}
          {kind === 'none' && (isTouchDevice() ? <p className="mr-msg" data-mr="ar-none">{c.noAr}</p> : <QrCode spot={spot} />)}
        </div>
      )}
    </section>
  );
}

function OptionText({ scale }) {
  const c = COPY.ar;
  return (
    <span className="mr-ar__text">
      <span className="mr-ar__name">{scale === 'life' ? c.life : c.tabletop}</span>
      <span className="mr-ar__hint">{scale === 'life' ? c.lifeHint : c.tabletopHint}</span>
    </span>
  );
}

/* ── iPhone: AR Quick Look ───────────────────────────────────────────────── */

function QuickLook({ spot, viewer, ready }) {
  const c = COPY.ar;
  const [urls, setUrls] = useState({}); // scale → blob url (with the Quick Look fragment)
  const [failed, setFailed] = useState(false);
  const anchors = useRef({});
  const wanted = useRef(null); // a scale tapped before its file was ready

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    (async () => {
      try {
        const { usdzUrl } = await import('./usdz.js');
        for (const scale of SCALES) {
          const url = await usdzUrl(viewer, spot, scale);
          if (!alive) return;
          const href = `${url}#allowsContentScaling=${scale === 'life' ? 0 : 1}`;
          setUrls((u) => ({ ...u, [scale]: href }));
          if (wanted.current === scale) {
            wanted.current = null;
            requestAnimationFrame(() => anchors.current[scale]?.click());
          }
        }
      } catch (err) {
        console.info('[memory-rooms] usdz failed:', err?.message || err);
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, viewer, spot]);

  const img = tileImage(spot);
  const busy = ready && !failed && SCALES.some((s) => !urls[s]);
  return (
    <>
      <ul className="mr-ar__options">
        {SCALES.map((scale) => (
          <li key={scale} className="mr-ar__option" data-ready={urls[scale] ? '1' : '0'}>
            <a
              ref={(el) => {
                anchors.current[scale] = el;
              }}
              rel="ar"
              href={urls[scale] || undefined}
              download={urls[scale] ? `${spot.id}-${scale}.usdz` : undefined}
              className="mr-ar__tile"
              aria-label={c.quickLookLabel(scale, spot.title)}
              onClick={(e) => {
                if (urls[scale]) return;
                e.preventDefault();
                wanted.current = scale;
              }}
              data-mr="ar-quicklook"
              data-scale={scale}
            >
              <img src={img} alt="" width="64" height="64" />
            </a>
            <button type="button" className="mr-ar__label" onClick={() => anchors.current[scale]?.click()} tabIndex={-1} aria-hidden="true">
              <OptionText scale={scale} />
            </button>
          </li>
        ))}
      </ul>
      {!ready && <p className="mr-msg">{c.waiting}</p>}
      {busy && (
        <p className="mr-msg" data-tone="busy" data-mr="ar-preparing">
          {c.preparing}
        </p>
      )}
      {failed && (
        <p className="mr-msg" data-tone="danger" data-mr="ar-error">
          {c.prepareFailed}
        </p>
      )}
    </>
  );
}

/* ── Android: WebXR inside the viewer ────────────────────────────────────── */

function WebXr({ viewer, ready }) {
  const c = COPY.ar;
  const overlayRef = useRef(null);
  const barRef = useRef(null);
  const ctrl = useRef(null);
  const [session, setSession] = useState(null); // { mode, phase, scale }
  const [error, setError] = useState(false);

  // Taps on the overlay's buttons must not also place / drag the room.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const stop = (e) => e.preventDefault();
    bar.addEventListener('beforexrselect', stop);
    return () => bar.removeEventListener('beforexrselect', stop);
  }, []);

  // The session must be asked for inside the tap's user activation, so the module is fetched now,
  // with the panel, not after the tap (a slow line would let the activation run out).
  useEffect(() => {
    import('./xr.js').catch(() => {});
  }, []);

  // Leaving the page ends the session (also one still starting: `gone` makes it end on arrival).
  const gone = useRef(false);
  useEffect(() => {
    const live = ctrl;
    gone.current = false;
    return () => {
      gone.current = true;
      live.current?.end();
    };
  }, []);

  const start = async (mode) => {
    if (!ready || session) return;
    setError(false);
    const overlay = overlayRef.current;
    overlay.style.display = 'flex';
    try {
      const { startAr } = await import('./xr.js');
      setSession({ mode, phase: 'finding', scale: mode === 'life' ? 1 : 1 / 20 });
      const started = await startAr(viewer, {
        mode,
        overlay,
        onPhase: (phase) => setSession((s) => s && { ...s, phase }),
        onScale: (scale) => setSession((s) => s && { ...s, scale }),
        onEnd: () => {
          overlay.style.display = 'none';
          ctrl.current = null;
          setSession(null);
        },
      });
      if (gone.current) started.end();
      else ctrl.current = started;
    } catch (err) {
      console.info('[memory-rooms] AR did not start:', err?.message || err);
      overlay.style.display = 'none';
      setSession(null);
      setError(true);
    }
  };

  const hint = session ? { finding: c.finding, ready: c.tapToPlace, placed: c.placed }[session.phase] : '';
  return (
    <>
      <ul className="mr-ar__options">
        {SCALES.map((scale) => (
          <li key={scale} className="mr-ar__option">
            <button type="button" className="mr-ar__label mr-ar__label--btn" disabled={!ready || Boolean(session)} onClick={() => start(scale)} data-mr="ar-start" data-scale={scale}>
              <OptionText scale={scale} />
            </button>
          </li>
        ))}
      </ul>
      {!ready && <p className="mr-msg">{c.waiting}</p>}
      {error && (
        <p className="mr-msg" data-tone="danger" data-mr="ar-error">
          {c.startFailed}
        </p>
      )}
      {createPortal(
        <div className="mr mr-ar-overlay" ref={overlayRef} data-mr="ar-overlay" style={{ display: 'none' }}>
          <p className="mr-ar-overlay__hint" aria-live="polite">
            {hint}
          </p>
          <div className="mr-ar-overlay__bar" ref={barRef}>
            <span className="mr-label mr-ar-overlay__scale">{session ? c.scale(session.scale) : ''}</span>
            <button type="button" className="mr-btn" onClick={() => ctrl.current?.resetScale()}>
              {c.reset(session?.mode)}
            </button>
            <button type="button" className="mr-btn mr-btn--primary" onClick={() => ctrl.current?.end()} data-mr="ar-exit">
              {c.exit}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Desktop: open it on a phone ─────────────────────────────────────────── */

function QrCode({ spot }) {
  const c = COPY.ar;
  const [qr, setQr] = useState(null);
  const url = `${window.location.origin}${paths.spot(spot.id)}?ar=1`;
  useEffect(() => {
    let alive = true;
    import('./qr.js').then((m) => alive && setQr({ url, ...m.qrPath(url) }));
    return () => {
      alive = false;
    };
  }, [url]);
  const ready = qr?.url === url;
  return (
    <div className="mr-ar__qr" data-mr="ar-qr" data-url={url}>
      {/* a 4-module quiet zone, as the QR spec asks (the page around it can be dark) */}
      <svg className="mr-ar__qrcode" viewBox={ready ? `-4 -4 ${qr.size + 8} ${qr.size + 8}` : '0 0 1 1'} role="img" aria-label={c.qrLabel(spot.title)} shapeRendering="crispEdges">
        {ready && (
          <>
            <rect x="-4" y="-4" width={qr.size + 8} height={qr.size + 8} className="mr-ar__qrpaper" />
            <path d={qr.d} className="mr-ar__qrink" />
          </>
        )}
      </svg>
      <p className="mr-ar__qrline">{c.qrLine}</p>
    </div>
  );
}
