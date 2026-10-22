import Icon from '../../../icons';

/* ============================================================================
   LECTURES 6–7 STUDY — LAB CHROME
   ----------------------------------------------------------------------------
     Lab     the frame every "Play" piece sits in: name, slide receipt, the
             one-line "Try this" prompt (what to change, what to notice), and
             the redrawn figure's own caption from the slide, verbatim (`fig`)
     Chips   a labelled row of toggle chips (aria-pressed), the .dl-chip style
     Range   a labelled range slider showing its live value
     Stat    a big-number readout with its working underneath
   Built on the shared .dl-* controls in ../common.css.
   ========================================================================== */

export function Lab({ title, slides, tryThis, fig, children }) {
  return (
    <div className="dl67s-lab">
      <div className="dl67s-lab__bar">
        <span className="dl67s-lab__name">{title}</span>
        {slides && <span className="dl67s-lab__slides">{slides}</span>}
      </div>
      {tryThis && (
        <p className="dl67s-try">
          <Icon name="flask" size={14} />
          <span><b>Try this:</b> {tryThis}</span>
        </p>
      )}
      {children}
      {fig && <p className="dl67s-figcap"><span className="dl67s-figcap__k">On the slide:</span> {fig}</p>}
    </div>
  );
}

export function Chips({ label, value, options, onChange, compact = false, code = false }) {
  return (
    <div className={`dl-ctl dl67s-ctl${compact ? ' dl67s-ctl--compact' : ''}`} role="group" aria-label={label}>
      <span className={`dl-ctl__label${code ? ' dl67s-ctl__code' : ''}`}>{label}</span>
      <div className="dl-chips">
        {options.map((o) => {
          const v = typeof o === 'object' ? o.v : o;
          const l = typeof o === 'object' ? o.l : String(o);
          const on = v === value;
          return (
            <button key={String(v)} type="button" className={`dl-chip${on ? ' dl-chip--on' : ''}`} aria-pressed={on} onClick={() => onChange(v)}>
              {l}
              {typeof o === 'object' && o.tag && <span className="dl-chip__tag">{o.tag}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Range({ label, value, min, max, step = 1, onChange, fmt, width }) {
  return (
    <label className="dl-slider dl67s-range" style={width ? { minWidth: width } : undefined}>
      <span>
        {label} = <b>{fmt ? fmt(value) : value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Stat({ k, v, sub, tone }) {
  return (
    <div className="dl67s-stat" data-tone={tone}>
      <p className="dl67s-stat__k">{k}</p>
      <p className="dl67s-stat__v">{v}</p>
      {sub && <p className="dl67s-stat__sub">{sub}</p>}
    </div>
  );
}
