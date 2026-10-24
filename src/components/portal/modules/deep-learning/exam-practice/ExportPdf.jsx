import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_PROMPT, NLM_STEPS, NLM_FORMAT, NLM_NOTE } from './exportPrompt';

/* ============================================================================
   EXAM PRACTICE — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   A copy of the Lecture 8 study's ExportPdf.jsx, with one prompt: the
   "Export PDF" button (the shell's exportPdf: print mode + the browser's
   Save as PDF) and, directly under it, a quiet disclosure with the numbered
   steps and the NotebookLM prompt. Copy uses navigator.clipboard and falls
   back to selecting the text. Nothing here prints.
   ========================================================================== */

function PromptBlock({ text, label }) {
  const [copied, setCopied] = useState('');
  const textRef = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // fall back: select the prompt so Ctrl+C copies it
      try {
        const range = document.createRange();
        range.selectNodeContents(textRef.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        /* nothing more to try */
      }
    }
    setCopied(ok ? 'Copied' : 'Selected: press Ctrl+C');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(''), 2400);
  };

  return (
    <div className="dlxp-nlm__block" data-prompt="video">
      <div className="dlxp-nlm__head">
        <span className="dlxp-nlm__k">{label} · {text.length} characters</span>
        <button type="button" className="dlxp-nlm__copy" onClick={copy}>
          {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
        </button>
      </div>
      <p className="dlxp-nlm__text" ref={textRef}>{text}</p>
    </div>
  );
}

export default function ExportPdf({ onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dlxp-export">
      <button type="button" className="dlxp-btn dlxp-btn--big" onClick={onExport} title="Print all three papers, each followed by its model answers, to an A4 PDF (choose Save as PDF)">
        <Icon name="printer" size={16} /> Export PDF
      </button>
      <button type="button" className="dlxp-export__toggle" aria-expanded={open} aria-controls="dlxp-nlm" onClick={() => setOpen((o) => !o)}>
        NotebookLM video prompt <span className={`dlxp-export__chev${open ? ' dlxp-export__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dlxp-nlm" id="dlxp-nlm">
          <ol className="dlxp-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <PromptBlock text={NLM_PROMPT} label={`One video · format: ${NLM_FORMAT}`} />
          <p className="dlxp-nlm__note">{NLM_NOTE}</p>
        </div>
      )}
    </span>
  );
}
