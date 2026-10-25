/* ============================================================================
   TOPIC · __TOPIC_TITLE__ — what the shell loads (lazily, from ../index.js)
   ----------------------------------------------------------------------------
   Everything this topic owns, in one object for ../../TopicShell.jsx:
     topic    ./topic.js       the opener, steps, drill (data)
     labs     ./labs/index.js  every lab, the `hero` and the `drill`
     sheets   ./sheets         the notebook page(s)
     figs     line art for the notebook pages ({ key: Component }; this
              template has none — add a figs.jsx and list its components)
     prompts  ./exportPrompt.js
   Import only from this folder and the shared engine (../../*). Never from
   another topic's folder: link to it with [label](@topicId) instead.
   ========================================================================== */
import topic from './topic.js';
import { LABS } from './labs/index.js';
import { SHEETS } from './sheets/index.js';
import { PROMPTS } from './exportPrompt.js';

export default { topic, labs: LABS, sheets: SHEETS, figs: {}, prompts: PROMPTS };
