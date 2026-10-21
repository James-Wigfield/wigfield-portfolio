import { useCallback, useEffect, useRef, useState } from 'react';
import { NLM_STEPS, NLM_PROMPT, NLM_FORMAT, NLM_SPLIT_NOTE, NLM_PARTS } from './exportPrompt';

/* ============================================================================
   LECTURE 3 STUDY — THE NOTEBOOKLM PROMPT PANEL
   ----------------------------------------------------------------------------
   Opened by the "NotebookLM video prompt" disclosure under Export PDF: three
   tiny steps, the prompt with a Copy button, and an optional two-part
   variant. Copy uses the async clipboard and falls back to selecting the
   prompt's text (plus execCommand) so Ctrl+C still works. Prompt text lives
   in ./exportPrompt.js. Screen only — it never prints.
   ========================================================================== */

function useCopy() {
  const [copied, setCopied] = useState('');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async (which, text, preEl) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      if (preEl) {
        try {
          const range = document.createRange();
          range.selectNodeContents(preEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
      }
    }
    setCopied(ok ? which : `${which}-selected`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(''), 2400);
  }, []);
  return [copied, copy];
}

function PromptBlock({ which, label, text, copied, onCopy }) {
  const preRef = useRef(null);
  const done = copied === which;
  const selected = copied === `${which}-selected`;
  return (
    <div className="dl3s-nlm__block">
      <div className="dl3s-nlm__bar">
        <span className="dl3s-nlm__label">{label}</span>
        <span className="dl3s-nlm__hint">{text.length} characters</span>
        <button type="button" className="dl3s-btn dl3s-nlm__copy" onClick={() => onCopy(which, text, preRef.current)} aria-live="polite">
          {done ? 'Copied' : selected ? 'Selected — press Ctrl+C' : 'Copy'}
        </button>
      </div>
      <pre className="dl3s-nlm__text" ref={preRef} tabIndex={0} aria-label={`${label} text`}>{text}</pre>
    </div>
  );
}

export default function NotebookLmPrompt({ id }) {
  const [copied, copy] = useCopy();
  return (
    <div className="dl3s-nlm" id={id}>
      <ol className="dl3s-nlm__steps">
        {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <PromptBlock which="full" label={`Prompt · ${NLM_FORMAT} format, whole PDF`} text={NLM_PROMPT} copied={copied} onCopy={copy} />
      <p className="dl3s-nlm__split">{NLM_SPLIT_NOTE}</p>
      {NLM_PARTS.map((p, i) => (
        <PromptBlock key={p.label} which={`part${i + 1}`} label={p.label} text={p.text} copied={copied} onCopy={copy} />
      ))}
    </div>
  );
}
