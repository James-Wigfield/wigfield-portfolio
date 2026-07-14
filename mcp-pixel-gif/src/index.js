/* ============================================================================
   PIXEL-GIF — REMOTE MCP SERVER (Cloudflare Worker)
   ----------------------------------------------------------------------------
   A remote MCP server Claude Code connects to over SSE. It writes pixel-art
   sprites into the portal's Supabase `sprites` table using the SECRET key
   (a Worker secret — never shipped to a client). The studio reads them back
   with the public key and renders/encodes the GIF client-side (pixelGif.js).

     Claude Code  ──SSE──>  this Worker  ──secret key──>  Supabase (sprites)

   v2 — INCREMENTAL, ROW-STRING TOOLS. The original single save_sprite call
   took frames as number[][] (one JSON number per pixel, whole animation in one
   call), which blew up context on anything big and made spatial accuracy poor.
   Now:
     • Frames travel as ROW STRINGS — one character per pixel ('.' transparent,
       0-9a-v = palette index), so the model literally draws ASCII art and rows
       are validated exactly against width/height.
     • The surface is incremental (create_sprite → add_frame → patch/transform),
       so no single tool call ever carries more than one frame, and animation
       frames can be DERIVED (duplicate + patch a blink; shift a scroll) instead
       of redrawn.
   The STORED sprite shape is unchanged (frames as number[][] palette indices) —
   the studio and encoder are untouched. A sprite with no frames yet is simply
   hidden by the studio's isValidSprite guard until its first frame arrives.

   The McpAgent (Cloudflare `agents` SDK) is backed by a Durable Object,
   declared in wrangler.jsonc. Endpoints:
     • GET /sse   — the SSE transport (what Claude Code connects to)
     • POST /mcp  — the Streamable-HTTP transport (for HTTP-only clients)
   ========================================================================== */

import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── Limits (keep generation reliable — draw small, upscale in the studio) ────
const MAX_DIM = 64;        // native grid cap; the studio upscales losslessly
const MAX_COLOURS = 32;    // one char per palette slot (0-9a-v)
const MAX_FRAMES = 64;

const CHARS = '0123456789abcdefghijklmnopqrstuv';

// ── Row-string codec ─────────────────────────────────────────────────────────
// rows: string[] (height entries, width chars each) → flat number[] indices.
// Throws Error with a PRECISE message so the model can fix the exact row.
function decodeFrame(rows, sprite) {
  const { width, height, palette, transparentIndex } = sprite;
  if (rows.length !== height) {
    throw new Error(`expected ${height} rows, got ${rows.length}`);
  }
  const flat = new Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row.length !== width) {
      throw new Error(`row ${y} is ${row.length} chars, expected ${width} ("${row}")`);
    }
    for (let x = 0; x < width; x++) {
      flat[y * width + x] = charToIndex(row[x], palette, transparentIndex, `row ${y}, col ${x}`);
    }
  }
  return flat;
}

function charToIndex(ch, palette, transparentIndex, where) {
  if (ch === '.') {
    if (transparentIndex === null || transparentIndex === undefined) {
      throw new Error(`'.' used at ${where} but the sprite has no transparent slot (transparentIndex is null)`);
    }
    return transparentIndex;
  }
  const idx = CHARS.indexOf(ch);
  if (idx === -1) throw new Error(`invalid char '${ch}' at ${where} — use '.' or 0-9a-v`);
  if (idx >= palette.length) {
    throw new Error(`char '${ch}' at ${where} = palette index ${idx}, but the palette only has ${palette.length} colours`);
  }
  return idx;
}

// flat number[] → string[] rows (for get_sprite read-back).
function encodeFrame(flat, sprite) {
  const { width, height, transparentIndex } = sprite;
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const idx = flat[y * width + x];
      row += idx === transparentIndex ? '.' : CHARS[idx] ?? '?';
    }
    rows.push(row);
  }
  return rows;
}

// ── Frame transforms (derive animation instead of redrawing it) ──────────────
function shiftFrame(flat, sprite, dx, dy, wrap) {
  const { width, height, transparentIndex } = sprite;
  const fill = transparentIndex ?? 0;
  const out = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sx = x - dx;
      let sy = y - dy;
      if (wrap) {
        sx = ((sx % width) + width) % width;
        sy = ((sy % height) + height) % height;
        out[y * width + x] = flat[sy * width + sx];
      } else {
        out[y * width + x] =
          sx >= 0 && sx < width && sy >= 0 && sy < height ? flat[sy * width + sx] : fill;
      }
    }
  }
  return out;
}

function mirrorFrame(flat, sprite, axis) {
  const { width, height } = sprite;
  const out = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = axis === 'mirror-h' ? width - 1 - x : x;
      const sy = axis === 'mirror-v' ? height - 1 - y : y;
      out[y * width + x] = flat[sy * width + sx];
    }
  }
  return out;
}

