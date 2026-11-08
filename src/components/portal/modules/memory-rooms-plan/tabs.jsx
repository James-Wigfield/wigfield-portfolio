import { lazy, Suspense, useEffect, useState } from 'react';
import { DioramaArt, ScanArt, GeneratedArt } from './art';
import { SAMPLE_SCENE, SAMPLE_JSON } from './sampleScene';
import blenderTest from './blender-test.webp';
import {
  LANES, CHANGES, CAPTURE_STEPS, SHOTS, NODES, EDGES, PORTABLE, LOOP, HOUSE_ROOMS,
  GIVES, HOUSE_TEST, MILESTONES, QUESTIONS,
} from './content';

const DioramaPreview = lazy(() => import('./DioramaPreview'));

/* ── shared bits ─────────────────────────────────────────────────────────── */

function TabHead({ n, hook, sub }) {
  return (
    <header className="mrp-head">
      <span className="mrp-head__n">{n}</span>
      <h2 className="mrp-head__hook">{hook}</h2>
      {sub && <p className="mrp-head__sub">{sub}</p>}
    </header>
  );
}

export function Dot({ tone, children }) {
  return <span className="mrp-dot" data-tone={tone}>{children}</span>;
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="mrp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function useReducedMotion() {
  const [reduce] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  return reduce;
}

/* ── 01 · Verdict ───────────────────────────────────────────────────────── */

const ART = { diorama: DioramaArt, scan: ScanArt, generated: GeneratedArt };

