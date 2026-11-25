/* Dream Rooms · quote → span (decision 4). Claude never counts characters: this
   finds every quote with indexOf and writes `src` beside it. A quote that isn't
   in the text is an error (fix the quote, don't fudge the span).

     const { dream: withSpans, missing } = fillSpans(dream, text);

   When the same words occur more than once, each quote takes the first
   occurrence not already used by an earlier quote of the same entity. */

const LISTS = ['places', 'links', 'figures', 'objects', 'changes', 'vague', 'sound'];

export function fillSpans(dream, text) {
  const out = JSON.parse(JSON.stringify(dream));
  const missing = [];
  const fill = (id, e) => {
    if (!e?.quote) return;
    const taken = [];
    e.src = e.quote.map((q, i) => {
      let at = text.indexOf(q);
      while (at >= 0 && taken.some(([a, b]) => at < b && at + q.length > a)) at = text.indexOf(q, at + 1);
      if (at < 0) at = text.indexOf(q);
      if (at < 0) {
        missing.push(`${id}: quote ${i + 1}`);
        return [0, 0];
      }
      taken.push([at, at + q.length]);
      return [at, at + q.length];
    });
  };
  fill('mood', out.mood);
  if (out.time) fill('time', out.time);
  for (const l of LISTS) for (const e of out[l] || []) fill(e.id, e);
  (out.fragments || []).forEach((f, i) => {
    const at = text.indexOf(f.text);
    if (at < 0) missing.push(`fragments[${i}]`);
    else f.src = [at, at + f.text.length];
  });
  return { dream: out, missing };
}
