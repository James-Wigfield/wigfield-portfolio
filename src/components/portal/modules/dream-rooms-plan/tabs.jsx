import { lazy, Suspense, useMemo, useState } from 'react';
import { PhoneScreen, Outbox, ViewerWire, ArchiveArt } from './art';
import stillHaze from './blender-corridor.webp';
import stillClear from './blender-corridor-clear.webp';
import atlasImg from './blender-atlas.webp';
import {
  DAY, MVP, CALLS, FINDINGS, CAPTURE_STEPS, RULES_6AM, DICTATION, SAMPLE_DREAM, KINDS, FRAGMENTS, SCENE_RULES,
  ROLES, AHEAD, LIVE, BLENDER_VIEWS, BLENDER_CAPTIONS, BLENDER_FACTS, SKILLS, SKETCH_FRAGMENTS, FEEL_RULES, MODES,
  BENCH, WHO, LEVELS, GATE, PRIVACY_RULES, ARCHIVE_DREAMS, ARCHIVE_MOTIFS, ARCHIVE_LINES, PHASES, RISKS, QUESTIONS,
} from './content';

const LiminalSketch = lazy(() => import('./LiminalSketch'));

/* ── shared bits ─────────────────────────────────────────────────────────── */

function TabHead({ n, hook, sub }) {
  return (
    <header className="drp-head">
      <span className="drp-head__n">{n}</span>
      <h2 className="drp-head__hook">{hook}</h2>
      {sub && <p className="drp-head__sub">{sub}</p>}
    </header>
  );
}

