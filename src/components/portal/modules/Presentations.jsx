import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import uwaLogo from '../../../assets/portal/uwa-medical-physics.png';
import psma3d from '../../../assets/portal/psma-3d.gif';
import mambaOutput from '../../../assets/portal/mamba_block_3d-output.png';
import updateReportPdf from '../../../assets/portal/mamba-training-update-runs-1-3.pdf';

/* ============================================================================
   PRESENTATIONS — tabulated slide decks  (University)
   ----------------------------------------------------------------------------
   A tabbed presentation page. Each tab is a dated deck; the deck is a slide-based
   presentation with a UWA Medical Physics banner on every slide and a full-screen
   presentation mode (Fullscreen API on the .pres-stage element). Navigation is
   next/prev buttons, dot jumps, and keyboard arrows (the stage is focusable, and
   it is auto-focused on entering full screen so arrows work there too).

   Adding another deck later is one more entry in DECKS below (a title, a date
   label, and a `slides` array of { kicker, title, body }). The shell — tabs,
   stage, banner, controls, full-screen — never changes.

   Styled with the .pres-* block in portal.css; every colour is a portal theme
   token, so the deck re-skins with the active theme (jade / coral / arcade).
   ========================================================================== */

// Project facts pulled from Documents/honours-project/research_proposal.tex
const PROJECT = {
  title: 'Optimising PSMA PET Segmentation using the Mamba Architecture',
  author: 'James Wigfield (23334375)',
  supervisor: 'Dr. Jake Kendrick',
  cosupervisor: 'Dr. Mubashar Hassan',
  degree: 'Bachelor of Advanced Computer Science (Honours)',
};

