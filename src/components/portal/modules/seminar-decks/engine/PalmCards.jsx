import { useEffect, useMemo, useRef, useState } from 'react';
import { talkPlan } from './talk';
import { fmtTime } from '../shared/text';
import './talk.css';

/* ============================================================================
   SEMINAR DECKS — PALM CARDS (Script tab, "Export PDF")
   ----------------------------------------------------------------------------
   The transcripts as A6 cards, four to an A4 sheet with cut lines (two
   straight cuts), printed single-sided through the browser's print dialog
   (Save as PDF). A6 is a quarter of A4 and fits one hand; at 13.5 pt, with
   each sentence starting its own line, most slides fit one card.
   Each sentence is measured in the card's own type before packing, so no
   sentence is split and no card overflows; a slide that needs two cards is
   shared evenly between them. On every card: the card number ("4 / 21"), the
   slide and its "ends at" target, a "Space: slide n" mark where the slide
   changes (or "continued"), a thin bar on the right edge for how far through
   the talk the card ends, and the next card's first words. The last cards
   hold the demo slide and the backup index with the numbers to type.
   Calls onReady once the cards are laid out (the caller then prints).
   ========================================================================== */

/** "Next: " plus as many of the words as fit one footer line (measured in the footer's type). */
function fitNext(measure, width, lead, text, most) {
  const w = String(text ?? '').split(/\s+/).filter(Boolean);
  for (let n = Math.min(most, w.length); n > 0; n -= 1) {
    const s = `Next: ${lead}${w.slice(0, n).join(' ')}${n < w.length ? ' ...' : ''}`;
    if (measure(s) <= width) return s;
  }
  return `Next: ${lead.replace(/: $/, '')}`;
}

/** Share items (heights) between as few cards as fit `cap`, evenly when a slide needs more than one. */
function pack(heights, cap) {
  const greedy = (limit) => {
    const out = [[]];
    let h = 0;
    heights.forEach((x, i) => {
      if (out[out.length - 1].length && h + x > limit) {
        out.push([]);
        h = 0;
      }
      out[out.length - 1].push(i);
      h += x;
    });
    return out;
  };
  const first = greedy(cap);
  if (first.length < 2) return first;
  const total = heights.reduce((a, x) => a + x, 0);
  const even = greedy(Math.min(cap, total / first.length + Math.max(...heights) / 2));
  return even.length === first.length ? even : first;
}

