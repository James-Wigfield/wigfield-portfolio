import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_STEPS, NLM_NOTE } from './nlm';

/* ============================================================================
   TRICKY TOPICS — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPT(S)
   ----------------------------------------------------------------------------
   A secondary button in the topic's opener ("Export PDF": the shell's
   exportPdf, print mode + the browser's Save as PDF, for THIS topic) and,
   directly under it, a quiet disclosure with the topic's NotebookLM prompts
   (topics/<id>/exportPrompt.js): one prompt for a single video, plus an
   optional multi-part variant. Each has its own Copy button, which uses
   navigator.clipboard and falls back to selecting the text. Nothing here
   prints.
   ========================================================================== */

function PromptBlock({ id, label, text }) {
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
    <div className="dltt-nlm__block" data-prompt={id}>
      <div className="dltt-nlm__head">
        <span className="dltt-nlm__k">{label} · {text.length} characters</span>
        <button type="button" className="dltt-nlm__copy" onClick={copy}>
          {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
        </button>
      </div>
      <p className="dltt-nlm__text" ref={textRef}>{text}</p>
    </div>
  );
}

export default function ExportPdf({ onExport, prompts, topicTitle }) {
  const [open, setOpen] = useState(false);
  const parts = prompts?.parts ?? [];
  return (
    <span className="dltt-export">
      <button type="button" className="dltt-btn dltt-btn--big" onClick={onExport} title={`Print this topic (${topicTitle}): the opener, every step's Read + Play and the drill's worked set, to an A4 PDF (choose Save as PDF)`}>
        <Icon name="printer" size={16} /> Export PDF
      </button>
      {prompts && (
        <button type="button" className="dltt-export__toggle" aria-expanded={open} aria-controls="dltt-nlm" onClick={() => setOpen((o) => !o)}>
          NotebookLM video prompt <span className={`dltt-export__chev${open ? ' dltt-export__chev--open' : ''}`} aria-hidden="true">▾</span>
        </button>
      )}
      {prompts && open && (
        <div className="dltt-nlm" id="dltt-nlm">
          <ol className="dltt-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <PromptBlock id="single" label={prompts.single.label ?? 'One video · format: Explainer'} text={prompts.single.text} />
          {parts.length > 0 && <p className="dltt-nlm__or">Or, as {parts.length} shorter videos:</p>}
          {parts.map((p, i) => <PromptBlock key={p.label} id={`part${i + 1}`} label={p.label} text={p.text} />)}
          <p className="dltt-nlm__note">{NLM_NOTE}</p>
        </div>
      )}
    </span>
  );
}
