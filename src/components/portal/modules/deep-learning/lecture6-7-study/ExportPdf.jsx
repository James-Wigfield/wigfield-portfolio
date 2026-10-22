import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_PROMPT, NLM_STEPS } from './exportPrompt';

/* ============================================================================
   LECTURES 6–7 STUDY — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPT
   ----------------------------------------------------------------------------
   A secondary button in the hero ("Export PDF", the shell's exportPdf: print
   mode + the browser's Save as PDF) and, directly under it, a quiet
   disclosure holding the NotebookLM video prompt with a Copy button. Copy uses
   navigator.clipboard and falls back to selecting the text. Neither prints.
   ========================================================================== */

export default function ExportPdf({ onExport }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const textRef = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(NLM_PROMPT);
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
    <span className="dl67s-export">
      <button type="button" className="dl67s-btn dl67s-btn--big" onClick={onExport} title="Print the Read and Play beats to an A4 PDF (choose Save as PDF)">
        <Icon name="printer" size={16} /> Export PDF
      </button>
      <button type="button" className="dl67s-export__toggle" aria-expanded={open} aria-controls="dl67s-nlm" onClick={() => setOpen((o) => !o)}>
        NotebookLM video prompt <span className={`dl67s-export__chev${open ? ' dl67s-export__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dl67s-nlm" id="dl67s-nlm">
          <ol className="dl67s-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <div className="dl67s-nlm__head">
            <span className="dl67s-nlm__k">Steering prompt · {NLM_PROMPT.length} characters · format: Explainer</span>
            <button type="button" className="dl67s-nlm__copy" onClick={copy}>
              {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
            </button>
          </div>
          <p className="dl67s-nlm__text" ref={textRef}>{NLM_PROMPT}</p>
          <p className="dl67s-nlm__note">
            NotebookLM publishes no length limit for this box (checked 22 October 2026), so the prompt is kept short. It asks for the PDF’s sections in
            order, with the latent loss and the two GAN training phases worked through.
          </p>
        </div>
      )}
    </span>
  );
}
