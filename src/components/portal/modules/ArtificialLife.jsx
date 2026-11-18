import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import './ArtificialLife.css';

/* ============================================================================
   ARTIFICIAL LIFE — the "Specimen Cabinet" simulations
   ----------------------------------------------------------------------------
   The sim is a self-contained static site (plain ES modules, no build step)
   living in public/artificial-life/. It is embedded in an iframe rather than
   ported to React because it owns the whole viewport: full-page canvas, global
   element ids, document-level keyboard shortcuts and its own stylesheet. The
   iframe keeps all of that isolated from the portal.

   This shell only adds fullscreen: the Fullscreen API on the stage wrapper,
   Escape leaves it natively, `fullscreenchange` keeps the button honest. The
   sim resizes itself to the iframe on window resize.

   To update the sim, copy index.html, style.css and src/ from the
   artifical-life repo into public/artificial-life/.
   ========================================================================== */

const SRC = '/artificial-life/index.html';

export default function ArtificialLife() {
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === stageRef.current;
      setFs(on);
      // Hand focus back to the sim so its keyboard shortcuts keep working.
      frameRef.current?.focus();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  return (
    <div className="pt-module alife">
      <p className="pt-module__intro">
        Six artificial-life systems, computed live: Lenia, Gray-Scott, Physarum, Particle Life,
        the Primordial Particle System and an evolving ecology. Click the plate to give it keyboard
        focus — <b>space</b> hold, <b>r</b> reseed, <b>h</b> hide panels, <b style={{ whiteSpace: 'nowrap' }}>1–6</b> switch plate.
      </p>

      <div ref={stageRef} className={`alife-stage${fs ? ' alife-stage--fs' : ''}`}>
        <iframe
          ref={frameRef}
          className="alife-frame"
          src={SRC}
          title="Artificial Life — Specimen Cabinet"
        />
        <button
          type="button"
          className="alife-fsbtn"
          onClick={toggleFullscreen}
          aria-label={fs ? 'Leave fullscreen' : 'Enter fullscreen'}
          title={fs ? 'Leave fullscreen (Esc)' : 'Fullscreen'}
        >
          <Icon name={fs ? 'compress' : 'expand'} size={16} />
        </button>
      </div>
    </div>
  );
}
