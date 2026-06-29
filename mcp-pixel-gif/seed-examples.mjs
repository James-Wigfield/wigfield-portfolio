/* One-off seed: push the studio's built-in example animations into Supabase so
   the (now Supabase-backed) Pixel-Art GIF Studio has real content, and clear the
   smoke-test rows. Idempotent — re-running replaces the same-named rows. Run:
     node mcp-pixel-gif/seed-examples.mjs
   Uses the SECRET key from .dev.vars (server-side; bypasses RLS). */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../src/components/portal/modules/pixelSprites.js';

const SUPABASE_URL = 'https://trcnbmxtudhbuswqmqxy.supabase.co';

// Pull SUPABASE_SECRET_KEY out of .dev.vars (same file wrangler dev uses).
const devVars = readFileSync(new URL('./.dev.vars', import.meta.url), 'utf8');
const env = Object.fromEntries(
  devVars
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

if (!env.SUPABASE_SECRET_KEY) {
  console.error('No SUPABASE_SECRET_KEY found in mcp-pixel-gif/.dev.vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const names = EXAMPLES.map((s) => s.name);

// Idempotent clean-up: remove any prior seed rows + the "Test dot" smoke rows.
const { error: delErr } = await supabase.from('sprites').delete().in('name', [...names, 'Test dot']);
if (delErr) console.warn('cleanup warning:', delErr.message);

for (const s of EXAMPLES) {
  const sprite = {
    width: s.width,
    height: s.height,
    delayMs: s.delayMs,
    palette: s.palette,
    transparentIndex: s.transparentIndex,
    frames: s.frames,
  };
  const { data, error } = await supabase
    .from('sprites')
    .insert({ name: s.name, sprite })
    .select('id')
    .single();
  console.log(error ? `x ${s.name}: ${error.message}` : `+ ${s.name} -> ${data.id}`);
}

process.exit(0);
