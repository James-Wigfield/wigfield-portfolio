# Build: CITS5017 Lecture 9 (Reinforcement Learning): Study Module

## Who this is for and what you're building

I'm a uni student taking CITS5017 Deep Learning. My personal React portal (this repo: Vite + React 19) has a **Deep Learning** section with one study module per lecture. Each module is one continuous page that I work down in focus mode, in slide order:

> I read a short explanation, play with an interactive visual until the idea clicks, then copy a page of notes into my paper notebook, and move on.

Build **the module for the last lecture of the unit**: `Documents/cits5017/lectures/cits5017-lect09-Reinforcement-learning.pdf`. It has 69 slides, covers Chapter 18 of Géron's *Hands-On Machine Learning* (3rd ed.), and its title is "Topic 9: Reinforcement Learning".
- **The PDF is currently untracked in git**, unlike every other lecture PDF.
- **I haven't studied this topic yet, and the exam is close.** It has to teach me the material well and quickly.

**The template is the Lecture 8 study module**, the best one so far: "Lecture 8 · Transformers (Study)", `/portal/dl-lecture-8-study`, `src/components/portal/modules/deep-learning/lecture8-study/`. Copy everything that made it work:
- the shell and focus mode;
- Read → Play → Write per section;
- **its lab design** (visual, inviting, picture-first);
- its notebook-page format, including **the freedom to add diagrams and tables where they help**;
- the PDF export with its NotebookLM prompts;
- its checks.

**Exam context.** Read `Documents/temp/past-exam-info/exam-information.md`. In short:
- the exam is closed-book, 2 hours, 4 questions × 20 marks, and covers topics 1–9;
- "Sections in the textbook that are not covered in the lecture notes won't be examined";
- "There won't be any large block of Python coding … you are likely to be given a block of code and you need to draw a diagram or give explanation."

This deck has a lot of code (policy gradients, Q-value iteration, DQN), so **make "explain this code / draw this diagram" a first-class skill in this module** (see "Exam-style code cards").

Three things matter above everything else:

1. **Every piece of content in the lecture is covered, and all of it is accurate.**
   - Every slide lands in a section, in deck order.
   - Every claim, number, equation, code line and figure comes from the slides, in the slides' own notation.
   - A wrong formula or a made-up number is worse than a missing lab.
2. **The labs make the ideas click quickly and pleasantly**, following Lecture 8's lab principles.
3. **The notebook pages are fast to copy** and carry exactly what's worth memorising for the exam.

> **Note on a saved preference:** your auto-memory has an older rule: "no long-scroll pages, use top tabs". **It doesn't apply here.** Study modules are deliberately one continuous page worked through in focus mode. The other saved rules still apply:
> - no tone-coloured callout boxes or filled pills;
> - VS-Code-style code blocks;
> - no walls of text.

---

## Play: Lecture 8's lab design, applied to RL

