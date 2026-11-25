# Plan page: Dream Rooms (a dream description → a walkable, liminal 3D dream on my site)

You're in `C:\Users\james\Documents\personal-projects\wigfield-portfolio`, a Vite + React 19 SPA served by a Cloudflare Worker (`workers/app.js`, `wrangler.jsonc`), with Supabase for data. Read `CLAUDE.md` first and do what it asks. It points at my Obsidian vault at `C:\Users\james\Documents\james-claude-brain`. Then read the idea brief at `Documents/dream-rooms/dream-rooms-plan.md`.

## What this session makes

This session plans the tool and doesn't build it. The output is a **plan page in my private portal**: `/portal/dream-rooms-plan`, under the **Personal** group. I'll read it, ask for changes, and only then hand its build prompt to another fresh session that builds the real thing on the live site.

This changes one part of the brief. **The brief's "Approach" and "The plan should cover" sections still apply in full, but its output is not a `PLAN.md`.** The output is:

1. **The page**: a tabbed wireframe plan, one diagram per tab, readable in a few minutes.
2. **`build-prompt.md`**: the build spec for the later session, shown in a copyable drawer at the top of the page. It's the source of truth for every decision, and the page is the visual check of it.

## Copy this pattern exactly: the Memory Rooms plan page

Memory Rooms started the same way. Study it before writing anything:

- `src/components/portal/modules/memory-rooms-plan/`:
  - `MemoryRoomsPlan.jsx` is the shell: prompt drawer → hero → numbered top tabs → panel, with deep links through `usePortalRoute`.
  - `PromptBlock.jsx` is the VS Code-style drawer with a Copy button. It normalises CRLF to LF, so the clipboard gets exactly the file.
  - `build-prompt.md` is the spec, imported `?raw`.
  - `content.js` holds every word that isn't in the prompt.
  - `tabs.jsx` has one component per tab, and `art.jsx` holds the SVG pictures.
  - `DioramaPreview.jsx` is a small live three.js sketch.
- `tools/memory-rooms-plan/page-check.mjs` is the headless check (puppeteer-core + local Edge, seeded through the portal gate).
- In the vault: `03-Dev-Logs/2026-11-08-memory-rooms-plan.md`. Read its "Revision (same day): Blender-first" section.
- `src/components/portal/registry.js` has the `memory-rooms-plan` entry (`group: 'Personal'`).

Make a sibling module, `src/components/portal/modules/dream-rooms-plan/`, with its own CSS prefix (for example `drp-`). Add one registry entry with id `dream-rooms-plan`, label `Dream Rooms · Plan` and group `Personal`. Add an icon to `icons.jsx` if none fits. **Copy** components such as `PromptBlock` into the new folder. Don't import them from `memory-rooms-plan`, and don't change any Memory Rooms file.

## Rules

- **Git:** stay on the current branch (`git branch --show-current`, usually `main`). Don't create, switch or check out branches, and don't use worktrees. This applies to subagents too. Don't commit, push or deploy: I review first.
- **The working tree has someone else's uncommitted work** (Memory Rooms freeform capture, under `src/memory-rooms/`, `workers/memory-rooms.js`, `tools/memory-rooms/` and more). Don't touch, stage, format or revert any of it. The only existing files you may edit are `src/components/portal/registry.js` and `icons.jsx`.
- **No implementation code for Dream Rooms itself.** That means no `/dreams` route, Worker routes, SQL or skill. Small throwaway experiments that *prove a claim* are fine and encouraged, as long as they're kept out of the app (see "Verify, don't guess").
- **Unattended, start to finish.** I've left the PC and can't answer. Never stop to ask, wait for confirmation, present a plan for approval, or use AskUserQuestion / plan mode. When something is unclear, make a sensible call, note it on the page as an open question with your recommendation, and keep going. If something truly needs me (an account, a paid service, my real dreams), work around it and list it in the final summary. Tell every subagent the same. If a tool or step fails, try another way. Don't stop half-done.
- Start the dev server and any long processes in the background, and stop them (node, Edge, Blender) when you've finished. Pick a free port, not 8787.

## Correct this in the brief

The brief says Memory Rooms builds scenes "via the Blender MCP". That's wrong. Memory Rooms uses a **headless Blender kit** (`blender.exe -b --factory-startup --python …`) driven by the `memory-render` skill (`.claude/skills/memory-render/`), with Claude writing a checkable `scene.json` and comparing renders. The MCP needs the Blender GUI open and is only for optional touch-ups. Plan Dream Rooms the same way unless you find a strong reason not to, and say which you chose.

## How to work

