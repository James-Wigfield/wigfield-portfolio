/**
 * PORTARA-TEST stand-ins for home.tsx's `loader` and `action`.
 *
 * In portara-repo the landing page is a React Router framework-mode route on a
 * Cloudflare Worker: the loader hands the Turnstile site key to the page and
 * the action verifies the CAPTCHA and calls hq.lead_submit. A Vite SPA has
 * nowhere to run either, so the meeting form here validates the same way and
 * then pretends to send. Nothing leaves the browser.
 *
 * If the test page should ever really submit, add a /api/portara-lead handler
 * to workers/app.js and post the FormData there from submitLead.
 */

export type LeadResult = { ok: true } | { ok: false; error: string };

/** The real loader reads this from the Worker env. Null hides the widget. */
export function turnstileSiteKey(): string | null {
  return null;
}

export async function submitLead(form: FormData): Promise<LeadResult> {
  // Honeypot: real users never see this field; bots fill it. Silently "succeed".
  if (String(form.get("company_website") ?? "").trim()) return { ok: true };

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!name || !email) {
    return { ok: false, error: "Your name and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  await new Promise((r) => setTimeout(r, 600));
  console.info("[portara-test] meeting request (not sent):", Object.fromEntries(form));
  return { ok: true };
}
