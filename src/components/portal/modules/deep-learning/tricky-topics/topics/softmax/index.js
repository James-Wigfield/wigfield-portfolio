/* ============================================================================
   TOPIC 3 · SOFTMAX — what the shell loads (lazily)
   ----------------------------------------------------------------------------
   Imports only from this folder and the shared engine (../../*).
   ========================================================================== */
import topic from './topic.js';
import { LABS } from './labs/index.js';
import { SHEETS } from './sheets/index.js';
import { PROMPTS } from './exportPrompt.js';

export default { topic, labs: LABS, sheets: SHEETS, figs: {}, prompts: PROMPTS };