1. **Explore in parallel with read-only subagents**, as the brief's "Approach" says: Memory Rooms end to end, site and deployment (and private access patterns such as the `/memories` password gate and the `/memories/s/<token>` share links), and rendering research. Brief each one fully, because the brief is all the context it gets.
2. **Verify, don't guess.** When a decision depends on a claim you can test cheaply on this PC, test it, and put the evidence on the page, the way Memory Rooms put a real Blender test render on its Render loop tab. Good candidates:
   - a headless Blender test render of a small liminal space (fog/volume, no-source light, a looping corridor);
   - a three.js sketch running the proposed post-processing stack (grain, bloom, fog, chromatic aberration, soft focus), with its frame rate measured;
   - whether dictation into a web textarea works on iOS Safari versus recording audio for transcription.

   Keep any test scripts and outputs under `tools/dream-rooms-plan/` and commit nothing.
3. **Write `build-prompt.md`** in the shape of Memory Rooms' `build-prompt.md`: what it is, decisions already made (numbered), routes, the dream-scene schema, the pipeline, the skill, storage and privacy, the phased build with "done" criteria, and checks. Write it for an **unattended** build session: no confirmation stops, a `DECISIONS.md` log, framework first, and local first so it runs without cloud setup.
4. **Build the page** from `build-prompt.md`, with words in `content.js`.
5. **Critique with a fresh subagent.** Give it the build prompt and screenshots, without your opinion. Ask it for feasibility problems, gaps, over-engineering, and anything that makes the result feel *less like a dream* (a game level, a tidy 3D model, a tech demo). Revise.
6. **Check** with `tools/dream-rooms-plan/page-check.mjs`, modelled on the Memory Rooms one. It should cover every tab and its deep link, the drawer opening, Copy giving the exact `build-prompt.md` text, any live canvas painting non-blank pixels, no horizontal scroll at 390 px, no left-border callouts, zero console errors or warnings, and screenshots of every tab in the 3 portal themes (jade, coral, arcade) at 1440 and 390. Then have a fresh subagent review the screenshots for the worst visual problems, and fix them.

## The page

Suggested tabs (change them if the content wants a different shape):

1. **Verdict**: the pitch in one line, the recommended MVP, and the 4–6 key calls with one-line reasons. Include anything the research changed about the idea, like Memory Rooms' "Findings that changed the idea".
2. **Capture**: wireframes of the half-awake phone flow at 6 am (phone screens drawn as SVG): type or dictate, one big button, nothing to decide before the words are down, private by default, an offline outbox.
3. **Dream scene**: a sample rambling dream with its fragments highlighted, each linked to the scene entry it became. Show how vagueness, contradiction, emotion and impossible features ("two places at once", "the door led back to the same room", "it was my school but it was also the airport") are kept as data instead of being cleaned up.
4. **Pipeline**: who does what and when. Claude (with the skill) and Blender work ahead of time; the browser works live. Show the new skill next to `memory-render`: what it borrows and what it doesn't.
5. **Experience**: a wireframe of the viewer (navigation, how text fragments surface, audio) plus **one live sketch** of the liminal look (three.js, ≤ 3 controls). Also list the alternative modes (soundscape, text fragments, painterly/VHS 2D, AR, the dream archive map), ranked with a "build first" pick.
6. **Privacy & archive**: private/unlisted/public, drawn as who can reach what. Show how a private dream stays unreachable on the live site, and how the archive links recurring places, people and symbols across dreams as it grows.
7. **Roadmap & questions**: phases with "done" criteria (MVP = one dream walkable on the site as fast as possible), the risks, and **the questions I need to answer**, each with your recommended answer.

## Style (my standing preferences)

- Top tabs, no long scroll, never big blocks of text. Every tab leads with its picture, and its words fit in a minute.
- No coloured rounded callout boxes with a left border, and no filled pills. Mark tone with a labelled dot on ruled, editorial layouts.
- A visual should get one idea across in 5 seconds. Picture first, details in a drawer, ≤ 3 controls.
- Code and JSON blocks get the VS Code look, as in `PromptBlock`.
- Use the portal's theme tokens, so it reads in all 3 themes. A quiet dreamlike touch is welcome, such as haze or soft grain in the hero. Nothing gimmicky.
- Write in plain, short sentences: Australian English, active voice, no jargon without a gloss.

## Sample dream

If I've pasted a real dream below, use it as the worked example throughout. If not, write a believable rambling one (fragmented, contradictory, with at least one impossible space and one thing that changes), and label it a sample on the page.

<!-- optional: paste a real dream here -->

## When you're done

- Update the vault: create `01-Active-Projects/dream-rooms.md` and a dev log `03-Dev-Logs/<date>-dream-rooms-plan.md` with [[wikilinks]] to `memory-rooms`, `wigfield-portfolio-management-portal` and the tech involved. Add a line to the portal note.
- Then give me a short summary: the recommended MVP, the key technical decisions, what's reused from Memory Rooms, what you verified on this PC (with results), the questions I need to answer, and how to open the page locally (`npx vite`, then `/portal/dream-rooms-plan`). That summary is the end of the session. Don't start building Dream Rooms; I'll review the page and give the go-ahead in a later session.
