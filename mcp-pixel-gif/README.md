# pixel-gif MCP server (remote, on a Cloudflare Worker)

A remote [MCP](https://modelcontextprotocol.io) server Claude Code connects to
over SSE. One tool — `save_sprite` — inserts a pixel-art GIF into the portal's
Supabase `sprites` table using the **secret** key, which stays server-side on
the Worker (never shipped to a browser).

```
Claude Code ──SSE──> this Worker ──secret key──> Supabase (sprites)
                                                     ↑ studio reads with the
                                                       public key and renders
```

## Setup

```bash
cd mcp-pixel-gif

# 1. install deps (writes versions into package.json)
npm install agents @modelcontextprotocol/sdk @supabase/supabase-js zod
npm install -D wrangler

# 2. set your Supabase project URL in wrangler.jsonc  (replace YOUR-REF)
# 3. add the secret key for local dev:
cp .dev.vars.example .dev.vars     # then edit .dev.vars
```

## Run locally + test

```bash
npm run dev                         # serves http://localhost:8787/sse
npx @modelcontextprotocol/inspector # GUI: connect (SSE) to the URL above
```

Call `save_sprite` from the Inspector, then check the row in Supabase → Table
Editor → `sprites`.

## Deploy

```bash
npx wrangler login
npx wrangler secret put SUPABASE_SECRET_KEY    # paste the sb_secret_... key
# optional, to lock the public URL:
npx wrangler secret put MCP_AUTH_TOKEN          # paste a long random string
npm run deploy                                  # prints https://pixel-gif-mcp.<you>.workers.dev
```

## Connect Claude Code

```bash
claude mcp add --transport sse pixel-gif https://pixel-gif-mcp.<you>.workers.dev/sse
# if you set MCP_AUTH_TOKEN, add:
#   --header "Authorization: Bearer <that-token>"
```

Then in Claude Code run `/mcp` to confirm it's connected, and ask it to make &
save a sprite. Refresh the GIF studio in the portal to see it.
