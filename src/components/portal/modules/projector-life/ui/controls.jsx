import { memo } from 'react';
import Icon from '../../../icons';

/* ============================================================================
   PROJECTOR LIFE — generic controls, generated from a params.js def
   ----------------------------------------------------------------------------
   <ParamControl def value onChange /> picks the widget from the def:
     range                      slider + mono readout (unit, digits)
     int, ≤ 5 values            segmented buttons (1 · 2 · 3)
     int, wider                 slider
     toggle                     switch (role="switch")
     select, ≤ 4 short options  segmented radio group
     select, otherwise          native <select>
   Every widget has a real <label>/aria name, is keyboard-reachable and calls
   onChange(key, value). Memoised: a slider drag re-renders only itself.
   ========================================================================== */

const ctlId = (key) => `pjl-c-${key.replace(/[^\w-]/g, '-')}`;

function fmtValue(def, v) {
  if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return '—';
  if (def.type === 'range' || def.type === 'int') {
    const n = Number(v).toFixed(def.digits ?? (def.type === 'int' ? 0 : 2));
    if (!def.unit) return n;
    return def.unit === '°' ? `${n}°` : `${n} ${def.unit}`;
  }
  if (def.type === 'select') return def.options.find((o) => o.value === v)?.label ?? String(v);
  return v ? 'on' : 'off';
}

const isSegmentedSelect = (def) =>
  def.options.length <= 4 && def.options.every((o) => String(o.label).length <= 9);

function Hint({ def }) {
  return def.hint ? <span className="pjl-ctl__hint">{def.hint}</span> : null;
}

export function Segmented({ id, label, options, value, onPick, hint, compact }) {
  return (
    <div className={`pjl-ctl pjl-ctl--seg${compact ? ' pjl-ctl--compact' : ''}`}>
      <span className="pjl-ctl__label" id={`${id}-l`}>
        {label}
      </span>
      <div className="pjl-seg" role="radiogroup" aria-labelledby={`${id}-l`}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              className={`pjl-seg__btn${on ? ' is-on' : ''}`}
              onClick={() => onPick(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <span className="pjl-ctl__hint">{hint}</span>}
    </div>
  );
}

export function Switch({ id, label, checked, onFlip, hint }) {
  return (
    <div className="pjl-ctl pjl-ctl--toggle">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        className={`pjl-switch${checked ? ' is-on' : ''}`}
        onClick={() => onFlip(!checked)}
      >
        <span className="pjl-switch__label">{label}</span>
        <span className="pjl-switch__track" aria-hidden="true">
          <span className="pjl-switch__knob" />
        </span>
      </button>
      {hint && <span className="pjl-ctl__hint">{hint}</span>}
    </div>
  );
}

function RangeCtl({ def, value, onChange, readout, children }) {
  const id = ctlId(def.key);
  const v = Number.isFinite(Number(value)) ? Number(value) : def.default;
  const fill = ((v - def.min) / (def.max - def.min)) * 100;
  return (
    <div className="pjl-ctl pjl-ctl--range">
      <div className="pjl-ctl__row">
        <label className="pjl-ctl__label" htmlFor={id}>
          {def.label}
        </label>
        <output className="pjl-ctl__val" htmlFor={id}>
          {readout ?? fmtValue(def, v)}
        </output>
      </div>
      <input
        id={id}
        className="pjl-range"
        type="range"
        min={def.min}
        max={def.max}
        step={def.step ?? 'any'}
        value={v}
        style={{ '--pjl-fill': `${Math.max(0, Math.min(100, fill))}%` }}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
      />
      <Hint def={def} />
      {children}
    </div>
  );
}

function SelectCtl({ def, value, onChange }) {
  const id = ctlId(def.key);
  return (
    <div className="pjl-ctl pjl-ctl--select">
      <label className="pjl-ctl__label" htmlFor={id}>
        {def.label}
      </label>
      <select id={id} className="pjl-select" value={value ?? def.default} onChange={(e) => onChange(def.key, e.target.value)}>
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint def={def} />
    </div>
  );
}

function ParamControlImpl({ def, value, onChange, readout, children }) {
  const id = ctlId(def.key);
  if (def.type === 'toggle') {
    return <Switch id={id} label={def.label} checked={value ?? def.default} onFlip={(v) => onChange(def.key, v)} hint={def.hint} />;
  }
  if (def.type === 'int' && def.max - def.min <= 4) {
    const options = [];
    for (let n = def.min; n <= def.max; n++) options.push({ value: n, label: String(n) });
    return <Segmented id={id} label={def.label} options={options} value={value ?? def.default} onPick={(v) => onChange(def.key, v)} hint={def.hint} />;
  }
  if (def.type === 'select') {
    if (isSegmentedSelect(def)) {
      return <Segmented id={id} label={def.label} options={def.options} value={value ?? def.default} onPick={(v) => onChange(def.key, v)} hint={def.hint} />;
    }
    return <SelectCtl def={def} value={value} onChange={onChange} />;
  }
  return (
    <RangeCtl def={def} value={value} onChange={onChange} readout={readout}>
      {children}
    </RangeCtl>
  );
}

export const ParamControl = memo(ParamControlImpl);

/* A collapsible control group. The header is a real button (aria-expanded);
   `summary` is a live one-liner that stays readable while collapsed. */
export function Group({ id, n, label, summary, open, onToggle, children, level = 1 }) {
  const bodyId = `pjl-gb-${id}`;
  const H = level === 1 ? 'h3' : 'h4';
  return (
    <section className={`pjl-group pjl-group--l${level}${open ? ' is-open' : ''}`} id={`pjl-g-${id}`}>
      <H className="pjl-group__h">
        <button type="button" className="pjl-group__btn" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(id)}>
          {n != null && <span className="pjl-group__n">{n}</span>}
          <span className="pjl-group__label">{label}</span>
          {summary != null && <span className="pjl-group__sum">{summary}</span>}
          <span className="pjl-group__chev" aria-hidden="true">
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </H>
      {open && (
        <div id={bodyId} className="pjl-group__body">
          {children}
        </div>
      )}
    </section>
  );
}

export function SecHead({ children }) {
  return <div className="pjl-sec">{children}</div>;
}
