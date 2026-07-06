/* ============================================================================
   PORTAL — MOCK AUTH (Supabase Auth placeholder)
   ----------------------------------------------------------------------------
   A deliberately thin, client-side password barrier. It mirrors the surface of
   `supabase.auth` so swapping in the real client later is mechanical:

     signIn(password)  →  supabase.auth.signInWithPassword({ email, password })
     signOut()         →  supabase.auth.signOut()
     getSession()      →  supabase.auth.getSession()

   SECURITY NOTE: this is a mock. The password lives in client code and only
   gates rendering — it is NOT real security. Real auth must move server-side
   (Supabase Auth / RLS) before anything sensitive lives behind this gate.
   ========================================================================== */

// ── Mock credential (replace with Supabase Auth) ────────────────────────────
const MOCK_PASSWORD = 'wiggy1';
const SESSION_KEY = 'portal_auth';

/**
 * Attempt sign-in. Returns Supabase-style { data, error }.
 * @param {string} password
 */
export async function signIn(password) {
  // Tiny delay so the UI can show a "checking…" state like a real network call.
  await new Promise((r) => setTimeout(r, 220));

  // SUPABASE:
  //   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  //   return { data, error };
  if (password === MOCK_PASSWORD) {
    // Keep the entered password on the session so server-side /api/* routes can
    // be gated by it (see getPortalKey + workers/app.js). It's the same mock
    // secret — this just lets the browser prove it passed the gate to the Worker.
    const session = { token: 'mock-session-token', key: password, issued_at: new Date().toISOString() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { data: { session }, error: null };
  }
  return { data: null, error: { message: 'Invalid credentials' } };
}

/** Clear the session. */
export function signOut() {
  // SUPABASE: await supabase.auth.signOut();
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Read the current session synchronously (used to seed React state on mount).
 * Returns the session object or null.
 */
export function getSession() {
  // SUPABASE: const { data: { session } } = await supabase.auth.getSession();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return getSession() !== null;
}

/**
 * The key the browser sends to gate server-side /api/* routes — the password
 * entered at the gate (stored on the session by signIn). Null when signed out.
 * The Worker verifies it against its PORTAL_PASSWORD secret.
 */
export function getPortalKey() {
  return getSession()?.key ?? null;
}
