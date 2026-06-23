import { useRef, useEffect } from 'react';

/*
 * ScanViewport — the signature visual.
 * A field of "voxels" (mostly dim, cool background tissue) is swept by a scan
 * line; as the sweep passes a hidden lesion cluster, those voxels ignite hot
 * and a segmentation marker is drawn around them. This literally pictures the
 * research thesis: isolating tiny lesion SIGNAL from vast healthy BACKGROUND.
 *
 * Rendered on <canvas> (decorative, aria-hidden). Pauses when off-screen or the
 * tab is hidden; respects prefers-reduced-motion by drawing one static "segmented"
 * frame with no animation loop.
 */

const VARIANTS = {
  hero: { cols: 30, lesion: [0.64, 0.4], sigma: 1.9 },
  research: { cols: 26, lesion: [0.4, 0.6], sigma: 2.3 },
};

export default function ScanViewport({ variant = 'hero', className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cfg = VARIANTS[variant] || VARIANTS.hero;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let running = false;
    let intersecting = false;
    let hidden = document.hidden;
    let w = 0, h = 0, cell = 0, rows = 0;
    const cols = cfg.cols;
    let lesionCol = 0, lesionRow = 0;

    const baseAt = (c, r) =>
      0.06 +
      0.06 * (0.5 + 0.5 * Math.sin(c * 0.7 + r * 0.45)) +
      0.04 * (0.5 + 0.5 * Math.sin(c * 0.27 - r * 0.6 + 2.1));

    const GAP = 1;

    function draw(now) {
      if (!w || !h) return;
      const cycle = 5200;
      const sweepDur = 3200;
      let sweepGX, lit, sweeping;

      if (reduce) {
        sweepGX = cols + 5;
        lit = 1;
        sweeping = false;
      } else {
        const t = now % cycle;
        sweeping = t < sweepDur;
        const sp = sweeping ? t / sweepDur : 1;
        sweepGX = sp * (cols + 2) - 1;
        lit = Math.max(0, Math.min(1, (sweepGX - lesionCol) / 3));
      }

      ctx.clearRect(0, 0, w, h);
      const sigma = cfg.sigma;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let intensity = baseAt(c, r);

          if (sweeping) {
            const dxs = Math.abs(c - sweepGX);
            if (dxs < 2.2) intensity += (1 - dxs / 2.2) * 0.5;
          }

          const dc = c - lesionCol;
          const dr = r - lesionRow;
          const fall = Math.exp(-(dc * dc + dr * dr) / (2 * sigma * sigma));
          const lesion = fall * lit;

          if (intensity < 0.04 && lesion < 0.02) continue;

          const x = c * cell;
          const y = r * cell;
          const s = cell - GAP;

          let cr, cg, cb, a;
          if (lesion > 0.02) {
            const hot = Math.min(1, lesion * 1.15);
            const bg = Math.min(0.55, intensity);
            const toWhite = Math.max(0, hot - 0.7) / 0.3;
            cr = 255;
            cg = Math.round(106 + (255 - 106) * toWhite);
            cb = Math.round(61 + (255 - 61) * toWhite);
            a = Math.min(1, bg * 0.4 + hot * 0.95);
          } else {
            const L = Math.min(0.6, intensity);
            cr = Math.round(96 + 70 * L);
            cg = Math.round(116 + 70 * L);
            cb = Math.round(140 + 80 * L);
            a = Math.min(0.85, 0.12 + L * 1.1);
          }
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
          ctx.fillRect(x, y, s, s);
        }
      }

      // Scan sweep line + leading glow
      if (sweeping && sweepGX >= -1 && sweepGX <= cols + 1) {
        const lx = sweepGX * cell;
        const grad = ctx.createLinearGradient(lx - 26, 0, lx + 6, 0);
        grad.addColorStop(0, 'rgba(255,170,120,0)');
        grad.addColorStop(1, 'rgba(255,190,150,0.16)');
        ctx.fillStyle = grad;
        ctx.fillRect(lx - 26, 0, 32, h);
        ctx.fillStyle = 'rgba(255,214,186,0.55)';
        ctx.fillRect(lx, 0, 1.4, h);
      }

      // Segmentation marker once the lesion is detected
      if (lit > 0.55) {
        const pad = sigma * 1.7;
        const x0 = (lesionCol - pad) * cell;
        const y0 = (lesionRow - pad) * cell;
        const bw = pad * 2 * cell;
        const bh = pad * 2 * cell;
        const flicker = reduce ? 0.7 : 0.5 + 0.3 * Math.sin(now * 0.006);
        ctx.strokeStyle = `rgba(255,106,61,${flicker})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, y0, bw, bh);

        const tk = 6;
        ctx.strokeStyle = 'rgba(255,140,100,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + tk); ctx.lineTo(x0, y0); ctx.lineTo(x0 + tk, y0);
        ctx.moveTo(x0 + bw - tk, y0); ctx.lineTo(x0 + bw, y0); ctx.lineTo(x0 + bw, y0 + tk);
        ctx.moveTo(x0, y0 + bh - tk); ctx.lineTo(x0, y0 + bh); ctx.lineTo(x0 + tk, y0 + bh);
        ctx.moveTo(x0 + bw - tk, y0 + bh); ctx.lineTo(x0 + bw, y0 + bh); ctx.lineTo(x0 + bw, y0 + bh - tk);
        ctx.stroke();
      }
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      const should = intersecting && !hidden && !reduce;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      cell = w / cols;
      rows = Math.max(1, Math.round(h / cell));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lesionCol = cfg.lesion[0] * cols;
      lesionRow = cfg.lesion[1] * rows;
      draw(performance.now());
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let io;
    if (reduce) {
      draw(0);
    } else {
      io = new IntersectionObserver(
        ([e]) => {
          intersecting = e.isIntersecting;
          sync();
        },
        { threshold: 0.05 }
      );
      io.observe(canvas);
    }

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`hp-viewport__canvas ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