export function Dot({ tone, children }) {
  return <span className="drp-dot" data-tone={tone}>{children}</span>;
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="drp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TONE_LABEL = { go: 'decided', maybe: 'your call', later: 'later' };

/* headline-only rows that open to their reason (keeps the tab short) */
function FoldList({ items }) {
  const [open, setOpen] = useState(() => new Set());
  const flip = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <ol className="drp-fold">
      {items.map((c, i) => {
        const on = open.has(c.title);
        return (
          <li key={c.title} data-open={on}>
            <button type="button" className="drp-fold__head" aria-expanded={on} onClick={() => flip(c.title)}>
              <span className="drp-ruled__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="drp-fold__title">
                {c.tone && <Dot tone={c.tone}>{c.tag ?? TONE_LABEL[c.tone]}</Dot>}
                <strong>{c.title}</strong>
              </span>
              <span className="drp-fold__sign" aria-hidden="true">{on ? '–' : '+'}</span>
            </button>
            {on && <p className="drp-fold__why">{c.why}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/* ── 01 · Verdict ───────────────────────────────────────────────────────── */

export function Verdict() {
  return (
    <div className="drp-tab">
      <TabHead
        n="01"
        hook="It works, built the Memory Rooms way, with the strangeness kept as data."
        sub="Claude reads the dream, Blender builds and bakes it on your PC, and the browser adds the fog, the sound and the impossible doors."
      />
      <ol className="drp-dayrail" aria-label="A day with Dream Rooms">
        {DAY.map((d, i) => (
          <li key={d.title} data-i={i}>
            <span className="drp-dayrail__t">{d.t}</span>
            <span className="drp-dayrail__dot" aria-hidden="true" />
            <strong>{d.title}</strong>
            <span className="drp-dayrail__sub">{d.sub}</span>
          </li>
        ))}
      </ol>
      <div className="drp-split">
        <figure className="drp-still">
          <img src={stillHaze} alt="A hazy, endless corridor with fluorescent ceiling panels, rendered by headless Blender on this PC" width="1280" height="800" />
          <figcaption className="drp-cap">Built and rendered on your PC by headless Blender in 11 s. This is the test that settled the plan.</figcaption>
        </figure>
        <section className="drp-block">
          <h3 className="drp-micro">The MVP · one dream walkable</h3>
          <ol className="drp-ruled drp-ruled--tight">
            {MVP.map((m, i) => (
              <li key={m}><span className="drp-ruled__n">{String(i + 1).padStart(2, '0')}</span><span className="drp-ruled__t">{m}</span></li>
            ))}
          </ol>
        </section>
      </div>
      <div className="drp-split">
        <section className="drp-block">
          <h3 className="drp-micro">Key calls · tap for the reason</h3>
          <FoldList items={CALLS} />
        </section>
        <section className="drp-block">
          <h3 className="drp-micro">Findings that changed the idea</h3>
          <FoldList items={FINDINGS} />
        </section>
      </div>
    </div>
  );
}

/* ── 02 · Capture ───────────────────────────────────────────────────────── */

export function Capture() {
  return (
    <div className="drp-tab">
      <TabHead
        n="02"
        hook="One dark screen, one button, nothing to decide."
        sub="Built for 6 am: open it, talk to the keyboard’s mic, press Save. Everything else can wait."
      />
      <ol className="drp-steps">
        {CAPTURE_STEPS.map((s, i) => (
          <li key={s.id} data-optional={s.id === 'feel' || undefined}>
            <PhoneScreen kind={s.id} />
            <span className="drp-steps__n">{String(i + 1).padStart(2, '0')}</span>
            <strong>{s.title}</strong>
            <span>{s.line}</span>
          </li>
        ))}
      </ol>
      <div className="drp-split">
        <section className="drp-block">
          <h3 className="drp-micro">Dictation · which way</h3>
          <ul className="drp-ruled drp-ruled--plain">
            {DICTATION.map((d) => (
              <li key={d.name}>
                <Dot tone={d.tone}>{d.verdict}</Dot>
                <span className="drp-ruled__t"><strong>{d.name}.</strong> {d.line}</span>
              </li>
            ))}
          </ul>
          <h3 className="drp-micro drp-micro--gap">No signal? It waits</h3>
          <Outbox />
        </section>
        <section className="drp-block">
          <h3 className="drp-micro">Rules for 6 am</h3>
          <ul className="drp-ruled drp-ruled--plain">
            {RULES_6AM.map((r) => (
              <li key={r.label}><Dot tone={r.tone}>{r.label}</Dot><span className="drp-ruled__t">{r.text}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ── 03 · Dream scene ───────────────────────────────────────────────────── */

export function Scene() {
  const [sel, setSel] = useState('loop');
  const [view, setView] = useState('dream');
  const frag = FRAGMENTS.find((f) => f.id === sel);
  const pieces = useMemo(() => {
    const out = [];
    let at = 0;
    for (const f of [...FRAGMENTS].sort((a, b) => a.span[0] - b.span[0])) {
      if (f.span[0] > at) out.push({ text: SAMPLE_DREAM.slice(at, f.span[0]) });
      out.push({ text: SAMPLE_DREAM.slice(f.span[0], f.span[1]), f });
      at = f.span[1];
    }
    if (at < SAMPLE_DREAM.length) out.push({ text: SAMPLE_DREAM.slice(at) });
    return out;
  }, []);

  return (
    <div className="drp-tab">
      <TabHead
        n="03"
        hook="The odd parts are the point, so they stay in."
        sub="Tap a highlighted fragment to see the entry it became in dream.json, and how world.json builds it."
      />
      <div className="drp-split drp-split--scene">
        <section className="drp-block">
          <h3 className="drp-micro">Sample dream · written for this plan, not a real one</h3>
          <p className="drp-dream">
            {pieces.map((p, i) => (p.f ? (
              <span
                key={i}
                role="button"
                tabIndex={0}
                className="drp-frag"
                data-kind={p.f.kind}
                aria-pressed={sel === p.f.id}
                onClick={() => setSel(p.f.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel(p.f.id); } }}
              >
                {p.text}
              </span>
            ) : <span key={i}>{p.text}</span>))}
          </p>
          <ul className="drp-legend" aria-label="Fragment kinds">
            {KINDS.map((k) => <li key={k.id} data-kind={k.id}>{k.label}</li>)}
          </ul>
        </section>
        <section className="drp-block drp-became">
          <div className="drp-block__bar">
            <Dot tone={frag.kind}>{KINDS.find((k) => k.id === frag.kind).label}</Dot>
            <Seg label="Contract" value={view} onChange={setView} options={[{ id: 'dream', label: 'dream.json' }, { id: 'world', label: 'world.json' }]} />
          </div>
          <div className="drp-code" aria-live="polite">
            <div className="drp-code__chrome"><span className="drp-editor__dots" aria-hidden="true"><i /><i /><i /></span><span>{view}.json</span></div>
            <pre className="drp-code__body" tabIndex={0}>{view === 'dream' ? frag.dream : frag.world}</pre>
          </div>
          <p className="drp-became__how">{frag.how}</p>
          <ul className="drp-ruled drp-ruled--mini drp-became__rules">
            {SCENE_RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ── 04 · Pipeline ──────────────────────────────────────────────────────── */

export function Pipeline() {
  const [sel, setSel] = useState('design');
  const [view, setView] = useState('haze');
  const step = AHEAD.find((s) => s.id === sel);
  const img = { haze: stillHaze, clear: stillClear, atlas: atlasImg }[view];
  return (
    <div className="drp-tab">
      <TabHead
        n="04"
        hook="Your PC does the heavy work once. The browser does the dreaming every frame."
        sub="One new skill, dream-render, runs when you ask. Tap a step to see what it does."
      />
      <div className="drp-lane">
        <div className="drp-block__bar">
          <h3 className="drp-micro">Ahead of time · your PC</h3>
          <ul className="drp-roles" aria-label="Who does each step">
            {ROLES.map((r) => <li key={r.id}><Dot tone={r.id}>{r.label}</Dot></li>)}
          </ul>
        </div>
        <ol className="drp-flow">
          {AHEAD.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="drp-flow__step" data-who={s.who} aria-pressed={sel === s.id} onClick={() => setSel(s.id)}>
                <span className="drp-flow__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="drp-flow__title">{s.title}</span>
                <span className="drp-flow__who">{s.who}{s.id === 'review' ? ' · ↺ ≤ 2' : ''}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="drp-detail" aria-live="polite">
          <Dot tone={step.who}>{step.title}</Dot>
          <p>{step.line}</p>
          <code>{step.code}</code>
        </div>
      </div>
      <p className="drp-handoff"><span>world-v&lt;N&gt;.glb + stills ↓</span></p>
      <div className="drp-lane">
        <h3 className="drp-micro">Live · the browser, every frame</h3>
        <ul className="drp-live">
          {LIVE.map((l) => (
            <li key={l.title}><Dot tone="view">{l.title}</Dot><span>{l.line}</span></li>
          ))}
        </ul>
      </div>
      <div className="drp-split">
        <section className="drp-block">
          <div className="drp-block__bar">
            <h3 className="drp-micro">Tested on your PC</h3>
            <Seg label="Blender output" value={view} onChange={setView} options={BLENDER_VIEWS} />
          </div>
          <div className="drp-still drp-still--frame" data-view={view}>
            <img src={img} alt={BLENDER_CAPTIONS[view]} width={view === 'atlas' ? 512 : 1280} height={view === 'atlas' ? 512 : 800} />
          </div>
          <p className="drp-cap">{BLENDER_CAPTIONS[view]}</p>
          <dl className="drp-facts">
            {BLENDER_FACTS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <section className="drp-block">
          <h3 className="drp-micro">dream-render beside memory-render</h3>
          <div className="drp-skills">
            <div>
              <Dot tone="go">Borrows</Dot>
              <ul>{SKILLS.borrows.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
            <div>
              <Dot tone="later">Leaves behind</Dot>
              <ul>{SKILLS.leaves.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          </div>
          <p className="drp-cap">The Blender MCP isn’t needed: it only works with the Blender app open. It stays handy for hand touch-ups.</p>
        </section>
      </div>
    </div>
  );
}

/* ── 05 · Experience ────────────────────────────────────────────────────── */

export function Experience() {
  return (
    <div className="drp-tab">
      <TabHead
        n="05"
        hook="Hear it first, drift through, and wake at the end."
        sub="Live below: the corridor Blender baked on your PC, looping forever in the browser. Words from the dream appear on the wall while you aren’t looking, and doors change colour behind you. Drag to look back."
      />
      <div className="drp-split drp-split--exp">
        <Suspense fallback={<div className="drp-sketch__stage"><span className="drp-sketch__msg">Loading three.js…</span></div>}>
          <LiminalSketch fragments={SKETCH_FRAGMENTS} />
        </Suspense>
        <section className="drp-block drp-block--wire">
          <ViewerWire />
          <ul className="drp-ruled drp-ruled--plain drp-ruled--narrow">
            {FEEL_RULES.map((r) => <li key={r.label}><Dot tone="view">{r.label}</Dot><span className="drp-ruled__t">{r.text}</span></li>)}
          </ul>
        </section>
      </div>
      <details className="drp-drawer">
        <summary>How much does the dream shader cost?</summary>
        <p className="drp-cap">{BENCH.note}</p>
        <div className="drp-scroll">
          <table className="drp-table">
            <thead><tr>{BENCH.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{BENCH.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i ? `${c} ms` : c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="drp-cap">{BENCH.draws}</p>
      </details>
      <section className="drp-block">
        <h3 className="drp-micro">Other ways to have the dream · ranked</h3>
        <ol className="drp-modes">
          {MODES.map((m) => (
            <li key={m.name}>
              <span className="drp-ruled__n">{String(m.rank).padStart(2, '0')}</span>
              <span className="drp-modes__name">{m.name}{m.rank === 2 && <Dot tone="go">build first</Dot>}</span>
              <span className="drp-modes__line">{m.line}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ── 06 · Privacy & archive ─────────────────────────────────────────────── */

export function Privacy() {
  const [view, setView] = useState('reach');
  return (
    <div className="drp-tab">
      <TabHead
        n="06"
        hook="Private by default, and the archive grows by itself."
        sub="In the first build every dream is private. The site’s code is public, so only the Worker can hand a dream out, and it checks first."
      />
      <div className="drp-block__bar">
        <Seg label="Picture" value={view} onChange={setView} options={[{ id: 'reach', label: 'Who can reach what' }, { id: 'archive', label: 'How the archive grows' }]} />
      </div>
      {view === 'reach' ? (
        <div className="drp-split">
          <section className="drp-block">
            <div className="drp-reach" role="table" aria-label="Who can reach a dream at each privacy level">
              <div className="drp-reach__row drp-reach__row--head" role="row">
                <span role="columnheader" />
                {WHO.map((w) => (
                  <span key={w.id} role="columnheader" className="drp-reach__who"><strong>{w.label}</strong><small>{w.sub}</small></span>
                ))}
              </div>
              {LEVELS.map((l) => (
                <div key={l.id} className="drp-reach__row" role="row" data-later={l.later || undefined}>
                  <span role="rowheader" className="drp-reach__lvl"><strong>{l.label}</strong><small>{l.sub}</small></span>
                  {WHO.map((w) => (
                    <span key={w.id} role="cell" className="drp-reach__cell" data-yes={l.reach[w.id]} aria-label={l.reach[w.id] ? 'can reach' : 'cannot reach'} />
                  ))}
                </div>
              ))}
            </div>
            <ol className="drp-gate" aria-label="How a dream leaves storage">
              {GATE.map((g, i) => (
                <li key={g.title} data-gate={i === 1 || undefined}><strong>{g.title}</strong><span>{g.sub}</span></li>
              ))}
            </ol>
          </section>
          <section className="drp-block">
            <h3 className="drp-micro">How private stays private</h3>
            <ul className="drp-ruled drp-ruled--plain">
              {PRIVACY_RULES.map((r) => <li key={r.label}><Dot tone={r.tone}>{r.label}</Dot><span className="drp-ruled__t">{r.text}</span></li>)}
            </ul>
          </section>
        </div>
      ) : (
        <div className="drp-split">
          <section className="drp-block">
            <ArchiveArt dreams={ARCHIVE_DREAMS} motifs={ARCHIVE_MOTIFS} />
            <p className="drp-cap">Illustrative: five made-up dreams joined by what keeps coming back.</p>
          </section>
          <section className="drp-block">
            <h3 className="drp-micro">Motifs, not effort</h3>
            <ol className="drp-ruled drp-ruled--tight">
              {ARCHIVE_LINES.map((l, i) => <li key={l}><span className="drp-ruled__n">{String(i + 1).padStart(2, '0')}</span><span className="drp-ruled__t">{l}</span></li>)}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}

/* ── 07 · Roadmap + questions ───────────────────────────────────────────── */

export function Roadmap() {
  const [sel, setSel] = useState('p1');
  const [view, setView] = useState('questions');
  const p = PHASES.find((x) => x.id === sel);
  return (
    <div className="drp-tab">
      <TabHead
        n="07"
        hook="One dream walkable first. Everything else waits for real dreams."
        sub="Phase 1 is one unattended build session. Later phases start once you’ve walked a few of your own dreams."
      />
      <ol className="drp-phases" aria-label="Phases">
        {PHASES.map((x) => (
          <li key={x.id}>
            <button type="button" className="drp-phases__p" data-tone={x.tone} aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
              <span className="drp-phases__n">{x.n}</span>
              <strong>{x.title}</strong>
              <span className="drp-phases__when">{x.when}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="drp-detail drp-detail--phase" aria-live="polite">
        <Dot tone={p.tone}>Phase {p.n} · done when</Dot>
        <ul>{p.done.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      <div className="drp-block__bar">
        <Seg label="List" value={view} onChange={setView} options={[{ id: 'questions', label: `Questions for you (${QUESTIONS.length})` }, { id: 'risks', label: `Risks (${RISKS.length})` }]} />
      </div>
      {view === 'questions' ? (
        <ol className="drp-qs">
          {QUESTIONS.map((q, i) => (
            <li key={q.q}>
              <span className="drp-ruled__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="drp-qs__q">{q.q}</span>
              <span className="drp-qs__d"><Dot tone={q.tone}>my answer</Dot> {q.d}</span>
            </li>
          ))}
        </ol>
      ) : (
        <FoldList items={RISKS.map((r) => ({ ...r, tag: r.tone === 'maybe' ? 'risk' : 'watch' }))} />
      )}
    </div>
  );
}
