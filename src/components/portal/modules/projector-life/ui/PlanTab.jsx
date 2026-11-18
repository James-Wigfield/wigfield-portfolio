import { useCallback, useEffect, useState } from 'react';
import Glyph from './glyphs';
import Icon from '../../../icons';
import Code from './Code';
import ArchDiagram from './ArchDiagram';
import { INTERFACE_CODE, PHASES, QUESTIONS, RISKS, STANDFIRST } from './planData';
import { MEASUREMENTS } from './measurements';
import { loadPref, savePref, useReducedMotion } from './store';
import './plan.css';

/* ============================================================================
   PROJECTOR LIFE — Plan tab: the merger plan, visual
     standfirst · sub-nav (Phases · Architecture · Risks · Measured · Questions)
   Each section fits one screen. The Phases section is a clickable timeline
   with a "walk the plan" auto-advance (off under reduced motion). The brief
   for the mate's Claude Code (merger-plan.md) loads only when copied.
   ========================================================================== */

const SECTIONS = [
  { id: 'phases', label: 'Phases' },
  { id: 'arch', label: 'Architecture' },
  { id: 'risks', label: 'Risks' },
  { id: 'measured', label: 'What it showed' },
  { id: 'questions', label: 'Ask him' },
];
const pad2 = (n) => String(n).padStart(2, '0');

