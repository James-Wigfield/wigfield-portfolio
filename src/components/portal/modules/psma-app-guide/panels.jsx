import { LOOK, rgb } from './looks';
import { CLOSE, COUNTS, DEFS, LEGEND, TAG } from './copy';

/* ============================================================================
   PSMA APP GUIDE — PANELS
   ----------------------------------------------------------------------------
   Stage panels that are not callouts: the comparison legend (the app's exact
   overlay colours), the score definitions, the "sped up" tag and the closing
   credits. Numbers come from the panel's data (the manifest), never from here.
   ========================================================================== */

// Each class by chip, shape and word (C4: colour alone does not separate them for every viewer).
// The chip is filled as the app draws the class over CT (0.6 over grey 128) and edged in the
// class's own colour, so it matches what is on the slice. Stage.jsx lights one row at a time
// (B.legendFocus) through each row's data-row.
function Legend() {
  const rows = [['found', LEGEND.found], ['missed', LEGEND.missed], ['falseAlarm', LEGEND.falseAlarm]];
  return (
    <div className="pag-legend">
      {rows.map(([k, label]) => (
        <div className="pag-legend-row" key={k} data-row={k}>
          <span className="pag-legend-sw" style={{ background: rgb(LOOK.overlayOnCt[k]), borderColor: rgb(LOOK.overlay[k]) }} />
          <span className="pag-legend-glyph" aria-hidden="true">{LOOK.glyph[k]}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

// The definitions, row by row in the card's order (B.panelRow steps them in), each with the
// card's own value beside its name; the first row ties the counts to their words and shapes (C4).
function Defs({ data }) {
  return (
    <div className="pag-defs">
      <div className="pag-defs-row pag-defs-counts" data-row="counts">
        <span>{LOOK.glyph.found} {data.found} {COUNTS.found}</span>
        <span>{LOOK.glyph.missed} {data.missed} {COUNTS.missed}</span>
        <span>{LOOK.glyph.falseAlarm} {data.falseAlarm} {COUNTS.falseAlarm}</span>
      </div>
      {DEFS.map((d) => (
        <div className="pag-defs-row" key={d.key} data-row={d.key}>
          <div className="pag-defs-name">{d.name} <span className="pag-defs-value">{data[d.key]}</span></div>
          <div className="pag-defs-text">{d.text}</div>
        </div>
      ))}
    </div>
  );
}

function Tag({ data }) {
  return (
    <div className="pag-tag">
      <span className="pag-tag-mark" aria-hidden="true">▶▶</span>
      {TAG.sped} {data.factor}× · {TAG.took} <span data-k={data.key}>{data.seconds}</span> {TAG.unit}
      {data.where ? ` ${TAG.on} ${data.where}` : ''}
    </div>
  );
}

function Credits() {
  return (
    <div className="pag-credits">
      <div className="pag-credits-group">{CLOSE.group}</div>
      <div className="pag-credits-data">{CLOSE.data}</div>
      <div className="pag-credits-note">{CLOSE.disclaimer}</div>
    </div>
  );
}

const PANELS = { legend: Legend, defs: Defs, tag: Tag, credits: Credits };

export default function Panel({ id, data }) {
  const Content = PANELS[id];
  return Content ? <Content data={data} /> : null;
}
