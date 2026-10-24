import { useEffect, useState } from 'react';
import { LABELS } from '../../content/chain-reaction.js';

/* ============================================================================
   CHAIN REACTION — CUSTOM INPUTS
   ----------------------------------------------------------------------------
   OrderPad     slide 19's four steps as tappable cards: tap (or keys 1–4)
                in order, Backspace undoes, Enter submits the sequence
   HeadBuilder  a task card's output layer: one chip per row (neurons,
                activation, loss), Build or Enter submits
   Both submit plain JSON values (an id list; { neurons, act, loss }).
   ========================================================================== */

export function OrderPad({ cards, onSubmit, disabled = false, active = true }) {
  const [seq, setSeq] = useState([]);
  const complete = seq.length === cards.length;
  const place = (id) => {
    if (disabled) return;
    setSeq((s) => (s.includes(id) || s.length >= cards.length ? s : [...s, id]));
  };
  const undo = () => !disabled && setSeq((s) => s.slice(0, -1));
  const submit = () => { if (complete && !disabled) onSubmit(seq); };
  useEffect(() => {
    if (!active || disabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= cards.length) { e.preventDefault(); place(cards[n - 1].id); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="dla-cr__order" role="group" aria-label={LABELS.orderEmpty}>
      <div className="dla-cr__steps">
        {cards.map((c, i) => {
          const at = seq.indexOf(c.id);
          const last = at >= 0 && at === seq.length - 1;
          return (
            <button
              key={c.id}
              type="button"
              className={`dla-cr__step${at >= 0 ? ' dla-cr__step--on' : ''}`}
              onClick={() => (at < 0 ? place(c.id) : last ? undo() : null)}
              disabled={disabled}
              aria-pressed={at >= 0}
              aria-label={`${i + 1}: ${c.label}${at >= 0 ? `, placed ${at + 1}` : ''}`}
            >
              <span className="dla-cr__stepn" aria-hidden="true">{at >= 0 ? at + 1 : ''}</span>
              <span className="dla-cr__stepb"><b>{c.label}</b><span>{c.text}</span></span>
              <span className="dla-cr__stepkey" aria-hidden="true">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="dla-cr__row">
        <button type="button" className="dla-btn dla-btn--quiet dla-cr__btn" onClick={undo} disabled={disabled || !seq.length} aria-label="Undo the last step (Backspace)">{LABELS.undo}</button>
        <button type="button" className="dla-btn dla-btn--primary dla-cr__btn" onClick={submit} disabled={disabled || !complete} aria-label="Submit the order (Enter)">{LABELS.submitOrder}</button>
      </div>
    </div>
  );
}

export function HeadBuilder({ head, pick, onPick, onSubmit, disabled = false, active = true }) {
  const complete = pick.neurons !== null && pick.act !== null && pick.loss !== null;
  const submit = () => { if (complete && !disabled) onSubmit(); };
  useEffect(() => {
    if (!active || disabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      // Enter builds once every row is picked (even with a chip focused)
      if (e.key === 'Enter' && complete) { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const rows = [
    { key: 'neurons', label: head.rows.neurons, opts: head.neurons.map((v) => ({ id: v, label: String(v) })) },
    { key: 'act', label: head.rows.act, opts: head.acts },
    { key: 'loss', label: head.rows.loss, opts: head.losses },
  ];
  return (
    <div className="dla-cr__head" role="group" aria-label="Build the output layer">
      {rows.map((row) => (
        <div key={row.key} className="dla-cr__hrow" role="radiogroup" aria-label={row.label}>
          <span className="dla-k dla-cr__hk">{row.label}</span>
          {row.opts.map((o) => (
            <button
              key={String(o.id)}
              type="button"
              role="radio"
              aria-checked={pick[row.key] === o.id}
              className="dla-cr__chip"
              onClick={() => !disabled && onPick((p) => ({ ...p, [row.key]: o.id }))}
              disabled={disabled}
            >
              {o.label}
            </button>
          ))}
        </div>
      ))}
      <div className="dla-cr__row">
        <button type="button" className="dla-btn dla-btn--primary dla-cr__btn" onClick={submit} disabled={disabled || !complete} aria-label="Build this output layer (Enter)">{LABELS.build}</button>
      </div>
    </div>
  );
}
