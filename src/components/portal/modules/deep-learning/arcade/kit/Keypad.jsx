import { useEffect, useState } from 'react';
import Icon from '../../../../icons';

/* ============================================================================
   GRADIENT ARCADE — NUMERIC INPUT
   ----------------------------------------------------------------------------
   Keypad     a big-tap on-screen keypad for one number (physical keys work
              too while it is mounted and `active`): digits, optional '.'
              and '−', backspace, Enter submits
   ShapePad   n numeric slots (H × W × C …) sharing one keypad; the active
              slot takes the keys, Tab / Enter move on, Enter on the last
              submits; `fixed` slots show a value that cannot be edited
              (e.g. a known None)
   Styles in kit.css (.dla-pad*, .dla-slots*).
   ========================================================================== */

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

export function Keypad({ value, onChange, onSubmit, decimal = false, negative = false, disabled = false, active = true, label = 'Your answer', unit = '', autoWidth = false }) {
  const press = (k) => {
    if (disabled) return;
    if (k === 'back') onChange(String(value).slice(0, -1));
    else if (k === 'clear') onChange('');
    else if (k === 'neg') onChange(String(value).startsWith('-') ? String(value).slice(1) : `-${value}`);
    else if (k === '.') { if (!String(value).includes('.')) onChange(`${value || '0'}.`); }
    else if (String(value).length < 9) onChange(`${value}${k}`);
  };
  useEffect(() => {
    if (!active || disabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); }
      else if (e.key === 'Escape') { e.preventDefault(); press('clear'); }
      else if (decimal && e.key === '.') { e.preventDefault(); press('.'); }
      else if (negative && e.key === '-') { e.preventDefault(); press('neg'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const canSubmit = String(value).length > 0 && !disabled;
  return (
    <div className={`dla-pad${disabled ? ' dla-pad--off' : ''}${autoWidth ? ' dla-pad--auto' : ''}`} role="group" aria-label={label}>
      <output className="dla-pad__screen" aria-live="polite" aria-label={label}>
        <span className="dla-pad__val">{value === '' ? <span className="dla-pad__ph">?</span> : String(value).replace('-', '−')}</span>
        {unit && <span className="dla-pad__unit">{unit}</span>}
      </output>
      <div className="dla-pad__keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="dla-key" onClick={() => press(k)} disabled={disabled} aria-label={`digit ${k}`}>{k}</button>
        ))}
        <button type="button" className="dla-key dla-key--fn" onClick={() => press(negative ? 'neg' : 'clear')} disabled={disabled || (!negative && value === '')} aria-label={negative ? 'change sign' : 'clear'}>{negative ? '±' : 'C'}</button>
        <button type="button" className="dla-key" onClick={() => press('0')} disabled={disabled} aria-label="digit 0">0</button>
        {decimal
          ? <button type="button" className="dla-key dla-key--fn" onClick={() => press('.')} disabled={disabled} aria-label="decimal point">.</button>
          : <button type="button" className="dla-key dla-key--fn" onClick={() => press('back')} disabled={disabled || value === ''} aria-label="backspace"><Icon name="arrowLeft" size={16} /></button>}
      </div>
      <div className="dla-pad__row">
        {decimal && <button type="button" className="dla-key dla-key--fn dla-key--wide" onClick={() => press('back')} disabled={disabled || value === ''} aria-label="backspace"><Icon name="arrowLeft" size={16} /></button>}
        <button type="button" className="dla-key dla-key--go" onClick={() => canSubmit && onSubmit?.()} disabled={!canSubmit} aria-label="submit answer (Enter)">Enter</button>
      </div>
    </div>
  );
}

/* n slots; value is an array of strings ('' = empty); fixed[i] (optional) is
   a string shown in place of slot i (not editable, e.g. 'None'). */