// The 08/07/2026 deck — a brief, non-technical progress update.
const HONOURS_UPDATE_SLIDES = [
  /* 1 · COVER */
  {
    kicker: 'Honours progress update',
    title: 'Cover',
    body: (
      <div className="pres-cover">
        <div className="pres-cover__text">
          <p className="pres-cover__eyebrow">Bachelor of Advanced Computer Science (Honours)</p>
          <h2 className="pres-cover__title">{PROJECT.title}</h2>
          <dl className="pres-cover__facts">
            <div><dt>Author</dt><dd>{PROJECT.author}</dd></div>
            <div><dt>Supervisor</dt><dd>{PROJECT.supervisor}</dd></div>
            <div><dt>Co-supervisor</dt><dd>{PROJECT.cosupervisor}</dd></div>
          </dl>
          <p className="pres-cover__date">Progress update · 08 / 07 / 2026</p>
        </div>
        <figure className="pres-cover__figure">
          <img src={psma3d} alt="Rotating whole-body PSMA PET scan" />
          <figcaption>Whole-body PSMA PET — the scans this project segments</figcaption>
        </figure>
      </div>
    ),
  },

  /* 2 · WHY IT MATTERS */
  {
    kicker: 'The problem',
    title: 'Why this matters',
    body: (
      <>
        <p className="pres-lead">
          Prostate cancer can spread through the body. A special scan — a <strong>PSMA PET</strong> scan —
          makes those cancer spots light up, so doctors can find them.
        </p>
        <div className="pres-cards">
          <div className="pres-card">
            <span className="pres-card__k">Today</span>
            <p>Finding and outlining every tumour on a whole-body scan is done largely by hand — slow, and
              different experts draw them differently.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">The goal</span>
            <p>A tool that outlines the tumours <strong>automatically</strong> — faster, and consistent every
              time.</p>
          </div>
          <div className="pres-card pres-card--accent">
            <span className="pres-card__k">The catch</span>
            <p>Tumours can be tiny specks inside a huge scan. The tool has to catch the specks without raising
              lots of false alarms.</p>
          </div>
        </div>
      </>
    ),
  },

  /* 3 · PROJECT AIMS */
  {
    kicker: 'What we set out to do',
    title: 'Project aims',
    body: (
      <>
        <p className="pres-lead">Three aims, in plain terms:</p>
        <ol className="pres-aims">
          <li>
            <span className="pres-aims__n">1</span>
            <div>
              <b>Build a smarter model.</b> Design a new type of AI model (called <em>Mamba</em>) that is well
              suited to spotting tiny tumours inside very large whole-body scans.
            </div>
          </li>
          <li>
            <span className="pres-aims__n">2</span>
            <div>
              <b>Compare it fairly.</b> Test it head-to-head against the current best model (nnU-Net) on the
              same data, so the comparison is honest.
            </div>
          </li>
          <li>
            <span className="pres-aims__n">3</span>
            <div>
              <b>Measure what counts.</b> Judge success by how well it detects real lesions — balancing
              <em> catching every tumour</em> against <em>not crying wolf</em>.
            </div>
          </li>
        </ol>
      </>
    ),
  },

  /* 4 · PREPROCESSING (light skim) */
  {
    kicker: 'Getting the data ready',
    title: 'Preprocessing — done',
    body: (
      <>
        <p className="pres-lead">
          Before a model can learn, every scan is cleaned up and put into the same shape. This whole pipeline
          is <strong>built and tested</strong>.
        </p>
        <div className="pres-flow" aria-label="Preprocessing pipeline">
          {['Load scans', 'Line up CT + PET', 'Resample', 'Normalise', 'Cut into patches', 'Batch'].map((step, i, arr) => (
            <span key={step} className="pres-flow__item">
              <span className="pres-flow__node">{step}</span>
              {i < arr.length - 1 && <span className="pres-flow__arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <p className="pres-note">
          The recipe is copied exactly from the existing nnU-Net baseline, so later comparisons stay fair.
          That's the light part — the two big hurdles came next.
        </p>
      </>
    ),
  },

  /* 5 · ENVIRONMENT SETUP CHALLENGES (main focus) */
  {
    kicker: 'Main focus · the first big hurdle',
    title: 'Getting it to run at all',
    body: (
      <>
        <p className="pres-lead">
          The graphics card (GPU) that runs the model is <strong>brand new</strong>. So new that most of the
          software didn't know how to talk to it yet — getting the environment working was a real fight.
        </p>
        <div className="pres-cards pres-cards--tight">
          <div className="pres-card">
            <span className="pres-card__k">Too new</span>
            <p>The card needed the very latest version of the GPU software; older, standard versions built fine
              but simply refused to run on it.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Silent sabotage</span>
            <p>Installing one library kept quietly swapping out another one it depended on — breaking the setup
              without any obvious error.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Build from scratch</span>
            <p>The core libraries had to be re-compiled from source, aimed precisely at this exact card, rather
              than downloaded ready-made.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Version clashes</span>
            <p>Even the compiler was too new and had to be pinned to an older version before anything would
              build.</p>
          </div>
        </div>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">Outcome</span>
          After working through about five distinct failures, the whole thing is now captured as one tested,
          repeatable recipe — so it never has to be fought again, and it transfers to the hospital's computers.
        </p>
      </>
    ),
  },

  /* 6 · SUCCESSFUL IMPLEMENTATION (main focus) */
  {
    kicker: 'Main focus · the first big win',
    title: 'The core building block works',
    body: (
      <div className="pres-impl">
        <div className="pres-impl__text">
          <p className="pres-lead">
            The first real piece of the model — its core building block — is <strong>built and proven on the
            GPU</strong>. It takes a 3D chunk of a scan, studies it from several directions to gather context,
            and hands it back enhanced.
          </p>
          <div className="pres-metrics">
            <div className="pres-metric"><b>6 / 6</b><span>scan directions verified</span></div>
            <div className="pres-metric"><b>= input</b><span>shape kept, both variants</span></div>
            <div className="pres-metric"><b>~13 ms</b><span>full 6-way pass</span></div>
            <div className="pres-metric pres-metric--accent"><b>~368 MB</b><span>peak memory · 16 GB card</span></div>
          </div>
          <p className="pres-note">
            Every automated check passed. (One variant shows a long first run — that's a one-time compile step,
            not the real speed; warmed up, it's milliseconds.)
          </p>
        </div>
        <figure className="pres-impl__figure">
          <img src={mambaOutput} alt="Terminal output: all checks passed for the 3D Mamba block on the GPU" />
          <figcaption>Actual test output — “ALL CHECKS PASSED” on the RTX 5070 Ti</figcaption>
        </figure>
      </div>
    ),
  },

  /* 7 · WRAP-UP */
  {
    kicker: 'Where things stand',
    title: 'Current state & next steps',
    body: (
      <>
        <div className="pres-status">
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--done">Done</span>
            <ul>
              <li>Data preprocessing pipeline — built &amp; tested</li>
              <li>Environment — solved &amp; documented as a recipe</li>
              <li>Core model block — built &amp; GPU-verified</li>
            </ul>
          </div>
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--next">Next</span>
            <ul>
              <li>Assemble the full network (encoder → decoder)</li>
              <li>Train on labelled scans</li>
              <li>Benchmark against the nnU-Net baseline</li>
            </ul>
          </div>
        </div>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">In short</span>
          The groundwork is done and the hardest setup problems are behind us — the project is ready to move on
          to building and training the full model.
        </p>
      </>
    ),
  },
];

// The 11/08/2026 deck — training runs 1–3: what changed, what improved.
// Slides stay light; the heavy explanation lives in TRAINING_UPDATE_NOTES below,
// rendered under the stage, one note per slide.
const TRAINING_UPDATE_SLIDES = [
  /* 1 · COVER */
  {
    kicker: 'Training update · runs 1–3',
    title: 'Cover',
    body: (
      <div className="pres-cover">
        <div className="pres-cover__text">
          <p className="pres-cover__eyebrow">Bachelor of Advanced Computer Science (Honours)</p>
          <h2 className="pres-cover__title">{PROJECT.title}</h2>
          <dl className="pres-cover__facts">
            <div><dt>Author</dt><dd>{PROJECT.author}</dd></div>
            <div><dt>Supervisor</dt><dd>{PROJECT.supervisor}</dd></div>
            <div><dt>Co-supervisor</dt><dd>{PROJECT.cosupervisor}</dd></div>
          </dl>
          <p className="pres-cover__date">Training update · runs 1–3 · 11 / 08 / 2026</p>
        </div>
        <figure className="pres-cover__figure">
          <img src={psma3d} alt="Rotating whole-body PSMA PET scan" />
          <figcaption>Whole-body PSMA PET — the scans this project segments</figcaption>
        </figure>
      </div>
    ),
  },

  /* 2 · SINCE LAST TIME */
  {
    kicker: 'Since last time',
    title: 'From one building block to a trained model',
    body: (
      <>
        <p className="pres-lead">
          The last update ended with a single working building block. Since then the <strong>full model has
          been assembled and trained end-to-end three times</strong> — and each run taught us something.
        </p>
        <div className="pres-flow" aria-label="Progress since the last update">
          {['Full network assembled', 'Run 1 · first attempt', 'Run 2 · stabilised', 'Run 3 · sharpened', 'Evaluated & archived'].map((step, i, arr) => (
            <span key={step} className="pres-flow__item">
              <span className="pres-flow__node">{step}</span>
              {i < arr.length - 1 && <span className="pres-flow__arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
        <p className="pres-note">
          Each run is 250,000 practice attempts — 12 to 40 hours of continuous computing — with regular pauses
          to test the model on 57 scans it has never seen.
        </p>
      </>
    ),
  },

  /* 3 · THE EXPERIMENTS */
  {
    kicker: 'The experiments',
    title: 'What we changed between runs',
    body: (
      <>
        <div className="pres-cards">
          <div className="pres-card">
            <span className="pres-card__k">Run 1 → 2 · a speed limiter</span>
            <p>Run 1 kept collapsing: rare, giant correction jolts scrambled its learning. We capped how hard
              any single step can yank the model — the chaos disappeared.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Run 2 → 3 · sharper eyes</span>
            <p>Doubled the image sharpness (4 mm → 2 mm pixels), so a small tumour is ~100 pixels instead of a
              3-pixel smudge — and enlarged the model’s viewing window to match.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Run 2 → 3 · fairer penalties</span>
            <p>Run 2 punished a missed tumour 2.3× harder than a false alarm, so the model flagged everything.
              Run 3 made both mistakes cost the same.</p>
          </div>
          <div className="pres-card pres-card--accent">
            <span className="pres-card__k">One crash, survived</span>
            <p>Run 3 was killed 2 hours in by a memory bug. Diagnosed from system logs, fixed with one line,
              resumed with ~20 seconds of progress lost.</p>
          </div>
        </div>
      </>
    ),
  },

  /* 4 · THE RESULTS */
  {
    kicker: 'The results',
    title: 'Better every run',
    body: (
      <>
        <div className="pres-metrics">
          <div className="pres-metric"><b>0.385</b><span>overlap score · run 1</span></div>
          <div className="pres-metric"><b>0.514</b><span>overlap score · run 2</span></div>
          <div className="pres-metric"><b>0.545</b><span>overlap score · run 3</span></div>
          <div className="pres-metric pres-metric--accent"><b>73.5%</b><span>tumours found · past the reference’s 73.0%</span></div>
        </div>
        <p className="pres-lead">
          Run 3 found <strong>108 more real tumours</strong> than run 2 and missed 95 fewer — and for the first
          time, one of our numbers is <strong>past the published reference</strong>.
        </p>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">Fair test</span>
          Runs 2 and 3 were scored with an identical protocol — this improvement is a clean comparison, on less
          than half the training data the reference used.
        </p>
      </>
    ),
  },

  /* 5 · THE RUBBER RULER */
  {
    kicker: 'A discovery',
    title: 'We were measuring with a rubber ruler',
    body: (
      <>
        <p className="pres-lead">
          Our scoring throws away predicted specks smaller than <strong>10 pixels</strong>. But pixels
          shrank when the scans got sharper — so the same rule quietly became a <strong>5× weaker
          filter</strong> for run 3.
        </p>
        <div className="pres-cards">
          <div className="pres-card">
            <span className="pres-card__k">Run 2’s ruler</span>
            <p>10 pixels at 4 mm = <strong>663 mm³</strong> of tissue filtered out.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Run 3, same rule</span>
            <p>10 pixels at 2 mm = only <strong>124 mm³</strong> — run 3 was judged with a far weaker noise
              filter.</p>
          </div>
          <div className="pres-card pres-card--accent">
            <span className="pres-card__k">Measured fairly</span>
            <p>At matched physical size, run 3 beats run 2 on <strong>all three</strong> measures — finding,
              precision, and the balance of both.</p>
          </div>
        </div>
      </>
    ),
  },

  /* 6 · WHAT'S STILL HARD */
  {
    kicker: 'Honest about the gaps',
    title: 'What’s still hard',
    body: (
      <>
        <div className="pres-cards">
          <div className="pres-card pres-card--accent">
            <span className="pres-card__k">False alarms on healthy scans</span>
            <p>Parts of the body glow naturally on these scans. Run 3’s sharper eyes now flag something on
              every cancer-free scan in the test set — the clear next problem to solve.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Precision gap</span>
            <p>The reference is still ahead overall — but it trained on 2× the data, uses five models in
              ensemble, and has an anatomy-aware cleanup step we haven’t built yet.</p>
          </div>
          <div className="pres-card">
            <span className="pres-card__k">Time per experiment</span>
            <p>Sharper scans tripled the cost: run 2 took 12.5 hours, run 3 took 40. The desktop PC is
              becoming the bottleneck.</p>
          </div>
        </div>
      </>
    ),
  },

  /* 7 · NEXT STEPS */
  {
    kicker: 'Where next',
    title: 'Next steps',
    body: (
      <>
        <div className="pres-status">
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--done">Done</span>
            <ul>
              <li>Full model trained end-to-end, three times</li>
              <li>Training instability — solved and measured</li>
              <li>Resolution parity with the reference</li>
              <li>One-command evaluation &amp; archiving pipeline</li>
            </ul>
          </div>
          <div className="pres-status__col">
            <span className="pres-status__head pres-status__head--next">Next</span>
            <ul>
              <li>Fix the ruler — measure in mm³, re-score both runs</li>
              <li>Teach it anatomy — filter natural glow (bladder, kidneys)</li>
              <li>Move to the hospital’s 4-GPU machine, full dataset</li>
            </ul>
          </div>
        </div>
        <p className="pres-outcome">
          <span className="pres-outcome__tag">In short</span>
          Every number improved run over run, one has passed the reference, and the open problems are specific
          and understood — the project scales up from a position of strength.
        </p>
      </>
    ),
  },
];

// Plain-English deep-dive, one entry per slide above. Rendered below the stage.
const TRAINING_UPDATE_NOTES = [
  {
    t: 'What this update covers',
    body: (
      <>
        <p>This deck covers roughly five weeks of work: the first three complete training runs of the Mamba
          model, the experiments between them, one crash, one measurement discovery, and where the results now
          stand against the published reference tool (nnU-Net). The slides stay light on purpose — everything
          on each slide is explained fully in this section, one block per slide.</p>
        <p>If you’d rather listen than read: the button above downloads this update as a PDF report written in
          plain English, ready to drop into NotebookLM to generate a podcast.</p>
      </>
    ),
  },
  {
    t: 'What a “training run” actually is',
    body: (
      <>
        <p>The model learns by practice. It’s shown a piece of a scan, guesses where the tumours are, gets told
          how wrong it was, and adjusts itself slightly. One cycle of that is an <em>iteration</em>; a full run
          here is 250,000 of them — a quarter of a million practice attempts over 12–40 hours on a gaming
          graphics card.</p>
        <p>While it trains, we regularly pause and test it on 57 scans it has never seen. That held-out test is
          how we know it’s genuinely learning rather than memorising, and every result in this deck comes from
          those unseen scans.</p>
      </>
    ),
  },
  {
    t: 'The three experiments, in plain English',
    body: (
      <>
        <p><strong>The speed limiter (run 1 → 2).</strong> Occasionally — about one practice attempt in a
          hundred — run 1’s model received a correction signal thousands of times bigger than normal (one spiked
          to 4,165 when the working range is below 1). A jolt like that scrambles everything learned so far,
          like slamming the steering wheel mid-corner. The fix, called gradient clipping, simply caps how hard
          any one step can pull. Only 1.27% of steps needed capping, but those were exactly the ones wrecking
          run 1.</p>
        <p><strong>Sharper eyes (run 2 → 3).</strong> At 4 mm resolution, a typical small lesion is a smudge
          about 3 pixels across — nearly impossible to outline. Halving the pixel size to ~2 mm gives the model
          five times more detail on exactly the tumours it was getting wrong. Because sharper pixels shrink the
          field of view, the model’s viewing window was enlarged to compensate, so it still sees the same amount
          of the body at once.</p>
        <p><strong>Fairer penalties (run 2 → 3).</strong> The scoring the model learns from used to punish a
          missed tumour about 2.3× harder than a false alarm — so it learned to flag anything remotely
          suspicious. Run 3 made both mistakes cost the same.</p>
        <p><strong>The crash.</strong> Two hours into run 3 the process was abruptly killed. System logs traced
          it to memory exhaustion: at the first mid-run test, six extra data-loading helpers each held entire
          full-body scans — eight times larger at the new resolution — and the operating system killed the run
          to protect itself. One line of code fixed it, and because progress is saved at every test point, only
          ~50 iterations (20 seconds of progress) were lost. The remaining 38 hours ran without a hiccup.</p>
      </>
    ),
  },
  {
    t: 'The results — and what the numbers actually mean',
    body: (
      <>
        <p>Four measurements matter here. The <strong>overlap score</strong> (Dice) says how well the model’s
          outlines overlap the true ones, from 0 to 1 — it went 0.385 → 0.514 → 0.545 across the three runs.
          <strong> Sensitivity</strong> asks: of the tumours that really exist, what fraction did we find? —
          the clinical priority, since a missed tumour is worse than a false alarm a doctor can dismiss.
          <strong> Precision</strong> asks: of what we flagged, how much was real? — the trust metric.
          <strong> F1</strong> balances the two into one headline number.</p>
        <p>Run 3 vs run 2 on the standard scoring: 108 more real tumours found (1,286 vs 1,178), 95 fewer
          missed, sensitivity up from 66.7% to 72.3%. Before any filtering, sensitivity reached
          <strong> 73.5% — past the reference’s published 73.0%</strong> for the first time, on less than half
          its training data. The sharper resolution also halved a specific bad habit: blurring chains of
          neighbouring tumours into one blob.</p>
      </>
    ),
  },
  {
    t: 'The rubber ruler, fully explained',
    body: (
      <>
        <p>One number looked worse in run 3: precision dipped from 74.0% to 70.4% on the official scoring. The
          investigation found the problem in our measuring stick, not the model. The scoring throws away
          predicted specks smaller than 10 <em>pixels</em> — but a pixel is not a fixed physical size. At 4 mm
          resolution, 10 pixels ≈ 663 mm³ of tissue; at 2 mm it’s only ≈ 124 mm³. The identical rule filters
          five times less aggressively, purely as a side effect of the resolution change.</p>
        <p>Re-compared at matched physical volume, run 3 beats run 2 on everything at once: F1 72.4% vs 70.2%,
          precision 75.6% vs 74.0%, sensitivity 69.5% vs 66.7%. The apparent precision drop was an artefact of
          the measurement. Before run 4, the protocol gets restated in cubic millimetres so a resolution change
          can never distort a comparison again.</p>
      </>
    ),
  },
  {
    t: 'The honest gaps',
    body: (
      <>
        <p><strong>False alarms on healthy scans.</strong> Seven test scans contain no cancer at all. Run 2
          kept three completely clean; run 3 kept none, scattering ~25 false alarms across them. Sharper
          resolution means 8× more pixels where natural glow — bladder, kidneys, salivary glands all light up
          normally on PSMA scans — can be mistaken for disease. The reference solves this with an anatomy-aware
          cleanup step we haven’t built yet; this result makes it the clear next priority.</p>
        <p><strong>The overall gap.</strong> At the fair comparison our F1 is 72.4% vs the reference’s 79.9%.
          But the reference trained on 2.3× our data, ensembles five models where we use one, and has that
          anatomy cleanup. Our number is a floor, not a verdict on the architecture.</p>
        <p><strong>Time.</strong> Sharper scans tripled the cost of an experiment (12.5 h → 40 h per run),
          which is why training moves to the hospital’s four-GPU machine next.</p>
      </>
    ),
  },
  {
    t: 'What happens next',
    body: (
      <>
        <p>Five concrete steps, in order of value: restate the size filter in mm³ and re-score runs 2 and 3 on
          the identical physical standard; add organ-aware filtering to discount natural glow (aimed squarely
          at the healthy-scan false alarms); run one clean experiment isolating the penalty-balance change so
          we know which of run 3’s changes caused what; adopt deep supervision, a training aid the reference
          uses that we don’t yet; and scale to the hospital’s four RTX 4090s to train on the full ~1,000-scan
          dataset with proper cross-validation — the point where the comparison to the reference becomes truly
          like-for-like.</p>
      </>
    ),
  },
];

// The registry of decks (newest first). Each becomes a tab.
const DECKS = [
  {
    id: 'honours-2026-08-11',
    dateLabel: '11/08/2026',
    bannerTitle: 'Honours Project · Mamba PSMA',
    slides: TRAINING_UPDATE_SLIDES,
    notes: TRAINING_UPDATE_NOTES,
    pdf: {
      href: updateReportPdf,
      filename: 'mamba-training-update-runs-1-3.pdf',
      blurb: 'The whole update as a plain-English PDF report — written to be dropped into NotebookLM and turned into a podcast you can listen to.',
    },
  },
  {
    id: 'honours-2026-07-08',
    dateLabel: '08/07/2026',
    bannerTitle: 'Honours Project · Mamba PSMA',
    slides: HONOURS_UPDATE_SLIDES,
  },
];

export default function Presentations() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [idx, setIdx] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const stageRef = useRef(null);

  const deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0];
  const slides = deck.slides;
  const count = slides.length;

  const goto = useCallback((i) => setIdx((prev) => {
    const next = Math.min(count - 1, Math.max(0, i));
    return next === prev ? prev : next;
  }), [count]);
  const go = useCallback((n) => setIdx((prev) => Math.min(count - 1, Math.max(0, prev + n))), [count]);

  // Switching tabs resets to the first slide.
  const pickDeck = (id) => { setDeckId(id); setIdx(0); };

  // Track full-screen state for the toggle icon + label.
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFs = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      const req = el.requestFullscreen?.();
      // Focus the stage so keyboard arrows drive the deck in full screen.
      if (req?.then) req.then(() => el.focus?.()).catch(() => {});
      else el.focus?.();
    }
  }, []);

  // Keyboard: the stage is focusable, so arrows only act when it's focused
  // (or when it's the full-screen element) — never hijacks page scrolling.
  const onKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ': e.preventDefault(); go(1); break;
      case 'ArrowLeft':
      case 'PageUp': e.preventDefault(); go(-1); break;
      case 'Home': e.preventDefault(); goto(0); break;
      case 'End': e.preventDefault(); goto(count - 1); break;
      case 'f':
      case 'F': e.preventDefault(); toggleFs(); break;
      default: break;
    }
  }, [go, goto, count, toggleFs]);

  return (
    <div className="pt-module pres">
      <div>
        <p className="pres-kicker">University · Presentations</p>
        <p className="pt-module__intro">
          Slide decks for the honours project. Each tab is a dated presentation; open one, step through it with
          the arrows or the on-screen controls, and hit full screen to present it. Press <kbd>F</kbd> to toggle
          full screen and <kbd>←</kbd>/<kbd>→</kbd> to move between slides.
        </p>
      </div>

      {/* ── Tabs (one per dated deck) ─────────────────────────────────── */}
      <div className="pres-tabs" role="tablist" aria-label="Presentation dates">
        {DECKS.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={d.id === deckId}
            className={`pres-tab${d.id === deckId ? ' pres-tab--active' : ''}`}
            onClick={() => pickDeck(d.id)}
          >
            <span className="pres-tab__dot" aria-hidden="true" />
            {d.dateLabel}
          </button>
        ))}
      </div>

      {/* ── Stage (the full-screen target) ────────────────────────────── */}
      <div
        className={`pres-stage${isFs ? ' pres-stage--fs' : ''}`}
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="slide presentation"
        aria-label={`${deck.bannerTitle} — slide ${idx + 1} of ${count}`}
      >
        <div className="pres-screen">
          {slides.map((s, i) => (
            <section
              key={i}
              className={`pres-slide${i === idx ? ' pres-slide--active' : ''}`}
              aria-hidden={i !== idx}
            >
              {/* Banner — on every slide, carrying the UWA Medical Physics logo */}
              <header className="pres-banner">
                <div className="pres-banner__meta">
                  <span className="pres-banner__kicker">{s.kicker}</span>
                  <span className="pres-banner__title">{deck.bannerTitle}</span>
                </div>
                <img className="pres-banner__logo" src={uwaLogo} alt="UWA Medical Physics Research Group" />
              </header>

              <div className="pres-body">
                {s.title && s.title !== 'Cover' && <h2 className="pres-slide__h">{s.title}</h2>}
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {/* Controls — available in-page and in full screen */}
        <div className="pres-controls">
          <button
            className="pres-btn"
            onClick={() => go(-1)}
            disabled={idx === 0}
            aria-label="Previous slide"
          >
            <Icon name="arrowLeft" size={16} />
          </button>

          <div className="pres-dots" role="tablist" aria-label="Slides">
            {slides.map((s, i) => (
              <button
                key={i}
                className={`pres-dot${i === idx ? ' pres-dot--active' : ''}`}
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                aria-current={i === idx ? 'true' : undefined}
              />
            ))}
          </div>

          <span className="pres-counter">{idx + 1} / {count}</span>

          <button
            className="pres-btn"
            onClick={() => go(1)}
            disabled={idx === count - 1}
            aria-label="Next slide"
          >
            <Icon name="arrowRight" size={16} />
          </button>

          <button
            className="pres-btn pres-btn--fs"
            onClick={toggleFs}
            aria-label={isFs ? 'Exit full screen' : 'Enter full screen'}
          >
            <Icon name={isFs ? 'compress' : 'expand'} size={16} />
            <span className="pres-btn__label">{isFs ? 'Exit' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      {/* ── PDF report download (decks that ship one) ─────────────────── */}
      {deck.pdf && (
        <div className="pres-report">
          <div className="pres-report__text">
            <span className="pres-report__k">Listenable report</span>
            <p>{deck.pdf.blurb}</p>
          </div>
          <a
            className="pres-report__btn"
            href={deck.pdf.href}
            download={deck.pdf.filename}
          >
            <Icon name="download" size={16} />
            Download the PDF report
          </a>
        </div>
      )}

      {/* ── Plain-English notes — one block per slide ─────────────────── */}
      {deck.notes && (
        <section className="pres-notes" aria-label="Slide-by-slide explanation">
          <h3 className="pres-notes__h">Slide-by-slide, in plain English</h3>
          <p className="pres-notes__sub">
            Each block below expands one slide — what it says, why it matters, and what the numbers actually
            mean. Click a slide number to jump the deck to it.
          </p>
          {deck.notes.map((n, i) => (
            <article
              key={i}
              className={`pres-note-card${i === idx ? ' pres-note-card--active' : ''}`}
            >
              <button
                type="button"
                className="pres-note-card__jump"
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}`}
              >
                Slide {String(i + 1).padStart(2, '0')}
              </button>
              <div className="pres-note-card__body">
                <h4>{n.t}</h4>
                {n.body}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