export function Verdict() {
  return (
    <div className="mrp-tab">
      <TabHead
        n="01"
        hook="Your idea holds, as a diorama rather than a photograph."
        sub="Six phone photos are plenty for Claude to rebuild a room as a stylised model, but not enough for a photoreal one. So every spot gets a diorama, and the places that matter most can also get a free phone scan."
      />
      <div className="mrp-lanes">
        {LANES.map((l) => {
          const Art = ART[l.id];
          return (
            <article key={l.id} className="mrp-lane" data-pick={l.tone}>
              <div className="mrp-lane__art"><Art /></div>
              <div className="mrp-lane__top">
                <h3>{l.name}</h3>
                <Dot tone={l.tone}>{l.verdict}</Dot>
              </div>
              <p className="mrp-lane__by">{l.by}</p>
              <dl className="mrp-lane__rows">
                {l.rows.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>

      <section className="mrp-block">
        <h3 className="mrp-micro">What changes from your original idea</h3>
        <ol className="mrp-ruled">
          {CHANGES.map((c, i) => (
            <li key={c.title}>
              <span className="mrp-ruled__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="mrp-ruled__t"><strong>{c.title}</strong> {c.why}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ── 02 · Capture ───────────────────────────────────────────────────────── */

function PhoneScreen({ kind }) {
  // 64 × 112 phone, content drawn per step
  return (
    <svg viewBox="0 0 64 112" className="mrp-phone" aria-hidden="true">
      <rect x="1" y="1" width="62" height="110" rx="9" className="mrp-phone__body" />
      <rect x="25" y="5" width="14" height="3" rx="1.5" className="mrp-phone__notch" />
      {kind === 'kind' && (
        <g>
          <rect x="8" y="18" width="48" height="34" rx="3" className="mrp-phone__tile mrp-phone__tile--on" />
          <path d="M18 44 V30 L32 22 L46 30 V44 Z" className="mrp-phone__glyph" />
          <rect x="8" y="58" width="48" height="34" rx="3" className="mrp-phone__tile" />
          <path d="M16 86 V72 h10 v-6 h12 v6 h10 v14 Z" className="mrp-phone__glyph mrp-phone__glyph--dim" />
          <rect x="8" y="98" width="30" height="4" rx="2" className="mrp-phone__line" />
        </g>
      )}
      {kind === 'photos' && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={8 + (i % 2) * 25} y={16 + Math.floor(i / 2) * 25} width="23" height="23" rx="2" className={i < 5 ? 'mrp-phone__thumb' : 'mrp-phone__tile'} />
          ))}
          <circle cx="32" cy="98" r="7" className="mrp-phone__shutter" />
        </g>
      )}
      {kind === 'memory' && (
        <g>
          <rect x="8" y="18" width="48" height="22" rx="2" className="mrp-phone__tile mrp-phone__tile--on" />
          <rect x="12" y="24" width="34" height="3" rx="1.5" className="mrp-phone__line" />
          <rect x="12" y="31" width="22" height="3" rx="1.5" className="mrp-phone__line" />
          {[0, 1, 2].map((i) => <rect key={i} x={8 + i * 17} y="48" width="14" height="8" rx="2" className={i === 1 ? 'mrp-phone__tile mrp-phone__tile--on' : 'mrp-phone__tile'} />)}
          <rect x="8" y="64" width="48" height="14" rx="2" className="mrp-phone__tile" />
          <text x="32" y="74" className="mrp-phone__txt">.spz</text>
        </g>
      )}
      {kind === 'place' && (
        <g>
          <rect x="6" y="16" width="52" height="64" rx="2" className="mrp-phone__map" />
          <path d="M14 60 Q24 40 36 48 T54 34" className="mrp-phone__road" />
          <path d="M32 50 c-6 -8 -6 -16 0 -16 c6 0 6 8 0 16 z" className="mrp-phone__pin" />
          <circle cx="32" cy="40" r="2" className="mrp-phone__notch" />
          <rect x="8" y="88" width="48" height="12" rx="3" className="mrp-phone__tile mrp-phone__tile--on" />
        </g>
      )}
    </svg>
  );
}

function Cam({ x, y, a, n, wide = false }) {
  // a camera glyph at (x,y) looking along angle a (deg), with a view cone
  const span = wide ? 30 : 24;
  const len = wide ? 84 : 62;
  const r = (deg) => (deg * Math.PI) / 180;
  const p1 = [x + Math.cos(r(a - span)) * len, y + Math.sin(r(a - span)) * len];
  const p2 = [x + Math.cos(r(a + span)) * len, y + Math.sin(r(a + span)) * len];
  return (
    <g className="mrp-cam">
      <path d={`M${x} ${y} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${len} ${len} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} Z`} className="mrp-cam__cone" />
      <circle cx={x} cy={y} r="9" className="mrp-cam__body" />
      <text x={x} y={y + 3.5} className="mrp-cam__n">{n}</text>
    </g>
  );
}

function ShotGuide({ mode }) {
  if (mode === 'interior') {
    return (
      <svg viewBox="0 0 320 240" className="mrp-shots" role="img" aria-label="Interior shot guide: four corner shots across the room, one wide from the door, one detail">
        <defs>
          <clipPath id="mrp-room-clip"><rect x="50" y="30" width="220" height="180" /></clipPath>
        </defs>
        <g clipPath="url(#mrp-room-clip)">
          <Cam x={62} y={42} a={39} n="1" />
          <Cam x={258} y={42} a={141} n="2" />
          <Cam x={258} y={198} a={-141} n="3" />
          <Cam x={62} y={198} a={-39} n="4" />
        </g>
        <rect x="50" y="30" width="220" height="180" className="mrp-shots__room" />
        <line x1="50" y1="150" x2="50" y2="186" className="mrp-shots__gap" />
        <path d="M50 150 A36 36 0 0 1 86 186" className="mrp-shots__swing" />
        <Cam x={34} y={168} a={-8} n="6" wide />
        <g transform="translate(196 112)">
          <path d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6Z" className="mrp-shots__star" />
        </g>
        <Cam x={160} y={150} a={-35} n="5" />
        <text x="160" y="228" className="mrp-shots__cap">door</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 240" className="mrp-shots" role="img" aria-label="Exterior shot guide: four angles around the building, one wide with context, one detail">
      <rect x="0" y="196" width="320" height="44" className="mrp-shots__street" />
      <rect x="112" y="78" width="96" height="74" className="mrp-shots__bldg" />
      <path d="M112 78 L160 52 L208 78" className="mrp-shots__roof" />
      <Cam x={70} y={40} a={38} n="1" />
      <Cam x={250} y={40} a={142} n="2" />
      <Cam x={252} y={184} a={-140} n="3" />
      <Cam x={68} y={184} a={-40} n="4" />
      <g transform="translate(170 140)">
        <path d="M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4Z" className="mrp-shots__star" />
      </g>
      <Cam x={196} y={176} a={-115} n="5" />
      <Cam x={160} y={226} a={-90} n="6" wide />
      <text x="292" y="232" className="mrp-shots__cap">street</text>
    </svg>
  );
}

export function Capture() {
  const [mode, setMode] = useState('interior');
  return (
    <div className="mrp-tab">
      <TabHead
        n="02"
        hook="Four screens, six photos, one line."
        sub="It's the tool's own web page, open on your phone. Saving never needs signal: spots wait in an outbox and upload later."
      />
      <ol className="mrp-steps">
        {CAPTURE_STEPS.map((s, i) => (
          <li key={s.id}>
            <PhoneScreen kind={s.id} />
            <span className="mrp-steps__n">{String(i + 1).padStart(2, '0')}</span>
            <strong>{s.title}</strong>
            <span>{s.line}</span>
          </li>
        ))}
      </ol>

      <div className="mrp-split">
        <section className="mrp-block">
          <div className="mrp-block__bar">
            <h3 className="mrp-micro">Shot guide</h3>
            <Seg label="Spot kind" value={mode} onChange={setMode} options={[{ id: 'interior', label: 'Interior' }, { id: 'exterior', label: 'Exterior' }]} />
          </div>
          <ShotGuide mode={mode} />
          <p className="mrp-cap">{SHOTS[mode]}</p>
        </section>

        <section className="mrp-block">
          <h3 className="mrp-micro">No signal? It waits</h3>
          <Outbox />
          <ul className="mrp-ruled mrp-ruled--plain">
            <li><Dot tone="go">Shrunk on the phone</Dot><span className="mrp-ruled__t">to 2048 px JPEG plus a thumbnail before they're queued.</span></li>
            <li><Dot tone="go">GPS on save</Dot><span className="mrp-ruled__t">Photos picked in a web page lose their location, so the page asks the phone directly.</span></li>
            <li><Dot tone="maybe">Optional scan</Dot><span className="mrp-ruled__t">Scaniverse: walk slowly for 1–2 min, export <code>.spz</code>, attach it at step 3.</span></li>
            <li><Dot tone="later">Keep a video</Dot><span className="mrp-ruled__t">Film a slow 20 s walk-around and leave it in your camera roll. It's insurance and isn't uploaded.</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Outbox() {
  return (
    <svg viewBox="0 0 400 96" className="mrp-outbox" role="img" aria-label="Phone saves to an outbox, which uploads to storage when there's signal">
      <line x1="40" y1="44" x2="360" y2="44" className="mrp-outbox__rail" />
      <path d="M165 44 q10 -16 20 0 t20 0 t20 0" className="mrp-outbox__nosig" />
      {[
        { x: 40, label: 'Phone', sub: 'capture' },
        { x: 140, label: 'Outbox', sub: 'on the phone' },
        { x: 260, label: 'Upload', sub: 'retries itself' },
        { x: 360, label: 'Stored', sub: 'R2 + Supabase' },
      ].map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy="44" r="8" className="mrp-outbox__node" />
          <text x={n.x} y="74" className="mrp-outbox__label">{n.label}</text>
          <text x={n.x} y="88" className="mrp-outbox__sub">{n.sub}</text>
        </g>
      ))}
      <text x="195" y="24" className="mrp-outbox__sub">no signal</text>
      <circle r="5" className="mrp-outbox__pulse" cx="40" cy="44" />
    </svg>
  );
}

/* ── 03 · Framework ─────────────────────────────────────────────────────── */

export function Framework() {
  const [sel, setSel] = useState('claude');
  const node = NODES.find((n) => n.id === sel);
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <div className="mrp-tab">
      <TabHead
        n="03"
        hook="One pipe from your phone to the map."
        sub="It runs on the site Worker, Supabase and three.js, which this repo already has, plus Blender on your PC. R2 is the one new piece. Tap a box to see what it does."
      />
      <div className="mrp-arch-wrap">
        <svg viewBox="0 0 960 300" className="mrp-arch" role="group" aria-label="System diagram">
          <defs>
            <marker id="mrp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="mrp-arch__head" />
            </marker>
          </defs>
          {EDGES.map((e) => {
            const a = byId[e.from];
            const b = byId[e.to];
            const x1 = a.x + 66;
            const x2 = b.x - 66;
            const mx = (x1 + x2) / 2;
            const d = `M${x1} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}`;
            const on = sel === e.from || sel === e.to;
            return (
              <g key={`${e.from}-${e.to}`} className="mrp-arch__edge" data-on={on} data-dash={e.dash || undefined}>
                <path d={d} markerEnd="url(#mrp-arrow)" />
                {e.label && <text x={mx} y={(a.y + b.y) / 2 - 8}>{e.label}</text>}
              </g>
            );
          })}
          {NODES.map((n) => (
            <g
              key={n.id}
              className="mrp-arch__node"
              data-role={n.role}
              data-on={sel === n.id}
              transform={`translate(${n.x - 66} ${n.y - 34})`}
              tabIndex={0}
              role="button"
              aria-pressed={sel === n.id}
              aria-label={`${n.title}: ${n.sub}`}
              onClick={() => setSel(n.id)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel(n.id); } }}
            >
              <rect width="132" height="68" rx="4" />
              <circle cx="14" cy="17" r="4" className="mrp-arch__dot" />
              <text x="24" y="21" className="mrp-arch__title">{n.title}</text>
              <text x="12" y="42" className="mrp-arch__sub">{n.sub}</text>
              <text x="12" y="56" className="mrp-arch__sub">{n.sub2}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mrp-detail" aria-live="polite">
        <Dot tone={node.role}>{node.title}</Dot>
        <p>{node.detail}</p>
        <code>{node.where}</code>
      </div>

      <section className="mrp-block">
        <h3 className="mrp-micro">Moves to the trip site as five folders</h3>
        <ul className="mrp-tree">
          {PORTABLE.map(([path, what]) => (
            <li key={path}><code>{path}</code><span>{what}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── 04 · Render loop ───────────────────────────────────────────────────── */

const VIEW_OPTIONS = [
  { id: 'blender', label: 'Blender test' },
  { id: 'layout', label: 'Layout preview' },
  { id: 'json', label: 'scene.json' },
];
const VIEW_CAPTIONS = {
  blender: 'Rendered on your PC: a 60-line headless script built a simplified version of this bedroom, and Cycles rendered it on the GPU in 4.4 s. It shows the lighting only; the real kit adds proper pieces and materials.',
  layout: 'The same scene.json as quick three.js blocks, live in this page. Drag to orbit. The real viewer loads Blender’s baked model instead.',
  json: 'What Claude writes for a room: the layout Blender builds from (a sample, trimmed).',
};

export function RenderLoop() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(!reduce);
  const [view, setView] = useState('blender');

  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % LOOP.length), 1900);
    return () => clearInterval(id);
  }, [auto]);

  const pick = (i) => { setAuto(false); setStep(i); };
  const cx = 200;
  const cy = 150;
  const R = 104;
  const pos = LOOP.map((_, i) => {
    const a = (-90 + (i * 360) / LOOP.length) * (Math.PI / 180);
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });
  const cur = LOOP[step];

  return (
    <div className="mrp-tab">
      <TabHead
        n="04"
        hook="Claude builds, looks, corrects, and stops after three rounds."
        sub="To make a new render you run one skill in Claude Code. Blender renders the model from where each photo was taken, and Claude fixes whatever doesn't match."
      />
      <div className="mrp-split mrp-split--loop">
        <section className="mrp-block">
          <svg viewBox="0 0 360 300" className="mrp-loop" role="group" aria-label="Render loop">
            <circle cx={cx} cy={cy} r={R} className="mrp-loop__ring" />
            <path
              d={`M${pos[5][0] - 4} ${pos[5][1] + 12} Q${cx} ${cy + 20} ${pos[2][0] - 6} ${pos[2][1] + 12}`}
              className="mrp-loop__back"
              markerEnd="url(#mrp-loop-arrow)"
            />
            <defs>
              <marker id="mrp-loop-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" className="mrp-loop__head" />
              </marker>
            </defs>
            <text x={cx} y={cy + 4} className="mrp-loop__fix">fix · up to 3×</text>
            {LOOP.map((s, i) => (
              <g
                key={s.id}
                className="mrp-loop__node"
                data-on={i === step}
                transform={`translate(${pos[i][0]} ${pos[i][1]})`}
                tabIndex={0}
                role="button"
                aria-pressed={i === step}
                aria-label={`Step ${i + 1}: ${s.title}`}
                onClick={() => pick(i)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(i); } }}
              >
                <circle r="22" />
                <text y="-2" className="mrp-loop__n">{String(i + 1).padStart(2, '0')}</text>
                <text y="10" className="mrp-loop__t">{s.short}</text>
              </g>
            ))}
            <g className="mrp-loop__exit">
              <line x1={pos[5][0] - 24} y1={pos[5][1]} x2="30" y2={pos[5][1]} markerEnd="url(#mrp-loop-arrow)" />
              <text x="8" y={pos[5][1] - 30}>bake → push</text>
            </g>
          </svg>
          <div className="mrp-detail mrp-detail--loop" aria-live="polite">
            <Dot tone="claude">{String(step + 1).padStart(2, '0')} · {cur.title}</Dot>
            <p>{cur.line}</p>
            <code>{cur.script}</code>
          </div>
        </section>

        <section className="mrp-block">
          <div className="mrp-block__bar">
            <h3 className="mrp-micro">What Claude writes, and what you see</h3>
            <Seg label="View" value={view} onChange={setView} options={VIEW_OPTIONS} />
          </div>
          {view === 'blender' && (
            <div className="mrp-dio mrp-dio--still">
              <img className="mrp-dio__img" src={blenderTest} alt="The sample bedroom built and rendered by headless Blender with Cycles" width="800" height="600" />
            </div>
          )}
          {view === 'layout' && (
            <Suspense fallback={<div className="mrp-dio"><span className="mrp-dio__msg">Loading three.js…</span></div>}>
              <DioramaPreview scene={SAMPLE_SCENE} label="Quick three.js block-out of the sample scene" />
            </Suspense>
          )}
          {view === 'json' && <pre className="mrp-json" tabIndex={0}>{SAMPLE_JSON}</pre>}
          <p className="mrp-cap">{VIEW_CAPTIONS[view]}</p>
        </section>
      </div>
    </div>
  );
}

/* ── 05 · Your house ────────────────────────────────────────────────────── */

export function House() {
  const [mode, setMode] = useState('one');
  return (
    <div className="mrp-tab">
      <TabHead
        n="05"
        hook="Go room by room, in one shared frame."
        sub="The floor plan fixes the walls and the photos fill the room. Every room is placed on the same house grid, so the whole house assembles itself as rooms get rendered."
      />
      <div className="mrp-split">
        <section className="mrp-block">
          <div className="mrp-block__bar">
            <h3 className="mrp-micro">Floor plan · illustrative, not yours</h3>
            <Seg label="House view" value={mode} onChange={setMode} options={[{ id: 'one', label: 'Test room' }, { id: 'all', label: 'Whole house' }]} />
          </div>
          <svg viewBox="0 0 340 236" className="mrp-plan" data-mode={mode} role="img" aria-label={mode === 'one' ? 'One test room highlighted on the floor plan' : 'All rooms placed on one house grid'}>
            {HOUSE_ROOMS.map((r) => (
              <g key={r.id} className="mrp-plan__room" data-test={r.test || undefined}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 4}>{r.label}</text>
                <g className="mrp-plan__origin" transform={`translate(${r.x} ${r.y})`}>
                  <path d="M0 0 h10 M0 0 v10" />
                  <circle r="2.2" />
                </g>
              </g>
            ))}
            <text x="14" y="228" className="mrp-plan__note">{mode === 'one' ? 'origin [0, 0] = your test room’s NW corner' : 'each room: frame { group: "home", origin, rotY }'}</text>
          </svg>
        </section>

        <section className="mrp-block">
          <h3 className="mrp-micro">Who supplies what</h3>
          <div className="mrp-gives">
            {GIVES.map((g) => (
              <div key={g.from} className="mrp-gives__row">
                <span className="mrp-gives__from">{g.from}</span>
                <span className="mrp-gives__arrow" aria-hidden="true">→</span>
                <span className="mrp-gives__to">{g.to}</span>
              </div>
            ))}
          </div>
          <h3 className="mrp-micro mrp-micro--gap">The first test, one room</h3>
          <ol className="mrp-ruled">
            {HOUSE_TEST.map((t, i) => (
              <li key={t}>
                <span className="mrp-ruled__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="mrp-ruled__t">{t}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

/* ── 06 · Roadmap + open questions ──────────────────────────────────────── */

const T0 = Date.UTC(2026, 10, 8);
const T1 = Date.UTC(2027, 1, 20);
const xOf = (iso) => 30 + ((Date.parse(iso) - T0) / (T1 - T0)) * 700;

export function Roadmap() {
  const months = [['2026-11-01', 'NOV'], ['2026-12-01', 'DEC'], ['2027-01-01', 'JAN'], ['2027-02-01', 'FEB']];
  return (
    <div className="mrp-tab">
      <TabHead
        n="06"
        hook="Build in November, test at home, capture from 16 December."
        sub="The dates are suggestions. The one hard date is the flight."
      />
      <div className="mrp-time-wrap">
        <svg viewBox="0 0 760 170" className="mrp-time" role="img" aria-label="Timeline from now to after the trip">
          <line x1="30" y1="96" x2="730" y2="96" className="mrp-time__axis" />
          {months.map(([d, m]) => {
            const x = Math.max(30, xOf(d));
            return (
              <g key={m}>
                <line x1={x} y1="90" x2={x} y2="102" className="mrp-time__tick" />
                <text x={x + 4} y="118" className="mrp-time__month">{m}</text>
              </g>
            );
          })}
          <rect x={xOf('2026-12-16')} y="84" width={xOf('2027-01-15') - xOf('2026-12-16')} height="24" className="mrp-time__trip" />
          <text x={(xOf('2026-12-16') + xOf('2027-01-15')) / 2} y="100" className="mrp-time__tripl">the trip · capture</text>
          {MILESTONES.map((m, i) => {
            const x = xOf(m.date);
            const up = i % 2 === 0;
            const end = m.end ? xOf(m.end) : null;
            return (
              <g key={m.label} className="mrp-time__m" data-tone={m.tone}>
                {end && <line x1={x} y1="96" x2={end} y2="96" className="mrp-time__span" />}
                <line x1={x} y1="96" x2={x} y2={up ? 48 : 136} className="mrp-time__stem" />
                <circle cx={x} cy="96" r="4.5" />
                <text x={x + 6} y={up ? 44 : 146} className="mrp-time__label">{m.label}</text>
                <text x={x + 6} y={up ? 30 : 160} className="mrp-time__date">{m.when}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <section className="mrp-block">
        <h3 className="mrp-micro">Open questions · answer before pasting the prompt (each has a default)</h3>
        <ol className="mrp-qs">
          {QUESTIONS.map((q, i) => (
            <li key={q.q}>
              <span className="mrp-ruled__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="mrp-qs__q">{q.q}</span>
              <span className="mrp-qs__d"><Dot tone={q.tone}>default</Dot> {q.d}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
