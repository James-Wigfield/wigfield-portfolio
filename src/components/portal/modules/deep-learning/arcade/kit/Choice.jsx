import { useEffect } from 'react';

/* ============================================================================
   GRADIENT ARCADE — CHOICE INPUT
   ----------------------------------------------------------------------------
   Up to six big buttons; keys 1–6 pick on desktop. After a pick the chosen
   button shows right/wrong (and the right one is revealed) until the round
   engine advances. `choices` = [{ value, label, sub? }]; `picked` is the
   value chosen during feedback; `answer` the correct value.
   ========================================================================== */
export function Choice({ choices, onPick, picked = null, answer = null, disabled = false, active = true, columns = 2, label = 'Choices' }) {
  useEffect(() => {
    if (!active || disabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) { e.preventDefault(); onPick(choices[n - 1].value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const showing = picked !== null;
  return (
    <div className={`dla-choices dla-choices--${columns}`} role="group" aria-label={label}>
      {choices.map((c, i) => {
        const isPick = showing && c.value === picked;
        const isAns = showing && c.value === answer;
        const cls = `dla-choice${isPick ? ' dla-choice--picked' : ''}${isAns ? ' dla-choice--right' : ''}${isPick && !isAns ? ' dla-choice--wrong' : ''}`;
        return (
          <button key={String(c.value)} type="button" className={cls} onClick={() => !disabled && !showing && onPick(c.value)} disabled={disabled || showing} aria-label={`${i + 1}: ${c.aria ?? c.label}`}>
            <span className="dla-choice__n" aria-hidden="true">{i + 1}</span>
            <span className="dla-choice__body">
              <span className="dla-choice__label">{c.label}</span>
              {c.sub && <span className="dla-choice__sub">{c.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
