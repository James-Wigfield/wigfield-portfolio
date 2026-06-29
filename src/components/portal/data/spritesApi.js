/* ============================================================================
   SPRITES API — the portal's read access to the Supabase `sprites` table
   ----------------------------------------------------------------------------
   The Pixel-Art GIF Studio reads every GIF from here. Rows are written by the
   pixel-gif MCP server (a Cloudflare Worker, using the secret key); the browser
   only ever READS, with the public anon key, guarded by the table's RLS policy.

   Row shape:  { id, name, sprite, created_at }
     sprite (jsonb) = { width, height, delayMs, palette[], transparentIndex, frames[][] }
   Returns Supabase's { data, error } shape (never throws).
   ========================================================================== */

import { supabase } from '../../../lib/supabaseClient';

export async function listSprites() {
  if (!supabase) {
    return {
      data: null,
      error: { message: 'Supabase isn’t configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.' },
    };
  }
  return supabase
    .from('sprites')
    .select('id, name, sprite, created_at')
    .order('created_at', { ascending: false });
}
