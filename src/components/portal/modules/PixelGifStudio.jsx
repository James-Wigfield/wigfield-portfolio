import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../icons';
import { spriteToGif, gifDataUrl } from './pixelGif';
import { listSprites } from '../data/spritesApi';

/* ============================================================================
   PIXEL-ART GIF STUDIO (Personal)
   ----------------------------------------------------------------------------
   A studio for animated pixel-art GIFs. Every GIF shown here is loaded LIVE
   from Supabase — written by Claude Code through the `pixel-gif` MCP server
   (a Cloudflare Worker, see mcp-pixel-gif/) and saved to the cloud. The studio
   reads them with the public anon key, then previews/encodes a real .gif fully
   in-browser via the dependency-free GIF89a encoder in ./pixelGif.js.

   Each Supabase row is { id, name, sprite }, where `sprite` is the exact shape
   the encoder renders: { width, height, palette[], transparentIndex,
   frames:number[][], delayMs }. Hit Refresh to pull in newly-generated GIFs.
   ========================================================================== */

const SIZE_PRESETS = [16, 32, 64, 128];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A sensible default render spec for a freshly-selected sprite: crisp 4× upscale
// (capped to 128), aspect-preserved, all frames, the sprite's own speed.
function defaultSpec(s) {
  const size = clamp(s.width * 4, 16, 128);
  const height = s.width === s.height ? size : clamp(Math.round(s.height * (size / s.width)), 16, 128);
  return { width: size, height, frames: s.frames.length, delayMs: s.delayMs };
}

// A Supabase row { id, name, sprite } -> the flat sprite shape the studio renders.
const rowToSprite = (r) => ({ id: r.id, name: r.name, ...r.sprite });

// Guard against a malformed row so one bad sprite can't crash the encoder.
function isValidSprite(s) {
  return (
    s &&
    Number.isFinite(s.width) &&
    Number.isFinite(s.height) &&
    Array.isArray(s.palette) &&
    Array.isArray(s.frames) &&
    s.frames.length > 0 &&
    Array.isArray(s.frames[0])
  );
}

export default function PixelGifStudio() {
  const [sprites, setSprites] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'empty' | 'error'
  const [error, setError] = useState(null);
  const [sprite, setSprite] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [spec, setSpec] = useState(null);

  // Select a sprite into the studio + reset its render spec.
  const selectSprite = useCallback((s) => {
    setSprite(s);
    setSourceId(s.id);
    setSpec(defaultSpec(s));
  }, []);

  // Apply a listSprites() result to state. Shared by the initial load (effect)
  // and the Refresh button.
  const applyResult = useCallback(({ data, error: err }) => {
    if (err) {
      setSprites([]);
      setError(err.message);
      setStatus('error');
      return;
    }
    const list = (data ?? []).map(rowToSprite).filter(isValidSprite);
    setSprites(list);
    if (list.length === 0) {
      setSprite(null);
      setStatus('empty');
      return;
    }
    selectSprite(list[0]);
    setStatus('ready');
  }, [selectSprite]);

  // Refresh button — an event handler, so setting "loading" up front is fine.
  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    applyResult(await listSprites());
  }, [applyResult]);

  // Initial load: setState runs in the promise callback (after await), not
  // synchronously in the effect body. `cancelled` guards against unmount.
  useEffect(() => {
    let cancelled = false;
    listSprites().then((res) => {
      if (!cancelled) applyResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  // Derived values — guarded so the hooks are unconditional even before a sprite loads.
  const maxFrames = sprite ? sprite.frames.length : 1;
  const count = sprite && spec ? clamp(spec.frames, 1, maxFrames) : 1;
  const fps = spec ? Math.max(1, Math.round(1000 / spec.delayMs)) : 1;

  // The preview IS the real encoded GIF — what you see is what downloads.
  const gifUrl = useMemo(() => {
    if (!sprite || !spec) return null;
    try {
      return gifDataUrl(spriteToGif(sprite, { ...spec, frames: count }));
    } catch {
      return null;
    }
  }, [sprite, spec, count]);

  const setSize = (w, h) => setSpec((s) => ({ ...s, width: clamp(w, 2, 256), height: clamp(h, 2, 256) }));

  const download = () => {
    if (!sprite || !spec) return;
    const bytes = spriteToGif(sprite, { ...spec, frames: count });
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.name.replace(/\s+/g, '-').toLowerCase()}-${spec.width}x${spec.height}-${count}f.gif`;
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
          Every GIF here is loaded live from <strong>Supabase</strong> — generated by Claude Code through the{' '}
          <code>pixel-gif</code> MCP tool and saved to the cloud, then rendered and encoded to a real{' '}
          <code>.gif</code> entirely in your browser. Set the output size, frame count and speed, then download.
          Hit <strong>Refresh</strong> after asking Claude for a new one.
        </p>
      </header>

      {/* ── GIF switcher + refresh ────────────────────────────────────────── */}
      <div className="pg-switch-row">
        <div className="pg-switch" role="tablist" aria-label="Saved GIFs">
          {sprites.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === sourceId}
              className={`pg-switch__tab${t.id === sourceId ? ' pg-switch__tab--active' : ''}`}
              onClick={() => selectSprite(t)}
            >
              <span className="pg-switch__fig">{String(i + 1).padStart(2, '0')}</span>
              <span className="pg-switch__label">{t.name}</span>
            </button>
          ))}
          {sprites.length === 0 && <span className="pg-switch__empty">// no GIFs in the database</span>}
        </div>
        <button className="pg-btn" onClick={refresh} disabled={status === 'loading'}>
          <Icon name="swap" size={15} /> Refresh
        </button>
      </div>

      {/* ── Non-ready states ──────────────────────────────────────────────── */}
      {status !== 'ready' && (
        <div className="pg-stage pt-card">
          <div className="pg-screen">
            <p className="pt-loading">
              {status === 'loading' && '// loading GIFs from Supabase…'}
              {status === 'empty' && '// no GIFs saved yet — ask Claude to generate one, then Refresh'}
              {status === 'error' && `// could not load — ${error}`}
            </p>
          </div>
        </div>
      )}

      {/* ── Studio: preview + controls ────────────────────────────────────── */}
      {status === 'ready' && sprite && spec && (
        <>
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
                <p className="pg-ctl__note">number of frames in the loop</p>
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

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
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
        </>
      )}

      {/* ── Generate with Claude Code (now live) ──────────────────────────── */}
      <div className="pg-hook pt-card">
        <div className="pg-hook__head">
          <span className="pg-hook__icon"><Icon name="cloud" size={16} /></span>
          <h3 className="pg-hook__title">Generate with Claude Code</h3>
          <span className="pg-hook__tag">Connected</span>
        </div>
        <p className="pg-hook__desc">
          The <code>pixel-gif</code> MCP server — a Cloudflare Worker — is wired to Claude Code. Describe a
          sprite and Claude generates it and calls <code>save_sprite</code>, which writes it to Supabase
          using the secret key. Then hit <strong>Refresh</strong> above and it appears here.
        </p>
        <pre className="pg-code">{`// ask Claude Code:
"Use the pixel-gif tool to save a 16×16 bouncing ball GIF, 6 frames."

// Claude generates the sprite -> save_sprite -> Supabase -> Refresh -> shows here.`}</pre>
      </div>
    </div>
  );
}
