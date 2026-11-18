import { useMemo, useState } from 'react';
import Icon from '../../../icons';
import Code from './Code';
import { buildMcpCalls, formatCalls, MCP_FILTERS } from './mcp';
import { useStats } from './store';

/* PROJECTOR LIFE — MCP preview drawer: the tool calls that would rebuild the
   current scene on the mate's real rig, as JSON in a VS Code block. Closed by
   default (a ruled bar with the call count); the JSON only builds when open. */
export default function McpPreview({ stage, values, patches }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [pretty, setPretty] = useState(false);
  const s = useStats(open ? stage : null);
  const lastSeed = s?.lastSeed || null;
  const calls = useMemo(() => buildMcpCalls({ values, patches, lastSeed }), [values, patches, lastSeed]);
  const shown = filter === 'all' ? calls : calls.filter((c) => c.group === filter);
  const counts = useMemo(() => {
    const m = { all: calls.length };
    for (const c of calls) m[c.group] = (m[c.group] || 0) + 1;
    return m;
  }, [calls]);
  const text = !open ? '' : pretty ? JSON.stringify(shown.map(({ tool, args }) => ({ tool, args })), null, 2) : formatCalls(shown);

  return (
    <section className={`pjl-mcp${open ? ' is-open' : ''}`} aria-label="MCP preview">
      <button type="button" className="pjl-mcp__bar" aria-expanded={open} aria-controls="pjl-mcp-body" onClick={() => setOpen((o) => !o)}>
        <span className="pjl-mcp__tag">mcp preview</span>
        <span className="pjl-mcp__lead">
          <b>{calls.length}</b> tool calls would rebuild this scene on the real rig
        </span>
        <span className="pjl-mcp__chev" aria-hidden="true">
          <Icon name="chevron" size={14} />
        </span>
      </button>
      {open && (
        <div id="pjl-mcp-body" className="pjl-mcp__body">
          <div className="pjl-mcp__filters" role="radiogroup" aria-label="Filter calls">
            {MCP_FILTERS.filter((f) => counts[f.id]).map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`pjl-mcp__f${filter === f.id ? ' is-on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
                <span className="pjl-mcp__fn">{counts[f.id]}</span>
              </button>
            ))}
            <button type="button" className="pjl-mcp__f pjl-mcp__fmt" aria-pressed={pretty} onClick={() => setPretty((v) => !v)}>
              {pretty ? 'one call per line' : 'pretty-print'}
            </button>
            <span className="pjl-mcp__note">
              <span className="pjl-dot pjl-dot--illus" />
              proposed tool names · see Plan
            </span>
          </div>
          <Code code={text} label="scene.mcp.json" meta={`${shown.length} calls`} maxHeight="420px" />
        </div>
      )}
    </section>
  );
}
