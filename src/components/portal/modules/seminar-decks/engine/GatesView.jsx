import { useEffect } from 'react';
import { useAllDecks } from './decks';
import { buildSequence, deckMedia } from './sequence';
import { labelOf } from './controller';
import { FACTS } from '../shared/facts';
import { CRIB } from '../shared/crib';
import { HYPOTHESES } from '../shared/meta';
import { fill, spokenText, wordCount } from '../shared/text';

/* ============================================================================
   SEMINAR DECKS — GATES SUMMARY  (/portal/seminar-decks/__gates)
   ----------------------------------------------------------------------------
   Everything the scripted gates need that is not in the rendered DOM: every
   slide's title, transcript (raw and spoken), timing and media; the crib; the
   fact manifest. Exposed as window.__sdGates (tools/seminar-decks/gates.mjs).
   ========================================================================== */

function summarise(deck) {
  const { seq, totals, refOrder } = buildSequence(deck);
  return {
    slug: deck.slug,
    name: deck.name,
    totals,
    refOrder,
    media: deckMedia(deck),
    slides: seq.map((s, i) => ({
      id: s.id,
      label: labelOf(seq, i),
      kind: s.kind,
      part: s.part ?? null,
      steps: s.steps ?? 1,
      title: s.title ?? '',
      titleFilled: fill(s.title ?? ''),
      titleWords: fill(s.title ?? '').split(/\s+/).filter(Boolean).length,
      scriptRaw: s.script?.text ?? '',
      spoken: s.script ? spokenText(s.script.text) : '',
      words: s.script ? wordCount(s.script.text) : 0,
      target: s.script?.seconds ?? 0,
      silent: s.script?.silent ?? 0,
      cues: s.cues ?? [],
      cites: s.cites ?? [],
      scans: !!s.scans,
      req: s.req ?? [],
      media: s.media ?? [],
    })),
  };
}

export default function GatesView() {
  const decks = useAllDecks();
  const ok = decks.every((d) => d && !(d instanceof Error));
  const data = ok
    ? {
      decks: decks.map(summarise),
      crib: CRIB.map((c) => ({ ...c, qFilled: fill(c.q), aFilled: fill(c.a) })),
      hypotheses: HYPOTHESES.map((h) => ({ ...h, lineFilled: fill(h.line) })),
      facts: Object.fromEntries(Object.entries(FACTS).map(([k, v]) => [k, { display: v.display, value: v.value, source: v.source }])),
    }
    : null;

  useEffect(() => {
    if (data) window.__sdGates = data;
  });

  return (
    <div className="pt-module">
      <p className="pt-module__intro">{ok ? 'Gates summary ready (window.__sdGates).' : 'Loading decks...'}</p>
      {ok && <pre className="sd-gates-pre" data-gates-ready="1">{JSON.stringify(data.decks.map((d) => ({ slug: d.slug, totals: d.totals })), null, 2)}</pre>}
    </div>
  );
}
