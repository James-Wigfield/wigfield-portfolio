/* ============================================================================
   TRICKY TOPICS — THE TOPIC LIST (the only place topics are named)
   ----------------------------------------------------------------------------
   One line per topic, in tab order. The tab bar, the deep links, the
   progress marks and every check script read this list; nothing else names a
   topic. `load` is a lazy import() of the topic's folder, so the page stays
   fast as topics pile up.

     id        the folder name and the deep link: /portal/dl-tricky-topics/<id>
     title     the tab's title
     lectures  the decks it draws on, as quiet labels on the tab
     blurb     one line (the tab's tooltip)
     load      () => import('./<id>/index.js')

   To add a topic: node tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"
   (it copies ./_template and appends a line here). See ../ADDING-A-TOPIC.md.
   ========================================================================== */

export const TOPICS = [
  { id: 'engine-proof', title: 'Engine proof (template)', lectures: ['L1'], blurb: 'The _template topic rendered as if it were real.', load: () => import('./_template/index.js') },
];
