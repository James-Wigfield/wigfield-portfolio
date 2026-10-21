import { useEffect, useMemo, useRef, useState } from 'react';
import { Lab, Chips, Stat } from '../ui';
import { loadRecon, loadTsne, useData } from '../fashion';
import { fmt, fmtInt } from '../ae';
import { ReconGrid, LossCurve } from './parts';
import './labsVisual.css';

/* ============================================================================
   LECTURE 5 STUDY — LABS FOR §6
     ReconLab   Figure 17-4's comparison with real data: the first validation
                images and stacked_ae's reconstructions (this page's run of
                slide 12's code), what each lost, and the loss curves
     TsneLab    Figure 17-5's idea with real data: t-SNE of stacked_encoder's
                30-number codings of 5,000 validation images, coloured by
                kind of item or one class at a time
   ========================================================================== */

const pending = <p className="dl5s-readout dl5s-fwait">Loading this page’s Fashion MNIST run…</p>;

/* ── §6 · reconstructions ────────────────────────────────────────────────── */
export function ReconLab() {
  const data = useData(loadRecon);
  const [n, setN] = useState(5);
  const [diff, setDiff] = useState(false);
  const t = data?.TRAINING.stacked;
  return (
    <Lab
      title="Originals vs reconstructions (Figure 17-4’s check)"
      slides="slide 13"
      tryThis="before showing what was lost, predict which item suffers most. Then show it, and notice what kind of detail disappears: logos, straps and handles."
    >
      <div className="dl-lab__controls">
        <Chips label="images" value={n} options={[{ v: 5, l: 'the first 5 (as Figure 17-4)' }, { v: 10, l: 'the first 10' }]} onChange={setN} />
        <Chips label="third row" value={diff} options={[{ v: false, l: 'off' }, { v: true, l: 'what was lost: |original − reconstruction|' }]} onChange={setDiff} />
      </div>
      {!data ? pending : (
        <>
          <div className="dl5s-scroll"><ReconGrid data={data} model="stacked" n={n} diff={diff} /></div>
          <div className="dl5s-recon__low">
            <figure className="dl5s-recon__fig">
              <figcaption className="dl5s-stagehead">stacked_ae’s loss by epoch (MSE)</figcaption>
              <LossCurve label="stacked_ae training and validation loss over 20 epochs" series={[{ label: 'train', values: t.loss, tone: 'a' }, { label: 'valid', values: t.valLoss, tone: 'b' }]} />
            </figure>
            <div className="dl5s-recon__side">
              <div className="dl5s-stats dl5s-stats--tight">
                <Stat k="validation MSE after 20 epochs" v={fmt(t.finalValidMse, 4)} sub="this page’s run" />
                <Stat k="parameters" v={fmtInt(t.params)} sub="as slide 12" tone="accent" />
              </div>
              <p className="dl5s-stagehead">Slide 13: if the reconstructions are too lossy</p>
              <ol className="dl5s-recon__fixes">
                <li>train the model for longer</li>
                <li>make the encoder and decoder deeper</li>
                <li>make the codings larger</li>
              </ol>
            </div>
          </div>
        </>
      )}
      <p className="dl5s-cap">
        <span className="dl5s-own">this page’s own run</span> <code>stacked_ae</code> built and trained exactly as slide 12 (Nadam, MSE, 20 epochs) with
        TensorFlow on Fashion MNIST, and the first validation images (the same five as Figure 17-4 come first). These are not the slide’s images. The
        validation loss is still falling at epoch 20, which fits the first remedy. Each image’s MSE is its own mean squared pixel error, on a 0–1 scale.
      </p>
    </Lab>
  );
}

/* ── §6 · t-SNE ──────────────────────────────────────────────────────────── */
// This page's own grouping of the ten classes into four kinds of item, so the
// map needs four colours (in the portal's fixed series order), not ten.
const FAMILIES = [
  { key: 'tops', name: 'tops, dresses and coats', classes: [0, 2, 3, 4, 6], color: '--dlv-blue' },
  { key: 'trousers', name: 'trousers', classes: [1], color: '--dlv-orange' },
  { key: 'shoes', name: 'footwear', classes: [5, 7, 9], color: '--dlv-aqua' },
  { key: 'bags', name: 'bags', classes: [8], color: '--dlv-yellow' },
];
const FAMILY_OF = Object.fromEntries(FAMILIES.flatMap((f, fi) => f.classes.map((c) => [c, fi])));