// ── Shared zod pieces ────────────────────────────────────────────────────────
const ROWS = z
  .array(z.string())
  .describe(
    'The frame as ROW STRINGS, one per pixel row (top to bottom), one CHAR per pixel: ' +
    "'.' = transparent, '0'-'9' then 'a'-'v' = palette index 0-31. Every row must be " +
    'exactly `width` chars and there must be exactly `height` rows. Draw it like ASCII art.',
  );

const PIXEL = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  c: z.string().length(1).describe("New value: '.' (transparent) or a palette char 0-9a-v"),
});

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

export class PixelGifMCP extends McpAgent {
  server = new McpServer({ name: 'pixel-gif', version: '2.0.0' });

  db() {
    return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SECRET_KEY);
  }

  async getRow(id) {
    const { data, error } = await this.db().from('sprites').select('name, sprite').eq('id', id).single();
    return error ? { error } : { name: data.name, sprite: data.sprite };
  }

  async putSprite(id, sprite) {
    const { error } = await this.db().from('sprites').update({ sprite }).eq('id', id).select('id').single();
    return error || null;
  }

  async init() {
    // ── create_sprite ────────────────────────────────────────────────────
    this.server.tool(
      'create_sprite',
      'Start a new pixel-art sprite (canvas + palette, no frames yet). Then call add_frame ' +
      'for frame 1, and PREFER duplicate_frame + patch_frame / transform_frame for the rest — ' +
      'most animation is a small change to the previous frame, not a redraw. ' +
      'DISCIPLINE: draw small (16-32px native — the studio upscales losslessly), keep the ' +
      'palette tight (≤16 colours), and put the transparent slot at index 0.',
      {
        name: z.string().describe('Display name, e.g. "Walking mushroom"'),
        width: z.number().int().min(4).max(MAX_DIM).describe('Native pixel width (16-32 recommended)'),
        height: z.number().int().min(4).max(MAX_DIM).describe('Native pixel height'),
        delayMs: z.number().int().min(20).max(2000).describe('Per-frame delay in ms (the speed)'),
        palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(MAX_COLOURS)
          .describe('Hex colours; index 0 is conventionally the transparent slot'),
        transparentIndex: z.number().int().nullable()
          .describe("Palette index drawn transparent (usually 0), or null for fully opaque art — '.' in rows maps to this"),
      },
      async ({ name, width, height, delayMs, palette, transparentIndex }) => {
        if (transparentIndex !== null && transparentIndex >= palette.length) {
          return fail(`Error: transparentIndex ${transparentIndex} is outside the ${palette.length}-colour palette.`);
        }
        const sprite = { width, height, delayMs, palette, transparentIndex, frames: [] };
        const { data, error } = await this.db().from('sprites').insert({ name, sprite }).select('id').single();
        if (error) return fail(`Error: ${error.message}`);
        return ok(
          `Created "${name}" (${width}×${height}, ${palette.length} colours) — id ${data.id}. ` +
          'It stays hidden in the studio until its first frame: call add_frame with row strings ' +
          `(${height} rows × ${width} chars, '.' = transparent).`,
        );
      },
    );

    // ── add_frame ────────────────────────────────────────────────────────
    this.server.tool(
      'add_frame',
      'Add one frame to a sprite as row strings. One frame per call — for follow-up frames ' +
      'that are similar, use duplicate_frame + patch_frame instead of redrawing.',
      {
        id: z.string().describe('The sprite id'),
        rows: ROWS,
        index: z.number().int().min(0).optional().describe('0-based insert position; omit to append'),
      },
      async ({ id, rows, index }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const sprite = got.sprite;
        if (sprite.frames.length >= MAX_FRAMES) return fail(`Error: frame cap (${MAX_FRAMES}) reached.`);
        let flat;
        try { flat = decodeFrame(rows, sprite); } catch (e) { return fail(`Error: ${e.message}`); }
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, sprite.frames.length)) : sprite.frames.length;
        sprite.frames.splice(at, 0, flat);
        const err = await this.putSprite(id, sprite);
        return err ? fail(`Error: ${err.message}`)
                   : ok(`Added frame at position ${at} — "${got.name}" now has ${sprite.frames.length} frame(s).`);
      },
    );

    // ── update_frame ─────────────────────────────────────────────────────
    this.server.tool(
      'update_frame',
      'Replace one frame entirely (row strings). For small fixes prefer patch_frame.',
      { id: z.string(), index: z.number().int().min(0), rows: ROWS },
      async ({ id, index, rows }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const sprite = got.sprite;
        if (index >= sprite.frames.length) return fail(`Error: frame ${index} doesn't exist (${sprite.frames.length} frames).`);
        let flat;
        try { flat = decodeFrame(rows, sprite); } catch (e) { return fail(`Error: ${e.message}`); }
        sprite.frames[index] = flat;
        const err = await this.putSprite(id, sprite);
        return err ? fail(`Error: ${err.message}`) : ok(`Replaced frame ${index} of "${got.name}".`);
      },
    );

    // ── duplicate_frame ──────────────────────────────────────────────────
    this.server.tool(
      'duplicate_frame',
      'Copy an existing frame (append, or insert at index). The cheap way to animate: ' +
      'duplicate, then patch_frame the few pixels that change.',
      {
        id: z.string(),
        from: z.number().int().min(0).describe('Frame to copy'),
        index: z.number().int().min(0).optional().describe('0-based insert position; omit to append'),
      },
      async ({ id, from, index }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const sprite = got.sprite;
        if (from >= sprite.frames.length) return fail(`Error: frame ${from} doesn't exist (${sprite.frames.length} frames).`);
        if (sprite.frames.length >= MAX_FRAMES) return fail(`Error: frame cap (${MAX_FRAMES}) reached.`);
        const at = Number.isInteger(index) ? Math.max(0, Math.min(index, sprite.frames.length)) : sprite.frames.length;
        sprite.frames.splice(at, 0, [...sprite.frames[from]]);
        const err = await this.putSprite(id, sprite);
        return err ? fail(`Error: ${err.message}`)
                   : ok(`Copied frame ${from} → position ${at} (${sprite.frames.length} frames total). Now patch_frame it.`);
      },
    );

    // ── patch_frame ──────────────────────────────────────────────────────
    this.server.tool(
      'patch_frame',
      'Change individual pixels of one frame — a sparse diff (a blink is ~10 pixels, not a redraw).',
      {
        id: z.string(),
        index: z.number().int().min(0),
        pixels: z.array(PIXEL).min(1).describe('Pixels to set: { x, y, c } with (0,0) top-left'),
      },
      async ({ id, index, pixels }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const sprite = got.sprite;
        if (index >= sprite.frames.length) return fail(`Error: frame ${index} doesn't exist (${sprite.frames.length} frames).`);
        const frame = [...sprite.frames[index]];
        try {
          for (const p of pixels) {
            if (p.x >= sprite.width || p.y >= sprite.height) {
              throw new Error(`pixel (${p.x},${p.y}) is outside the ${sprite.width}×${sprite.height} grid`);
            }
            frame[p.y * sprite.width + p.x] =
              charToIndex(p.c, sprite.palette, sprite.transparentIndex, `pixel (${p.x},${p.y})`);
          }
        } catch (e) {
          return fail(`Error: ${e.message}`);
        }
        sprite.frames[index] = frame;
        const err = await this.putSprite(id, sprite);
        return err ? fail(`Error: ${err.message}`) : ok(`Patched ${pixels.length} pixel(s) in frame ${index}.`);
      },
    );

    // ── transform_frame ──────────────────────────────────────────────────
    this.server.tool(
      'transform_frame',
      'Derive a frame by transforming an existing one: shift (walk/scroll cycles, with wrap) ' +
      'or mirror (symmetric sprites / left-right walk flips). Writes the result to a new frame ' +
      '(append or at index) or in place.',
      {
        id: z.string(),
        from: z.number().int().min(0).describe('Source frame'),
        op: z.enum(['shift', 'mirror-h', 'mirror-v']),
        dx: z.number().int().optional().describe('shift only: pixels right (negative = left)'),
        dy: z.number().int().optional().describe('shift only: pixels down (negative = up)'),
        wrap: z.boolean().optional().describe('shift only: wrap around edges (default true)'),
        inPlace: z.boolean().optional().describe('Overwrite the source frame instead of adding a new one'),
        index: z.number().int().min(0).optional().describe('0-based insert position for the new frame; omit to append'),
      },
      async ({ id, from, op, dx = 0, dy = 0, wrap = true, inPlace = false, index }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const sprite = got.sprite;
        if (from >= sprite.frames.length) return fail(`Error: frame ${from} doesn't exist (${sprite.frames.length} frames).`);
        const src = sprite.frames[from];
        const out = op === 'shift' ? shiftFrame(src, sprite, dx, dy, wrap) : mirrorFrame(src, sprite, op);
        if (inPlace) {
          sprite.frames[from] = out;
        } else {
          if (sprite.frames.length >= MAX_FRAMES) return fail(`Error: frame cap (${MAX_FRAMES}) reached.`);
          const at = Number.isInteger(index) ? Math.max(0, Math.min(index, sprite.frames.length)) : sprite.frames.length;
          sprite.frames.splice(at, 0, out);
        }
        const err = await this.putSprite(id, sprite);
        return err ? fail(`Error: ${err.message}`)
                   : ok(`${op} of frame ${from} ${inPlace ? 'applied in place' : 'added'} (${sprite.frames.length} frames total).`);
      },
    );

    // ── get_sprite ───────────────────────────────────────────────────────
    this.server.tool(
      'get_sprite',
      'Read a sprite back as row strings — inspect what is actually stored, then fix specific ' +
      'pixels with patch_frame instead of regenerating.',
      {
        id: z.string(),
        frame: z.number().int().min(0).optional().describe('Only return this frame (omit for all)'),
      },
      async ({ id, frame }) => {
        const got = await this.getRow(id);
        if (got.error) return fail(`Error: ${got.error.message}`);
        const s = got.sprite;
        const frames = frame !== undefined
          ? (frame < s.frames.length ? [[frame, s.frames[frame]]] : null)
          : s.frames.map((f, i) => [i, f]);
        if (!frames) return fail(`Error: frame ${frame} doesn't exist (${s.frames.length} frames).`);
        const head =
          `"${got.name}" — ${s.width}×${s.height}, ${s.frames.length} frame(s), delay ${s.delayMs}ms\n` +
          `palette: ${s.palette.map((c, i) => `${CHARS[i]}=${c}${i === s.transparentIndex ? ' (transparent)' : ''}`).join('  ')}`;
        const body = frames
          .map(([i, f]) => `frame ${i}:\n${encodeFrame(f, s).join('\n')}`)
          .join('\n\n');
        return ok(`${head}\n\n${body}`);
      },
    );

    // ── list_sprites ─────────────────────────────────────────────────────
    this.server.tool('list_sprites', 'List the sprites in the studio.', {}, async () => {
      const { data, error } = await this.db().from('sprites').select('id, name, sprite').order('created_at', { ascending: false });
      if (error) return fail(`Error: ${error.message}`);
      if (!data.length) return ok('No sprites yet.');
      return ok(data
        .map((r) => `• ${r.name} — ${r.sprite?.width}×${r.sprite?.height}, ${r.sprite?.frames?.length ?? 0} frame(s) — id ${r.id}`)
        .join('\n'));
    });

    // ── delete_sprite ────────────────────────────────────────────────────
    this.server.tool(
      'delete_sprite',
      'Delete a sprite from the studio.',
      { id: z.string() },
      async ({ id }) => {
        const { error } = await this.db().from('sprites').delete().eq('id', id);
        return error ? fail(`Error: ${error.message}`) : ok(`Deleted sprite ${id}.`);
      },
    );

    // ── save_sprite (one-shot, small sprites only) ───────────────────────
    this.server.tool(
      'save_sprite',
      'One-shot save of a SMALL pixel-art sprite (≤24×24 and ≤6 frames). Frames are row ' +
      "strings ('.' transparent, 0-9a-v palette chars). For anything larger or longer, use " +
      'create_sprite + add_frame (+ duplicate/patch/transform) instead — one frame per call.',
      {
        name: z.string().describe('Display name for the GIF'),
        sprite: z.object({
          width: z.number().int().min(4).max(MAX_DIM),
          height: z.number().int().min(4).max(MAX_DIM),
          delayMs: z.number().int().min(20).max(2000),
          palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(MAX_COLOURS),
          transparentIndex: z.number().int().nullable(),
          frames: z.array(ROWS).min(1).max(MAX_FRAMES).describe('Each frame = array of row strings'),
        }),
      },
      async ({ name, sprite }) => {
        if (sprite.transparentIndex !== null && sprite.transparentIndex >= sprite.palette.length) {
          return fail(`Error: transparentIndex ${sprite.transparentIndex} is outside the palette.`);
        }
        let frames;
        try {
          frames = sprite.frames.map((rows, i) => {
            try { return decodeFrame(rows, sprite); }
            catch (e) { throw new Error(`frame ${i}: ${e.message}`); }
          });
        } catch (e) {
          return fail(`Error: ${e.message}`);
        }
        const stored = { ...sprite, frames };
        const { data, error } = await this.db().from('sprites').insert({ name, sprite: stored }).select('id').single();
        return error
          ? fail(`Error: ${error.message}`)
          : ok(`Saved "${name}" (${frames.length} frames) — id ${data.id}. Refresh the studio to see it.`);
      },
    );
  }
}

// Optional shared-secret guard. If MCP_AUTH_TOKEN is set (as a Worker secret),
// every request must send `Authorization: Bearer <token>`. Left UNSET on purpose
// (authless, single-user) — treat the Worker URL itself as the secret.
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
