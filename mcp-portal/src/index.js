/* ============================================================================
   PORTAL — GENERAL REMOTE MCP SERVER (Cloudflare Worker)
   ----------------------------------------------------------------------------
   A single MCP server for the personal portal's write-tools. It exposes tools
   Claude can call to build things that show up in the portal, saving them to the
   portal's Supabase with the SECRET key (server-side, never shipped to a client).

     Claude Code  ──SSE──▶  this Worker  ──secret key──▶  Supabase
                                                     the portal reads them back

   First domain: DECK STUDIO (presentations). Claude describes slides at a HIGH
   level (a layout + content); the layout engine here expands each into the
   positioned-layer model the portal renders + edits. Add more tools (more
   portal domains) by registering them in init() — one server, one connection.

   Backed by a Durable Object (McpAgent), declared in wrangler.jsonc. Endpoints:
     • GET /sse   — SSE transport (what Claude Code connects to)
     • POST /mcp  — Streamable-HTTP transport (for HTTP-only clients)

   NOTE: this is the *personal* portal's MCP. It is NOT the Portara product
   (which sells the same pattern to clients) — keep them separate.
   ========================================================================== */

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── The logical canvas (must match the portal's deckModel.js) ────────────────
const CW = 1280;
const CH = 720;

// The high-level slide spec Claude sends (a layout + content). One zod object
// covers every layout; the engine reads only the fields a layout needs.
const SLIDE_SPEC = z.object({
  layout: z
    .enum(['title', 'section', 'statement', 'title-bullets', 'title-body', 'two-column', 'quote'])
    .describe(
      'PREFER title-bullets for most content slides. ' +
      'title = cover (eyebrow/title/subtitle); section = big divider heading; ' +
      'statement = one big centred line; title-bullets = heading + bullet list; ' +
      'title-body = heading + markdown body; two-column = heading + left/right markdown; ' +
      'quote = big centred quote + attribution.',
    ),
  title: z.string().optional().describe('Heading / cover title / statement / section text'),
  subtitle: z.string().optional().describe('Cover subtitle (layout: title)'),
  eyebrow: z.string().optional().describe('Small kicker above a cover title (layout: title)'),
  body: z.string().optional().describe('Markdown body (layout: title-body / statement fallback). Prefer bullet points, and **bold** the key terms.'),
  bullets: z.array(z.string()).optional().describe(
    'Bullet points (layout: title-bullets) — the preferred way to present content. ' +
    'Keep each bullet short (one line), and **bold** the most important word/number/phrase in each using markdown, ' +
    'e.g. "Cuts inference time by **40%**". Aim for 3–6 bullets per slide.',
  ),
  left: z.string().optional().describe('Left column markdown (layout: two-column). Prefer bullets; **bold** key terms.'),
  right: z.string().optional().describe('Right column markdown (layout: two-column). Prefer bullets; **bold** key terms.'),
  quote: z.string().optional().describe('Quote text (layout: quote)'),
  attribution: z.string().optional().describe('Quote attribution (layout: quote)'),
});

// Build one positioned slide from a high-level spec.
function buildSlide(spec, id) {
  const els = [];
  let z = 1;
  const add = (x, y, w, h, markdown, style) => {
    els.push({ id: `el${z}`, type: 'text', x, y, w, h, z, markdown: markdown || '', style });
    z += 1;
  };

  switch (spec.layout) {
    case 'title':
      if (spec.eyebrow) add(80, 196, 1120, 50, spec.eyebrow, { fontSize: 26, align: 'center', color: 'token:accent-ink' });
      add(120, 252, 1040, 200, spec.title, { fontSize: 64, align: 'center', color: 'token:ink' });
      if (spec.subtitle) add(160, 468, 960, 90, spec.subtitle, { fontSize: 30, align: 'center', color: 'token:ink-2' });
      break;
    case 'section':
      add(140, 290, 1000, 140, spec.title, { fontSize: 60, align: 'center', color: 'token:accent' });
      break;
    case 'statement':
      add(120, 270, 1040, 180, spec.title || spec.body, { fontSize: 52, align: 'center', color: 'token:ink' });
      break;
    case 'title-body':
      add(80, 70, 1120, 110, spec.title, { fontSize: 48, align: 'left', color: 'token:ink' });
      add(80, 208, 1120, 432, spec.body, { fontSize: 30, align: 'left', color: 'token:ink-2' });
      break;
    case 'two-column':
      add(80, 70, 1120, 110, spec.title, { fontSize: 48, align: 'left', color: 'token:ink' });
      add(80, 208, 520, 432, spec.left, { fontSize: 28, align: 'left', color: 'token:ink-2' });
      add(640, 208, 560, 432, spec.right, { fontSize: 28, align: 'left', color: 'token:ink-2' });
      break;
    case 'quote':
      add(140, 230, 1000, 240, spec.quote ? `*“${spec.quote}”*` : '', { fontSize: 44, align: 'center', color: 'token:ink' });
      if (spec.attribution) add(140, 500, 1000, 60, `— ${spec.attribution}`, { fontSize: 26, align: 'center', color: 'token:accent-ink' });
      break;
    case 'title-bullets':
    default: {
      add(80, 70, 1120, 110, spec.title, { fontSize: 48, align: 'left', color: 'token:ink' });
      const body = spec.bullets && spec.bullets.length
        ? spec.bullets.map((b) => `- ${b}`).join('\n')
        : (spec.body || '');
      add(80, 208, 1120, 432, body, { fontSize: 32, align: 'left', color: 'token:ink-2' });
      break;
    }
  }

  return { id, background: { type: 'color', color: 'token:surface' }, elements: els };
}

// Build a whole deck (the JSON blob stored in `presentations.deck`).
function buildDeck({ title, dateLabel, slides }) {
  return {
    version: 1,
    title,
    dateLabel: dateLabel || '',
    canvas: { w: CW, h: CH },
    slides: (slides || []).map((spec, i) => buildSlide(spec, `s${i + 1}`)),
  };
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

export class PortalMCP extends McpAgent {
  server = new McpServer({ name: 'portal', version: '1.0.0' });

  db() {
    return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SECRET_KEY);
  }

  async init() {
    // ── create_presentation ──────────────────────────────────────────────
    this.server.tool(
      'create_presentation',
      'Build a slide deck and save it to the portal Deck Studio (Personal tab). ' +
      'Describe each slide at a high level with a layout + content; the server ' +
      'positions the elements. STYLE: keep slides short and skimmable — lean on ' +
      'bullet points (the title-bullets layout) rather than paragraphs, keep each ' +
      'bullet to one line, and **bold** the key term/number in each bullet so the ' +
      'important parts stand out. Aim for 3–6 bullets a slide.',
      {
        title: z.string().describe('Deck title (also the tab label base)'),
        dateLabel: z.string().optional().describe('Optional short label shown on the tab, e.g. a date'),
        slides: z.array(SLIDE_SPEC).min(1).describe('Slides in order'),
      },
      async ({ title, dateLabel, slides }) => {
        const deck = buildDeck({ title, dateLabel, slides });
        const { data, error } = await this.db()
          .from('presentations')
          .insert({ title, date_label: dateLabel ?? null, deck, created_by: 'claude' })
          .select('id')
          .single();
        return error
          ? fail(`Error: ${error.message}`)
          : ok(`Created "${title}" (${deck.slides.length} slides) — id ${data.id}. Refresh Deck Studio to see it.`);
      },
    );

    // ── list_presentations ───────────────────────────────────────────────
    this.server.tool(
      'list_presentations',
      'List the decks currently in the portal Deck Studio.',
      {},
      async () => {
        const { data, error } = await this.db()
          .from('presentations')
          .select('id, title, date_label, updated_at')
          .order('updated_at', { ascending: false });
        if (error) return fail(`Error: ${error.message}`);
        if (!data.length) return ok('No decks yet.');
        return ok(data.map((r) => `• ${r.title}${r.date_label ? ` (${r.date_label})` : ''} — id ${r.id} — updated ${r.updated_at}`).join('\n'));
      },
    );

    // ── get_presentation ─────────────────────────────────────────────────
    this.server.tool(
      'get_presentation',
      'Fetch one deck\'s full JSON (to inspect or before editing).',
      { id: z.string().describe('The deck id') },
      async ({ id }) => {
        const { data, error } = await this.db()
          .from('presentations')
          .select('title, date_label, deck')
          .eq('id', id)
          .single();
        return error ? fail(`Error: ${error.message}`) : ok(JSON.stringify(data, null, 2));
      },
    );

    // ── add_slide ────────────────────────────────────────────────────────
    this.server.tool(
      'add_slide',
      'Append (or insert) a single slide into an existing deck.',
      {
        id: z.string().describe('The deck id'),
        slide: SLIDE_SPEC.describe('The slide to add'),
        index: z.number().int().optional().describe('0-based insert position; omit to append at the end'),
      },
      async ({ id, slide, index }) => {
        const { data, error } = await this.db().from('presentations').select('deck').eq('id', id).single();
        if (error) return fail(`Error: ${error.message}`);
        const deck = data.deck;
        const built = buildSlide(slide, crypto.randomUUID());
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, deck.slides.length)) : deck.slides.length;
        deck.slides.splice(at, 0, built);
        const upd = await this.db().from('presentations').update({ deck }).eq('id', id).select('id').single();
        return upd.error ? fail(`Error: ${upd.error.message}`) : ok(`Added a slide to deck ${id} at position ${at + 1} (${deck.slides.length} total).`);
      },
    );

    // ── delete_presentation ──────────────────────────────────────────────
    this.server.tool(
      'delete_presentation',
      'Delete a deck from the portal Deck Studio.',
      { id: z.string().describe('The deck id') },
      async ({ id }) => {
        const { error } = await this.db().from('presentations').delete().eq('id', id);
        return error ? fail(`Error: ${error.message}`) : ok(`Deleted deck ${id}.`);
      },
    );
  }
}

// Optional shared-secret guard. Set MCP_AUTH_TOKEN (a Worker secret) to require
// `Authorization: Bearer <token>` on every request; leave unset to run authless.
function authorized(request, env) {
  if (!env.MCP_AUTH_TOKEN) return true;
  return request.headers.get('Authorization') === `Bearer ${env.MCP_AUTH_TOKEN}`;
}

export default {
  fetch(request, env, ctx) {
    if (!authorized(request, env)) return new Response('Unauthorized', { status: 401 });

    const { pathname } = new URL(request.url);
    if (pathname === '/sse' || pathname === '/sse/message') {
      return PortalMCP.serveSSE('/sse').fetch(request, env, ctx);
    }
    if (pathname === '/mcp') {
      return PortalMCP.serve('/mcp').fetch(request, env, ctx);
    }
    return new Response('portal MCP server — connect a client to /sse', { status: 404 });
  },
};