// re-draw when the portal theme changes (canvas colours are read from CSS)
function useThemeKey() {
  const [key, setKey] = useState('');
  useEffect(() => {
    const el = document.querySelector('.portal');
    if (!el) return undefined;
    const read = () => setKey(el.getAttribute('data-portal-theme') || '');
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-portal-theme'] });
    const id = setTimeout(read, 0);
    return () => { mo.disconnect(); clearTimeout(id); };
  }, []);
  return key;
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function TsneLab() {
  const data = useData(loadTsne);
  const theme = useThemeKey();
  const [mode, setMode] = useState('family');
  const [cls, setCls] = useState(1);
  const [hover, setHover] = useState(null);
  const canvasRef = useRef(null);
  const [cw, setCw] = useState(0);
  const T = data?.TSNE;

  // redraw when the canvas changes width (focus mode, window resize)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setCw(Math.round(entries[0].contentRect.width)));
    ro.observe(c);
    return () => ro.disconnect();
  }, [T]);

  // where each label goes: the median point of its group
  const labels = useMemo(() => {
    if (!T) return [];
    const groups = mode === 'family' ? FAMILIES.map((f) => ({ name: f.name, test: (l) => FAMILY_OF[l] === FAMILIES.indexOf(f) })) : [{ name: T.classNames[cls], test: (l) => l === cls }];
    return groups.map((g) => {
      const xs = [];
      const ys = [];
      T.labels.forEach((l, i) => { if (g.test(l)) { xs.push(T.x[i]); ys.push(T.y[i]); } });
      return { name: g.name, x: median(xs), y: median(ys) };
    });
  }, [T, mode, cls]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !T) return;
    const css = getComputedStyle(c);
    const col = (v) => css.getPropertyValue(v).trim() || '#888';
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth || 520;
    const H = Math.round(W * 0.82);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.height = `${H}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pad = 14;
    const s = Math.min((W - 2 * pad) / T.extent[0], (H - 2 * pad) / T.extent[1]);
    const px = (x) => pad + x * s;
    const py = (y) => pad + (T.extent[1] - y) * s;
    const faint = col('--line');
    const famCols = FAMILIES.map((f) => col(f.color));
    const draw = (i, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(T.x[i]), py(T.y[i]), r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (mode === 'family') {
      for (let i = 0; i < T.labels.length; i++) draw(i, famCols[FAMILY_OF[T.labels[i]]], 1.7);
    } else {
      const on = col('--dlv-violet');
      for (let i = 0; i < T.labels.length; i++) if (T.labels[i] !== cls) draw(i, faint, 1.5);
      for (let i = 0; i < T.labels.length; i++) if (T.labels[i] === cls) draw(i, on, 2);
    }
    // direct labels at each group's median, in ink with a surface halo
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = col('--surface');
    ctx.fillStyle = col('--ink');
    labels.forEach((l) => {
      ctx.strokeText(l.name, px(l.x), py(l.y));
      ctx.fillText(l.name, px(l.x), py(l.y));
    });
    if (hover != null) {
      ctx.strokeStyle = col('--ink');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(T.x[hover]), py(T.y[hover]), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [T, mode, cls, labels, hover, theme, cw]);

  const onMove = (e) => {
    const c = canvasRef.current;
    if (!c || !T) return;
    const r = c.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    const pad = 14;
    const s = Math.min((W - 2 * pad) / T.extent[0], (H - 2 * pad) / T.extent[1]);
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = -1;
    let bd = 64;
    for (let i = 0; i < T.labels.length; i++) {
      const d = (pad + T.x[i] * s - mx) ** 2 + (pad + (T.extent[1] - T.y[i]) * s - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    setHover(best >= 0 ? best : null);
  };

  const counts = useMemo(() => (T ? T.classNames.map((_, k) => T.labels.filter((l) => l === k).length) : []), [T]);
  return (
    <Lab
      title="t-SNE of the codings (Figure 17-5’s idea)"
      slides="slides 14–15"
      tryThis="before switching to one class at a time, predict which classes will sit apart and which will overlap. Then pick trousers, bags and the different tops in turn, and notice where the clusters blur."
    >
      <div className="dl-lab__controls">
        <Chips label="colour by" value={mode} options={[{ v: 'family', l: 'kind of item (4 groups)' }, { v: 'class', l: 'one class at a time' }]} onChange={setMode} />
        {mode === 'class' && T && (
          <Chips label="class" value={cls} options={T.classNames.map((nm, k) => ({ v: k, l: nm }))} onChange={setCls} />
        )}
      </div>
      {!T ? pending : (
        <div className="dl5s-tsne">
          <canvas
            ref={canvasRef}
            className="dl5s-tsne__canvas"
            role="img"
            aria-label={`t-SNE map of ${fmtInt(T.count)} validation images' codings, coloured ${mode === 'family' ? 'by kind of item' : `to show ${T.classNames[cls]}`}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
          <div className="dl5s-tsne__side">
            {mode === 'family' ? (
              <ul className="dl5s-tsne__legend">
                {FAMILIES.map((f) => (
                  <li key={f.key}>
                    <span className="dl5s-dot" style={{ background: `var(${f.color})` }} />
                    <b>{f.name}</b>
                    <span className="dl5s-mini">{f.classes.map((c) => T.classNames[c]).join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dl5s-readout"><span className="dl5s-dot" style={{ background: 'var(--dlv-violet)' }} /><b>{T.classNames[cls]}</b>: {fmtInt(counts[cls])} of the {fmtInt(T.count)} images; every other class in grey.</p>
            )}
            <p className="dl5s-readout dl5s-tsne__hover" aria-live="polite">
              {hover != null ? <>Nearest point: validation image {fmtInt(hover + 1)}, a <b>{T.classNames[T.labels[hover]]}</b>.</> : 'Hover the map to name a point.'}
            </p>
          </div>
        </div>
      )}
      <p className="dl5s-cap">
        <span className="dl5s-own">this page’s own run</span> Slide 14’s code: <code>stacked_encoder.predict(X_valid)</code> gives 30 codings per image, then{' '}
        <code>TSNE()</code> (scikit-learn, random_state=42) maps all {T ? fmtInt(T.count) : '5,000'} validation images to 2D. The axes of a t-SNE map have no
        meaning; only who sits near whom does. The four colour groups are this page’s own grouping of the ten classes. Figure 17-5 colours each class and adds item
        thumbnails; like it, this map keeps trousers, bags and footwear apart while the tops overlap.
      </p>
    </Lab>
  );
}
