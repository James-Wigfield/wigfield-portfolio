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
      <span key={`${keyBase}-${i++}`} className={tok.startsWith('`') ? 'mrp-md-code' : 'mrp-md-bold'}>{tok}</span>,
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
      return <span className="mrp-md-fence">{line}</span>;
    }
    if (fenced) return <span className="mrp-md-json">{line}</span>;
    const h = line.match(/^(#{1,6})\s(.*)$/);
    if (h) return <span className="mrp-md-head"><span className="mrp-md-mark">{h[1]} </span>{h[2]}</span>;
    const li = line.match(/^(\s*)(\d+\.|-)\s(.*)$/);
    if (li) return <>{li[1]}<span className="mrp-md-mark">{li[2]} </span>{inline(li[3], n)}</>;
    return inline(line, n);
  });
}

export default function PromptBlock({ prompt }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('idle');
  const timer = useRef(0);
  const lines = useMemo(() => highlight(prompt), [prompt]);
  const words = useMemo(() => prompt.split(/\s+/).filter(Boolean).length, [prompt]);

  const onCopy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok ? 'done' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2200);
  };

  const copyLabel = copied === 'done' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy prompt';

  return (
    <section className="mrp-prompt" data-open={open}>
      <div className="mrp-prompt__bar">
        <button
          type="button"
          className="mrp-prompt__toggle"
          aria-expanded={open}
          aria-controls="mrp-prompt-body"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="chevron" size={16} className="mrp-prompt__chev" />
          <span className="mrp-micro">Build prompt</span>
          <span className="mrp-prompt__title">Paste into a fresh Claude Code in this repo</span>
          <span className="mrp-prompt__meta">{words.toLocaleString()} words · markdown</span>
        </button>
        <button type="button" className="mrp-copy" data-state={copied} onClick={onCopy}>
          <Icon name={copied === 'done' ? 'check' : 'edit'} size={14} />
          <span aria-live="polite">{copyLabel}</span>
        </button>
      </div>

      <div className="mrp-prompt__wrap" id="mrp-prompt-body" hidden={!open}>
        <div className="mrp-editor">
          <div className="mrp-editor__chrome">
            <span className="mrp-editor__dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="mrp-editor__tab">memory-rooms-build-prompt.md</span>
            <button type="button" className="mrp-editor__copy" onClick={onCopy}>{copyLabel}</button>
          </div>
          <pre className="mrp-editor__body" tabIndex={0} aria-label="Build prompt, markdown">
            {lines.map((l, i) => (
              <span className="mrp-editor__line" key={i}>
                <span className="mrp-editor__ln" aria-hidden="true">{i + 1}</span>
                <span className="mrp-editor__txt">{l}{'\n'}</span>
              </span>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}
