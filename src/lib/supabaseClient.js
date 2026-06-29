/* ============================================================================
   SUPABASE CLIENT (browser, public anon key)
   ----------------------------------------------------------------------------
   One shared client for the whole front-end, built from the two VITE_ env vars
   (set in .env.local locally, and in the Cloudflare Pages project for prod).

   Null-safe on purpose: if the keys aren't configured yet, `supabase` is null
   instead of throwing at import time — so the portal still loads and the data
   layer can surface a friendly "not configured" message rather than a crash.
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
