import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_PROMPT, NLM_PARTS, NLM_STEPS, NLM_NOTE } from './exportPrompt';

/* ============================================================================
   LECTURES 1–2 REFRESHER — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   A secondary button in the hero ("Export PDF", the shell's exportPdf: print
   mode + the browser's Save as PDF) and, under it, a quiet disclosure with
   the NotebookLM prompts: one refresher video for both lectures, and a
   two-part variant (part 1 = Lecture 1, part 2 = Lecture 2). Each has its
   own Copy button, which uses navigator.clipboard and falls back to
   selecting the text. Nothing here prints.
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
    <div className="dl12r-nlm__block" data-prompt={id}>
      <div className="dl12r-nlm__head">
        <span className="dl12r-nlm__k">{label} · {text.length} characters</span>
        <button type="button" className="dl12r-nlm__copy" onClick={copy}>
          {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
        </button>
      </div>
      <p className="dl12r-nlm__text" ref={textRef}>{text}</p>
    </div>
  );
}

export default function ExportPdf({ onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dl12r-export">
      <button type="button" className="dl12r-btn dl12r-btn--big" onClick={onExport} title="Print the Read and Play beats to an A4 PDF (choose Save as PDF)">
        <Icon name="printer" size={16} /> Export PDF
      </button>
      <button type="button" className="dl12r-export__toggle" aria-expanded={open} aria-controls="dl12r-nlm" onClick={() => setOpen((o) => !o)}>
        NotebookLM video prompt <span className={`dl12r-export__chev${open ? ' dl12r-export__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dl12r-nlm" id="dl12r-nlm">
          <ol className="dl12r-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <PromptBlock id="single" label="One refresher video · format: Explainer" text={NLM_PROMPT} />
          <p className="dl12r-nlm__or">Or one video per lecture:</p>
          {NLM_PARTS.map((p, i) => <PromptBlock key={p.label} id={`part${i + 1}`} label={`${p.label} · Explainer`} text={p.text} />)}
          <p className="dl12r-nlm__note">{NLM_NOTE}</p>
        </div>
      )}
    </span>
  );
}
