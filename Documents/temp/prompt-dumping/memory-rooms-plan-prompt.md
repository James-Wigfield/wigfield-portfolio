# Prompt: plan a "trip memories → 3D renders on a map" tool

You're working in my portfolio repo, `C:\Users\james\Documents\personal-projects\wigfield-portfolio`. I want you to **work out the plan** for a new tool and present it as a **new page in my private portal under the Personal section**. Don't build the tool itself. You have two deliverables:

1. **A visual plan page** that I read to check the plan holds up.
2. **A build prompt** in a copyable markdown block at the top of that page. I'll paste it into a fresh Claude Code instance, and that instance builds the tool on a new route in this repo.

The plan is yours to decide. Research it, weigh the options and make the calls. What follows is the idea and the constraints, not a design.

**Run this start to finish without stopping to ask me anything.** I'll be away from the PC. When something is unclear, make a sensible call, note it under "open questions" on the plan page, and keep going. Don't deploy, push, or change Supabase or other external services. None of that is needed for this planning step.

---

## The idea

My mate and I are going to the USA (plus a bit of Canada) for Dec–Jan. We're both programmers and use Claude Code heavily. Whenever we're somewhere with a real memory attached (say the common room of a party hostel we loved), we want to take a few photos from different angles, mark the spot as an **interior** or an **exterior**, and attach its location. After the trip, Claude Code works through what we've collected and turns each spot into a **3D render**. My thinking is that Claude builds the model itself using the photos as reference, probably through the Blender MCP, or three.js if that's better. I've done something similar before and seen it done online, but I'm not certain it's the right approach. Check it. The end result is a **map of the USA and the parts of Canada we visit**, where we can click a spot and explore the 3D room or building.

Constraints and context:
- **We upload the photos through the tool's own web interface**, on our phones while we travel. Using the Claude phone app or an MCP for uploads is optional, not required.
- **Stage 1 is built in this repo as a new route.** Once it's refined I may move it to our separate USA trip site, which is a React app connected to Supabase and has its own custom MCP. Keep that move in mind.
- **The first real test is my house.** I'm not sure whether to do it room by room or all in one go. I also have the **floor plans**, but I don't know if they help much beyond the photos, maybe as a check on dimensions.
- The plan should tell me **how the framework gets built** and **what the workflow looks like to get a new render made**.

## Context worth reading first

- `CLAUDE.md`, then the vault notes `C:\Users\james\Documents\james-claude-brain\01-Active-Projects\wigfield-portfolio.md` and `wigfield-portfolio-management-portal.md`.
- My memory index, especially the design feedback memories about styling, page layout and visuals. Follow them for the plan page.
- Portal conventions: `src/components/portal/registry.js`, `portalRoute.js`, `icons.jsx`, and existing Personal modules for patterns.
- What already exists in the repo and on this machine. Use what fits:
  - a Supabase client (`src/lib/supabaseClient.js`) and SQL files in `supabase/`
  - my portal MCP (`mcp-portal/`)
  - a USA SVG map in `modules/america/`
  - three.js / react-three-fiber
  - a Blender MCP connected to this Claude Code. Check what it can actually do.

## The plan page

- A new module in the portal's **Personal** section, in its own folder.
- **Highly visual and as short and summarised as possible.** I should understand the plan from easy-to-read diagrams, not from walls of text.
- **At the very top:** a dropdown containing the build prompt as a copyable markdown block (with a copy button).
- Everything else about the page's structure and content is your call.

## The build prompt

- Written for a fresh Claude Code instance that has none of this context, so it has to stand on its own and carry the decisions your plan made.
- It builds the tool and the framework behind it on a new route in this repo. Once it's done, I should be able to test it on one room of my house.

## Before you finish

- `npm run build`, a lint scoped to your new files, and a look at the page yourself (headless screenshots are fine) to check that it reads clearly and the copy button works.
- Work on a feature branch, and don't commit unless I ask.
- Per `CLAUDE.md`, add a vault note and a memory entry.
- Tell me the portal URL, anything important you found that changes my original idea, and any open questions I should answer before I paste the build prompt.
