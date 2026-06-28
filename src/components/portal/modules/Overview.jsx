import { useEffect, useState } from 'react';
import Icon from '../icons';
import { SECTIONS, MODULES } from '../registry';
import { getProject, listMilestones, listTasks } from '../data/portalApi';

/* ============================================================================
   OVERVIEW MODULE — workspace dashboard
   ----------------------------------------------------------------------------
   The portal's landing page. Organised to be future-proof: a global "at a
   glance" strip plus one summary card per life-area section. Each card is a
   slot designed to surface the most important fact(s) from the tools inside
   that section — as more tools land, they push their headline here. Clicking a
   card jumps to that section's first tool (via the onNavigate prop). Live data
   (honours progress) comes from the same Supabase-style api layer the trackers
   use; everything else is curated until those tools come online.
   ========================================================================== */

// Per-section headline content. `live` cards are filled from api data below;
// the rest are curated summaries that future tools can replace.
const HIGHLIGHTS = {
  University:  { live: 'honours', fallback: 'Honours project in progress' },
  Syllabite:   { static: 'Phase 1 · validating the engine', note: 'Free, syllabus-aligned ATAR study platform' },
  Business:    { static: 'Codebase Visualizer · market validated', note: 'Conversational MCP architectural compiler' },
  Personal:    { static: 'Wall Art · 4 print-ready pieces', note: 'Original A4 CS art — nets, Mamba scan, riso & core-memory plates' },
  Investments: { static: null, note: 'Portfolio & assets — set up your first tool' },
};

// First tool registered under a section (the card's jump target), if any.
function firstToolOf(name) {
  return MODULES.find((m) => m.group === name && !m.system) ?? null;
}

export default function Overview({ onNavigate }) {
  const [state, setState] = useState({ loading: true, project: null, milestones: [], tasks: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: project }, { data: milestones }, { data: tasks }] = await Promise.all([
        getProject(),
        listMilestones(),
        listTasks(),
      ]);
      if (alive) setState({ loading: false, project, milestones: milestones ?? [], tasks: tasks ?? [] });
    })();
    return () => { alive = false; };
  }, []);

  const { project, milestones, tasks } = state;
  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const honoursPct = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0;
  const activeMs = milestones.find((m) => m.status === 'in_progress');

  const systemTool = MODULES.find((m) => m.system) ?? null;
  const liveTools = MODULES.filter((m) => m.group && !m.system).length;
  const activeAreas = SECTIONS.filter((s) => firstToolOf(s.name)).length;

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    { label: 'Active areas', value: `${activeAreas} / ${SECTIONS.length}`, sub: 'sections with live tools', accent: true },
    { label: 'Live tools', value: String(liveTools), sub: 'across the workspace' },
    { label: 'Honours progress', value: state.loading ? '—' : `${honoursPct}%`, sub: `${tasksDone}/${tasks.length} tasks done` },
    { label: 'Focus', value: activeMs ? activeMs.title : '—', sub: activeMs ? `due ${activeMs.due_date}` : 'no active milestone', wide: true },
  ];

  // Resolve each section's card content (live data wins where requested).
  const cards = SECTIONS.map((s) => {
    const tool = firstToolOf(s.name);
    const count = MODULES.filter((m) => m.group === s.name && !m.system).length;
    const cfg = HIGHLIGHTS[s.name] ?? {};
    let highlight = cfg.static;
    let note = cfg.note ?? s.blurb;
    if (cfg.live === 'honours') {
      highlight = state.loading ? 'Loading…' : `${honoursPct}% implemented`;
      note = project ? project.title : cfg.fallback;
    }
    return { ...s, tool, count, highlight, note };
  });

  return (
    <div className="pt-module ov">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="pt-card ov-hero">
        <p className="ov-hero__eyebrow">// {today}</p>
        <h2 className="ov-hero__title">Your private command centre</h2>
        <p className="ov-hero__sub">
          Every area of work in one place — university, ventures and personal. Pick an area below to
          dive in; the most important numbers from each tool surface here as they come online.
        </p>
      </header>

      {/* ── At a glance ──────────────────────────────────────────────────── */}
      <div className="ov-stats">
        {stats.map((s) => (
          <div key={s.label} className={`pt-card ov-stat${s.accent ? ' ov-stat--accent' : ''}${s.wide ? ' ov-stat--wide' : ''}`}>
            <span className="ov-stat__value">{s.value}</span>
            <span className="ov-stat__label">{s.label}</span>
            <span className="ov-stat__sub">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Areas ────────────────────────────────────────────────────────── */}
      <div className="ov-section-head">
        <span className="ov-section-head__label">Areas</span>
        <span className="ov-section-head__rule" />
      </div>

      <div className="ov-grid">
        {cards.map((c) => {
          const clickable = !!c.tool;
          return (
            <button
              key={c.name}
              className={`pt-card ov-card${clickable ? '' : ' ov-card--empty'}`}
              onClick={() => clickable && onNavigate?.(c.tool.id)}
              disabled={!clickable}
              aria-label={clickable ? `Open ${c.name}` : `${c.name} — no tools yet`}
            >
              <span className="ov-card__top">
                <span className="ov-card__icon"><Icon name={c.icon} size={20} /></span>
                <span className="ov-card__name">{c.name}</span>
              </span>
              {c.highlight && <span className="ov-card__highlight">{c.highlight}</span>}
              <span className="ov-card__note">{c.note}</span>
              <span className="ov-card__foot">
                <span className="ov-card__count">{c.count} {c.count === 1 ? 'tool' : 'tools'}</span>
                {clickable
                  ? <span className="ov-card__cta">Open <Icon name="arrowRight" size={14} /></span>
                  : <span className="ov-card__planned">Planned</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── System ───────────────────────────────────────────────────────── */}
      {systemTool && (
        <button className="ov-system" onClick={() => onNavigate?.(systemTool.id)}>
          <span className="ov-system__icon"><Icon name={systemTool.icon} size={16} /></span>
          <span className="ov-system__text">
            <strong>{systemTool.label}</strong> — wire the portal to a real backend so tools persist data
          </span>
          <Icon name="arrowRight" size={15} className="ov-system__arrow" />
        </button>
      )}
    </div>
  );
}
