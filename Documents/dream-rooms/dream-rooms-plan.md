## Goal
Design a new standalone project called **Dream Rooms**: a tool that takes my written or dictated description of a dream and turns it into an immersive, explorable experience on my website. This means a walkable 3D render of the dream, plus other visualisations that capture how it felt. Your job in this session is to produce the full structural and technical plan, not to build it yet.

## Concept
- I wake up and describe a dream, typed or dictated on my phone, often rambling, fragmented and contradictory. That raw description is the only required input.
- Claude interprets it into a structured "dream scene": places, objects, people or figures, emotions, lighting and time of day, sounds, and the strange parts (spaces that don't connect properly, things that change, scale that's wrong, places that are two places at once). Those strange parts are the point of a dream and must be preserved, not cleaned up.
- From that scene, the system generates a 3D environment, using Blender via the Blender MCP in the same way my Memory Rooms project does, and publishes it to my live site.
- The aesthetic is liminal and dreamlike: empty, too-quiet spaces; fluorescent hum; late-afternoon or no-source light; fog and soft focus; slightly wrong proportions; corridors that loop; doorways that lead somewhere they shouldn't; things that change when you look away. It should feel like being inside a half-remembered dream, not like a game level.
- The 3D world is the centrepiece, but I want other ways of experiencing a dream too. Propose options and recommend which to build first. Starting ideas: an ambient soundscape generated from the dream's mood, fragments of my own description surfacing as text in the space, a painterly or VHS-style 2D rendition, an AR mode that places the dream in my real room (reusing Memory Rooms' AR approach), and a dream archive or map that links recurring places, people and symbols across many dreams.
- Dream Rooms is standalone, separate from Memory Rooms. It can borrow patterns, code or skills from Memory Rooms, but it must not depend on it.
- Dreams are personal. Each dream needs a privacy setting (private, unlisted or public), and private ones must not be publicly reachable on the live site.

## Context
- I'm on a Claude Max plan with multiple repos and a personal website on my own domain, where I deploy many personal projects.
- Memory Rooms is the closest existing project. It takes photos or house plans, uses a custom Claude skill with Blender MCP to build a 3D render of a space, pushes it to the live site, and shows it in AR at real-world scale. Find this repo and the skill and study how they work before planning.
- Find how my other projects are structured and deployed to the live site, so Dream Rooms fits the same setup.

## Constraints
- **Git: stay on the current branch.** Check it with `git branch --show-current` (usually `main`) and do all work there. Do not create, switch or check out branches, and do not use git worktrees. This applies to any subagents too.
- Follow the conventions, stack and deployment patterns my existing projects already use unless there's a strong reason not to. If you deviate, explain why.
- Don't modify Memory Rooms or any other existing project in this session.
- Don't write implementation code yet. The only output is the plan document.

## Approach
1. Explore in parallel with subagents that report findings without editing anything:
   - **Memory Rooms:** its pipeline end to end, the Blender skill, how scenes are exported to the web, the web viewer, the AR implementation, and what's reusable.
   - **Site and deployment:** how my website and other projects are structured, hosted and deployed, and how a new project would slot in, including how private content could be protected.
   - **Rendering research:** techniques for a dreamlike, liminal look in the browser (post-processing such as fog, bloom, grain, chromatic aberration, depth of field; impossible or non-Euclidean spaces; looping and shifting geometry; spatial audio), what's achievable in Blender vs in the browser at runtime, and performance limits on a phone.
2. Think hard about the design, then write the plan from those findings.
3. Use a separate subagent to critique the plan for feasibility, gaps, over-engineering and anything that would make the result feel less like a dream. Revise accordingly.

## The plan should cover
- The architecture and data flow, from raw dream text to a live, explorable page.
- The "dream scene" schema: how vagueness, contradictions, emotions and impossible features are represented so they survive into the render.
- The generation pipeline, split clearly between what Claude and Blender build ahead of time and what the browser does live. Include any new Claude skill(s) to write, and how they relate to the Memory Rooms skill.
- The web experience: the viewer, navigation, dream effects, audio, and the alternative visualisation modes, with a recommendation of which to do first.
- The capture flow for a half-awake person on a phone in the morning.
- Privacy and access control, storage, and how the dream archive grows over time.
- The tech stack and project structure, and how it deploys alongside my other projects.
- A phased build plan: an MVP that gets one dream walkable on the site as fast as possible, then later phases. Give each phase clear "done" criteria.
- Risks, open questions for me, and the things you'd want me to decide.

## When you're done
Save the plan as `PLAN.md` in a new Dream Rooms project directory, located wherever fits my existing repo conventions. Then give me a short summary covering the recommended MVP, the key technical decisions, what you'd reuse from Memory Rooms, and the questions I need to answer. Stop there, and wait for my go-ahead before building anything.