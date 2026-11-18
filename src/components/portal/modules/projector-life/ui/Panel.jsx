import { Fragment } from 'react';
import Icon from '../../../icons';
import { GROUPS, PARAMS, SYSTEMS } from '../params.js';
import { PRESETS } from '../presets.js';
import { Group, ParamControl, SecHead } from './controls';
import {
  ApexProfile, CoverageReadout, CreatureCounters, Histograms, Populations, ProjectorPlan, RegionMap, ThrowQuick,
} from './widgets';
import { useStats } from './store';

/* ============================================================================
   PROJECTOR LIFE — the controls panel, GENERATED from params.js
   ----------------------------------------------------------------------------
   One collapsible <Group> per GROUPS entry (plus "Scenes" for the presets).
   Inside a group the PARAMS with that group render in file order; a new
   `section` value starts a sub-head; defs with a `projector` index are pulled
   out into per-projector sub-groups shown up to proj.count. A handful of keys
   get a special widget (SPECIAL below) and some groups get live read-outs
   appended (APPENDIX). Adding a control = adding a def to params.js.
   ========================================================================== */

const pitchOf = (apex) => (Math.atan((apex - 2.25) / 2.18) * 180) / Math.PI;
const SYS_SHORT = Object.fromEntries(SYSTEMS.map((s) => [s.value, { off: 'off', grayscott: 'GS', physarum: 'Phys', particlelife: 'PL', lenia: 'Lenia' }[s.value] || s.value]));
const pad2 = (n) => String(n).padStart(2, '0');

function CreatureSummary({ stage, on }) {
  const s = useStats(stage);
  if (!on) return 'off';
  const a = s?.life?.creatures?.alive;
  return Number.isFinite(a) ? `${a} alive` : 'on';
}

function summaryFor(id, values, patches, stage) {
  switch (id) {
    case 'room':
      return `${Number(values['room.apex']).toFixed(2)} m · ${pitchOf(values['room.apex']).toFixed(0)}°`;
    case 'projectors': {
      const n = values['proj.count'];
      return `${n} · throw ${Number(values['p0.throw']).toFixed(2)}${n > 1 ? '…' : ''}`;
    }
    case 'mapping': {
      const ids = patches.length ? patches.map((p) => p.id) : [];
      const on = ids.filter((pid) => values[`region.${pid}.on`] !== false).length;
      return `${values['map.mode']}${ids.length ? ` · ${on}/${ids.length}` : ''}`;
    }
    case 'life':
      return ['floor', 'wall', 'ceiling'].map((t) => SYS_SHORT[values[`life.sys.${t}`]] || '—').join(' · ');
    case 'creatures':
      return <CreatureSummary stage={stage} on={values['cr.on']} />;
    case 'aids': {
      const n = PARAMS.filter((d) => d.group === 'aids' && values[d.key] === true).length;
      return `${n} on`;
    }
    default:
      return null;
  }
}

function renderDefs(defs, ctx) {
  const { values, onChange } = ctx;
  const out = [];
  let section = null;
  for (const d of defs) {
    if (d.section && d.section !== section && d.projector === undefined) {
      section = d.section;
      out.push(<SecHead key={`s-${section}`}>{section}</SecHead>);
    }
    const special = SPECIAL[d.key.replace(/^p\d\./, 'p*.')];
    out.push(special ? <Fragment key={d.key}>{special(d, ctx)}</Fragment> : <ParamControl key={d.key} def={d} value={values[d.key]} onChange={onChange} />);
  }
  return out;
}

const SPECIAL = {
  'room.apex': (d, { values, onChange }) => {
    const pd = pitchOf(values['room.apex']);
    return (
      <ParamControl def={d} value={values[d.key]} onChange={onChange} readout={`${Number(values[d.key]).toFixed(2)} m · ${pd.toFixed(1)}°`}>
        <ApexProfile apex={values[d.key]} pitchDeg={pd} />
      </ParamControl>
    );
  },
  'p*.throw': (d, { values, onChange }) => (
    <ParamControl def={d} value={values[d.key]} onChange={onChange}>
      <ThrowQuick projector={d.projector} value={values[d.key]} onChange={onChange} />
    </ParamControl>
  ),
};

