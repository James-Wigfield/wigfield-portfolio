import { useEffect, useState } from 'react';
import { getProject, listMilestones, listTasks } from '../data/portalApi';

/* ============================================================================
   OVERVIEW MODULE
   ----------------------------------------------------------------------------
   A small landing dashboard. Demonstrates that a second registry tool renders
   with zero layout changes, and reuses the same Supabase-style api layer the
   tracker uses. Aggregates project status into headline stats.
   ========================================================================== */
export default function Overview() {
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

  if (state.loading) {
    return <p className="pt-loading">// loading workspace…</p>;
  }

  const { project, milestones, tasks } = state;
  const msDone = milestones.filter((m) => m.status === 'completed').length;
  const tasksDone = tasks.filter((t) => t.status === 'done').length;
  const pct = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0;
  const active = milestones.find((m) => m.status === 'in_progress');

  const stats = [
    { label: 'Overall progress', value: `${pct}%`, sub: `${tasksDone}/${tasks.length} tasks done`, accent: true },
    { label: 'Milestones', value: `${msDone}/${milestones.length}`, sub: 'completed' },
    { label: 'Active milestone', value: active ? active.title : '—', sub: active ? `due ${active.due_date}` : 'none in progress' },
    { label: 'Target submission', value: project?.due_date ?? '—', sub: project?.code ?? '' },
  ];

  return (
    <div className="pt-module">
      <p className="pt-module__intro">
        Private workspace for managing personal projects &amp; tools. Select a tool from the
        sidebar — the <strong>Honours Tracker</strong> is the first live module.
      </p>

      <div className="pt-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className={`pt-card pt-stat${s.accent ? ' pt-stat--accent' : ''}`}>
            <span className="pt-stat__value">{s.value}</span>
            <span className="pt-stat__label">{s.label}</span>
            <span className="pt-stat__sub">{s.sub}</span>
          </div>
        ))}
      </div>

      <div className="pt-card pt-overview-card">
        <p className="pt-overview-card__code">{project?.code} · {project?.institution}</p>
        <h3 className="pt-overview-card__title">{project?.name}</h3>
        <p className="pt-overview-card__desc">{project?.description}</p>
      </div>
    </div>
  );
}
