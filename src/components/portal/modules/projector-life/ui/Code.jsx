import { useCallback, useState } from 'react';
import Glyph from './glyphs';

/* ============================================================================
   PROJECTOR LIFE — VS-Code-style code block
   Mirrors the Deep Learning kit's <Code> (deep-learning/kit.jsx): dark editor
   chrome with traffic-light dots and a file tab, line numbers, Dark+ token
   colours — on every portal theme. This one tokenises JS / JSON(C) instead
   of Python and adds a copy button. Classes: pjl-code*.
   ========================================================================== */

const KEYWORDS = new Set([
  'export', 'import', 'from', 'function', 'const', 'let', 'var', 'return', 'async', 'await', 'new',
  'if', 'else', 'for', 'of', 'in', 'while', 'class', 'extends', 'interface', 'type', 'default', 'typeof',
]);
const CONSTS = new Set(['true', 'false', 'null', 'undefined', 'this']);

const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`[^`]*`?)|(-?\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)/g;

/** One line of JS/JSON → [{ t, cls }] with Dark+ classes. */
function tokens(line) {
  const out = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    const after = line.slice(TOKEN_RE.lastIndex);
    if (m[1] !== undefined) out.push({ t: m[1], cls: 'cm' });
    else if (m[2] !== undefined) out.push({ t: m[2], cls: /^\s*:/.test(after) ? 'pk' : 'st' });
    else if (m[3] !== undefined) out.push({ t: m[3], cls: 'nu' });
    else {
      const w = m[4];
      if (KEYWORDS.has(w)) out.push({ t: w, cls: 'kw' });
      else if (CONSTS.has(w)) out.push({ t: w, cls: 'ct' });
      else if (/^\s*\(/.test(after)) out.push({ t: w, cls: 'fn' });
      else if (/^\s*\??:/.test(after)) out.push({ t: w, cls: 'pk' });
      else if (/^[A-Z]/.test(w)) out.push({ t: w, cls: 'ty' });
      else out.push({ t: w, cls: 'id' });
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* code = the text shown; copy = what the copy button copies (defaults to code);
   label = the editor-tab "filename"; meta = right-hand mono note. */
export default function Code({ code, copy, label = 'scene.json', meta, maxHeight }) {
  const [state, setState] = useState('idle');
  const lines = code.replace(/\n$/, '').split('\n');
  const onCopy = useCallback(async () => {
    const ok = await copyText(copy ?? code);
    setState(ok ? 'copied' : 'failed');
    setTimeout(() => setState('idle'), 1600);
  }, [code, copy]);
  return (
    <figure className="pjl-code">
      <figcaption className="pjl-code__bar">
        <span className="pjl-code__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="pjl-code__file">{label}</span>
        {meta && <span className="pjl-code__meta">{meta}</span>}
        <button type="button" className="pjl-code__copy" onClick={onCopy} aria-live="polite">
          <Glyph name="copy" size={13} />
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </figcaption>
      <pre className="pjl-code__pre" style={maxHeight ? { maxHeight } : undefined} tabIndex={0}>
        <code className="pjl-code__code">
          {lines.map((ln, i) => (
            <span key={i} className="pjl-code__line">
              {tokens(ln).map((tok, j) => (tok.cls ? <span key={j} className={`pjl-tok-${tok.cls}`}>{tok.t}</span> : tok.t))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
