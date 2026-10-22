import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_PROMPT, NLM_PARTS, NLM_STEPS } from './exportPrompt';

/* ============================================================================
   LECTURE 8 STUDY — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   A secondary button in the hero ("Export PDF", the shell's exportPdf: print
   mode + the browser's Save as PDF) and, under it, a quiet disclosure with
   the NotebookLM prompts: one for a single video, and a two-part variant
   (§0–§8, §9–§17) for a deck this long. Each has its own Copy button, which
   uses navigator.clipboard and falls back to selecting the text. Nothing
   here prints.
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
    <div className="dl8s-nlm__block" data-prompt={id}>
      <div className="dl8s-nlm__head">
        <span className="dl8s-nlm__k">{label} · {text.length} characters</span>
        <button type="button" className="dl8s-nlm__copy" onClick={copy}>
          {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
        </button>
      </div>
      <p className="dl8s-nlm__text" ref={textRef}>{text}</p>
    </div>
  );
}

export default function ExportPdf({ onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dl8s-export">
      <button type="button" className="dl8s-btn dl8s-btn--big" onClick={onExport} title="Print the Read and Play beats to an A4 PDF (choose Save as PDF)">
        <Icon name="printer" size={16} /> Export PDF
      </button>
      <button type="button" className="dl8s-export__toggle" aria-expanded={open} aria-controls="dl8s-nlm" onClick={() => setOpen((o) => !o)}>
        NotebookLM video prompt <span className={`dl8s-export__chev${open ? ' dl8s-export__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dl8s-nlm" id="dl8s-nlm">
          <ol className="dl8s-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <PromptBlock id="single" label="One video · format: Explainer" text={NLM_PROMPT} />
          <p className="dl8s-nlm__or">Or, for a lecture this long, two videos:</p>
          {NLM_PARTS.map((p, i) => <PromptBlock key={p.label} id={`part${i + 1}`} label={`${p.label} · Explainer`} text={p.text} />)}
          <p className="dl8s-nlm__note">
            NotebookLM publishes no length limit for the steering prompt (checked October 2026), so each prompt is kept under 1,000 characters.
            They ask for the PDF’s sections in order, the running example, the Slide checks, and to skip §16 (not examined).
          </p>
        </div>
      )}
    </span>
  );
}
