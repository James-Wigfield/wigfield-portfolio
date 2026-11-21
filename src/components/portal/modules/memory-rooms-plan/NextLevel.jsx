import { useEffect, useRef, useState } from 'react';
import room from './blender-test.webp';
import './next-level.css';

/* ── 07 · Next level ─────────────────────────────────────────────────────────
   A quick visual of the 2026-11-21 plan (vault: 2026-11-21-memory-rooms-next-
   level-plan): the "Recall" look for /memories and the whole-building idea.
   Mock-ups only: nothing here is wired to the real tool. */

const FONT_ID = 'mrn-instrument-serif';

function useSerif() {
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(l);
  }, []);
}

/* The signature: the room "recalls" itself from a cloud of points, then the
   solid render fades up. A 2D canvas stand-in for the three.js version. */
function RecallCanvas({ run }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const W = 800;
    const H = 600;
    canvas.width = W;
    canvas.height = H;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let alive = true;
    const img = new Image();
    img.src = room;
    img.onload = () => {
      if (!alive) return;
      if (reduce) {
        ctx.drawImage(img, 0, 0, W, H);
        return;
      }
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const o = off.getContext('2d');
      o.drawImage(img, 0, 0, W, H);
      const data = o.getImageData(0, 0, W, H).data;
      const pts = [];
      const STEP = 5;
      for (let y = 0; y < H; y += STEP) {
        for (let x = 0; x < W; x += STEP) {
          const i = (y * W + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (data[i + 3] < 40 || (r > 246 && g > 246 && b > 246)) continue; // the paper behind the room
          const a = Math.random() * Math.PI * 2;
          const d = 120 + Math.random() * 380;
          pts.push({
            x, y, c: `rgb(${r},${g},${b})`,
            sx: W / 2 + Math.cos(a) * d, sy: H / 2 + Math.sin(a) * d * 0.7,
            delay: Math.random() * 0.45,
          });
        }
      }
      const t0 = performance.now();
      const DUR = 2.6;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const frame = (now) => {
        if (!alive) return;
        const t = (now - t0) / 1000;
        ctx.clearRect(0, 0, W, H);
        for (const p of pts) {
          const k = ease(Math.min(1, Math.max(0, (t - p.delay) / (DUR - 0.6))));
          const drift = (1 - k) * 6 * Math.sin(now / 400 + p.x);
          ctx.fillStyle = p.c;
          ctx.globalAlpha = 0.35 + 0.65 * k;
          ctx.fillRect(p.sx + (p.x - p.sx) * k + drift, p.sy + (p.y - p.sy) * k, 2.4, 2.4);
        }
        const solid = Math.min(1, Math.max(0, (t - DUR) / 0.8));
        if (solid > 0) {
          ctx.globalAlpha = solid;
          ctx.drawImage(img, 0, 0, W, H);
        }
        ctx.globalAlpha = 1;
        if (solid < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [run]);
  return <canvas ref={ref} className="mrn-canvas" aria-label="A bedroom diorama forming from points" />;
}

function SpotMock() {
  const [run, setRun] = useState(0);
  return (
    <div className="mrn-spot">
      <div className="mrn-stage">
        <span className="mrn-back">← Map</span>
        <RecallCanvas run={run} />
        {/* pin as an architectural callout: leader line to the margin */}
        <svg className="mrn-leader" viewBox="0 0 800 600" preserveAspectRatio="none" aria-hidden="true">
          <circle cx="430" cy="335" r="5" />
          <polyline points="430,335 560,200 800,200" />
        </svg>
        <p className="mrn-callout">
          <b>01</b> The bed we didn't sleep in, first night in NYC.
        </p>
        <div className="mrn-titleblock">
          <div className="mrn-tb__row"><span>Sheet</span><b>MR-004</b></div>
          <div className="mrn-tb__row"><span>Place</span><b>New York, NY</b></div>
          <div className="mrn-tb__row"><span>Captured</span><b>17 Dec 2026</b></div>
          <div className="mrn-tb__foot">
            <span className="mrn-scale"><i /><i /><i /><em>0 · 1 · 2 m</em></span>
            <svg className="mrn-north" viewBox="0 0 20 20" aria-label="North"><path d="M10 2 L14 17 L10 13 L6 17 Z" /><text x="10" y="-1">N</text></svg>
          </div>
        </div>
        <button type="button" className="mrn-replay" onClick={() => setRun((n) => n + 1)}>Replay recall</button>
      </div>
      <aside className="mrn-panel">
        <span className="mrn-label">Interior · ● Rendered</span>
        <h3 className="mrn-title">Front bedroom</h3>
        <blockquote className="mrn-quote">
          “Jet-lagged, 3 a.m., watching the snow on the fire escape.”
          <cite>— James</cite>
        </blockquote>
        <div className="mrn-actions">
          <span className="mrn-btn mrn-btn--ink">Walk in</span>
          <span className="mrn-btn">See it in your space</span>
        </div>
        <dl className="mrn-meta">
          <dt>Building</dt><dd>Brooklyn apartment · room 2 of 5</dd>
          <dt>Day</dt><dd>Day 2 of the trip</dd>
        </dl>
      </aside>
    </div>
  );
}

const INDEX = [
  { n: '001', t: 'Front bedroom', p: 'New York, NY · 17 Dec', who: 'James' },
  { n: '002', t: 'Corner diner', p: 'San Diego, CA · 3 Jan', who: 'Justin' },
  { n: '003', t: 'Brooklyn apartment', p: 'New York, NY · 5 rooms', who: 'Both', building: true },
];

function IndexMock() {
  return (
    <div className="mrn-index">
      <ol>
        {INDEX.map((r) => (
          <li key={r.n}>
            <span className="mrn-index__n">No. {r.n}</span>
            <span className="mrn-index__cut" data-building={r.building ? '' : undefined}>
              {r.building ? <IsoHouse small /> : <img src={room} alt="" />}
            </span>
            <span className="mrn-index__t">{r.t}<small>{r.p}</small></span>
            <span className="mrn-label">{r.who}</span>
          </li>
        ))}
      </ol>
      <div className="mrn-days" aria-label="Trip day strip">
        {Array.from({ length: 31 }, (_, i) => (
          <i key={i} data-on={[1, 2, 18, 19].includes(i) ? '' : undefined} />
        ))}
        <span className="mrn-label">16 Dec</span>
        <span className="mrn-label">15 Jan</span>
      </div>
    </div>
  );
}

/* ── whole building ──────────────────────────────────────────────────────── */

const ROOMS = [
  { id: 'living', name: 'Living', pts: '20,20 200,20 200,150 20,150', done: true },
  { id: 'kitchen', name: 'Kitchen', pts: '200,20 320,20 320,110 200,110', done: true },
  { id: 'hall', name: 'Hall', pts: '200,110 320,110 320,150 200,150', done: false },
  { id: 'bed1', name: 'Bed 1', pts: '20,150 140,150 140,260 20,260', done: true },
  { id: 'bath', name: 'Bath', pts: '140,150 210,150 210,260 140,260', done: false },
  { id: 'bed2', name: 'Bed 2', pts: '210,150 320,150 320,260 210,260', done: false },
];

function PlanMock() {
  const [sel, setSel] = useState('living');
  const centre = (pts) => {
    const p = pts.split(' ').map((s) => s.split(',').map(Number));
    return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
  };
  return (
    <figure className="mrn-plan">
      <svg viewBox="0 0 340 280" role="img" aria-label="Floor plan with captured rooms filled in">
        {ROOMS.map((r) => {
          const [cx, cy] = centre(r.pts);
          return (
            <g key={r.id} className="mrn-room" data-done={r.done ? '' : undefined} data-sel={sel === r.id ? '' : undefined} onClick={() => setSel(r.id)}>
              <polygon points={r.pts} />
              <text x={cx} y={cy - 2}>{r.name}</text>
              <text x={cx} y={cy + 11} className="mrn-room__s">{r.done ? '● captured' : '○ to capture'}</text>
            </g>
          );
        })}
        {/* wall graph: every shared wall drawn once, exterior thicker */}
        <path className="mrn-wall mrn-wall--ext" d="M20 20 H320 V260 H20 Z" />
        <path className="mrn-wall" d="M200 20 V150 M200 110 H320 M20 150 H320 M140 150 V260 M210 150 V260" />
        {/* door gaps + swings */}
        <g className="mrn-door">
          <rect x="230" y="146" width="26" height="8" /><path d="M230 150 A26 26 0 0 1 256 124" />
          <rect x="80" y="146" width="26" height="8" /><path d="M106 150 A26 26 0 0 0 80 176" />
          <rect x="250" y="256" width="30" height="8" />
        </g>
        <text x="300" y="276" className="mrn-plan__n">N ↑</text>
      </svg>
      <figcaption>
        <span className="mrn-label">Capture checklist</span>
        Tap a room on the phone, take its six photos, and it fills in. Selected: <b>{ROOMS.find((r) => r.id === sel).name}</b>.
      </figcaption>
    </figure>
  );
}

function IsoHouse({ small = false }) {
  // simple isometric stack: site, level, lifted roof
  const iso = (x, y, z) => [160 + (x - y) * 0.87, 150 + (x + y) * 0.5 - z];
  const poly = (pts) => pts.map((p) => iso(...p).join(',')).join(' ');
  const box = (x0, y0, x1, y1, z) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  return (
    <svg className={small ? 'mrn-iso mrn-iso--small' : 'mrn-iso'} viewBox={small ? '0 0 320 300' : '0 0 420 300'} aria-hidden={small || undefined} role={small ? undefined : 'img'} aria-label={small ? undefined : 'Exploded building: roof lifted above the ground floor and site'}>
      <polygon className="mrn-iso__site" points={box(-40, -40, 160, 140, 0)} />
      <polygon className="mrn-iso__floor" points={box(0, 0, 120, 100, 4)} />
      {/* section-cut walls */}
      <polygon className="mrn-iso__wall" points={poly([[0, 100, 4], [120, 100, 4], [120, 100, 34], [0, 100, 34]])} />
      <polygon className="mrn-iso__wall mrn-iso__wall--side" points={poly([[120, 0, 4], [120, 100, 4], [120, 100, 34], [120, 0, 34]])} />
      <polyline className="mrn-iso__cut" points={poly([[0, 100, 34], [120, 100, 34], [120, 0, 34]])} />
      <polyline className="mrn-iso__inner" points={poly([[60, 0, 4], [60, 100, 4]])} />
      <polyline className="mrn-iso__inner" points={poly([[0, 55, 4], [120, 55, 4]])} />
      {/* roof, lifted */}
      <polygon className="mrn-iso__roof" points={poly([[-8, -8, 80], [128, -8, 80], [128, 50, 115], [-8, 50, 115]])} />
      <polygon className="mrn-iso__roof mrn-iso__roof--b" points={poly([[-8, 50, 115], [128, 50, 115], [128, 108, 80], [-8, 108, 80]])} />
      {!small && (
        <>
          <text {...xy(iso(140, 20, 112))}>roof · lifted</text>
          <text {...xy(iso(140, 40, 40))}>level 1 · plan cut at 1.2 m</text>
          <text {...xy(iso(170, 130, 0))}>site · lot, drive, trees</text>
        </>
      )}
    </svg>
  );
}
const xy = ([x, y]) => ({ x, y });

export default function NextLevel() {
  useSerif();
  return (
    <div className="mrp-tab mrn">
      <header className="mrp-head">
        <span className="mrp-head__n">07</span>
        <h2 className="mrp-head__hook">Next level: a sheet in an archive of memories, and whole buildings.</h2>
        <p className="mrp-head__sub">
          Mock-ups of the 21 Nov plan. Same paper, ink and mono labels as /memories today, plus architect's-drawing
          details and one signature effect: the room recalls itself from points. Not wired to the real tool.
        </p>
      </header>

      <span className="mrp-micro">1 · The spot page, restyled</span>
      <SpotMock />
      <ul className="mrn-notes">
        <li><b>Recall</b> the small map model loads first as a point cloud, then settles into the solid room.</li>
        <li><b>Title block</b> sheet number, place, date, live scale bar, north arrow that turns with the orbit.</li>
        <li><b>Callouts</b> pins become numbered leader lines; the note becomes a serif pull-quote.</li>
        <li><b>Ground</b> a drafting grid fading out, instead of the grey oval.</li>
      </ul>

      <span className="mrp-micro mrp-micro--gap">2 · The map's list as an index</span>
      <IndexMock />

      <span className="mrp-micro mrp-micro--gap">3 · Whole buildings</span>
      <div className="mrn-building">
        <PlanMock />
        <figure className="mrn-explode">
          <IsoHouse />
          <figcaption>
            <span className="mrn-label">Building page</span>
            Outside view → lift the roof → plan cut → tap a room to fly in → walk the whole house.
          </figcaption>
        </figure>
      </div>
      <ul className="mrn-notes">
        <li><b>building.json</b> levels, a wall graph (shared walls once), any-shape rooms, doors, stairs, roof, site, real north.</li>
        <li><b>Rooms</b> become furniture layers inside the building; today's spots keep working.</li>
        <li><b>Plan in</b> trace a floor plan image, or sketch rooms on the phone when there isn't one.</li>
      </ul>

      <span className="mrp-micro mrp-micro--gap">4 · Order</span>
      <ol className="mrn-order">
        <li><span className="mrn-label">Before 10 Dec</span>Contracts, the Recall design pass, capturing whole places on the phone.</li>
        <li><span className="mrn-label">After the trip</span>Blender house build, building page, house walk, true placement on the map.</li>
        <li><span className="mrn-label">Rolling</span>Voice memories, real sun, postcards, trip chapters.</li>
      </ol>
    </div>
  );
}
