/* ============================================================================
   PIXEL-GIF — REMOTE MCP SERVER (Cloudflare Worker)
   ----------------------------------------------------------------------------
   A remote MCP server Claude Code connects to over SSE. It exposes one tool —
   save_sprite — that inserts a pixel-art GIF into the portal's Supabase
   `sprites` table using the SECRET key. Because this runs on a Worker (not the
   browser), the secret key stays server-side: it's a Worker secret, never
   shipped to any client.

     Claude Code  ──SSE──>  this Worker  ──secret key──>  Supabase (sprites)
                                                              ↑ studio reads with the
                                                                public key and renders

   The McpAgent (from Cloudflare's `agents` SDK) is backed by a Durable Object,
   declared in wrangler.jsonc. Endpoints:
     • GET /sse   — the SSE transport (what Claude Code connects to)
     • POST /mcp  — the Streamable-HTTP transport (for HTTP-only clients)
   ========================================================================== */

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export class PixelGifMCP extends McpAgent {
  server = new McpServer({ name: 'pixel-gif', version: '1.0.0' });

  async init() {
    this.server.tool(
      'save_sprite',
      'Save a pixel-art sprite (a GIF) to the portal so it shows in the studio.',
      {
        name: z.string().describe('Display name for the GIF, e.g. "Walking mushroom"'),
        sprite: z
          .object({
            width: z.number().int().describe('Native pixel width'),
            height: z.number().int().describe('Native pixel height'),
            delayMs: z.number().int().describe('Per-frame delay in ms (the speed)'),
            palette: z.array(z.string()).describe('Hex colours; index 0 is the transparent slot'),
            transparentIndex: z.number().int().nullable().describe('Palette index drawn transparent, or null'),
            frames: z
              .array(z.array(z.number().int()))
              .describe('frames[f][y*width + x] = palette index — the colour grid per frame'),
          })
          .describe('The sprite, in the exact shape the studio renders (see pixelGif.js)'),
      },
      async ({ name, sprite }) => {
        // this.env is the Worker's environment (vars + secrets) on the Durable Object.
        const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SECRET_KEY);
        const { data, error } = await supabase
          .from('sprites')
          .insert({ name, sprite })
          .select('id')
          .single();
        return {
          content: [
            { type: 'text', text: error ? `Error: ${error.message}` : `Saved sprite ${data.id} — refresh the studio to see it.` },
          ],
          isError: !!error,
        };
      },
    );
  }
}

// Optional shared-secret guard. If MCP_AUTH_TOKEN is set (as a Worker secret),
// every request must send `Authorization: Bearer <token>`. Leave it UNSET to run
// authless while you test, then set it to lock the public URL down.
function authorized(request, env) {
  if (!env.MCP_AUTH_TOKEN) return true;
  return request.headers.get('Authorization') === `Bearer ${env.MCP_AUTH_TOKEN}`;
}

export default {
  fetch(request, env, ctx) {
    if (!authorized(request, env)) return new Response('Unauthorized', { status: 401 });

    const { pathname } = new URL(request.url);
    if (pathname === '/sse' || pathname === '/sse/message') {
      return PixelGifMCP.serveSSE('/sse').fetch(request, env, ctx);
    }
    if (pathname === '/mcp') {
      return PixelGifMCP.serve('/mcp').fetch(request, env, ctx);
    }
    return new Response('pixel-gif MCP server — connect a client to /sse', { status: 404 });
  },
};
