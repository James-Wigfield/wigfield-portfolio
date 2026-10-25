import { useEffect, useRef, useState } from 'react';
import Icon from '../../../icons';
import { NLM_PROMPT, NLM_PARTS, NLM_STEPS, NLM_FORMAT, NLM_NOTE } from './exportPrompt';

/* ============================================================================
   CODE LAB — EXPORT PDF + THE NOTEBOOKLM VIDEO PROMPTS
   ----------------------------------------------------------------------------
   Copied from lecture9-study/ExportPdf.jsx: a button in the hero ("Export
   PDF", the shell's print mode + the browser's Save as PDF) and, directly
   under it, a quiet disclosure with the NotebookLM prompts: one for a single
   video and a two-part variant (Labs & projects, then Key concept code).
   Each has its own Copy button with the character count; Copy uses
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
    <div className="dlc-nlm__block" data-prompt={id}>
      <div className="dlc-nlm__head">
        <span className="dlc-nlm__k">{label} · {text.length} characters</span>
        <button type="button" className="dlc-nlm__copy" onClick={copy}>
          {copied ? <><Icon name="check" size={12} strokeWidth={2.4} /> {copied}</> : 'Copy'}
        </button>
      </div>
      <p className="dlc-nlm__text" ref={textRef}>{text}</p>
    </div>
  );
}

export default function ExportPdf({ onExport, busy }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState('single');
  const rootRef = useRef(null);

  // Esc or a click outside closes the dropdown
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <span className="dlc-export" ref={rootRef}>
      <button type="button" className="dlc-btn dlc-btn--big" onClick={onExport} disabled={busy} title="Print every tab and card to an A4 PDF (choose Save as PDF)">
        <Icon name="printer" size={16} /> {busy ? 'Preparing…' : 'Export PDF'}
      </button>
      <button type="button" className="dlc-export__toggle" aria-expanded={open} aria-controls="dlc-nlm" onClick={() => setOpen((o) => !o)}>
        NotebookLM video prompt <span className={`dlc-export__chev${open ? ' dlc-export__chev--open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dlc-nlm" id="dlc-nlm">
          <ol className="dlc-nlm__steps">
            {NLM_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <div className="dlc-nlm__switch" role="radiogroup" aria-label="Prompt variant">
            <button type="button" role="radio" aria-checked={variant === 'single'} className={`dlc-nlm__opt${variant === 'single' ? ' dlc-nlm__opt--on' : ''}`} onClick={() => setVariant('single')}>One video</button>
            <button type="button" role="radio" aria-checked={variant === 'parts'} className={`dlc-nlm__opt${variant === 'parts' ? ' dlc-nlm__opt--on' : ''}`} onClick={() => setVariant('parts')}>Two parts</button>
          </div>
          {variant === 'single'
            ? <PromptBlock id="single" label={`One video · ${NLM_FORMAT}`} text={NLM_PROMPT} />
            : NLM_PARTS.map((p, i) => <PromptBlock key={p.label} id={`part${i + 1}`} label={`${p.label} · ${NLM_FORMAT}`} text={p.text} />)}
          <p className="dlc-nlm__note">{NLM_NOTE}</p>
        </div>
      )}
    </span>
  );
}
