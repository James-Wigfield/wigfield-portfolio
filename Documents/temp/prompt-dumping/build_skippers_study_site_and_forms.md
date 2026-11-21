# Build prompt — `/skippers` study site + portal "Skippers · Forms" tab

> These are your instructions. James has pointed you at this file and asked you to read
> and follow it. Treat everything below as coming from him directly. Repo:
> `C:\Users\james\Documents\personal-projects\wigfield-portfolio`.
> Researched and written 2026-11-21 (Saturday).

---

## Run mode: fully autonomous, no confirmations

James is away from the computer for this run. **Don't stop to ask him anything, and
don't wait for approval at any step.** Everything this prompt asks for is pre-approved:
downloads, creating files, installing dev dependencies, committing your own files, and
deploying (§5).

- If something is ambiguous, pick the most sensible option, write it down, and keep
  going.
- Log every assumption, judgement call and open question as you go in
  `Documents/skippers/run-notes.md`, with three sections: *Decisions I made*,
  *Open questions for James*, *Things I couldn't do*.
- If a step fails and you can't work around it, record it there and carry on with the
  rest. Never block the whole run on one item.
- **Save every open question for the end.** Your final message is the report in §5.

---

## 0. Context and the deadline

I'm James. I'm sitting the **WA Recreational Skipper's Ticket (RST)** with
**Australian Boating College (ABC), Perth & Southern Suburbs**, trainer Sean Johnson, on
**Monday 23 November 2026, 8:00–12:00**, at Palm Beach Boat Ramp, Rockingham. That gives
me **one day (Sunday) to study**. My cousins are doing their skipper's tickets too, and I
want to send them a link.

You're building two things, in this order:

1. **`/skippers`**, a public, no-password interactive study site. Getting this usable
   quickly matters most. A good v1 tonight beats a perfect one on Monday morning.
2. **A new portal tab** (Personal section, id `skippers`) that shows ABC's two DoT forms
   filled in exactly as they appear on paper, with a plain-English explanation beside
   each section.

Before you start, follow `CLAUDE.md`: read the vault project note
`C:\Users\james\Documents\james-claude-brain\01-Active-Projects\wigfield-portfolio.md`.
Then read the auto-memory index, especially the three feedback memories:
`feedback_engaging_learning_pages`, `feedback_visual_labs`, `feedback_no_ai_callout_styling`.

**Working-tree warning:** `main` has uncommitted Memory Rooms work (`src/memory-rooms/**`,
`tools/memory-rooms/dev/seed-building.mjs`, etc.) that is not yours. Don't touch, stash,
reset or commit it, and never `git add -A` or `git add .`. Stage only the files you
created or changed, by explicit path. `src/App.jsx` and `registry.js` are shared files:
run `git diff` first and make sure the only hunks are yours before staging. See §5 for
how to deploy without shipping that work.

---

## 1. What the research found (verified 2026-11-21, so you don't need to redo it)

### 1.1 The exam (from ABC's Perth Southern course page)
- **Theory:** the DoT standard closed-book **40-question multiple-choice test**.
  **Pass = 34/40.** A score of 30–33 allows **one free resit the same day**, after going
  over mistakes with the trainer. Under 30 means rebooking another day (no extra cost).
- **Practical:** **11 on-water tasks**, scored on a DoT structured point system. The
  formal assessment takes about 10–15 minutes, after training on the boat:
  1. Situational awareness and general seamanship
  2. Securing the boat to a pontoon
  3. Performing a safety briefing to your passengers
  4. Pre-start checks and starting the motor
  5. Logging on (radio)
  6. Departing the berth
  7. Person overboard
  8. Steering a transit
  9. Controlled stop
  10. Docking the boat
  11. Logging off

  All of these are done while applying the collision regulations.
- ABC's own advice (registration email): *if you can do the last quiz repeatedly and get
  more than 90%, you should pass on the day.* So the site's readiness target is
  **≥ 36/40 on repeated full mock exams**.
