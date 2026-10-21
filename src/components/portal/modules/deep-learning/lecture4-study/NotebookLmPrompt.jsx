import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_STEPS, NLM_FORMAT, NLM_PROMPT, NLM_SPLIT, NLM_PARTS } from './exportPrompt';
import './export.css';

/* ============================================================================
   LECTURE 4 STUDY — "NOTEBOOKLM VIDEO PROMPT ▾"
   ----------------------------------------------------------------------------
   The quiet disclosure under Export PDF: three steps, which format to pick,
   the prompt (and a two-part variant) each with its own Copy button. Copy
   uses the clipboard API and, where that is refused, selects the text so a
   Ctrl+C finishes the job. Text lives in ./exportPrompt.js; never printed.
   ========================================================================== */

function PromptBlock({ label, text }) {
  const [state, setState] = useState(''); // '' · 'copied' · 'selected'
  const preRef = useRef(null);
  useEffect(() => {
    if (!state) return undefined;
    const id = setTimeout(() => setState(''), 2400);
    return () => clearTimeout(id);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // no clipboard access: select the text instead
      try {
        const range = document.createRange();
        range.selectNodeContents(preRef.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        /* nothing more to try */
      }
      setState('selected');
    }
  };

  return (
    <div className="dl4s-nlm__block">
      <div className="dl4s-nlm__bar">
        <span className="dl4s-nlm__label">{label}</span>
        <span className="dl4s-nlm__count">{text.length} characters</span>
        <button type="button" className="dl4s-nlm__copy" onClick={copy} aria-label={`Copy the prompt: ${label}`}>
          <Icon name={state === 'copied' ? 'check' : 'notebook'} size={13} />
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
        <span className="dl4s-nlm__status" role="status">
          {state === 'copied' ? 'Copied to the clipboard' : state === 'selected' ? 'Selected — press Ctrl+C' : ''}
        </span>
      </div>
      <pre className="dl4s-nlm__text" ref={preRef} tabIndex={0}>{text}</pre>
    </div>
  );
}

export default function NotebookLmPrompt() {
  const [open, setOpen] = useState(false);
  return (
    <div className="dl4s-export">
      <button
        type="button"
        className={`dl4s-export__toggle${open ? ' dl4s-export__toggle--open' : ''}`}
        aria-expanded={open}
        aria-controls="dl4s-nlm"
        onClick={() => setOpen((o) => !o)}
      >
        NotebookLM video prompt <span className="dl4s-export__chev" aria-hidden="true">▾</span>
      </button>
      <div className="dl4s-nlm" id="dl4s-nlm" hidden={!open}>
        <ol className="dl4s-nlm__steps">
          {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="dl4s-nlm__note">{NLM_FORMAT}</p>
        <PromptBlock label="One video · §0–§16" text={NLM_PROMPT} />
        <p className="dl4s-nlm__note dl4s-nlm__note--split">{NLM_SPLIT}</p>
        <div className="dl4s-nlm__parts">
          {NLM_PARTS.map((p) => <PromptBlock key={p.label} label={p.label} text={p.text} />)}
        </div>
      </div>
    </div>
  );
}
