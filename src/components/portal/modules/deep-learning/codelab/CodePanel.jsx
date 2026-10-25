import { panelRows } from './panelModel';

/* ============================================================================
   CODE LAB — THE CODE PANEL
   ----------------------------------------------------------------------------
   The kit's VS Code editor block (../kit.jsx `Code`: always-dark chrome,
   traffic-light dots, filename tab, line numbers, Dark+ tokens), copied and
   extended with numbered marks:
     · a line-range mark is a VS Code highlight band with ① in the gutter;
     · a token mark underlines exact text with ② straight after it.
   Unmarked lines are never dimmed. The card label sits in the title bar,
   so any crop of the panel says which card it is.

   In print the panel is swapped for its image (panelImage.js, made by the
   shell before printing) with the plain code laid under it as real text.
   ========================================================================== */

function Row({ row }) {
  return (
    <span className={`dlc-code__line${row.band ? ' dlc-code__line--band' : ''}`} data-line={row.no}>
      <span className="dlc-code__mk" aria-hidden="true">{row.gutter ? <span className="dlc-num-o">{row.gutter}</span> : ''}</span>
      <span className="dlc-code__no" aria-hidden="true">{row.no}</span>
      <span className="dlc-code__txt">
        {row.segs.map((s, j) => {
          const cls = [s.cls ? `dlc-tok-${s.cls}` : '', s.u ? 'dlc-code__u' : ''].filter(Boolean).join(' ');
          return (
            <span key={j}>
              {cls ? <span className={cls}>{s.t}</span> : s.t}
              {s.badge ? <span className="dlc-code__badge" aria-label={`mark ${s.badge}`}><span className="dlc-num-o">{s.badge}</span></span> : null}
            </span>
          );
        })}
      </span>
      {'\n'}
    </span>
  );
}

export default function CodePanel({ code, marks, file, meta, image }) {
  const rows = panelRows(code, marks);
  return (
    <div className={`dlc-codewrap${image ? ' dlc-codewrap--img' : ''}`}>
      <figure className="dlc-code">
        <figcaption className="dlc-code__bar">
          <span className="dlc-code__dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="dlc-code__file">{file}</span>
          {meta && <span className="dlc-code__meta">{meta}</span>}
        </figcaption>
        <pre className="dlc-code__pre"><code className="dlc-code__code">{rows.map((r) => <Row key={r.no} row={r} />)}</code></pre>
      </figure>
      {image && (
        <div className="dlc-pimg" aria-hidden="true">
          <div className="dlc-pimg__text" style={{ fontSize: `${(image.font / image.width) * 100}cqw`, lineHeight: `${(image.lh / image.width) * 100}cqw`, top: `${(image.top / image.height) * 100}%`, left: `${(image.left / image.width) * 100}%` }}>
            {image.text.map((t, i) => <div key={i}>{t || ' '}</div>)}
          </div>
          <img className="dlc-pimg__img" src={image.url} alt="" />
        </div>
      )}
    </div>
  );
}