export default function PalmCards({ deck, onReady }) {
  const plan = useMemo(() => talkPlan(deck), [deck]);
  const meas = useRef(null);
  const [cards, setCards] = useState(null);

  // The index items on the last cards: the demo slide, then each backup.
  const index = useMemo(() => [
    ...(plan.demo ? [{ key: 'demo', label: plan.demo.label, typed: plan.demo.typed, text: `Demo, after slide ${plan.total}: leave up during questions` }] : []),
    ...plan.backups.map((b) => ({ key: b.id, label: b.label, typed: b.typed, text: b.q || b.title })),
  ], [plan]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await document.fonts.load('14pt "SD Source Sans"');
        await document.fonts.load('600 14pt "SD Source Sans"');
      } catch {
        /* the fallback face is measured instead */
      }
      await document.fonts.ready;
      if (!alive || !meas.current) return;
      const root = meas.current;
      const px = (el) => el.getBoundingClientRect().height;
      const cap = px(root.querySelector('[data-cap]'));
      const gap = parseFloat(getComputedStyle(root.querySelector('[data-s]')).marginBottom) || 0;
      const out = [];
      plan.slides.forEach((s) => {
        const hs = [...root.querySelectorAll(`[data-slide="${s.no}"] [data-s]`)].map((el) => px(el) + gap);
        const groups = pack(hs, cap);
        let words = s.wordsBefore;
        groups.forEach((g, gi) => {
          const lines = g.map((i) => s.sentences[i]);
          words += lines.reduce((a, t) => a + t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length, 0);
          out.push({ kind: 'slide', s, part: gi, parts: groups.length, lines, upTo: Math.min(1, words / plan.totalWords) });
        });
      });
      const ixGap = parseFloat(getComputedStyle(root.querySelector('[data-ix]')).marginBottom) || 0;
      const ihs = [...root.querySelectorAll('[data-ix]')].map((el) => px(el) + ixGap);
      pack(ihs, cap).forEach((g, gi, all) => out.push({ kind: 'index', part: gi, parts: all.length, items: g.map((i) => index[i]), upTo: 1 }));
      // The next card's first words, as many as fit the footer line.
      const foot = root.querySelector('[data-foot]');
      const ctx = document.createElement('canvas').getContext('2d');
      const fs = getComputedStyle(foot);
      ctx.font = `${fs.fontWeight} ${fs.fontSize} ${fs.fontFamily}`;
      const width = foot.getBoundingClientRect().width - 2;
      const measure = (t) => ctx.measureText(t).width;
      const firstIx = out.findIndex((x) => x.kind === 'index');
      out.forEach((c, k) => {
        const d = out[k + 1];
        if (!d) c.next = 'Next: end of the cards';
        else if (d.kind === 'index') c.next = k + 1 === firstIx ? `Next: Space, ${plan.demo ? `${plan.demo.label}, the demo slide` : 'questions'}` : 'Next: backups, continued';
        else c.next = d.part === 0 ? fitNext(measure, width, `Slide ${d.s.no}: `, d.lines[0], 6) : fitNext(measure, width, '', d.lines[0], 8);
      });
      setCards(out);
    })();
    return () => {
      alive = false;
    };
  }, [plan, index]);

  useEffect(() => {
    if (cards) onReady?.(cards.length);
  }, [cards, onReady]);

  const n = cards?.length ?? 0;

  const card = (c, k) => (
    <section key={k} className="sd-pcard" data-card={k + 1} data-slide={c.s?.no ?? 'index'}>
      <div className="sd-pcard__head">
        <p className="sd-pcard__no">{k + 1} / {n}</p>
        {c.kind === 'slide' ? (
          <div className="sd-pcard__meta">
            <p><b>Slide {c.s.no}</b> of {plan.total}</p>
            <p>ends at {fmtTime(c.s.endsAt)}</p>
          </div>
        ) : (
          <div className="sd-pcard__meta"><p><b>Questions</b></p><p>type the number, Enter</p></div>
        )}
      </div>
      {c.kind === 'slide' && (c.part === 0
        ? <p className="sd-pcard__mark">{c.s.no === 1 ? 'Start' : `Space: slide ${c.s.no}`}</p>
        : <p className="sd-pcard__mark is-cont">Slide {c.s.no}, continued ({c.part + 1} of {c.parts})</p>)}
      {c.kind === 'index' && <p className="sd-pcard__mark">{c.part === 0 ? `After slide ${plan.total}, Space: ${plan.demo?.label ?? ''}` : 'Backups, continued'}</p>}
      <div className="sd-pcard__body">
        {c.kind === 'slide' && <div className="sd-pcard__text">{c.lines.map((t, i) => <p key={i} className="sd-pcard__s">{t}</p>)}</div>}
        {c.kind === 'index' && (
          <div className="sd-pcard__ix">
            {c.items.map((it) => <p key={it.key}><b>{it.label}</b> (type {it.typed}) {it.text}</p>)}
          </div>
        )}
      </div>
      <p className="sd-pcard__foot">{c.next}</p>
      <div className="sd-pcard__bar" aria-hidden="true"><span style={{ height: `${(c.upTo * 100).toFixed(1)}%` }} /></div>
    </section>
  );

  const sheets = [];
  for (let k = 0; k < n; k += 4) sheets.push(cards.slice(k, k + 4));

  return (
    <>
      <div className="sd-pcards-measure" ref={meas} aria-hidden="true">
        <div className="sd-pcard__cap" data-cap="" />
        <p className="sd-pcard__foot sd-pcard__foot--measure" data-foot="">Next:</p>
        {plan.slides.map((s) => (
          <div key={s.no} className="sd-pcard__text" data-slide={s.no}>
            {s.sentences.map((t, i) => <p key={i} className="sd-pcard__s" data-s="">{t}</p>)}
          </div>
        ))}
        <div className="sd-pcard__ix">
          {index.map((it) => <p key={it.key} data-ix=""><b>{it.label}</b> (type {it.typed}) {it.text}</p>)}
        </div>
      </div>
      {cards && (
        <div className="sd-pcards-root" data-cards={n}>
          {sheets.map((sh, si) => (
            <div key={si} className="sd-pcard-sheet">
              {sh.map((c, j) => card(c, si * 4 + j))}
              <span className="sd-pcard-sheet__cut is-v" aria-hidden="true" />
              <span className="sd-pcard-sheet__cut is-h" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
