# How the study-module prompts were built

The briefs in `Documents/temp/prompt-dumping/` were written in one chat for James's CITS5017 study modules. Each brief is handed to a fresh Claude Code instance with: `read and follow Documents\temp\prompt-dumping\<file>.md`. This note explains how they were put together, so new ones stay consistent.

## Steps for each new brief
1. **Read the deck first.** Run `pdfinfo` for the slide count, `pdftotext` for every slide's title and text, and `pdftoppm` for the slides with maths or code, because pdftotext drops Greek letters, primes and indentation.
2. **Check the repo state.** Run `git status`, `git worktree list` and `git log main`. See which modules are merged, whether another instance is mid-build, and which lecture PDFs are tracked.
3. **Pick the newest good module as the template.** Today that's `lecture8-study/`. Read its vault dev log in `03-Dev-Logs/` for its rules and gotchas.
4. **Verify the numbers yourself.** Re-derive the slide numbers you quote (parameter counts, worked examples, gate values) before putting them in a brief.

## What every brief contains (same order each time)
- **Who/what/why:** the deck path, the template module, and James's three priorities: complete and accurate, good to learn from, and consistent with the template.
- **James's design requests for that build.** Examples: the lab principles (from Lecture 8), the notes budget, extra diagrams, the refresher's 3-page limit.
- **"Where things are"** table: the deck, the template, its tools, transcripts, the registry, `ENVIRONMENT_SETUP.md` (the WSL `tf-2.20-gpu` env, read-only), the vault, and the exam note (`past-exam-info/`).
- **Ground rules:**
  - don't edit other modules;
  - copy, don't refactor;
  - **unattended: start straight away, never ask, never wait for confirmation**.
- **Git:** the final result must end up on `main`. Use a worktree plus a temp branch if another instance may be using the main folder, then merge, remove the worktree and delete the branch. **Never push.**
- **Setup:** the folder name, CSS and storage prefixes, the exact registry entry and its position, the maths helper file, and which data goes in which file.
- **Section plan:** a table of § / title / slides / lab ideas. Every slide lands in exactly one section.
- **Data:** live in the browser by default. Offline training only in the read-only WSL env (or a venv that inherits it). Anything the page computes itself is labelled "this page's own".
- **PDF export + NotebookLM prompt:** Read + Play only; stub `window.print` in tests; check the PDF text with `pdftotext`; a single prompt plus a two-part variant.
- **Accuracy traps:** each one names its slide, quotes the slide, and says what to check. Discrepancies become `slideNote` "Slide check" notes and are never silently fixed.
- **Subagent budget:** roughly 7–10 agents, with a hard cap. Transcribers, auditors and re-auditors are fresh agents, not forks.
- **Process phases, verification gates** (lint, build, page-check, maths check) **and wrap-up:** a vault dev log, the project note, a one-line memory update, and a final summary that pastes the NotebookLM prompts.
- **Known gotchas:** backslash-stripping heredocs, CRLF line endings, the ESLint hook rules, puppeteer resolving only inside the repo, WSL path rules, and ports.

## James's standing preferences
- **Short and visual:** labs follow Lecture 8's principles (picture first, ≤ 3 controls, story mode). Notes use proper sentences, four pen colours, no handwriting font, and a tight budget.
- **No asking:** he leaves these builds running, so a brief must never require confirmation.
- **Git:** the work must finish on `main`, with no leftover branches. Don't push.
- **What to tell him when a brief is done:** briefly, how to start it (bypass-permissions mode, computer awake) and what it will do.
