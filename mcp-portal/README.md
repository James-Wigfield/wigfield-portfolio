# portal-mcp

A general remote MCP server (on a Cloudflare Worker) for the **personal portal's**
write-tools. One server, one connection — add more tools over time.

> This is the personal portal's MCP. It is **not** the Portara product (which
> sells the same pattern to clients). Keep them separate.

## Tools

**Deck Studio** (Personal → Deck Studio):

| tool | what it does |
|---|---|
| `create_presentation` | Build a deck from high-level slide specs (`layout` + content) and save it. |
| `list_presentations` | List existing decks. |
| `get_presentation` | Fetch one deck's full JSON. |
| `add_slide` | Append/insert a slide into a deck. |
| `delete_presentation` | Delete a deck. |

Slide layouts: `title`, `section`, `statement`, `title-bullets`, `title-body`,
`two-column`, `quote`. Text is markdown. The server positions the elements into
the portal's 1280×720 canvas model; you can then drag/edit them in the portal.

**RSVP Papers** (Personal → RSVP Papers) — `src/papers.js`:

| tool | what it does |
|---|---|
| `save_paper` | Create a paper (title/authors/year/source) with the FIRST batch of sections; returns `paper_id` + the portal URL. |
| `append_sections` | Append the next ordered batch (`expected_count` guards against a duplicate retry; `final: true` marks complete). |
| `list_papers` | Papers with status, counts, progress and URL (`include_deleted` for the Bin). |
| `get_paper` | Metadata + section outline — how to resume an interrupted upload. |
| `delete_paper` | SOFT delete → the portal Bin (restore / purge from the library). |

The chat Claude is the PDF parser. Sections are
`{ heading, level 1–3, part main|appendix, blocks[] }` and blocks are
`text | list | figure | table | equation | algorithm` (see the schema and the
cleaning conventions in the `save_paper` tool description). Papers are sent in
~100 KB batches. Tables: `supabase/papers.sql`. Auth: the endpoint is authless
(claude.ai connectors can't send a static bearer), so nothing here can destroy
data — see the header of `src/index.js`.

## Setup

1. `cd mcp-portal && npm install`
2. `cp .dev.vars.example .dev.vars` and fill in `SUPABASE_SECRET_KEY` (and,
   recommended, `MCP_AUTH_TOKEN`).
3. Make sure the Supabase `presentations` table exists — run
   `../supabase/presentations.sql` in the Supabase SQL editor.
4. Local dev: `npm run dev` (serves the MCP at `http://localhost:8787/sse`).
5. Deploy: `npm run deploy`, then set the production secrets:
   ```
   wrangler secret put SUPABASE_SECRET_KEY
   wrangler secret put MCP_AUTH_TOKEN      # if you enabled the guard
   ```

## Connect from Claude Code

Add the deployed `/sse` URL as an MCP server. If you set `MCP_AUTH_TOKEN`, pass it
as a bearer token in the connection's headers. Then ask Claude to
"build a deck on …" and refresh Deck Studio in the portal.
