import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../icons';
import { spriteToGif, gifDataUrl } from './pixelGif';
import { EXAMPLES } from './pixelSprites';

/* ============================================================================
   PIXEL-ART GIF STUDIO (Personal)
   ----------------------------------------------------------------------------
   A small studio for animated pixel-art GIFs. It previews a looping GIF, lets
   you set the output pixel size, frame count and playback speed, and exports a
   real .gif — all encoded in-browser by the dependency-free GIF89a encoder in
   ./pixelGif.js (pixel art = tiny indexed frames, so no library is needed).

   Everything the studio shows is driven by a single SPRITE object (shape lives
   in pixelGif.js). The built-ins (./pixelSprites.js) are generated in-app so the
   page works out of the box; the SAME shape is what the future Claude Code / MCP
   wrapper will inject — see the injection seam + TODO inside the component.
   ========================================================================== */

// ── Spec helpers ─────────────────────────────────────────────────────────────
const SIZE_PRESETS = [16, 32, 64, 128];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A sensible default render spec for a freshly-loaded sprite: crisp 4× upscale
// (capped to 128), aspect-preserved, all frames, the sprite's own speed.
function defaultSpec(s) {
  const size = clamp(s.width * 4, 16, 128);
  const height = s.width === s.height ? size : clamp(Math.round(s.height * (size / s.width)), 16, 128);
  return { width: size, height, frames: s.frames.length, delayMs: s.delayMs };
}