Read the "new lab design" section of the vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`, plus `lecture8-study/stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`, `useWidth.js`, `stage.css` and two or three of its labs. Copy that kit and follow its ten rules:

1. **One idea per lab, visible in five seconds.** Labs open on their "aha" state.
2. **Picture first, numbers on demand.** Hover tips, plus a collapsed **"Show the maths"** drawer in the slides' exact notation.
3. **Direct manipulation, at most 3 controls.** Act on the thing itself: push the cart, drag γ, click a state.
4. **Story mode for processes.** ▶ plus 3–6 named beats, one sentence each. Under reduced motion, show end states.
5. **One running example per strand:**
   - **CartPole** for the policy side (slides 16–37) and the DQN (61–67);
   - **Figure 18-8's three-state MDP** (s0, s1, s2; actions a0, a1, a2; +10, −50 in "the fire", +40) for the value side (41–57).
6. **Tiny, honest numbers.** Anything the page computes itself is labelled "this page's own".
7. **Text budget:** a title, a one-line "Try this" (*predict → change → notice*), and at most two caption sentences.
8. **Quiet optional challenges** with a ✓ when achieved, e.g. "Keep the pole up for 100 steps yourself", or "Find the γ where s1's best action flips to a2".
9. **One visual vocabulary**, defined once as CSS tokens per theme, for the RL roles:
   - agent, environment, state/observation, action, reward (positive vs negative), return/discount, policy, value/Q-value;
   - a Q-table as a heatmap, an MDP as states and arrows whose thickness is the probability, and rewards as signed markers.
10. **Accuracy is non-negotiable.** Every visual's meaning matches the slides.

**Prototype first.** Build two labs before the rest, then build the others in the same visual language:
- the **Figure 18-8 Q-value iteration lab** (§12);
- the **live CartPole** lab (§4).

Screenshot both at 1440 and 390 in all three themes and critique them against the ten rules, including the five-second test.

### Exam-style code cards (new for this module)
In the sections whose slides carry code, add a small, quiet **"Explain this code"** card after the lab:
- `basic_policy` and the 500-episode loop;
- the policy network;
- `play_one_step` with its `y_target` line;
- `discount_rewards` / `discount_and_normalize_rewards`;
- the PG training loop;
- the Q-value iteration loop;
- `epsilon_greedy_policy`;
- `sample_experiences`;
- `training_step`;
- the DQN training loop.

Each card:
- shows **a few verbatim lines** from the slide (VS Code `Code` block), and asks one exam-style prompt, e.g. "What does `y_target` encode, and why is it 1 − action?" or "Draw the data flow of `training_step`";
- hides a **model answer** behind a click: 3–5 short sentences, or a small line-art diagram, built only from what the slides say.

Keep cards short; they're practice, not more reading. They print in the PDF with their answers.

---

## Write: notebook pages in Lecture 8's format

Use `lecture8-study/SheetPage.jsx`, `sheet.css` and the `sheets/index.js` schema. That means:
- **Layout by idea.** A blue sub-heading with its slide range, the lines, and *right there* the diagram, boxed formula, worked number, table or numbered steps that belong to it.
- **Proper short sentences**, with no student shorthand and no handwriting font.
- **The four pens:**

  | Pen | Used for |
  |---|---|
  | **Blue** | headings |
  | **Black** | body, line-work, formulas and numbers |
  | **Red** | bullet markers and step numbers only |
  | **Green** | sparing highlights |

- self-test questions in the margin;
- tick-as-you-copy with stable keys;
- the grey **"Not in these notes (see Read): …"** line where a page leaves things out;
- no notebook page for the intro and summary sections.
- **Diagrams and tables are welcome where they genuinely help memory**, as in Lecture 8. Each must be copyable in a minute or two.

**Notes budget.**
- **Read and Play cover everything; the notebook carries what's worth memorising.**
- Aim for roughly **3–8 lines per content section** and **under ~100 lines across the module**. Diagrams and tables don't count against the line budget, but each must earn its place.

**Core (in the notes):**
- the agent/environment/observation/action/reward loop and the objective (maximise expected long-term rewards);
- what a policy is, and stochastic vs deterministic;
- policy search: brute force, genetic algorithms (the 100 → 20 survivors × 4 offspring example), policy gradients;
- CartPole's four observations and two actions;
- `env.step()`'s five return values;
- the credit assignment problem;
- the **discounted return** with slide 26's worked example (γ = 0.8; 10, 0, −50 → −22);
- what γ near 0 vs near 1 means;
- **action advantage** (normalising returns);
- **REINFORCE's four steps**;
- Markov chains and the transition matrix (rows sum to 1);
- MDPs;
- **the Bellman optimality equation**;
- **value iteration** and **Q-value iteration** (formulas);
- the optimal policy as argmax Q;
- slide 49's γ = 0.90 vs 0.95 result;
- **the TD update**, TD target and TD error;
- **the Q-learning update**;
- off- vs on-policy;
- **ε-greedy** and its decay;
- approximate Q-learning, DQN and **the DQN target y(s,a)**;
- the replay buffer;
- catastrophic forgetting;
- why RL is hard.

**Good diagram and table candidates:**
- the agent–environment loop;
- Figure 18-8's MDP, simplified;
- a returns-and-discounting strip (Figure 18-6);
- a value-based vs policy-based **table** (PG vs Q-learning: on/off-policy, what's learned);
- the DQN training-step flow (sample batch → next Q → max → target → masked Q → loss → gradient step).

**Light (one line at most):** RL's history (TD-Gammon, Atari 2013, AlphaGo 2017, Google buying DeepMind); the thermostat/trader/maze examples; installing Gymnasium; `render()`; `show_one_episode` and the animation code; the training-loop debug prints.

---

## Where things are

| What | Path |
|---|---|
| **The source of truth** (69 slides; untracked; see Git) | `C:\Users\james\Documents\personal-projects\wigfield-portfolio\Documents\cits5017\lectures\cits5017-lect09-Reinforcement-learning.pdf` |
| **Exam information** | `C:\Users\james\Documents\personal-projects\wigfield-portfolio\Documents\temp\past-exam-info\exam-information.md` |
| **The template module** (copy it, never edit it) | `src/components/portal/modules/deep-learning/lecture8-study/` |
| The template's tools (copy and adapt) | `tools/dl-lecture8-study/` (`page-check.mjs`, `pdf.mjs`, `shot.mjs`, `check-attn.mjs` as the pattern for a maths check) |
| How Lecture 8 was built (lab rules, gotchas) | vault log `03-Dev-Logs/2026-10-22-dl-lecture8-study.md`; brief `Documents/temp/prompt-dumping/build_lecture8_study_module.md` |
| Transcript format to match | `Documents/cits5017/markdown-lecs/lecture-8.md` |
| **The unit's TensorFlow environment** (read before running any Python) | `C:\Users\james\Documents\university\cits5017\cits5017-project-two\documents\ENVIRONMENT_SETUP.md` |
| Module registry (add one entry) | `src/components/portal/registry.js` |
| Shared lecture kit | `.../deep-learning/kit.jsx` + `kit.css`, `common.css` |
| Obsidian vault (see Wrap-up) | `C:\Users\james\Documents\james-claude-brain` |

### Reading the slides
- Text: `pdftotext -layout -f N -l N <pdf> -`. **Warning:** pdftotext garbles this deck.
  - It drops γ, ε, α, π, θ, δ, the stars on V\*/Q\*/π\*, the primes on s′/a′, Σ/max/argmax with their subscripts, and "←" (slides 3, 26–28, 39, 43–46, 51, 53, 57–60).
  - It loses code indentation (slides 22, 32–36, 48, 61–64).
  - It mangles the charts on slides 54, 55 and 65.
- Images: `pdftoppm -png -r 110 -f N -l N <pdf> <scratchpad>/slide`, then look at them with the Read tool. **Read every slide as an image**, including Figures 18-1 to 18-9 and every equation.
- Don't embed slide renders in the page; rebuild figures as SVG and labs. The slides mention demo videos (`cits5017-lect09-demo-CartPole*.webm`); they aren't in the repo, so don't reference them as if they were. The live CartPole lab replaces them.

---

## Ground rules

- **Don't modify any other module or its tools.** That includes `lecture1/`, `lecture2/`, `lecture3/`, every `lecture*-study/` folder, `lectures1-2-refresher/` (another Claude instance may be building it right now), `arcade/`, `codelab/`, `game/` and `project2/`. The only existing files you may touch are `registry.js`, plus `icons.jsx` if you truly need a new icon.
- **Copy, don't refactor.** Copy what you need from `lecture8-study/` into the new folder; don't import across modules.
- **Do the whole build in one go, unattended.** I'm away from the computer and nobody will answer.
  - **Start building straight away.** Don't present a plan for approval, don't enter plan mode, and don't ask clarifying questions at the start or at any point.
  - If something blocks you, make the safest reasonable choice, write it down for the final summary, and carry on.
  - Don't end your turn until everything is merged into `main` (see "Git") and the final summary is written.
  - The only thing you must *not* do on your own is push to GitHub.

---

## Git: build in your own worktree, finish on `main`

I want the final result **on `main`, with no branch or worktree left behind**. Another Claude instance may be working directly on `main` in the main folder (the Lectures 1–2 refresher), so **always build in your own worktree**:

1. **Create the worktree:** `git worktree add ../wigfield-portfolio-dl9s -b tmp/dl9s-rl main`.
   - Run `npm install` there, and start its dev server on port **5180** (`npm run dev -- --port 5180`). Point every check script at it (`SITE_URL`).
   - Copy the untracked lecture PDF from the main folder into the same path in your worktree, and **commit it** with the module, since every other lecture PDF is tracked.
2. **Commit in your worktree** at sensible milestones. Every commit must leave `npm run build` passing.
3. **At the end, merge into `main`** with `git merge --no-ff tmp/dl9s-rl -m "Merge: Lecture 9 (Reinforcement Learning) study module"`, in the working tree that has `main` checked out (normally the main folder `C:\Users\james\Documents\personal-projects\wigfield-portfolio`).
   - **Only merge if that tree is clean** apart from untracked `Documents/temp/` files and the untracked lecture PDF.
   - **The PDF gotcha:** the main folder has the lecture PDF *untracked*, so the merge would refuse to overwrite it. Check it's byte-identical to your committed copy (`git hash-object` on both), delete the untracked copy, then merge.
   - **If the tree has someone else's uncommitted changes**, another instance is probably mid-build. **Wait and retry**: re-check every ~5 minutes for up to ~60 minutes (use a Monitor or an until-loop; don't spin). Merge as soon as it's clean.
   - If it never comes clean, don't touch it. Put the exact merge command in the **first line** of your summary.
   - **Conflicts:** keep every `registry.js` entry, in lecture order. For any other conflict, run `git merge --abort` and report it in the first line of your summary.
4. **After merging:** run `npm run build` and your page check against a dev server serving `main`. If anything fails, fix it with a follow-up commit on `main`. Never force, reset or rewrite history.
5. **Clean up:** stop your dev server, run `git worktree remove ../wigfield-portfolio-dl9s`, and run `git branch -d tmp/dl9s-rl`. Then confirm with `git worktree list` and `git branch` that nothing from this build is left.
6. **Don't push.** End the summary with "`main` is N commits ahead of `origin/main`".

Don't commit anything new from `Documents/temp/`. Only stage files you created or deliberately changed (plus the lecture PDF).

---

## Setup

1. **New folder:** `src/components/portal/modules/deep-learning/lecture9-study/`. CSS prefix `.dl9s-*`. localStorage prefix `dl9s:`. Print class `html.dl9s-printing`. Every storage read and write goes in try/catch.
2. **Register it directly after the `dl-lecture-8-study` entry:**
   ```js
   { id: 'dl-lecture-9-study', label: 'Lecture 9 · Reinforcement Learning (Study)', icon: 'network', group: 'Deep Learning', component: DeepLearningLecture9Study },
   ```
   It will then be at `/portal/dl-lecture-9-study`.
3. **Copy and adapt Lecture 8's module.**
   - Take the shell, the lab kit, `SheetPage.jsx`, `sheet.css`, the `sheets/` schema + `keys.js`, `Rich.jsx`, `hooks.js`, `storage.js`, `context.js`, `ExportPdf.jsx`, `print.js`, `texText.js` and the CSS.
   - **Grep the copies for Lecture 8 leftovers**: `dl8s`, the attention role tokens, the Topic 8 hero, the 51-slide footer, the Lecture 8 outcomes and NotebookLM prompts.
   - Copy `tools/dl-lecture8-study/` to `tools/dl-lecture9-study/`, and set the scripts' default port to 5180.
4. **Where things live.**
   - Maths goes in `rl.js`:
     - discounted returns and normalised advantages (ports of the slides' `discount_rewards` / `discount_and_normalize_rewards`);
     - a Markov-chain step;
     - value iteration, Q-value iteration (a port of slide 48's loop) and argmax policies;
     - TD and Q-learning updates;
     - ε-greedy with the slides' decay;
     - the DQN target with the done/truncated mask;
     - a seeded RNG;
     - a tiny dense network's forward/backward pass.
   - **CartPole physics** goes in `cartpole.js` (see "Data").
   - Slide facts go in `slideData.js`, Read/Play prose in `sections.js`, notebook pages in `sheets/sNN.js`, and the code cards' prompts and answers in `cards.js`.

---

## Section plan (confirm against the slides; merge or split where the slides suggest a better cut)

| § | Section | Slides | Lab ideas (suggestions, built to the ten rules) |
|---|---|---|---|
| 0 | Intro: roadmap & how to use this page | 1–3 | Slide 3's topics as a visual map |
| 1 | RL in a nutshell | 4–5 | A quick timeline (TD-Gammon → Atari 2013 → AlphaGo 2017) and slide 5's three techniques as signposts to their sections |
| 2 | Learning to optimise rewards | 6–10 | **The RL loop:** agent → action → environment → observation + reward → agent, animated; click one of Figure 18-1's five examples to relabel every arrow (robot, Ms. Pac-Man, thermostat, trader, maze) |
| 3 | Policy search | 11–15 | **The vacuum robot:** drag p and r and watch its stochastic trajectory and dust picked up (this page's own simulation); Figure 18-3's four points in policy space mapped to behaviours; a genetic-algorithm generation (100 → keep 20 → 4 offspring each) |
| 4 | OpenAI Gym and CartPole | 16–20 | **Prototype. Live CartPole:** push left/right yourself (buttons and ← →); the four observation values as labelled dials; `step()` returning `obs, reward, done, truncated, info` |
| 5 | A simple hard-coded policy | 21–22 | `basic_policy` driving the cart live, then 500 episodes summarised as a histogram, with slide 22's printed statistics shown as the slides' |
| 6 | Neural-network policies | 23–25 | 4 → 5 (ReLU) → 1 (sigmoid = p(left)), then a coin flip with probability p: exploration made visible; a switch that hides the velocity, to show why a partial observation needs past observations |
| 7 | The credit assignment problem | 26–29 | **Returns strip:** slide 26's rewards (10, 0, −50) with a γ handle, showing the return at each step (γ = 0.8 gives −22); a "half-weight" ruler (0.95 → about 13 steps, 0.99 → about 69); several episodes' returns normalised into advantages (colour = sign) |
| 8 | Policy gradients: REINFORCE | 30–31 | Story mode over the four steps: play episodes and store gradients → score actions → multiply each gradient by its score → average and take a step |
| 9 | Implementing policy gradients | 32–37 | The `y_target = 1 − action` trick visualised; **train live** (in-browser REINFORCE on the JS CartPole, this page's own) with the mean reward per iteration rising, beside the slide's printed "mean rewards: 190.3" |
| 10 | Markov chains | 38–40 | Figure 18-7 with a token hopping between states by the transition probabilities; the matrix row for the current state highlighted; rows sum to 1; s3 absorbing |
| 11 | MDPs, the Bellman optimality equation, value iteration | 41–44 | Figure 18-8 with each state filling with V_k as you step the iterations; the Bellman equation term by term in the maths drawer |
| 12 | Q-values and Q-value iteration | 45–49 | **Prototype. The Q-table:** a 3 × 3 heatmap filling over 50 iterations (impossible actions shown as −∞, hatched); the argmax policy drawn on the MDP; a γ switch (0.90 ↔ 0.95) that flips s1's best action from a0 to a2, "going into the fire!" |
| 13 | Temporal difference learning | 50–52 | One observed transition at a time: the estimate V(s) moves a fraction α toward the TD target r + γV(s′); the TD error shown as the gap |
| 14 | Q-learning, off- vs on-policy, ε-greedy | 53–57 | A random explorer on Figure 18-8 updating Q-estimates, with a Figure 18-9-style comparison (Q-value iteration converges in under 20 iterations, Q-learning in about 8,000; this page's own run); an ε handle splitting explore vs exploit |
| 15 | Approximate Q-learning | 58–60 | Table vs network: as states and actions grow, the Q-table explodes while Q_θ keeps a fixed parameter count; story mode building the target y(s,a) = r + γ max Q_θ(s′, a′) |
| 16 | Deep Q-learning in Keras | 61–64 | **The replay buffer** as a ring (`maxlen=2000`) filling with 6-field experiences, a batch of 32 sampled; **`training_step` story:** next Q → max → `runs` mask → target → one-hot mask picks Q(s,a) → MSE → gradient step; the ε schedule `max(1 - episode / 500, 0.01)` as a chart |
| 17 | DQN results, catastrophic forgetting, why RL is hard | 65–67 | The page's own DQN learning curve (see "Data") beside the slides' description of the lecturer's run (first max around episode 290, a drop, settling near the max around 550, then collapsing to 100); the conclusion slide's points |
| 18 | Summary | 68–69 | Slide 68's eight outcomes as a persisted self-check, each linking to its section |

---

## Data and real computation

- **CartPole in the browser** (`cartpole.js`): port the CartPole-v1 dynamics so the cart and pole can run live: the four-value state, actions 0/1, reward 1 per step, termination on pole angle or cart position, and the slides' step limits (200 in their loops).
  - The physics constants and equations aren't on the slides. Take them from the Gymnasium source or documentation, cite them in the file header, and label the simulation as **"this page's port of CartPole"**.
  - Use a seeded RNG for the reset states. Run heavy loops (live REINFORCE training, many episodes) in small chunks via `requestAnimationFrame` or a Web Worker, so the page never freezes.
- **Gates that must match the slides exactly** (put them in `check-rl.mjs`):
  - **Slide 49:** Q-value iteration on Figure 18-8 with γ = 0.90 and 50 iterations gives Q-values [[18.91891892, 17.02702703, 13.62162162], [0., −inf, −4.87971488], [−inf, 50.13365013, −inf]] and argmax [0, 0, 1]. With γ = 0.95 the argmax is [0, 2, 1]. Run the slide's own algorithm. **My quick check of slide 48's loop gives 17.02702702 for Q(s0, a1), while the slide prints 17.02702703**; every other value matched to the printed digits. Confirm it yourself, and if that last digit really differs, record it as a quirk (likely float rounding in the slide's run); don't adjust anything to match.
  - **Slide 26:** γ = 0.8 on rewards 10, 0, −50 gives a first-step return of −22.
  - **Slide 28:** 0.95¹³ ≈ 0.5 and 0.99⁶⁹ ≈ 0.5.
- **Offline runs (recommended, time-boxed to about 45 minutes in total).** Read `ENVIRONMENT_SETUP.md`. The unit's env (`tf-2.20-gpu`, WSL Ubuntu: TensorFlow 2.21, Keras 3.15.1) is **read-only: never install into it**.
  - Gymnasium probably isn't in it. Make a **separate venv that inherits it**: `/home/james/miniconda3/envs/tf-2.20-gpu/bin/python -m venv --system-site-packages ~/venvs/cits5017-rl`, then `pip install gymnasium` *into that venv*. Call it by absolute path through `wsl.exe` (see the doc; use `MSYS_NO_PATHCONV=1` from Git Bash).
  - If that fails, a Windows venv (Python 3.12 + `tensorflow==2.21.0` + `gymnasium`, as in `tools/dl-lecture5-study/requirements.txt`) is the fallback.
  - With it, in `tools/dl-lecture9-study/`:
    - **reproduce slide 22's basic-policy statistics** (500 episodes, `reset(seed=episode)`, 200 steps). The slide prints `(41.698, 8.389445512070509, 24.0, 63.0)`. Report whether they match exactly, and the Gymnasium version;
    - **run the slides' PG code** (150 iterations, 10 episodes per update, Nadam 0.01, γ 0.95) and **the DQN code** (600 episodes) as written;
    - **export** the learning curves and the tiny trained weights (31 parameters for the policy network, 1,282 for the DQN by this page's own count; re-derive both), so the page can replay those policies in the JS CartPole.
  - Label every result as **this page's own run**. RL is seed-sensitive (the slides say so), so never present your numbers as the slides'.
  - If the offline route fails entirely, the in-browser REINFORCE and Q-learning runs are enough. Say so in the summary.
- **Data budget:** under ~300 KB in total, lazy-loaded.

---

## PDF export and the NotebookLM prompt

Copy Lecture 8's implementation and adapt it.
- **"Export PDF"** uses a print mode plus `window.print()`.
- **Contents:** every section's **Read + Play**, plus the **exam-style code cards with their answers**.
  - Labs print a finished, deterministic, informative state: the Q-table converged, CartPole as a filmstrip of frames, story labs on their final beat.
  - Every formula prints its plain-text twin. **Extend `texText.js`** for γ, ε, α, π\*, θ, δ, V\*, Q\*, s′/a′, max/argmax with subscripts, Σ over s′, and ←.
- **Left out:** the notebook pages and page chrome. The PDF prints on light paper, A4.
- **The "NotebookLM video prompt ▾" dropdown:** a prompt for a student **new to RL** revising for an exam that will show code and ask for diagrams or explanations.
  - Grounding: use only the PDF; follow its sections in order; use its notation; keep the two running examples (CartPole, and Figure 18-8's MDP).
  - Priorities: the RL loop → policies and policy search → credit assignment and discounted returns (with −22) → REINFORCE → Markov chains and MDPs → Bellman, value and Q-value iteration (with slide 49's γ flip) → TD → Q-learning and ε-greedy → approximate and deep Q-learning (the target, the replay buffer) → catastrophic forgetting.
  - Explain what each code block does in plain words, and end with self-test questions.
  - Also offer a **two-part variant**: part 1 = §0–§9 (policy-based), part 2 = §10–§18 (value-based). Re-check NotebookLM's current Video Overview options with web search; Lecture 8's `exportPrompt.js` records what was true on 2026-10-22. Keep each prompt under ~1,000 characters unless you confirm a larger limit. If web search isn't available, reuse Lecture 8's findings and say so.
- **Testing:** stub `window.print` in every automated check, before the page loads, so a print dialog can't hang this unattended run. Then generate the PDF headlessly and check with `pdftotext`:
  - every section title is present, in order;
  - no notebook text appears;
  - the Bellman, Q-learning and DQN-target formulas read correctly.

  Report the page count and file size.

---

## Accuracy traps I found while scoping (verify each, don't take my word for it)

- **Slide 17's code says `gym.make("CartPole-v1", reader_mode="rgb_array")`.** That's very likely a typo for `render_mode`, and as written it probably won't run. Keep it verbatim, add a **Slide check**, and confirm the behaviour in your offline run if you have one. Slide 17's observation list also has an unclosed "(positive means clockwise.".
- **Slide 22's `totals.append(episode_rewards)`** looks dedented outside the episode loop in pdftotext. Check its indentation on the image before quoting the code.
- **Slide 25 and slide 61** use `input_shape=` inside `Dense` (Keras 3 prefers an `Input`/`InputLayer`). Keep it verbatim, and note any warning your offline run shows.
- **Slide 26's example** is 10 + γ × 0 + γ² × (−50) = −22 with γ = 0.8. The slides' `discount_rewards` gives the full return sequence for those rewards; you may show it as computed by the page.
- **Slide 28:** with γ = 0.95, rewards 13 steps ahead count about half (0.95¹³ ≈ 0.5); with 0.99, about 69 steps ahead. CartPole uses 0.95.
- **Slides 30–31:** REINFORCE (Williams, 1992) in four steps. Keep the slides' wording: multiply each gradient by its action's score, then average and take a step.
- **Slide 32:** `action = (tf.random.uniform([1, 1]) > left_proba)` means action 1 (right) is taken with probability 1 − p(left); `y_target = 1 − action`. The model's single output is p(left) (slide 23). Make every visual consistent with this.
- **Slide 36's** "mean rewards: 190.3" and **slide 22's** statistics are the slides' printed results; yours are your own.
- **Slide 37:**
  - "matplotlib.anomation.FuncAnimation" is a typo; record it, don't fix it.
  - `show_one_episode(pg_policy)` uses `pg_policy`, which is never defined on the slides.
  - The "{" in "# extra code {" (slides 36 and 64) is a typesetting artefact for an en dash, as in the Lecture 4 deck. Write it as "–" and note that.
- **Slide 40's transition matrix** for Figure 18-7: rows are source states and columns are destinations, in the order s0, s1, s2, s3.
  - The slide's example "(row 2, column 3) has probability = 0.9 … from state s1 to s2" counts rows and columns from 1 while the states count from 0. Make that explicit so it doesn't confuse me.
  - Read the matrix from the image.
- **Slides 43–46 and 51–53 equations** (read the stars, primes, arrows and sub-/superscripts from the images):
  - **Bellman optimality:** V\*(s) = max_a Σ_{s′} T(s, a, s′)[R(s, a, s′) + γ·V\*(s′)];
  - **value iteration:** V_{k+1}(s) ← max_a Σ_{s′} T(s,a,s′)[R(s,a,s′) + γ·V_k(s′)];
  - **Q-value iteration:** Q_{k+1}(s,a) ← Σ_{s′} T(s,a,s′)[R(s,a,s′) + γ·max_{a′} Q_k(s′,a′)];
  - **the optimal policy:** π\*(s) = argmax_a Q\*(s,a);
  - **TD:** V_{k+1}(s) ← (1−α)V_k(s) + α(r + γ·V_k(s′)), equivalently V_k(s) + α·δ_k(s, r, s′) with δ_k = r + γ·V_k(s′) − V_k(s);
  - **Q-learning:** Q_{k+1}(s,a) ← (1−α)Q_k(s,a) + α(r + γ·max_{a′} Q_k(s′,a′));
  - **the DQN target (Eq. 18-7):** y(s,a) = r + γ·max_{a′} Q_θ(s′,a′).
- **Slide 52** talks about TD learning converging around "the optimum Q-values", although the update shown is for state values. Record that as a quirk.
- **Slide 54:** Q-learning takes "about 8, 000 iterations" (typeset with a space). The two charts on slides 54–55 print no exact values beyond their axes; describe their shape.
- **Slides 56–57:** Q-learning is off-policy, and policy gradients are on-policy.
  - The sentence "For on-policy algorithms, we need good exploration policies…" sits right before slide 57's "Q-Learning can work only if the exploration policy explores the MDP thoroughly". Check the image carefully. If the two read as contradicting each other, add a Slide check that quotes both; don't rewrite either.
  - ε-greedy starts near 1 and decays to "a small value (e.g., 0.05)", while slide 64's code decays to 0.01. Both are fine; mention both if you show the schedule.
- **Slides 61–62:**
  - Slide 61's comment says the buffer holds 5-field tuples `(obs, action, reward, next_obs, done)`, but `play_one_step` appends 6 fields (including `truncated`), and slide 62 says `sample_experiences` returns 6 arrays. Record it as a quirk.
  - `replay_buffer = deque(maxlen=2000)`.
- **Slide 63:** `runs = 1.0 - (dones | truncateds)`, so the future term is dropped at episode ends. The loss is `mean_squared_error`, though slide 60 says squared error *or* the Huber loss.
- **Slide 64** appends `step` to `rewards`, but slide 65 plots it as "Sum of rewards". Record that as a quirk, not a fix.
- **Slides 65–66** describe *the lecturer's* run ("my output … much worse than that from the textbook"): the last episode scored 100. Present the description as the slides', and your own curve as yours.
- **Wording quirks to record, not fix:**
  - "Chapters 18." (slide 2);
  - slide 19's "accelerating the robot left" (it's the cart);
  - slide 23's garbled "create a policy to move the e.g., a network as shown";
  - slide 41's "Bellman.They".
- **Footnote:** Williams (1992) on slide 30 goes in `REFS` with `Fnote`.
- Use `slideNote` ("Slide check") for every real discrepancy. **Never silently "correct" the slides.**

## Content rules
- **Accuracy over flair.** Every claim, number, equation and code snippet comes from the slides. Short intuition that explains a slide is welcome; new syllabus content isn't (the exam note says sections not in the lecture notes aren't examined). Common RL knowledge that isn't on the slides stays out, or is labelled as beyond the slides when a lab genuinely needs it (e.g. the CartPole physics constants).
- Keep the deck's names (`basic_policy`, `play_one_step`, `play_multiple_episodes`, `discount_rewards`, `discount_and_normalize_rewards`, `transition_probabilities`, `rewards`, `possible_actions`, `Q_values`, `epsilon_greedy_policy`, `replay_buffer`, `sample_experiences`, `training_step`, …) and calls exactly as written. Code is verbatim: fix pdftotext's wrapping and indentation against the images.

## Design rules
- Same as Lecture 8: portal theme tokens; all three themes (Jade, Coral, Arcade/dark); pen colours tuned per theme (contrast of at least 4.5:1); no coloured left-border callouts and no filled pills (including token boxes and the code cards); VS Code `Code` blocks; `prefers-reduced-motion` respected (CartPole shows still frames or a filmstrip; story labs jump to their end); everything keyboard-reachable (CartPole controls, sliders, story steps, Q-table cells); no emoji.
- It must work at laptop width, in fullscreen, and at 390px wide with no horizontal page scroll.

---

## Subagents: use them for accuracy, coverage and lab quality, within a sensible budget

Aim for about **9 agents in total**, and treat **12** as a hard ceiling.
- Prefer one well-briefed agent over several overlapping ones.
- Don't re-audit unchanged content.
- Launch independent agents in one message so they run in parallel.
- Give each a self-contained brief.
- Use fresh general-purpose agents (not forks) for audits.

A sensible allocation:

| Phase | Agents | Job |
|---|---|---|
| Ground truth | **2 transcribers** | Slides 1–37 and 38–69. They write `Documents/cits5017/markdown-lecs/lecture-9.md` in `lecture-8.md`'s format, which you merge: every equation in LaTeX exactly as typeset, code with correct indentation, every figure described (Figure 18-7's and 18-8's states, arrows, probabilities and rewards), and a **Quirks** list |
| Ground truth | **1 offline-run agent** | Reads `ENVIRONMENT_SETUP.md`; makes the separate venv; reproduces slide 22's statistics; runs the slides' PG and DQN code; exports the curves and weights; reports versions, seeds and time |
| Build (optional) | **Up to 2 lab builders** | Only after you've built the two prototypes and fixed the visual language |
| Audit | **3 auditors** | Content fidelity + coverage · numbers + maths (re-derive every formula, every gate, the code-card answers, every "page's own" label) · learning design + visuals (the ten rules, the five-second test, reduced motion, 390px, the notes budget, the code cards, the PDF, the NotebookLM prompts) |
| Re-audit | **1 re-auditor** | Only what changed |

## Process
1. **Git and setup** (see "Git"). Start the transcribers and the offline-run agent first, so they run while you orient.
2. **Orient.**
   - Check the vault's project note (`01-Active-Projects/wigfield-portfolio-management-portal.md`), as the repo `CLAUDE.md` asks, and the Lecture 8 dev log.
   - Read the exam-information note.
   - Read every file in `lecture8-study/` and `tools/dl-lecture8-study/` yourself.
3. **Visual language and prototypes:** the RL role tokens, then §4 (live CartPole) and §12 (the Q-table) built completely, Read → Play → Write → code card. Screenshot them, critique them against the ten rules, and iterate until they're clearly inviting.
4. **Remaining sections**, then the PDF export and the NotebookLM prompts.
5. **Audit, fix, re-audit.** Fix every **wrong**, **misleading**, **missing** and **overwhelming** finding, or justify it in the summary.
6. **Verify.**
   - Adapt `page-check.mjs`. It checks:
     - render and coverage of slides 1–69;
     - every lab mounts, and every code card reveals its answer;
     - pens, contrast and no handwriting font;
     - focus mode;
     - ticks persist across a reload, and "Resume at §N" works;
     - the page renders with localStorage throwing and with reduced motion;
     - keyboard operation of the §4 and §12 labs;
     - the stubbed export plus `afterprint`, and the PDF's text;
     - the NotebookLM dropdown;
     - 3 themes × 1440/390 with no horizontal scroll;
     - every other Deep Learning module still renders.
   - Add `check-rl.mjs`:
     - slide 49's Q-values and both argmaxes;
     - −22, plus the 0.95¹³ and 0.99⁶⁹ claims;
     - the TD and Q-learning updates on a hand-worked transition;
     - ε-greedy's decay;
     - the DQN target with done/truncated;
     - transition-matrix rows summing to 1;
     - CartPole termination conditions;
     - parameter counts;
     - every code card quoting its slide verbatim.
   - Lint the new folder, `registry.js` and the tools folder clean, and run `npm run build`.
7. **Wrap-up, then merge into `main`** (see "Git").
   - **Vault:** create a dev log in `03-Dev-Logs/` from the template in `05-Templates/`, and add the module to the Deep Learning entry in `01-Active-Projects/wigfield-portfolio-management-portal.md`, with `[[wikilinks]]`.
   - **Memory:** add one line to your auto-memory's Management Portal pointer.
   - **Final summary:**
     - what was built: sections, lab count, code cards, notebook lines, diagrams and tables;
     - what you left out of the notes and why;
     - every Slide check and why;
     - the slide-49, −22 and slide-22 gates (matched or not, with versions);
     - what the offline runs produced (real vs page's own);
     - the PDF's page count and size;
     - **the NotebookLM prompts, pasted in full**;
     - decisions you made;
     - anything unverified;
     - the subagents used;
     - **the final git state**: merged, `main` N commits ahead of `origin/main`, no worktree or branch left.

### Known gotchas in this repo
- Bash heredocs and `node -e` strip backslashes on this machine, which breaks KaTeX strings. Write scripts and data with the Write/Edit tools.
- Vite sometimes misses files written by scripts; `touch` them after scripted edits.
- Files are CRLF (`core.autocrlf true`).
- ESLint: react-hooks forbids `setState` directly in an effect body (do it in callbacks/timers/rAF), and react-refresh allows only component exports from `.jsx` files (put helpers in `.js`).
- puppeteer-core only resolves from inside the repo (e.g. `tools/dl-lecture9-study/`), not from a scratchpad folder.
- pdftotext garbles KaTeX, so every formula needs a plain-text twin in print (`texText.js`).
- From Lecture 8: a lab that early-returns a loading state without its measured wrapper never gets a width from `useWidth(ref)`. Keep the measured element mounted in every branch.
- **WSL from Windows.**
  - Bare `python`/`conda`/`pip` aren't found in non-interactive WSL shells, so always use absolute binary paths.
  - Put non-trivial code in `.py` files.
  - Set `MPLBACKEND=Agg`.
  - Prefix the command with `MSYS_NO_PATHCONV=1` from Git Bash.
  - Don't try to "fix" the expected CUDA warnings.
- Port 8787 belongs to another project. 5173 is the main folder's dev server; your worktree uses 5180.