function Timeline() {
  const [sel, setSel] = useState(1);
  const [walking, setWalking] = useState(false);
  const rm = useReducedMotion();
  useEffect(() => {
    if (!walking || rm) return undefined;
    const id = setInterval(() => setSel((s) => (s + 1) % PHASES.length), 3800);
    return () => clearInterval(id);
  }, [walking, rm]);
  const ph = PHASES[sel];
  const pick = (i) => {
    setWalking(false);
    setSel(i);
  };
  const onKey = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    pick((sel + d + PHASES.length) % PHASES.length);
  };
  return (
    <div className="pjl-tl">
      <div className="pjl-tl__bar">
        <div className="pjl-micro">seven phases · level 1 → level 2 → the naturalist</div>
        {!rm && (
          <button type="button" className="pjl-textbtn" onClick={() => setWalking((w) => !w)} aria-pressed={walking}>
            <Icon name={walking ? 'pause' : 'play'} size={12} />
            {walking ? 'stop' : 'walk the plan'}
          </button>
        )}
      </div>
      <div className="pjl-tl__track" role="tablist" aria-label="Phases" onKeyDown={onKey} style={{ '--pjl-tl-at': sel / (PHASES.length - 1) }}>
        <span className="pjl-tl__rail" aria-hidden="true">
          <span className="pjl-tl__fill" />
        </span>
        {PHASES.map((p, i) => (
          <button
            key={p.n}
            type="button"
            role="tab"
            aria-selected={sel === i}
            tabIndex={sel === i ? 0 : -1}
            className={`pjl-tl__stop${sel === i ? ' is-on' : ''}${i < sel ? ' is-past' : ''}`}
            onClick={() => pick(i)}
          >
            <span className="pjl-tl__node" aria-hidden="true" />
            <span className="pjl-tl__n">{pad2(p.n)}</span>
            <span className="pjl-tl__short">{p.short}</span>
          </button>
        ))}
      </div>
      <div className="pjl-tl__detail" key={ph.n} role="tabpanel">
        <div className="pjl-tl__head">
          <span className="pjl-tl__big">{pad2(ph.n)}</span>
          <div>
            <div className="pjl-micro">phase {ph.n} · {ph.level}</div>
            <h3 className="pjl-tl__title">{ph.title}</h3>
          </div>
        </div>
        <ul className="pjl-tl__bullets">
          {ph.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="pjl-tl__facts">
          <div className="pjl-tl__fact">
            <span className="pjl-micro">mcp tools introduced</span>
            <span className="pjl-tl__tools">
              {ph.tools.length ? ph.tools.map((t) => <code key={t}>{t}</code>) : <em>none new — inventory his</em>}
            </span>
          </div>
          <div className="pjl-tl__fact">
            <span className="pjl-micro">
              <span className="pjl-dot pjl-dot--live" />
              done when
            </span>
            <span className="pjl-tl__accept">{ph.accept}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Architecture() {
  return (
    <div className="pjl-plan__arch">
      <ArchDiagram />
      <div className="pjl-plan__iface">
        <div className="pjl-micro">the region-content interface · phase 0</div>
        <Code code={INTERFACE_CODE} copy={INTERFACE_CODE} label="region-content.ts" meta="proposal" />
      </div>
    </div>
  );
}

function Risks() {
  return (
    <div className="pjl-risks-wrap">
      <div className="pjl-micro pjl-risks__legend">
        <span className="pjl-dot pjl-dot--warn" /> will bite early
        <span className="pjl-dot pjl-dot--mild" /> manageable
      </div>
      <RiskList />
    </div>
  );
}

function RiskList() {
  return (
    <ol className="pjl-risks">
      {RISKS.map((r, i) => (
        <li key={r.t} className="pjl-risks__i">
          <span className="pjl-risks__n">{pad2(i + 1)}</span>
          <div>
            <div className="pjl-risks__t">
              <span className={`pjl-dot pjl-dot--${r.tone === 'warn' ? 'warn' : 'mild'}`} />
              {r.t}
            </div>
            <div className="pjl-risks__w">{r.why}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function fmtFact(f) {
  if (f.value == null || !Number.isFinite(f.value)) return null;
  const v = f.unit === '%' && f.value <= 1 ? f.value * 100 : f.value;
  const s = v.toFixed(f.digits ?? 1);
  return f.unit === '%' ? `${s}%` : f.unit ? `${s} ${f.unit}` : s;
}

function Measured() {
  const M = MEASUREMENTS;
  return (
    <div className="pjl-meas">
      <div className="pjl-meas__state">
        <span className={`pjl-dot ${M.measured ? 'pjl-dot--live' : 'pjl-dot--hollow'}`} />
        {M.measured ? `measured ${M.date || ''} · ${M.how}` : 'measurements pending — the geometry rows are computed, the rest fill in after the coverage run'}
      </div>
      <div className="pjl-meas__rows">
        {M.facts.map((f) => {
          const v = fmtFact(f);
          const pending = f.source === 'measured' && (!M.measured || v == null);
          return (
            <div key={f.id} className={`pjl-meas__row${pending ? ' is-pending' : ''}`}>
              <span className="pjl-meas__k">{f.label}</span>
              <span className="pjl-meas__v">{pending ? '—' : v ?? '—'}</span>
              <span className="pjl-meas__src">
                <span className={`pjl-dot ${f.source === 'geometry' ? 'pjl-dot--illus' : pending ? 'pjl-dot--hollow' : 'pjl-dot--live'}`} />
                {f.source === 'geometry' ? 'computed' : pending ? 'pending' : 'measured'}
              </span>
              {f.note && <span className="pjl-meas__note">{f.note}</span>}
            </div>
          );
        })}
      </div>
      {(M.uncovered.length > 0 || M.takeaways.length > 0) && (
        <div className="pjl-meas__lists">
          {M.uncovered.length > 0 && (
            <div>
              <div className="pjl-micro">stays dark</div>
              <ul>
                {M.uncovered.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {M.takeaways.length > 0 && (
            <div>
              <div className="pjl-micro">takeaways</div>
              <ul>
                {M.takeaways.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Questions() {
  return (
    <ol className="pjl-qs">
      {QUESTIONS.map((q, i) => (
        <li key={q.t} className="pjl-qs__i">
          <span className="pjl-qs__n">{pad2(i + 1)}</span>
          <div>
            <div className="pjl-qs__t">{q.t}</div>
            <div className="pjl-qs__w">{q.why}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CopyBrief() {
  const [state, setState] = useState('idle');
  const onCopy = useCallback(async () => {
    setState('loading');
    try {
      const mod = await import('../../../../../../Documents/projector-life/merger-plan.md?raw');
      await navigator.clipboard.writeText(mod.default);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  }, []);
  return (
    <button type="button" className="pjl-plan__copy" onClick={onCopy} aria-live="polite">
      <Glyph name="copy" size={13} />
      {state === 'copied' ? 'brief copied' : state === 'failed' ? 'copy failed' : state === 'loading' ? 'copying…' : 'copy the brief for his claude code'}
    </button>
  );
}

export default function PlanTab() {
  const [sec, setSec] = useState(() => {
    const s = loadPref('planSec', 'phases');
    return SECTIONS.some((x) => x.id === s) ? s : 'phases';
  });
  const go = (id) => {
    setSec(id);
    savePref('planSec', id);
  };
  return (
    <div className="pjl-plan">
      <header className="pjl-stand">
        <div className="pjl-stand__tag">
          <span className="pjl-dot pjl-dot--live" />
          {STANDFIRST.kicker}
        </div>
        <div className="pjl-stand__lead">{STANDFIRST.lead}</div>
        <dl className="pjl-stand__rows">
          {STANDFIRST.sub.map((r) => (
            <div key={r.k}>
              <dt>{r.k}</dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav className="pjl-subnav" aria-label="Plan sections">
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" className={`pjl-subnav__b${sec === s.id ? ' is-on' : ''}`} aria-current={sec === s.id ? 'true' : undefined} onClick={() => go(s.id)}>
            <span className="pjl-subnav__n">{pad2(i + 1)}</span>
            {s.label}
          </button>
        ))}
        <CopyBrief />
      </nav>

      <div className="pjl-plan__body">
        {sec === 'phases' && <Timeline />}
        {sec === 'arch' && <Architecture />}
        {sec === 'risks' && <Risks />}
        {sec === 'measured' && <Measured />}
        {sec === 'questions' && <Questions />}
      </div>
    </div>
  );
}