function ProjectorsAppendix(ctx) {
  const { values, apply, stage, patches, open, onToggle } = ctx;
  const count = values['proj.count'] || 1;
  const perProj = [0, 1, 2].filter((i) => i < count);
  return (
    <>
      <SecHead>Coverage</SecHead>
      <CoverageReadout stage={stage} />
      <SecHead>Placement</SecHead>
      <ProjectorPlan values={values} apply={apply} count={count} patches={patches} />
      {perProj.map((i) => (
        <Group
          key={i}
          id={`proj-${i}`}
          level={2}
          n={pad2(i + 1)}
          label={`Projector ${i + 1}`}
          summary={`${Number(values[`p${i}.throw`]).toFixed(2)} · ${values[`p${i}.aspect`]}`}
          open={!!open[`proj-${i}`]}
          onToggle={onToggle}
        >
          {renderDefs(
            PARAMS.filter((d) => d.projector === i),
            ctx,
          )}
        </Group>
      ))}
    </>
  );
}

const APPENDIX = {
  projectors: ProjectorsAppendix,
  mapping: (ctx) => (
    <>
      <SecHead>Regions</SecHead>
      <RegionMap stage={ctx.stage} patches={ctx.patches} values={ctx.values} onChange={ctx.onChange} apply={ctx.apply} />
    </>
  ),
  life: (ctx) => (
    <>
      <SecHead>Alive now</SecHead>
      <Populations stage={ctx.stage} />
    </>
  ),
  creatures: (ctx) => (
    <>
      <SecHead>Census</SecHead>
      <CreatureCounters stage={ctx.stage} />
      <SecHead>Traits by habitat</SecHead>
      <Histograms stage={ctx.stage} />
      <div className="pjl-honest">
        <span className="pjl-dot pjl-dot--illus" />
        Gait families are hand-written; selection only tunes the numbers. Real Plate VII evolves the gaits.
      </div>
    </>
  ),
};

/* Group bodies: everything in the group except per-projector defs. Projector
   defs go to the projectors appendix. */
function GroupBody({ group, ctx }) {
  const defs = PARAMS.filter((d) => d.group === group.id && d.projector === undefined);
  const App = APPENDIX[group.id];
  // Creatures: the census and histograms sit right under the master switch,
  // before the sliders, so opening the group shows the populations first.
  if (group.id === 'creatures') {
    return (
      <>
        {renderDefs(defs.slice(0, 1), ctx)}
        {App && <App {...ctx} />}
        {renderDefs(defs.slice(1), ctx)}
      </>
    );
  }
  return (
    <>
      {renderDefs(defs, ctx)}
      {App && <App {...ctx} />}
    </>
  );
}

export default function Panel({
  values, onChange, apply, stage, patches, scene, onPreset, open, onToggle, collapsed, onCollapse, narrow,
}) {
  const ctx = { values, onChange, apply, stage, patches, open, onToggle };
  if (collapsed && !narrow) {
    return (
      <aside className="pjl-panel pjl-panel--rail" aria-label="Controls (collapsed)">
        <button type="button" className="pjl-panel__rail" onClick={() => onCollapse(false)} aria-expanded="false" aria-label="Show controls">
          <Icon name="sliders" size={16} />
          <span>controls</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className="pjl-panel" aria-label="Controls">
      <div className="pjl-panel__head">
        <span className="pjl-panel__title">
          <Icon name="sliders" size={14} />
          controls
        </span>
        <span className="pjl-panel__count">{PARAMS.length} + regions</span>
        <button
          type="button"
          className="pjl-panel__fold"
          onClick={() => onCollapse(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={narrow ? (collapsed ? 'Open controls' : 'Close controls') : 'Hide controls'}
        >
          <Icon name="chevron" size={14} />
        </button>
      </div>
      {!(narrow && collapsed) && (
        <div className="pjl-panel__scroll">
          <Group id="scenes" n="00" label="Scenes" summary={`${PRESETS.length} presets`} open={open.scenes !== false} onToggle={onToggle}>
            <ol className="pjl-scenes">
              {PRESETS.map((p, i) => {
                const active = scene.presetId === p.id;
                return (
                  <li key={p.id}>
                    <button type="button" className={`pjl-scenes__btn${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => onPreset(p)}>
                      <span className="pjl-scenes__n">{pad2(i + 1)}</span>
                      <span className="pjl-scenes__body">
                        <span className="pjl-scenes__name">{p.name}</span>
                        {active && <span className="pjl-scenes__blurb">{p.blurb}</span>}
                      </span>
                      {active && (
                        <span className="pjl-scenes__state">
                          <span className={`pjl-dot ${scene.edited ? 'pjl-dot--hollow' : 'pjl-dot--live'}`} />
                          {scene.edited ? 'edited' : 'on'}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </Group>
          {GROUPS.map((g, gi) => (
            <Group key={g.id} id={g.id} n={pad2(gi + 1)} label={g.label} summary={summaryFor(g.id, values, patches, stage)} open={!!open[g.id]} onToggle={onToggle}>
              <GroupBody group={g} ctx={ctx} />
            </Group>
          ))}
        </div>
      )}
    </aside>
  );
}
