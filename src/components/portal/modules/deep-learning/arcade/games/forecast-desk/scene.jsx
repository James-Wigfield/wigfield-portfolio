import { baselineFigure, WEEK_HEAD, monthLabel, COPY, TABLE30, SPLITS, BOARD } from '../../maths/forecastDesk';

/* ============================================================================
   FORECAST DESK — THE PICTURES (procedural SVG / HTML, drawn at the stage's
   measured width so text stays at real pixel sizes)
   ----------------------------------------------------------------------------
   Calendar      level 1: three weeks of rail, one row per week (Mon first);
                 the 7-days' shift copies the cell straight above
   Baseline      Figure 15-7's two panels (rail and its 7-day lag; diff_7)
   Toy           slide 19's my_series as tokens, a window and its target
   Window        one 56-day window and its day-56 target (slide 22)
   Ahead         one 70-day window: 56 input days, 14 rail targets (slide 37)
   Board         the leaderboard of printed validation MAEs vs the baseline
   Table30       slide 30's mulvar_train.head()
   Strategy      the three multi-step strategies (slides 34, 35/38, 39)
   Stack         a deep RNN unrolled (Figure 15-10's idea, slide 28)
   Timeline      slide 20's train / valid / test periods
   Every value drawn comes from maths/ or content/; colours from tokens.
   ========================================================================== */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const path = (pts) => pts.filter((p) => Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

/* ── calendar ─────────────────────────────────────────────────────────── */
export function CalendarScene({ scene, cursor, onPick, picked, reveal, live }) {
  const answerIso = reveal && scene.pick ? scene.rows.flatMap((r) => r.cells).find((c) => scene.lags.includes(c.idx))?.iso : null;
  return (
    <div className="dla-fd-cal" role="group" aria-label={COPY.calendarAria}>
      <div className="dla-fd-cal__head" aria-hidden="true">
        {WEEK_HEAD.map((d) => <span key={d}>{d}</span>)}
      </div>
      {scene.rows.map((row, r) => (
        <div key={r} className="dla-fd-cal__row">
          <span className="dla-fd-cal__wk" aria-hidden="true">{row.head}</span>
          {row.cells.map((c) => {
            const isT = c.role === 'target';
            const isLag = c.role === 'lag' || (answerIso && c.iso === answerIso);
            const isPick = picked === c.iso;
            const canPick = scene.pick && live && !c.future && !isT;
            const cls = [
              'dla-fd-cell',
              c.future ? 'dla-fd-cell--future' : '',
              isT ? 'dla-fd-cell--target' : '',
              isLag ? 'dla-fd-cell--lag' : '',
              isPick && answerIso && c.iso !== answerIso ? 'dla-fd-cell--miss' : '',
              cursor === c.iso && canPick ? 'dla-fd-cell--cursor' : '',
            ].filter(Boolean).join(' ');
            const body = (
              <>
                <span className="dla-fd-cell__bar" style={{ '--h': c.h }} aria-hidden="true" />
                <span className="dla-fd-cell__d">{c.day === 1 || (r === 0 && c === row.cells[0]) ? `${c.day} ${monthLabel(c.iso)}` : c.day}</span>
                <span className="dla-fd-cell__v">{c.future ? '' : c.value === null ? '?' : c.value}</span>
              </>
            );
            const aria = `${c.label}: ${c.future ? COPY.cellFuture : c.value === null ? 'unknown' : `${c.value} thousand`}`;
            return canPick || (scene.pick && !c.future && !isT) ? (
              <button key={c.iso} type="button" className={cls} onClick={() => canPick && onPick(c.iso)} disabled={!canPick} aria-label={aria}>{body}</button>
            ) : (
              <span key={c.iso} className={cls} role="img" aria-label={aria}>{body}</span>
            );
          })}
        </div>
      ))}
      {scene.table && (
        <table className="dla-fd-tiny">
          <thead><tr><th>day t</th><th>y(t)</th><th>y(t−7)</th></tr></thead>
          <tbody>
            {scene.table.map((r) => <tr key={r.iso}><td>{r.label}</td><td>{r.y}</td><td>{r.lag}</td></tr>)}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Figure 15-7's idea: rail with its 7-day lag, and diff_7 ──────────── */
export function BaselineScene({ width }) {
  const F = baselineFigure();
  const W = Math.max(300, width);
  const H1 = 112;
  const H2 = 84;
  const pad = { l: 36, r: 8, t: 20 };
  const n = F.dates.length;
  const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const tv = [...F.rail, ...F.railLag].filter(Number.isFinite);
  const top = { lo: Math.min(...tv), hi: Math.max(...tv) };
  top.y = (v) => pad.t + (1 - (v - top.lo) / (top.hi - top.lo)) * (H1 - pad.t - 6);
  const dm = Math.max(...[...F.diffRail, ...F.diffBus].filter(Number.isFinite).map(Math.abs));
  const bot = { y0: H1 + 22 + H2 / 2 };
  bot.y = (v) => bot.y0 - (v / dm) * (H2 / 2 - 4);
  const months = F.dates.map((d, i) => [d, i]).filter(([d]) => d.endsWith('-01'));
  return (
    <div className="dla-fd-ahead">
    <svg className="dla-svg dla-fd-svg" width={W} height={H1 + H2 + 40} viewBox={`0 0 ${W} ${H1 + H2 + 40}`} role="img" aria-label="Rail riders March to May 2019 with the same series shifted 7 days (dotted), and below the 7-day differences diff_7 for bus and rail">
      <text className="dla-t--xs" x={pad.l} y={10}>{COPY.legend.top}</text>
      <path className="dla-fd-ln dla-fd-ln--rail" d={path(F.rail.map((v, i) => [x(i), top.y(v)]))} />
      <path className="dla-fd-ln dla-fd-ln--lag" d={path(F.railLag.map((v, i) => [x(i), top.y(v)]))} />
      <text className="dla-t--xs dla-t--m" x={pad.l - 4} y={top.y(top.hi) + 4} textAnchor="end">{Math.round(top.hi / 1000)}k</text>
      <text className="dla-t--xs dla-t--m" x={pad.l - 4} y={top.y(top.lo)} textAnchor="end">{Math.round(top.lo / 1000)}k</text>
      <line className="dla-fd-axis" x1={pad.l} x2={W - pad.r} y1={bot.y0} y2={bot.y0} />
      <text className="dla-t--xs" x={pad.l} y={H1 + 10}>{COPY.legend.bottom}</text>
      <path className="dla-fd-ln dla-fd-ln--bus" d={path(F.diffBus.map((v, i) => [x(i), bot.y(v)]))} />
      <path className="dla-fd-ln dla-fd-ln--rail" d={path(F.diffRail.map((v, i) => [x(i), bot.y(v)]))} />
      <text className="dla-t--xs dla-t--m" x={pad.l - 4} y={bot.y0 + 3} textAnchor="end">0</text>
      {months.map(([d, i]) => (
        <text key={d} className="dla-t--xs" x={x(i)} y={H1 + H2 + 36} textAnchor="start">{monthLabel(d)}</text>
      ))}
    </svg>
    <p className="dla-fd-legend" aria-hidden="true">
      <span><i className="dla-fd-key dla-fd-key--rail" />{COPY.legend.rail}</span>
      <span><i className="dla-fd-key dla-fd-key--lag" />{COPY.legend.lag}</span>
      <span><i className="dla-fd-key dla-fd-key--bus" />{COPY.legend.bus}</span>
    </p>
    </div>
  );
}

/* ── slide 19's toy ───────────────────────────────────────────────────── */
export function ToyScene({ scene, width, reveal }) {
  const n = scene.series.length;
  const W = Math.max(300, width);
  const cw = clamp(Math.floor((W - 16) / n), 30, 54);
  const x0 = (W - cw * n) / 2;
  const cx = (i) => x0 + i * cw + cw / 2;
  const focus = scene.focus ?? null;
  const fw = focus !== null ? scene.windows[focus] : null;
  const H = 128;
  const tY = 44;
  const gY = 104;
  const missing = scene.missing ? n - scene.L : null;
  return (
    <div className="dla-fd-toy">
      <svg className="dla-svg dla-fd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`my_series ${scene.series.join(', ')}; sequence_length ${scene.L}; the targets start at index ${scene.L}`}>
        <text className="dla-t--xs" x={x0} y={12}>my_series</text>
        {scene.series.map((v, i) => (
          <g key={i}>
            <rect className="dla-fd-tok" x={x0 + i * cw + 3} y={tY - 18} width={cw - 6} height={30} rx={6} />
            <text className="dla-t dla-t--m" x={cx(i)} y={tY + 2} textAnchor="middle">{v}</text>
          </g>
        ))}
        {fw && (
          <path className="dla-fd-brace" d={`M${x0 + focus * cw + 4},${tY + 18} v6 H${x0 + (focus + scene.L) * cw - 4} v-6`} />
        )}
        {missing !== null && (
          <path className="dla-fd-brace dla-fd-brace--miss" d={`M${x0 + missing * cw + 4},${tY + 18} v6 H${x0 + n * cw - 4} v-6`} />
        )}
        <text className="dla-t--xs" x={x0} y={gY - 22}>targets=my_series[{scene.L}:]</text>
        {scene.series.map((v, i) => (i >= scene.L ? (
          <g key={i}>
            <rect className={`dla-fd-tok dla-fd-tok--y${reveal && fw && fw.y === v ? ' dla-fd-tok--hit' : ''}`} x={x0 + i * cw + 3} y={gY - 16} width={cw - 6} height={26} rx={6} />
            <text className="dla-t dla-t--m" x={cx(i)} y={gY + 2} textAnchor="middle">{v}</text>
          </g>
        ) : null))}
      </svg>
      <pre className="dla-fd-code" aria-label="The call">{scene.code.join('\n')}</pre>
      {reveal && (
        <p className="dla-fd-wins" aria-live="polite">
          {scene.windows.map((w) => `[${w.x.join(', ')}] → ${w.y}`).join('   ')}
        </p>
      )}
    </div>
  );
}

/* ── a 56-day window (slide 22) / a 70-day window (slide 37) ──────────── */
function Chart({ width, series, n, split, label, ticks, aria, children = null }) {
  const W = Math.max(300, width);
  const H = 150;
  const pad = { l: 34, r: 14, t: 12, b: 24 };
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const lo = Math.min(...all) * 0.95;
  const hi = Math.max(...all) * 1.03;
  const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  return (
    <figure className="dla-fd-fig">
    <figcaption className="dla-fd-cap">{label}</figcaption>
    <svg className="dla-svg dla-fd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      <line className="dla-fd-axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {ticks.map((t) => (
        <g key={t}>
          <line className="dla-fd-tick" x1={x(t)} x2={x(t)} y1={H - pad.b} y2={H - pad.b + 4} />
          <text className="dla-t--xs dla-t--m" x={x(t)} y={H - pad.b + 15} textAnchor="middle">{t}</text>
        </g>
      ))}
      <text className="dla-t--xs" x={W - pad.r} y={H - 2} textAnchor="end">{COPY.dayAxis}</text>
      <text className="dla-t--xs dla-t--m" x={pad.l - 4} y={y(hi) + 8} textAnchor="end">{hi.toFixed(1)}</text>
      <text className="dla-t--xs dla-t--m" x={pad.l - 4} y={y(lo)} textAnchor="end">{lo.toFixed(1)}</text>
      {split !== undefined && <line className="dla-fd-split" x1={(x(split - 1) + x(split)) / 2} x2={(x(split - 1) + x(split)) / 2} y1={pad.t - 6} y2={H - pad.b} />}
      {series.map((s) => (
        <g key={s.key}>
          <path className={`dla-fd-ln dla-fd-ln--${s.cls}`} d={path(s.values.map((v, i) => [x(i + (s.offset ?? 0)), y(v)]))} />
          {s.dots && s.values.map((v, i) => (Number.isFinite(v) ? <circle key={i} className={`dla-fd-dot dla-fd-dot--${s.cls}`} cx={x(i + (s.offset ?? 0))} cy={y(v)} r={1.8} /> : null))}
        </g>
      ))}
      {typeof children === 'function' ? children({ x, y }) : children}
    </svg>
    </figure>
  );
}

export function WindowScene({ scene, width, reveal }) {
  const L = scene.L;
  const inputs = scene.values.slice(0, L);
  const target = scene.values[L];
  return (
    <Chart
      width={width}
      n={L + 1}
      series={[{ key: 'in', cls: 'rail', values: inputs, dots: true }]}
      split={L}
      ticks={[0, 20, 40]}
      label={COPY.windowCaption}
      aria={`A window of ${L} days of normalised rail riders and its next-day target`}
    >
      {({ x, y }) => (
        <g>
          <text className="dla-fd-star" x={x(L)} y={y(target) + 5} textAnchor="middle">★</text>
          {scene.reveal === 'target' && !reveal && <text className="dla-t dla-t--b" x={x(L)} y={y(target) - 9} textAnchor="middle">?</text>}
          {scene.reveal === 'all' && (
            <g className="dla-fd-ghosts" aria-hidden="true">
              <text className="dla-t--xs" x={x(L) - 4} y={30} textAnchor="end">× batch_size windows like this</text>
            </g>
          )}
        </g>
      )}
    </Chart>
  );
}

export function AheadScene({ scene, width }) {
  const n = scene.rail.length;
  const s = scene.split;
  return (
    <div className="dla-fd-ahead">
      <Chart
        width={width}
        n={n}
        series={[
          { key: 'bus', cls: 'bus', values: scene.bus.slice(0, s), dots: true },
          { key: 'rail', cls: 'rail', values: scene.rail.slice(0, s), dots: true },
          { key: 'out', cls: 'out', values: scene.rail.slice(s), offset: s, dots: true },
        ]}
        split={s}
        ticks={[0, 10, 20, 30, 40, 50, 60, 70].filter((t) => t < n)}
        label={COPY.aheadCaption}
        aria={`A ${n}-day window: bus and rail inputs, then rail targets`}
      />
      <p className="dla-fd-legend" aria-hidden="true">
        <span><i className="dla-fd-key dla-fd-key--bus" />{COPY.busIn}</span>
        <span><i className="dla-fd-key dla-fd-key--rail" />{COPY.railIn}</span>
        <span><i className="dla-fd-key dla-fd-key--out" />{COPY.railOut}</span>
      </p>
    </div>
  );
}

/* ── the leaderboard ──────────────────────────────────────────────────── */
export function BoardScene({ scene, width, reveal, correct }) {
  const W = Math.max(300, width);
  const narrow = W < 520;
  const labW = narrow ? 112 : 196;
  const valW = narrow ? 64 : 76;
  const x0 = labW + 6;
  const x1 = W - valW;
  const max = BOARD.scaleMax;
  const bx = (v) => x0 + (clamp(v, 0, max) / max) * (x1 - x0);
  const rows = scene.mode === 'nameOf' || scene.mode === 'valueOf' ? (reveal ? scene.rows : scene.rows.filter((r) => r.id === scene.ask)) : scene.rows;
  const rowH = narrow ? 30 : 38;
  const top = 26;
  const H = top + rows.length * rowH + 6;
  const base = bx(scene.baseline.value);
  return (
    <svg className="dla-svg dla-fd-svg dla-fd-board" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${COPY.boardTitle}; the 7-day baseline is ${scene.baseline.label}`}>
      <text className="dla-t--xs" x={0} y={11}>{COPY.boardTitle}</text>
      <line className="dla-fd-base" x1={base} x2={base} y1={16} y2={H} />
      <text className="dla-t--xs dla-t--b dla-fd-base__t" x={base - 4} y={top - 2} textAnchor="end">{COPY.baseline} {scene.baseline.label}</text>
      {rows.map((r, i) => {
        const y = top + i * rowH;
        const asked = r.id === scene.ask;
        const hideName = asked && scene.mode === 'nameOf' && !reveal;
        const hideVal = !reveal && (scene.mode === 'hidden' || (asked && scene.mode === 'valueOf'));
        const end = r.bound ? x1 : bx(r.value);
        const beats = !r.bound && r.value < scene.baseline.value;
        const tone = reveal && asked ? (correct ? ' dla-fd-bar--right' : ' dla-fd-bar--wrong') : '';
        return (
          <g key={r.id} className={`dla-fd-row${asked ? ' dla-fd-row--ask' : ''}`}>
            <text className="dla-t dla-t--m" x={0} y={y + 13}>{hideName ? COPY.boardHidden : r.name}</text>
            {!narrow && <text className="dla-t--xs" x={0} y={y + 26}>{hideName ? '' : r.code}</text>}
            {hideVal ? (
              <rect className="dla-fd-bar dla-fd-bar--ghost" x={x0} y={y + 4} width={x1 - x0} height={16} rx={3} />
            ) : (
              <rect className={`dla-fd-bar${beats ? ' dla-fd-bar--beat' : ' dla-fd-bar--lose'}${tone}${reveal ? ' dla-fd-bar--grow' : ''}`} x={x0} y={y + 4} width={Math.max(2, end - x0)} height={16} rx={3} />
            )}
            <text className="dla-t dla-t--m dla-t--b" x={W} y={y + 17} textAnchor="end">{hideVal ? COPY.boardHidden : r.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── slide 30's table ─────────────────────────────────────────────────── */
export function Table30Scene({ scene }) {
  const hl = scene.highlight;
  const oneHot = TABLE30.columns.slice(2);
  const prefix = oneHot[0].slice(0, oneHot[0].lastIndexOf('_') + 1); // 'next_day_type_'
  return (
    <div className="dla-fd-tablewrap">
      <table className={`dla-fd-table dla-fd-table--${hl}`} aria-label={TABLE30.caption}>
        <thead>
          {hl === 'index' && (
            <tr className="dla-fd-table__idx" aria-hidden="true"><th />{TABLE30.columns.map((c, i) => <th key={c}>{i}</th>)}</tr>
          )}
          <tr><th rowSpan={2}>date</th><th rowSpan={2}>{TABLE30.columns[0]}</th><th rowSpan={2}>{TABLE30.columns[1]}</th><th colSpan={3} className="dla-fd-table__group">{prefix}</th></tr>
          <tr>{oneHot.map((c) => <th key={c} aria-label={c}>{c.slice(prefix.length)}</th>)}</tr>
        </thead>
        <tbody>
          {TABLE30.rows.map((r) => (
            <tr key={r.date}>
              <th>{r.date}</th>
              {r.values.map((v, i) => (
                <td key={i} className={hl === 'nextDay' && r.date === '2016-01-02' && i === 3 ? 'dla-fd-table__hot' : ''}>{i < 2 ? v.toFixed(6) : v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dla-fd-cap">{TABLE30.caption}</p>
    </div>
  );
}

/* ── the multi-step strategies ────────────────────────────────────────── */
export function StrategyScene({ scene, width }) {
  const W = Math.max(300, width);
  const n = 6;
  const H = 150;
  const id = scene.id;
  const cw = Math.min(56, (W - 120) / n);
  const extra = id === 'ahead' ? 100 : id === 'loop' ? 60 : 0;
  const x0 = Math.max(16, (W - (n * (cw + 10) + extra)) / 2);
  const cy = 92;
  const cx = (i) => x0 + i * (cw + 10) + cw / 2;
  const last = n - 1;
  const outDots = (x, y, k, r = 3) => Array.from({ length: k }, (_, j) => <circle key={j} className="dla-fd-dot dla-fd-dot--out" cx={x} cy={y - j * (r * 2 + 1)} r={r} />);
  return (
    <svg className="dla-svg dla-fd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A recurrent network unrolled over time with its forecasts">
      <defs>
        <marker id="dla-fd-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 Z" className="dla-fd-ahead-mk" />
        </marker>
      </defs>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect className="dla-fd-cellbox" x={cx(i) - cw / 2} y={cy - 14} width={cw} height={28} rx={6} />
          <line className="dla-fd-wire" x1={cx(i)} x2={cx(i)} y1={cy + 36} y2={cy + 16} markerEnd="url(#dla-fd-ah)" />
          <circle className="dla-fd-dot dla-fd-dot--rail" cx={cx(i)} cy={cy + 42} r={4} />
          {i < last && <line className="dla-fd-wire" x1={cx(i) + cw / 2} x2={cx(i + 1) - cw / 2 - 2} y1={cy} y2={cy} markerEnd="url(#dla-fd-ah)" />}
          {id === 'seq2seq' && (
            <g>
              <line className="dla-fd-wire" x1={cx(i)} x2={cx(i)} y1={cy - 14} y2={cy - 30} markerEnd="url(#dla-fd-ah)" />
              {outDots(cx(i), cy - 38, 4)}
            </g>
          )}
        </g>
      ))}
      {id === 'ahead' && (
        <g>
          <line className="dla-fd-wire" x1={cx(last) + cw / 2} x2={cx(last) + cw / 2 + 22} y1={cy} y2={cy} markerEnd="url(#dla-fd-ah)" />
          <rect className="dla-fd-cellbox dla-fd-cellbox--head" x={cx(last) + cw / 2 + 26} y={cy - 14} width={64} height={28} rx={6} />
          <text className="dla-t--xs dla-t--m" x={cx(last) + cw / 2 + 58} y={cy + 4} textAnchor="middle">Dense(14)</text>
          {Array.from({ length: 14 }, (_, j) => <circle key={j} className="dla-fd-dot dla-fd-dot--out" cx={cx(last) + cw / 2 + 30 + (j % 7) * 8} cy={cy - 30 - Math.floor(j / 7) * 9} r={3} />)}
        </g>
      )}
      {id === 'loop' && (
        <g>
          <line className="dla-fd-wire" x1={cx(last)} x2={cx(last)} y1={cy - 14} y2={cy - 34} markerEnd="url(#dla-fd-ah)" />
          {outDots(cx(last), cy - 42, 1, 5)}
          <path className="dla-fd-wire dla-fd-wire--loop" d={`M${cx(last) + 6},${cy - 44} C${cx(last) + 60},${cy - 64} ${cx(last) + 70},${cy + 60} ${cx(last) + cw + 18},${cy + 44}`} markerEnd="url(#dla-fd-ah)" />
          <circle className="dla-fd-dot dla-fd-dot--out dla-fd-dot--fed" cx={cx(last) + cw + 22} cy={cy + 42} r={4} />
          <text className="dla-t dla-t--b dla-t--m" x={cx(last) - 12} y={cy - 38} textAnchor="end">× 14</text>
        </g>
      )}
      <text className="dla-t--xs" x={x0} y={H - 2}>{COPY.dayAxis} →</text>
    </svg>
  );
}

/* ── a deep RNN unrolled (slides 28–29) ───────────────────────────────── */
export function StackScene({ scene, width }) {
  const W = Math.max(300, width);
  const layers = scene.layers;
  const steps = 4;
  const rowH = 40;
  const top = 46;
  const H = top + layers * rowH + 36;
  const labW = W < 480 ? 0 : 110;
  const cw = Math.min(64, (W - labW - 40) / steps - 14);
  const cx = (t) => labW + 14 + t * (cw + 14) + cw / 2;
  const ry = (l) => top + (layers - 1 - l) * rowH + 14; // layer 0 at the bottom
  return (
    <svg className="dla-svg dla-fd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layers} stacked SimpleRNN layers unrolled over ${steps} time steps, then ${scene.head}`}>
      <defs>
        <marker id="dla-fd-ah2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 Z" className="dla-fd-ahead-mk" />
        </marker>
      </defs>
      <rect className="dla-fd-cellbox dla-fd-cellbox--head" x={cx(steps - 1) - 34} y={6} width={68} height={24} rx={6} />
      <text className="dla-t--xs dla-t--m" x={cx(steps - 1)} y={22} textAnchor="middle">{scene.head}</text>
      {Array.from({ length: layers }, (_, l) => (
        <g key={l}>
          {labW > 0 && <text className="dla-t--xs dla-t--m" x={0} y={ry(l) + 4}>SimpleRNN(32)</text>}
          {Array.from({ length: steps }, (_, t) => {
            const up = l < layers - 1 || t === steps - 1; // lower layers pass every step up; the last only its final output
            return (
              <g key={t}>
                <rect className="dla-fd-cellbox" x={cx(t) - cw / 2} y={ry(l) - 11} width={cw} height={22} rx={5} />
                {t < steps - 1 && <line className="dla-fd-wire" x1={cx(t) + cw / 2} x2={cx(t + 1) - cw / 2 - 2} y1={ry(l)} y2={ry(l)} markerEnd="url(#dla-fd-ah2)" />}
                {up && <line className={`dla-fd-wire${l < layers - 1 ? '' : ' dla-fd-wire--last'}`} x1={cx(t)} x2={cx(t)} y1={ry(l) - 11} y2={l < layers - 1 ? ry(l + 1) + 13 : 32} markerEnd="url(#dla-fd-ah2)" />}
                {l === 0 && <line className="dla-fd-wire" x1={cx(t)} x2={cx(t)} y1={ry(0) + 30} y2={ry(0) + 13} markerEnd="url(#dla-fd-ah2)" />}
                {l === 0 && <circle className="dla-fd-dot dla-fd-dot--rail" cx={cx(t)} cy={ry(0) + 34} r={4} />}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/* ── slide 20's split ─────────────────────────────────────────────────── */
const monthIdx = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};
export function TimelineScene({ width, reveal }) {
  const W = Math.max(300, width);
  const H = 92;
  const a = monthIdx(SPLITS.axis.from);
  const b = monthIdx(SPLITS.axis.to) + 1;
  const pad = { l: 8, r: 8 };
  const x = (mi) => pad.l + ((mi - a) / (b - a)) * (W - pad.l - pad.r);
  const years = [];
  for (let yr = Math.ceil(a / 12); yr * 12 < b; yr++) years.push(yr);
  return (
    <svg className="dla-svg dla-fd-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The ridership timeline from 2016 to 2019 split into three periods">
      {SPLITS.periods.map((p, i) => {
        const x1 = x(monthIdx(p.from));
        const x2 = p.to ? x(monthIdx(p.to) + 1) : W - pad.r;
        return (
          <g key={p.name}>
            <rect className={`dla-fd-seg dla-fd-seg--${i}`} x={x1} y={22} width={Math.max(2, x2 - x1 - 2)} height={26} rx={4} />
            {reveal && <text className="dla-t--xs dla-t--m" x={x1 + 4} y={16}>{p.name}</text>}
            {!p.to && <path className="dla-fd-arrow" d={`M${x2 - 8},${24} l8,11 l-8,11`} />}
          </g>
        );
      })}
      <rect className="dla-fd-band" x={x(monthIdx(SPLITS.diff7.from))} y={18} width={x(monthIdx(SPLITS.diff7.to) + 1) - x(monthIdx(SPLITS.diff7.from))} height={34} rx={4} />
      <line className="dla-fd-axis" x1={pad.l} x2={W - pad.r} y1={58} y2={58} />
      {years.map((yr) => (
        <g key={yr}>
          <line className="dla-fd-tick" x1={x(yr * 12)} x2={x(yr * 12)} y1={58} y2={63} />
          <text className="dla-t--xs dla-t--m" x={x(yr * 12) + 2} y={76}>{yr}</text>
        </g>
      ))}
      <text className="dla-t--xs" x={W - pad.r} y={H - 2} textAnchor="end">dashed: {SPLITS.diff7.label} ({SPLITS.diff7.from} to {SPLITS.diff7.to})</text>
    </svg>
  );
}

/* ── the desk tape: one tick per call ─────────────────────────────────── */
export function Tape({ total, index, outcomes }) {
  return (
    <span className="dla-fd-tape" aria-label={`${COPY.tape}: ${outcomes.filter((o) => o.correct).length} of ${outcomes.length} right`}>
      <span className="dla-k">{COPY.tape}</span>
      {Array.from({ length: total }, (_, i) => {
        const o = outcomes[i];
        return <i key={i} className={`dla-fd-tick-dot${o ? (o.correct ? ' dla-fd-tick-dot--right' : ' dla-fd-tick-dot--wrong') : ''}${i === index ? ' dla-fd-tick-dot--now' : ''}`} />;
      })}
    </span>
  );
}