export default function PixelGifStudio() {
  const [sprite, setSprite] = useState(EXAMPLES[0]);
  const [sourceId, setSourceId] = useState(EXAMPLES[0].id);
  const [spec, setSpec] = useState(() => defaultSpec(EXAMPLES[0]));
  const [injected, setInjected] = useState(null);

  // Load any sprite (built-in or generated) into the studio + reset the spec.
  const loadSprite = useCallback((s, { keepInjected = false } = {}) => {
    setSprite(s);
    setSourceId(s.id);
    setSpec(defaultSpec(s));
    if (!keepInjected) return;
    setInjected(s);
  }, []);

  // ── Injection seam for the deferred Claude Code / MCP wrapper ──────────────
  // A generated GIF is just a sprite object (shape documented in pixelGif.js).
  // The wrapper hands us one and calls this — nothing else in the page changes.
  useEffect(() => {
    // TODO: MCP integration hook. The Claude Code GIF tool will call
    //   window.__pixelGifStudio.load(generatedSprite)
    // to inject + preview a freshly-generated GIF here. Wire the MCP server to
    // this global (or lift it to context/router state) when building that step.
    window.__pixelGifStudio = { load: (s) => loadSprite(s, { keepInjected: true }) };
    return () => { delete window.__pixelGifStudio; };
  }, [loadSprite]);

  const maxFrames = sprite.frames.length;
  const count = clamp(spec.frames, 1, maxFrames);
  const fps = Math.max(1, Math.round(1000 / spec.delayMs));

  // The preview IS the real encoded GIF — what you see is what downloads.
  const gifUrl = useMemo(() => {
    try {
      return gifDataUrl(spriteToGif(sprite, { ...spec, frames: count }));
    } catch {
      return null;
    }
  }, [sprite, spec, count]);

  const tabs = injected ? [...EXAMPLES, injected] : EXAMPLES;

  const setSize = (w, h) => setSpec((s) => ({ ...s, width: clamp(w, 2, 256), height: clamp(h, 2, 256) }));

  const download = () => {
    const bytes = spriteToGif(sprite, { ...spec, frames: count });
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.id}-${spec.width}x${spec.height}-${count}f.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pt-module pg">
      {/* ── Intro ─────────────────────────────────────────────────────────── */}
      <header className="pg-intro pt-card">
        <p className="pg-intro__eyebrow">// PERSONAL · STUDIO</p>
        <h2 className="pg-intro__title">Pixel-Art GIF Studio</h2>
        <p className="pg-intro__desc">
          Preview, tune and export looping pixel-art GIFs. The frames below are generated in-app and
          encoded to a real <code>.gif</code> entirely in your browser — no upload, no dependency.
          Set the output size, frame count and speed, then download. A generated sprite will later be
          injectable straight from Claude Code (see below).
        </p>
      </header>

      {/* ── Example switcher ──────────────────────────────────────────────── */}
      <div className="pg-switch" role="tablist" aria-label="Example sprites">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === sourceId}
            className={`pg-switch__tab${t.id === sourceId ? ' pg-switch__tab--active' : ''}`}
            onClick={() => loadSprite(t, { keepInjected: !!injected })}
          >
            <span className="pg-switch__fig">{t.id === injected?.id ? 'GEN' : `0${i + 1}`}</span>
            <span className="pg-switch__label">{t.name}</span>
          </button>
        ))}
      </div>

      {/* ── Studio: preview + controls ────────────────────────────────────── */}
      <div className="pg-studio">
        <div className="pg-stage pt-card">
          <div className="pg-screen">
            {gifUrl ? (
              <img className="pg-gif" src={gifUrl} alt={`${sprite.name} animated preview`} />
            ) : (
              <p className="pt-loading">// encode error</p>
            )}
            <span className="pg-live">
              <span className="pg-live__dot" aria-hidden="true" />
              LIVE
            </span>
          </div>
          <p className="pg-stage__cap">
            <b>{sprite.name}</b> · source {sprite.width}×{sprite.height}px · {count}
            {count === 1 ? ' frame' : ' frames'} · {fps} fps
          </p>
        </div>

        <div className="pg-controls pt-card">
          {/* Output size */}
          <div className="pg-ctl">
            <div className="pg-ctl__head">
              <span className="pg-ctl__label">Output size</span>
              <span className="pg-ctl__val">{spec.width} × {spec.height}px</span>
            </div>
            <div className="pg-presets">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`pg-chip${spec.width === p && spec.height === p ? ' pg-chip--active' : ''}`}
                  onClick={() => setSize(p, p)}
                >
                  {p}²
                </button>
              ))}
            </div>
            <div className="pg-dims">
              <label className="pg-dim">
                <span>W</span>
                <input
                  type="number"
                  min="2"
                  max="256"
                  value={spec.width}
                  onChange={(e) => setSize(Number(e.target.value) || 2, spec.height)}
                />
              </label>
              <span className="pg-dim__x">×</span>
              <label className="pg-dim">
                <span>H</span>
                <input
                  type="number"
                  min="2"
                  max="256"
                  value={spec.height}
                  onChange={(e) => setSize(spec.width, Number(e.target.value) || 2)}
                />
              </label>
            </div>
            {spec.width !== sprite.width && (
              <p className="pg-ctl__note">scaled {(spec.width / sprite.width).toFixed(2)}× from {sprite.width}px source (nearest-neighbour)</p>
            )}
          </div>

          {/* Frames */}
          <div className="pg-ctl">
            <div className="pg-ctl__head">
              <span className="pg-ctl__label">Frames</span>
              <span className="pg-ctl__val">{count} / {maxFrames}</span>
            </div>
            <input
              className="pg-range"
              type="range"
              min="1"
              max={maxFrames}
              step="1"
              value={count}
              onChange={(e) => setSpec((s) => ({ ...s, frames: Number(e.target.value) }))}
              disabled={maxFrames <= 1}
            />
            <p className="pg-ctl__note">number of frames in the loop (generated sprites set their own count)</p>
          </div>

          {/* Speed */}
          <div className="pg-ctl">
            <div className="pg-ctl__head">
              <span className="pg-ctl__label">Speed</span>
              <span className="pg-ctl__val">{spec.delayMs}ms · {fps} fps</span>
            </div>
            <input
              className="pg-range"
              type="range"
              min="40"
              max="400"
              step="10"
              value={spec.delayMs}
              onChange={(e) => setSpec((s) => ({ ...s, delayMs: Number(e.target.value) }))}
            />
            <p className="pg-ctl__note">per-frame delay (GIF resolution is 10ms)</p>
          </div>

          {/* Palette */}
          <div className="pg-ctl">
            <div className="pg-ctl__head">
              <span className="pg-ctl__label">Palette</span>
              <span className="pg-ctl__val">{sprite.palette.length} colours</span>
            </div>
            <div className="pg-palette">
              {sprite.palette.map((hex, i) => (
                <span
                  key={i}
                  className={`pg-sw${i === sprite.transparentIndex ? ' pg-sw--alpha' : ''}`}
                  style={i === sprite.transparentIndex ? undefined : { background: hex }}
                  title={i === sprite.transparentIndex ? 'transparent' : hex}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="pg-toolbar">
        <span className="pg-spec">
          {spec.width}×{spec.height} · {count}f · {spec.delayMs}ms · GIF89a
        </span>
        <div className="pg-toolbar__actions">
          <button className="pg-btn" onClick={() => setSpec(defaultSpec(sprite))}>
            <Icon name="swap" size={15} /> Reset
          </button>
          <button className="pg-btn pg-btn--primary" onClick={download} disabled={!gifUrl}>
            <Icon name="download" size={15} /> Download .gif
          </button>
        </div>
      </div>

      {/* ── Deferred MCP integration (documented seam) ────────────────────── */}
      <div className="pg-hook pt-card">
        <div className="pg-hook__head">
          <span className="pg-hook__icon"><Icon name="cloud" size={16} /></span>
          <h3 className="pg-hook__title">Generate with Claude Code</h3>
          <span className="pg-hook__tag">Coming soon</span>
        </div>
        <p className="pg-hook__desc">
          Soon an MCP tool will let you describe a sprite (“a walking mushroom, 6 frames”), have Claude
          Code generate it, and drop it straight into this studio. The studio already renders any sprite
          in this shape, so that step only has to <em>produce</em> one and call the injection hook:
        </p>
        <pre className="pg-code">{`// sprite shape (see pixelGif.js)
{ id, name, width, height,
  palette: ['#rrggbb', …],   // index 0 = transparent
  transparentIndex: 0,
  frames: number[][],         // [frame][y*width+x] = palette index
  delayMs }

// inject (already wired):
window.__pixelGifStudio.load(sprite)`}</pre>
        <button className="pg-btn" disabled title="Deferred — needs the MCP wrapper">
          <Icon name="edit" size={15} /> Generate a sprite
        </button>
      </div>
    </div>
  );
}
