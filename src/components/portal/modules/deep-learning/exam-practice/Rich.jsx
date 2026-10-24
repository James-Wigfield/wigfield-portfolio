import { Tex } from '../kit';
import { texText } from './texText';
import { TOKEN, GREEN, closeBrace } from './plain';

/* ============================================================================
   EXAM PRACTICE — INLINE TEXT
   ----------------------------------------------------------------------------
   A copy of the Lecture 8 study's Rich.jsx, cut down to what the papers use.
   One string of inline markup → React nodes:
       **bold**  *italic*  `code`  $tex$  {g|…} green pen  \n line break
   (an earliest-match tokeniser, so nothing is ever injected as HTML).

   Maths prints twice over: KaTeX for the eye, and a print-only plain-text
   twin (.dlxp-texalt, from texText.js) so the PDF's text layer reads as
   words a reader — or NotebookLM — can follow.
   ========================================================================== */

// Inline maths: KaTeX on screen, its plain-text twin in print.
export function M({ src }) {
  return (
    <span className="dlxp-m">
      <Tex src={src} />
      <span className="dlxp-texalt">{texText(src)}</span>
    </span>
  );
}

function lines(text, key) {
  const parts = text.split('\n');
  return parts.flatMap((p, i) => (i === 0 ? [p] : [<br key={`${key}.br${i}`} />, p]));
}

function parse(text, key = 'r') {
  const out = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = TOKEN.exec(rest);
    const g = rest.indexOf(GREEN);
    const gEnd = g === -1 || (m && m.index < g) ? -1 : closeBrace(rest, g);
    if (gEnd !== -1) {
      if (g > 0) out.push(...lines(rest.slice(0, g), `${key}.${k++}`));
      const tk = `${key}.${k++}`;
      out.push(<span key={tk} className="dlxp-ink__g">{parse(rest.slice(g + GREEN.length, gEnd), tk)}</span>);
      rest = rest.slice(gEnd + 1);
      continue;
    }
    if (!m) {
      out.push(...lines(rest, `${key}.${k++}`));
      break;
    }
    if (m.index > 0) out.push(...lines(rest.slice(0, m.index), `${key}.${k++}`));
    const tk = `${key}.${k++}`;
    const tok = m[0];
    if (m[1]) out.push(<code key={tk} className="dlxp-c">{tok.slice(1, -1)}</code>);
    else if (m[2]) {
      // punctuation straight after a short formula stays on its line (a long
      // one keeps KaTeX's own break points, so it can still wrap at 390 px)
      const after = rest.slice(m.index + tok.length);
      const p = /^[.,;:!?)\]]+/.exec(after);
      if (p && tok.length <= 40) {
        out.push(<span key={tk} className="dlxp-nobr"><M src={tok.slice(1, -1)} />{p[0]}</span>);
        rest = after.slice(p[0].length);
        continue;
      }
      out.push(<M key={tk} src={tok.slice(1, -1)} />);
    } else if (m[3]) out.push(<b key={tk}>{parse(tok.slice(2, -2), tk)}</b>);
    else out.push(<em key={tk}>{parse(tok.slice(1, -1), tk)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

export function Rich({ text }) {
  return <>{parse(String(text ?? ''))}</>;
}
