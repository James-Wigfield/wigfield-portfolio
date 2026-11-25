import { useMemo, useRef, useState } from 'react';
import Icon from '../../icons';

/* The build prompt drawer: a disclosure at the very top of the page holding the
   prompt as a markdown file in VS-Code-style chrome, with a Copy button that
   works collapsed or open. The prompt text is build-prompt.md (imported ?raw). */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API blocked (permissions / insecure context) → execCommand fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// ── tiny markdown highlighter (line based, returns React nodes) ─────────────
function inline(text, keyBase) {
  const out = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      <span key={`${keyBase}-${i++}`} className={tok.startsWith('`') ? 'drp-md-code' : 'drp-md-bold'}>{tok}</span>,
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function highlight(src) {
  let fenced = false;
  return src.split('\n').map((line, n) => {
    if (line.startsWith('```')) {
      fenced = !fenced;
      return <span className="drp-md-fence">{line}</span>;
    }
    if (fenced) return <span className="drp-md-json">{line}</span>;
    const h = line.match(/^(#{1,6})\s(.*)$/);
    if (h) return <span className="drp-md-head"><span className="drp-md-mark">{h[1]} </span>{h[2]}</span>;
    const li = line.match(/^(\s*)(\d+\.|-)\s(.*)$/);
    if (li) return <>{li[1]}<span className="drp-md-mark">{li[2]} </span>{inline(li[3], n)}</>;
    return inline(line, n);
  });
}

export default function PromptBlock({ prompt }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('idle');
  const [from, setFrom] = useState('bar'); // which button was pressed, so only that one says Copied
  const timer = useRef(0);
  const lines = useMemo(() => highlight(prompt), [prompt]);
  const words = useMemo(() => prompt.split(/\s+/).filter(Boolean).length, [prompt]);

  const onCopy = async (src) => {
    setFrom(src);
    const ok = await copyText(prompt);
    setCopied(ok ? 'done' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2200);
  };

  const labelFor = (src) => (from !== src || copied === 'idle' ? 'Copy prompt' : copied === 'done' ? 'Copied' : 'Copy failed');
  const barState = from === 'bar' ? copied : 'idle';

  return (
    <section className="drp-prompt" data-open={open}>
      <div className="drp-prompt__bar">
        <button
          type="button"
          className="drp-prompt__toggle"
          aria-expanded={open}
          aria-controls="drp-prompt-body"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="chevron" size={16} className="drp-prompt__chev" />
          <span className="drp-micro">Build prompt</span>
          <span className="drp-prompt__title">Paste into a fresh Claude Code in this repo</span>
          <span className="drp-prompt__meta">{words.toLocaleString()} words · markdown</span>
        </button>
        <button type="button" className="drp-copy" data-state={barState} onClick={() => onCopy('bar')}>
          <Icon name={barState === 'done' ? 'check' : 'edit'} size={14} />
          <span aria-live="polite">{labelFor('bar')}</span>
        </button>
      </div>

      <div className="drp-prompt__wrap" id="drp-prompt-body" hidden={!open}>
        <div className="drp-editor">
          <div className="drp-editor__chrome">
            <span className="drp-editor__dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="drp-editor__tab">dream-rooms-build-prompt.md</span>
            <button type="button" className="drp-editor__copy" onClick={() => onCopy('editor')}>{labelFor('editor')}</button>
          </div>
          <pre className="drp-editor__body" tabIndex={0} aria-label="Build prompt, markdown">
            {lines.map((l, i) => (
              <span className="drp-editor__line" key={i}>
                <span className="drp-editor__ln" aria-hidden="true">{i + 1}</span>
                <span className="drp-editor__txt">{l}{'\n'}</span>
              </span>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}