export function ShapePad({ value, onChange, onSubmit, labels, fixed = [], sep = '×', disabled = false, active = true, ariaLabel = 'Output shape' }) {
  const editable = value.map((_, i) => fixed[i] === undefined);
  const firstEditable = editable.indexOf(true);
  const [slot, setSlot] = useState(firstEditable < 0 ? 0 : firstEditable);
  const nextSlot = (from, dir = 1) => {
    let i = from + dir;
    while (i >= 0 && i < value.length && !editable[i]) i += dir;
    return i;
  };
  const press = (k) => {
    if (disabled) return;
    const i = slot;
    const v = value.slice();
    if (k === 'back') {
      if (v[i] === '' && nextSlot(i, -1) >= 0) { setSlot(nextSlot(i, -1)); return; }
      v[i] = v[i].slice(0, -1);
    } else if (k === 'clear') v[i] = '';
    else if (k === 'next') {
      const n = nextSlot(i, 1);
      if (n >= value.length) onSubmit?.();
      else setSlot(n);
      return;
    } else if (v[i].length < 5) v[i] = `${v[i]}${k}`;
    onChange(v);
  };
  useEffect(() => {
    if (!active || disabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ' || e.key === 'x' || e.key === '*' || e.key === ',') { e.preventDefault(); press('next'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); const n = nextSlot(slot, -1); if (n >= 0) setSlot(n); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); const n = nextSlot(slot, 1); if (n < value.length) setSlot(n); }
      else if (e.key === 'Escape') { e.preventDefault(); press('clear'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const complete = value.every((v, i) => !editable[i] || v !== '');
  return (
    <div className={`dla-pad dla-pad--shape${disabled ? ' dla-pad--off' : ''}`} role="group" aria-label={ariaLabel}>
      <div className="dla-slots" role="group" aria-label={ariaLabel}>
        {value.map((v, i) => (
          <span key={i} className="dla-slots__cell">
            {i > 0 && <span className="dla-slots__sep" aria-hidden="true">{sep}</span>}
            {editable[i] ? (
              <button
                type="button"
                className={`dla-slot${i === slot ? ' dla-slot--on' : ''}${v === '' ? ' dla-slot--empty' : ''}`}
                onClick={() => setSlot(i)}
                aria-label={`${labels?.[i] ?? `dimension ${i + 1}`}: ${v === '' ? 'empty' : v}`}
                aria-pressed={i === slot}
                disabled={disabled}
              >
                <span className="dla-slot__val">{v === '' ? '?' : v}</span>
                {labels?.[i] && <span className="dla-slot__k">{labels[i]}</span>}
              </button>
            ) : (
              <span className="dla-slot dla-slot--fixed" aria-label={`${labels?.[i] ?? `dimension ${i + 1}`}: ${fixed[i]}`}>
                <span className="dla-slot__val">{fixed[i]}</span>
                {labels?.[i] && <span className="dla-slot__k">{labels[i]}</span>}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="dla-pad__keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="dla-key" onClick={() => press(k)} disabled={disabled} aria-label={`digit ${k}`}>{k}</button>
        ))}
        <button type="button" className="dla-key dla-key--fn" onClick={() => press('clear')} disabled={disabled} aria-label="clear this dimension">C</button>
        <button type="button" className="dla-key" onClick={() => press('0')} disabled={disabled} aria-label="digit 0">0</button>
        <button type="button" className="dla-key dla-key--fn" onClick={() => press('back')} disabled={disabled} aria-label="backspace"><Icon name="arrowLeft" size={16} /></button>
      </div>
      <div className="dla-pad__row">
        <button type="button" className="dla-key dla-key--fn dla-key--wide" onClick={() => press('next')} disabled={disabled} aria-label="next dimension (Tab)">next {sep}</button>
        <button type="button" className="dla-key dla-key--go" onClick={() => complete && onSubmit?.()} disabled={!complete || disabled} aria-label="submit shape (Enter)">Enter</button>
      </div>
    </div>
  );
}