- Day-of logistics (generic ABC info, fine to show publicly): bring an **Australian
  driver's licence or learner's permit as ID**, a water bottle and a hat, and wear closed
  shoes. A ~$37 DoT recording fee is paid at the end once you pass (DoT pages show
  $34.15–$36.90, so say "about $37, check on the day"). You get an interim ticket on the
  day; the card is posted. If you have no licence: other ID (workbook p.8) **plus** the
  eyesight declaration, done by an optometrist before the day. Under 18: parent/guardian
  letter of consent.

### 1.2 ABC's online course (not accessible yet)
ABC gives booked students a private online course (videos, lessons, multi-attempt
quizzes, a final readiness quiz, 3–4 hours). The login arrives in a **separate email to
my personal Gmail**, which hasn't come through yet. I've decided: **build without it.**
Base the content on the official DoT workbook, which is what the exam is set from. Leave
a clearly named, empty hook (e.g. an `abcCourse` entry in the content index plus a short
`README` note) so ABC's module list can be folded in later. **Don't try to log in to
anything.**

Public ABC resources you can use:
- Perth Southern course page (exam rules, the 11 tasks):
  https://abcboating.com/training-centres/western-australia/perth-southern-suburbs-courses/
- Public practice quiz, **82 questions**: https://boatquiz.abcboating.com/wa-quiz-1
- Training videos (on plane, solo launch, docking in wind, man overboard, ramp prep,
  lat/long off a chart, boating at night, bar crossing):
  https://abcboating.com/other-courses/how-to-train-videos/ . Link out to these;
  don't embed or rehost them.
- ABC's "Pre Study Guide" is the **2023** DoT workbook
  (`/wp-content/uploads/2023/11/MAC_P_RST_Workbook2023.pdf`). It's out of date. Use the
  2026 edition below, which wins on any conflict.

### 1.3 The source of truth: DoT RST Workbook, 8th edition (July 2026), 124 pages
https://www.transport.wa.gov.au/getmedia/4ca427b2-485e-49be-ab4d-f33014ef8e49/MAC_P_RST_Workbook2026.pdf

