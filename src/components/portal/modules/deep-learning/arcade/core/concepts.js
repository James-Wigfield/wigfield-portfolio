/* ============================================================================
   GRADIENT ARCADE — THE CONCEPT CATALOGUE
   ----------------------------------------------------------------------------
   Every drillable concept, merged from the slide-cited content files
   (content/lecture*.js, written by the slide readers) and any game-specific
   additions (content/<gameId>.js). Mastery and scheduling work per concept
   (core/scheduler.js), never per game.

     CONCEPTS        { [id]: { id, lecture, title, slides, hard, summary } }
     CONCEPT_IDS     every id
     byLecture(n)    the ids a lecture teaches
     LECTURES        the lecture list with titles, for the hub's mastery rings
   ========================================================================== */
import * as L1 from '../content/lecture1.js';
import * as L2 from '../content/lecture2.js';
import * as L3 from '../content/lecture3.js';
import * as L4 from '../content/lecture4.js';
import * as L5 from '../content/lecture5.js';
import * as L67 from '../content/lecture67.js';
import * as L8 from '../content/lecture8.js';
import { GAME_CONCEPTS } from '../content/gameConcepts.js';

export const LECTURES = [
  { n: 1, short: 'L1', title: 'Intro to ANNs' },
  { n: 2, short: 'L2', title: 'Training DNNs' },
  { n: 3, short: 'L3', title: 'CNNs' },
  { n: 4, short: 'L4', title: 'RNNs & sequences' },
  { n: 5, short: 'L5', title: 'Autoencoders' },
  { n: 6, short: 'L6–7', title: 'VAEs & GANs' },
  { n: 8, short: 'L8', title: 'Transformers' },
];

function merge(lists) {
  const out = {};
  lists.flat().forEach((c) => {
    if (!c || !c.id) return;
    if (!out[c.id]) out[c.id] = { hard: 2, slides: [], ...c };
    else {
      // the same id from two sources: keep the first; union the slides only
      // within the same lecture, and list another lecture's slides under `also`
      const prev = out[c.id];
      if (c.lecture === prev.lecture) out[c.id] = { ...prev, slides: [...new Set([...(prev.slides ?? []), ...(c.slides ?? [])])].sort((a, b) => a - b) };
      else out[c.id] = { ...prev, also: [...(prev.also ?? []), { lecture: c.lecture, slides: c.slides ?? [] }] };
    }
  });
  return out;
}

export const CONCEPTS = merge([
  L1.CONCEPTS ?? [], L2.CONCEPTS ?? [], L3.CONCEPTS ?? [], L4.CONCEPTS ?? [], L5.CONCEPTS ?? [], L67.CONCEPTS ?? [], L8.CONCEPTS ?? [],
  GAME_CONCEPTS ?? [],
]);
export const CONCEPT_IDS = Object.keys(CONCEPTS);
export const byLecture = (n) => CONCEPT_IDS.filter((id) => CONCEPTS[id].lecture === n);
export const conceptTitle = (id) => CONCEPTS[id]?.title ?? id;
