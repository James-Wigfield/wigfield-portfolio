/* ============================================================================
   TOPIC 4 · STRIDE — what the shell loads (lazily)
   ----------------------------------------------------------------------------
   Imports only from this folder and the shared engine (../../*).
   ========================================================================== */
import topic from './topic.js';
import { LABS } from './labs/index.js';
import { SHEETS } from './sheets/index.js';
import { PROMPTS } from './exportPrompt.js';
import { Fig148 } from './figs.jsx';

export default { topic, labs: LABS, sheets: SHEETS, figs: { fig148: Fig148 }, prompts: PROMPTS };
