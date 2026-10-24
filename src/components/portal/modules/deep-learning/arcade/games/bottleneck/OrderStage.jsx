import { useEffect, useState } from 'react';
import { ORDERS } from '../../content/bottleneck';
import { fill } from '../../maths/bottleneck';
import { Why } from '../../kit/WhyText';
import { StageHead } from './Parts';

/* ============================================================================
   BOTTLENECK · STAGE 3 — ONE STEP AT A TIME (slides 16–17, 23–25)
   ----------------------------------------------------------------------------
   Shuffled cards (Figure 17-6 / 17-7's phases, slide 24's code); tap them
   in order (keys 1–6), tap again or Backspace to take one back, Enter
   locks. A decoy card, when there is one, must be left out.
   ========================================================================== */

// Figure 17-6 / 17-7's boxes in miniature: green input / output, blue
// hidden, pink Hidden 2, orange Softmax (the figures' colours). A stack
// entry { name, tone } overrides the default (e.g. Phase 2's narrow light-blue
// Input / Output in Fig 17-7, the classifier's light-blue Output in Fig 17-6).
const tone = (n) => (typeof n === 'object' ? n.tone : /^(Input|Output)$/.test(n) ? 'io' : n === 'Hidden 2' ? 'code' : n === 'Softmax' ? 'soft' : 'hid');

function MiniStack({ layers }) {
  const h = layers.length * 9 + 2;
  return (
    <svg className="dla-bn__mini" viewBox={`0 0 40 ${h}`} width="40" height={h} aria-hidden="true">
      {layers.map((n, i) => {
        const t = tone(n);
        return <rect key={i} className={`dla-bn__mini--${t}`} x={t === 'io' ? 2 : 7} y={h - 9 - i * 9} width={t === 'io' ? 36 : 26} height="7" rx="2" />;
      })}
    </svg>
  );
}

export function OrderStage({ item, round }) {
  const [seq, setSeq] = useState([]);
  const live = round.state === 'play' && !round.feedback;
  const need = item.answer.length;
  const toggle = (id) => {
    if (!live) return;
    setSeq((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < need ? [...s, id] : s));
  };
  const submit = () => { if (live && seq.length === need) round.submit(seq); };

  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName ?? '';
      if (/^(input|textarea|select)$/i.test(tag)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= item.cards.length) { e.preventDefault(); toggle(item.cards[n - 1].id); }
      else if (e.key === 'Backspace') { e.preventDefault(); setSeq((s) => s.slice(0, -1)); }
      else if (e.key === 'Enter') { if (tag === 'BUTTON' && !e.target.dataset?.enter) return; e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fb = round.feedback;
  return (
    <>
      <StageHead item={item} round={round} />
      <div className={`dla-floor dla-bn__floor dla-bn__orderfloor${fb ? (fb.correct ? ' dla-bn--right' : ' dla-bn--wrong') : ''}`}>
        <ol className="dla-bn__cards" aria-label={item.prompt}>
          {item.cards.map((c, i) => {
            const pos = seq.indexOf(c.id);
            const truth = item.answer.indexOf(c.id);
            const mark = fb ? (pos === truth ? ' dla-bn__card--ok' : ' dla-bn__card--bad') : '';
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-enter="submit"
                  className={`dla-bn__card${pos >= 0 ? ' dla-bn__card--on' : ''}${mark}`}
                  onClick={() => toggle(c.id)}
                  disabled={!live}
                  aria-pressed={pos >= 0}
                  aria-label={`${i + 1}: ${c.short}${pos >= 0 ? `, placed ${pos + 1}` : ''}`}
                >
                  <span className="dla-bn__cardn" aria-hidden="true">{pos >= 0 ? pos + 1 : ''}</span>
                  {c.stack && <MiniStack layers={c.stack} />}
                  <span className="dla-bn__cardbody">
                    {c.text && <span className="dla-bn__cardt"><Why text={c.text} /></span>}
                    {c.code && <code className="dla-bn__cardc">{c.code}</code>}
                  </span>
                  <span className="dla-bn__cardk" aria-hidden="true">{i + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="dla-bn__orderbar">
        <span className="dla-k">{fill(ORDERS.ui.placed, { n: seq.length, m: need })}{item.hasDecoy ? ` · ${ORDERS.ui.leaveOut}` : ''}</span>
        <button type="button" className="dla-btn dla-btn--quiet" onClick={() => setSeq((s) => s.slice(0, -1))} disabled={!live || !seq.length}>
          {ORDERS.ui.undo} <span className="dla-btn__key">⌫</span>
        </button>
        <button type="button" className="dla-btn dla-btn--primary dla-bn__go" onClick={submit} disabled={!live || seq.length !== need}>
          {ORDERS.ui.lock} <span className="dla-btn__key">Enter</span>
        </button>
      </div>
    </>
  );
}