I approve downloading it (and the companion *Boating Rules at a Glance*:
https://www.transport.wa.gov.au/mediaFiles/marine/MAC_B_BoatingRulesAtAGlance.pdf) into
`Documents/skippers/source/`. Read it **cover to cover** before writing content. Every
fact on the site must trace to a workbook page.

Workbook chapters (printed page numbers):

| # | Chapter | p. |
|---|---|---|
| 1 | The Recreational Skipper's Ticket | 5 |
| 2 | Rules and Regulations | 11 |
| 3 | Collision Avoidance | 27 |
| 4 | Navigation Lights | 31 |
| 5 | IALA Buoyage | 37 |
| 6 | Maintenance | 43 |
| 7 | Safety Equipment | 49 |
| 8 | Safe Operations | 73 |
| 9 | Emergencies | 83 |
| 10 | Practical Assessment | 91 |
| 11 | Appendices | 115 |

### 1.4 Topics the exam pool clearly covers (from the stems of ABC's 82 public questions)
Use this as a **coverage checklist**. Every item needs a lesson and quiz questions:
- Who needs an RST (any recreational vessel over 6 hp; covers PWCs; not commercial);
  minimum age 14 and the **under-16 restrictions**; minimum age for a dinghy with a
  small motor; which craft don't need registering; where rego numbers and the annual
  label go.
- Speed and distance rules: **8-knot limits** near other vessels underway; near
  swimmers, jetties, beaches and moored or anchored boats; PWC freestyle distances;
  diver-below flag (Flag Alpha) distance; lights for night diving.
- Navigation lights: masthead (225°, white), sidelights, sternlight, all-round white;
  identifying a ~6 m power vessel from ahead, starboard and astern at night; anchor
  light; small sailing craft; power vessels under 7 m; why deck and cabin lights stay
  off at night.
- Sound signals (horn blasts and what each means).
- Water-skiing: minimum ages, the observer's duties, ski-area pick-up and drop-off zones.
- Right of way at jetties (approaching from opposite or the same direction).
- Who to call for marine fuel spills or serious incidents; fuel tank and fuel system
  maintenance intervals; fire extinguishers (when, and why dry chemical); battery
  ventilation.
- Required safety gear by area: wind waves vs swell; what **protected waters** are (and
  why Lake Argyle isn't); when flares, an **EVDS + GPS**, an **EPIRB** and an approved
  **marine radio** are required; distance offshore before everyone must wear a PFD;
  the vessel-length rule (≥ 4.8 m).
- Flares: orange smoke (day), red hand flare (night or close in), parachute/rocket
  (long range).
- Radio: which sets need an operator's certificate; 27 MHz and VHF calling and
  emergency channels; **Mayday / Pan Pan / Sécurité**.
- Anchoring: recommended anchor type, minimum rope (scope), why the sand (Danforth)
  anchor needs chain.
- PFDs: levels 50 / 100 / 150 / 275; what a PWC rider needs in protected water vs 3 NM
  offshore.
- Stability: trim, heel, keeping a boat stable; builder's plates; basic vs level vs no
  flotation when holed.
- Buoyage: lateral marks entering vs leaving port (red/green sides), cardinal marks,
  special marks, isolated danger, safe water; **light characters** (red/green lateral;
  white quick-flash groups for cardinals; yellow for special; long-flash white); reading
  marks on a chart.
- Collision regs: crossing (give way to the vessel on your starboard), head-on (both
  alter to starboard), overtaking, power vs sail; reading a vessel's aspect from its
  lights at night ("you see these lights, what do you do?").
- Chart datum.

**Copyright:** don't copy ABC's quiz questions or the workbook's prose and figures
verbatim. Write **original** questions in the same exam style, teach in your own words,
and redraw every diagram as SVG. Short quoted rules (e.g. an exact distance or speed) are
fine, but put the workbook page beside them.

---

## 2. Part A — `/skippers`, the public study site

### 2.1 Route and isolation
- New top-level public route, **no gate**, lazy-loaded like `/courtney-slides` and
  `/films`: `const Skippers = lazy(() => import('./skippers/SkippersApp.jsx'))` in
  `src/App.jsx`, plus `/skippers/*` for deep links (`/skippers/lights`,
  `/skippers/exam`, …).
- Code in `src/skippers/`. Use a **scoped stylesheet** (`.sk` root, `sk-` class
  prefix, tokens scoped to `.sk`). Don't touch `index.css` or `home.css`. Follow the
  `.oly-root` and courtney-slides scoping precedent.
- Make it unlisted: add `<meta name="robots" content="noindex">` while mounted, as
  `/courtney-slides` does.
- **No personal details on this page.** Not my name, booking or address. It's for anyone
  doing the WA RST.
- **Phone-first.** My cousins will mostly study on phones. Check every view at 390 px
  wide as well as 1440.
- Progress is stored in `localStorage` only (`sk:` prefix, every read and write wrapped
  in try/catch). No backend, accounts or Worker changes.

### 2.2 Look and feel: match my portal study modules
Use these as the reference implementations. Read them before designing:
- `src/components/portal/modules/deep-learning/lecture8-study/` is the
  **stage-first lab kit** (`stage.jsx`, `story.js`, `svgParts.jsx`, `svgFill.js`,
  `useWidth.js`, `stage.css`). Its labs follow the 10 rules in `feedback_visual_labs`.
- `src/components/portal/modules/deep-learning/lecture9-study/` is the latest study
  module (section structure, "explain this" cards, print/export).
- `src/components/portal/modules/deep-learning/kit.jsx` + `kit.css` provide Hook / Fact
  / Unfold primitives.
- `src/components/portal/modules/deep-learning/exam-practice/` is the exam-paper UX.
- `src/components/portal/modules/deep-learning/arcade/` (Gradient Arcade) is the
  Leitner-box revision hub.

These live inside the portal's theme tokens. `/skippers` sits outside the portal, so
either import the primitives that have no portal dependency, or **copy** what you need
into `src/skippers/` and re-token it. Never edit the portal originals for this.

Non-negotiable rules from my feedback memories:
- **No long scrolling pages.** Use top tabs or level-select, one concept per view.
- **Never big blocks of text.** One-line hooks, fact cards, collapsibles; the picture
  comes first.
- **No "AI-website" styling:** no coloured left-border rounded callout boxes and no
  filled number pills. Use ruled editorial layouts, small labelled dots, mono micro-labels
  and plain mono counters.
- Make it **exciting**: animated hero, progress marks, a sense of levelling up.
- Pick a nautical identity that's still quiet and editorial, e.g. chart paper, depth
  contours, port red / starboard green / masthead white as role colours. Support light
  and dark.

### 2.3 Information architecture (suggested; improve it if you see better)
Top tabs, each a "level" with a progress tick:

0. **Start here.** How the test works (40 Qs, 34 to pass, resit rule, 11 practical
   tasks), the **one-day study plan** (§2.5), and what to bring.
1. **The ticket and the rules.** Who needs one, ages, rego, speed and distance limits
   (ch. 1–2)
2. **Who gives way.** Collision avoidance and sound signals (ch. 3)
3. **Lights at night** (ch. 4)
4. **Reading the marks.** IALA buoyage (ch. 5)
5. **Boat care, fuel and fire** (ch. 6)
6. **Safety gear by distance.** PFDs, flares, EPIRB, radio (ch. 7)
7. **Safe operations.** Weather, bars, stability, skiing, anchoring, chart datum (ch. 8)
8. **Emergencies.** Mayday / Pan Pan / Sécurité, person overboard, fire, capsize (ch. 9)
9. **The practical: 11 tasks.** Each task as a step checklist with what the assessor
   looks for (ch. 10 + ABC's list), a **safety-briefing script** to say out loud, and
   the radio log-on/log-off wording. Link the relevant ABC video per task.
10. **Exam room** (§2.4)
11. **Night-before sheet.** One printable A4 cram sheet of every number, light and mark.
    Include an Export PDF / print view.

Each study level uses one hook, then 1–3 **visual labs**, then "Numbers to know" fact
cards (each with a `Workbook p.NN` receipt), then a 5-question **check-in quiz** that
feeds the Leitner deck.

### 2.4 Labs that earn their place (stage-first, ≤ 3 controls, story beats)
Prototype **two** first, screenshot them, critique, then build the rest:
- **Lights at night:** a vessel on a dark sea that you rotate (or tap ahead / port /
  starboard / astern). The visible light arcs (225° masthead, 112.5° sidelights, 135°
  stern) are drawn as cones. A challenge mode shows lights only and asks "what is it,
  and what do you do?"
- **Who gives way:** a top-down encounter (crossing / head-on / overtaking /
  power-vs-sail). Play shows the correct manoeuvre. The challenge is to tap the
  give-way vessel.
- **Buoyage:** entering vs leaving harbour; marks appear and you place them on the
  correct side. Cardinals show the "clock" flash groups (Q / VQ: 3 for E, 6+LFl for S,
  9 for W, continuous for N), animated as real light rhythms.
- **Sound signals:** tap to hear or see horn blasts (short and long), then name the
  meaning.
- **Gear by distance:** a slider from shore through protected water to 2, 5 and 20 NM
  offshore, with required gear lighting up. Take every threshold from the workbook and
  **don't guess any**.
- **Flotation when holed:** basic / level / none, showing how the hull floats or sinks.
- **Flare picker:** day / night × near / far → the right flare.
- **Anchoring scope:** a depth slider showing rope out and the angle; chain's job shown.

All labs need correct numbers from the workbook, honest labels and reduced-motion end
states. Draw every vessel, mark and flag in SVG.

### 2.5 The one-day plan (built into "Start here")
A timed route through the levels, about 6–7 hours with breaks, front-loading the
high-yield, easy-to-lose-marks topics: lights, give-way, buoyage, gear by distance,
numbers. Each block ends with its check-in quiz. The plan ends with **mock exams until 3
in a row are ≥ 36/40**, then the night-before sheet. Show the plan as a ruled timeline
with ticks, not cards.

### 2.6 Exam room
- **Original question bank, ≥ 200 questions**, each tagged by topic and workbook page,
  covering every item in §1.4. Include image questions (lights, marks, encounters)
  rendered from the same SVG parts as the labs.
- **Full mock exam:** 40 random questions weighted like the real paper, no feedback until
  the end, scored /40 against the pass line, with the 30–33 resit band shown.
  Review shows the explanation and workbook page for every miss.
- **Topic drills** and a **Leitner "weak spots" deck** (Gradient Arcade pattern):
  missed questions come back sooner.
- A readiness meter: the last 3 mocks against the 36/40 target.
- Validate the bank with a script: unique ids, exactly one correct answer, every
  question has a topic and page, topic coverage counts against §1.4.

---

## 3. Part B — portal tab "Skippers · Forms"

### 3.1 Wiring
- Module folder `src/components/portal/modules/skippers/`, entry in
  `src/components/portal/registry.js`: `{ id: 'skippers', label: 'Skippers · Forms',
  icon: <add an anchor icon to icons.jsx — single-colour SVG, no emoji>, group:
  'Personal', component: SkippersForms }`.
  Deep links: `/portal/skippers/eyesight`, `/portal/skippers/consent`.
- Link to `/skippers` from the tab header ("Study site →").

### 3.2 The two source forms (both in `Documents/portal/skippers/`)
1. **`Eyesight Declaration for Non MDL holders.pdf`**, 2 pages (DoT ref
   `09-11-14-RST-0626-WEB`):
   - p.1 "Declaration of Medical Fitness": *Applicant's Details*; *Applicant's
     Declaration of Medical Fitness* (condition tick boxes: epilepsy/fits/giddiness/
     fainting/seizures, heart disease, high/low blood pressure, arthritis, diabetes,
     other physical or mental disability); *Medical Practitioner Declaration*
     (unfit / fit / fit with conditions + conditions lines, signature, date).
   - p.2 "Eyesight Declaration": *Applicant's Details*; *Optometrist's / Medical
     Practitioner's / Registered Nurse's Declaration* (minimum standard **6/12 in at
     least one eye**; letter-test results right and left, without and with aids;
     HAS NOT met / HAS met with aids / HAS met without aids; signature and date);
     Privacy Collection Notice.
2. **`Letter of Consent for U18s.pdf`**, 1 page (ref `09-11-23-RST-0626`): addressed to
   the Director General, DoT. Fields: family name, other name, number, street, suburb,
   then a Parent / Legal Guardian tick box, name, signature (**no digital signature**),
   date. Privacy notice.

### 3.3 "Presented exactly how they are"
The page must look like the real paper forms, not a re-imagined web form. Recommended
approach: write a tool script (`tools/skippers/render-forms.mjs`) that rasterises each
PDF page to a high-DPI PNG (pdfjs-dist or pdftoppm). Then show each page at A4 aspect
with the filled values **overlaid at measured positions** in a clean "filled in by hand
in blue pen" or typed style. Tick boxes get real ticks. Position the values in a
per-page field map (`fields.js`: x/y as a % of the page) so they scale with the width.
Verify alignment by screenshot at 1440 and 390. The blank forms are public government
documents, so shipping their page images is fine.

Next to each section of each page (a right margin on desktop, inline below the section
on phone) goes a **plain-English explanation**: what the section is for, who fills it
in, whether it applies to me, and what to watch for. Use one or two sentences, plus
a labelled dot for status (`Applies` / `Not needed for James` / `Doctor fills this`).
Leader lines or matching mono numbers (`01 02 03`) connect each note to its section.

### 3.4 How to fill them ("the most logical way")
Decisions already made:
- **I hold an Australian driver's licence**, so **neither form is required for me.**
  Show a ruled status line at the top of each form: *Not required for James — licence
  holder / over 18. Filled as a worked example.* (Still useful for my under-18 or
  unlicensed cousins.)
- **My details go in the applicant fields; parts only someone else can fill get
  realistic EXAMPLE values that are visibly marked as examples** (e.g. a small `EXAMPLE`
  mono tag, or a different ink colour plus a legend).
- Source of my details: the email **"Fwd: Australian Boating College - Course
  Registration."** in my Portara inbox. Read it with the Gmail connector
  (`mcp__claude_ai_Gmail__search_threads` / `get_thread`). If the connector isn't
  available, use tidy placeholders and log it in `run-notes.md`.
  Surname **Wigfield**, other names **James**, suburb **Rockingham**, state **WA**,
  postcode **6168**, contact number and email as on that registration.
- **Privacy:** the portal gate is client-side, so everything in portal source ships in
  the public JS bundle (see the Resume tab memory). My **date of birth and street
  address must never be committed or bundled.** Put them in a small "My details (this
  device only)" editor saved to `localStorage` (`skf:applicant`). The forms show tidy
  placeholders until it's filled, and I'll type them in once. Name, suburb, state,
  postcode, phone and email can live in source (my phone is already public on the Resume
  tab).
- Eyesight / medical, p.1: applicant details filled; **no** condition boxes ticked
  (annotate: "Only tick if one applies. If none, the doctor section isn't needed"). Show
  the doctor section with an EXAMPLE "fit to operate a recreational motor boat" tick and
  an example practitioner, marked "only needed if a condition is ticked".
- Eyesight, p.2: applicant details filled; EXAMPLE results (6/6 right and left without
  aids; leave the "with aids" boxes blank and explain); EXAMPLE optometrist and practice;
  tick "HAS met… **without** aids to vision".
- Consent letter: family name Wigfield, other name James, address from the device-only
  details, Parent ticked, an EXAMPLE parent name, and a date. **Signatures:** never draw
  a fake signature. Leave the line with "Sign here by hand. Digital signatures aren't
  accepted", which is what the form itself says.
- An **Export PDF** of the filled forms (print CSS, or pdf-lib stamping the values onto
  the original PDF) is a nice extra. Do it after everything else works.

---

## 4. Verification (before you commit or deploy)
- `npx eslint` on the new folders only. `npm run build` passes.
- A headless check script per part, in `tools/skippers/`. Use the soak-kit pattern in
  memory `reference_headless_soak_kit`: puppeteer-core + local Edge, and write scripts
  with Write, not Bash heredocs. Load every tab and every lab, run a full mock exam
  programmatically, assert no console errors, assert no horizontal scroll at 390 px, and
  take screenshots at 1440 and 390 in light and dark.
- Portal tab: screenshot both forms in all three portal themes at 1440 and 390, and
  check that every overlaid value sits inside its box.
- Fact check: a script or a manual pass that every "Numbers to know" card and every
  quiz explanation has a workbook page, and spot-check 20 of them against the PDF.
- **Look at your own screenshots and critique them** against the feedback memories,
  then fix what you find. Nobody else is reviewing this run.

## 5. Wrap-up (no confirmation needed for any of it)
1. **Commit** your files only, by explicit path (see the working-tree warning in §0).
   Use one commit per part or one overall, with a normal message ending in the
   `Co-Authored-By` line. **Don't push to GitHub**; list that as a follow-up in the
   report.
2. **Deploy so the `/skippers` link works for my cousins, without shipping the
   uncommitted Memory Rooms work.** `npm run deploy` builds whatever is in the working
   tree, so **don't run it from the main checkout.** Instead:
   - `git worktree add ../wigfield-portfolio-deploy HEAD` (your new commit)
   - in that folder: `npm ci` then `npm run deploy`
   - smoke-test `https://jameswigfield.com/skippers` (and one deep link) in a headless
     browser
   - `git worktree remove ../wigfield-portfolio-deploy`

   If the deploy fails (auth, wrangler, build), don't fight it for long. Record the
   exact error in `run-notes.md` and move on.
3. Update the Obsidian vault (per `CLAUDE.md`): a new note
   `01-Active-Projects/wigfield-portfolio-skippers.md` plus a dated dev log, with
   wikilinks to `[[wigfield-portfolio]]` and `[[wigfield-portfolio-management-portal]]`.
   Add a line to the main project note.
4. Add an auto-memory entry (`project_skippers.md`) with how to add questions, run the
   checks and where the sources live, and a pointer line in `MEMORY.md`.
5. **Final message = the end-of-run report**, short and skimmable:
   - what's live (URLs), what's local only, and the commit hashes
   - check results (lint, build, headless checks, fact-check spot count), with any
     failures quoted
   - screenshot paths for the hero of `/skippers`, one lab, the mock exam, and both
     filled forms
   - everything under *Open questions for James* and *Things I couldn't do* from
     `run-notes.md`. This is the only place you ask him anything.
   - the one thing James has to do himself: open `/portal/skippers` and enter his DOB
     and street address in "My details (this device only)"
