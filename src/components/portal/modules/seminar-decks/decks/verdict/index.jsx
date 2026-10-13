import { BACKUPS } from '../../shared/backups';
import { Logo, VerdictGlyph } from '../../shared/chrome';
import DemoClip from '../../shared/DemoClip';
import Exhibit from '../../shared/Exhibit';
import { FACTS } from '../../shared/facts';
import { HYPOTHESES, TALK } from '../../shared/meta';
import { Num, T } from '../../shared/Num';
import Frame from './Frame';
import { PredictionTable, Ref, VerdictLine } from './parts/Board';
import DataTiles from './parts/DataTiles';
import FairChart, { UnderdogTable } from './parts/FairChart';
import FigureReveal from './parts/FigureReveal';
import Nested from './parts/Nested';
import { ClipWindow, Plate } from './parts/Plate';
import ScanLanes from './parts/ScanLanes';
import TwinChart from './parts/TwinChart';
import { CUES, SCRIPTS } from './scripts';
import './verdict.css';

/* ============================================================================
   DECK 2 — "DOES MAMBA EARN ITS PLACE?" (slug verdict)
   ----------------------------------------------------------------------------
   The talk as an experiment with four written predictions. A journal page:
   paper ground, deep ink, Fraunces headlines over Source Serif body and
   Source Sans labels; one accent per verdict state; scans as exhibits on
   dark plates. The hypothesis scoreboard (N6) is born on slide 6 and lives
   in the margin from slide 7, changing state on the [CLICK] where each
   verdict is spoken (compact on slides 7 to 9, while all are pending).
   Order: question, method, evidence, verdict.
   Transcripts and cues: ./scripts.js. Frame: ./Frame.jsx. Theme: verdict.css.
   ========================================================================== */

const on = (b) => (b ? ' is-on' : '');
const script = (id) => SCRIPTS[id];
const pct = (k, max = 100) => `${(FACTS[k].value / max) * 100}%`; // bar length from the manifest value

const slides = [
  /* 1 ── Title ─────────────────────────────────────────────────────────── */
  {
    id: 'title',
    bare: true,
    render: () => (
      <div className="d2-cover">
        <div className="d2-cover__head">
          <span data-role="foot"><span data-tick="">{TALK.unit}</span> · {TALK.university}</span>
          <span data-role="foot">{TALK.degree}</span>
        </div>
        <p className="d2-cover__q" data-role="body">Does Mamba earn its place?</p>
        <h1 className="d2-cover__title" data-req="title" data-role="title">{TALK.title}</h1>
        <p className="d2-cover__by" data-req="supervisors" data-role="body">
          <span className="d2-cover__name">{TALK.presenter}</span>
          <span className="d2-cover__sup">{TALK.supervisorsLine}</span>
        </p>
        <div className="d2-cover__logo"><Logo size="large" /></div>
        <aside className="d2-cover__board" aria-label="Four predictions, all pending">
          <p data-role="foot">Four predictions</p>
          <ul>
            {HYPOTHESES.map((h) => (
              <li key={h.id}><VerdictGlyph state="pending" size={34} /><span data-role="chart">{h.id}</span><span className="d2-cover__hn" data-role="chart">{h.name}</span></li>
            ))}
          </ul>
        </aside>
      </div>
    ),
    script: script('title'),
    cues: CUES.title,
  },

  /* 2 ── The problem, one exhibit ─────────────────────────────────────── */
  {
    id: 'problem',
    part: 'problem',
    title: 'Cancer hides among normal uptake, and experts outline it differently',
    steps: 2,
    scans: true,
    cites: ['kendrick2022'],
    media: ['figures/bg-psma-mip.png'],
    render: (ctx) => (
      <div className="d2-s2">
        {/* Figure 2.1 panel (a), cropped to the abdomen and pelvis: kidneys and bladder beside the outlined lesions */}
        <Plate width={776} tag="Exhibit" caption="autoPET-III PET projection, abdomen and pelvis. Dark is tracer uptake; lines name normal uptake; blue outlines are lesions.">
          <Exhibit
            src="figures/bg-psma-mip.png"
            crop={[0.0937, 0.3478, 0.3808, 0.37]}
            width={744}
            height={420}
            plate={false}
            alt="PSMA PET projection of the abdomen and pelvis of an autoPET-III study: liver, spleen, kidneys and bladder labelled as normal uptake, with lesions outlined in blue beside the bladder and between the kidneys"
          />
        </Plate>
        <div className={`d2-s2__stats${on(ctx.at(1))}`}>
          <p className="d2-kicker" data-role="foot">Two experts, the same scans</p>
          <div className="d2-stat">
            <span className="d2-stat__big" data-role="chart"><Num k="lit.obs_dsc_round" /></span>
            <span className="d2-stat__lab" data-role="body">mean overlap (Dice) of their outlines</span>
          </div>
          <div className="d2-stat">
            <span className="d2-stat__big" data-role="chart"><Num k="lit.obs_found" /></span>
            <span className="d2-stat__lab" data-role="body">of one expert&apos;s lesions found by the other</span>
          </div>
          <p className="d2-src" data-role="foot">
            <T>{'Second observer on {{lit.obs_scans}} scans'}</T> <Ref k="kendrick2022" refNum={ctx.refNum} />
          </p>
        </div>
      </div>
    ),
    script: script('problem'),
    cues: CUES.problem,
  },

  /* 3 ── Overview, mirroring the abstract ─────────────────────────────── */
  {
    id: 'overview',
    part: 'problem',
    title: 'I built a hybrid network and tested it once on sealed scans',
    render: () => (
      <div className="d2-abs">
        <p className="d2-kicker" data-role="foot">The talk in one breath</p>
        <dl className="d2-abs__list">
          <div><dt data-role="foot">Problem</dt><dd data-role="body">Outline every lesion in whole-body PSMA PET</dd></div>
          <div><dt data-role="foot">Idea</dt><dd data-role="body">Mamba: cost grows linearly with length</dd></div>
          <div><dt data-role="foot">Network</dt><dd data-role="body">Five stages, Mamba in the deepest three, plus organ training</dd></div>
          <div><dt data-role="foot">Data</dt><dd data-role="body"><T>{'{{data.total}} scans, {{data.test}} sealed away'}</T></dd></div>
          <div className="is-result"><dt data-role="foot">Result</dt><dd data-role="body"><T>{'{{r5.found_round}} of lesions found at {{r5.prec_round}} precision'}</T></dd></div>
        </dl>
      </div>
    ),
    script: script('overview'),
    cues: CUES.overview,
  },

  /* 4 ── Previous work ─────────────────────────────────────────────────── */
  {
    id: 'previous',
    part: 'previous',
    title: 'Convolutional networks read a scan one GPU-sized window at a time',
    steps: 2,
    cites: ['isensee2021', 'kendrick2022'],
    render: (ctx) => (
      <div className="d2-s4">
        <ol className="d2-prior">
          <li>
            <p className="d2-prior__name" data-role="body">nnU-Net <Ref k="isensee2021" refNum={ctx.refNum} /></p>
            <p className="d2-prior__what" data-role="body">a CNN that configures itself to each dataset</p>
          </li>
          <li>
            <p className="d2-prior__name" data-role="body">The 2022 nnU-Net cascade (Kendrick et al.) <Ref k="kendrick2022" refNum={ctx.refNum} /></p>
            <p className="d2-prior__fig" data-role="chart">
              <span>F1 <Num k="k22.f1" /></span>
              <span>precision <Num k="k22.ppv" /></span>
              <span>sensitivity <Num k="k22.sens" /></span>
            </p>
            <p className="d2-prior__what" data-role="body"><T>{'its own {{k22.test}} test scans; context only'}</T></p>
          </li>
          <li>
            <p className="d2-prior__name" data-role="body">PSMASegmentator <span className="d2-tag" data-role="foot">my comparator</span></p>
            <p className="d2-prior__what" data-role="body"><T>{'a later nnU-Net, {{psm.train}} training scans'}</T></p>
          </li>
        </ol>
        <div className="d2-s4__fig"><Nested on={ctx.at(1)} /></div>
      </div>
    ),
    script: script('previous'),
    cues: CUES.previous,
  },

  /* 5 ── The bet: Mamba (N2) and the need for a twin ──────────────────── */
  {
    id: 'bet',
    part: 'previous',
    title: "Mamba reads a whole window's deep features at linear cost",
    steps: 5,
    cites: ['gu2023', 'ma2024', 'isensee2024'],
    render: (ctx) => (
      <div className="d2-s5">
        <ScanLanes step={Math.min(ctx.step, 3)} />
        <p className={`d2-s5__warn${on(ctx.at(4))}`} data-role="body">
          U-Mamba&apos;s Mamba layers had no effect against a copy without them <Ref k="isensee2024" refNum={ctx.refNum} />. A fair claim needs a CNN-only twin.
        </p>
      </div>
    ),
    script: script('bet'),
    cues: CUES.bet,
  },

  /* 6 ── The research question and four predictions ──────────────────── */
  {
    id: 'question',
    part: 'mine',
    title: 'Four predictions turn one research question into tests',
    steps: 2,
    margin: 'legend',
    render: (ctx) => (
      <div className={`d2-s6${on(ctx.at(1))}`}>
        <div className="d2-rq">
          <p className="d2-kicker" data-role="foot">Research question</p>
          <p className="d2-rq__q" data-req="rq" data-role="body">
            Does a hybrid CNN-Mamba network find lesions better than PSMASegmentator on scans neither model trained on, and do its Mamba blocks add anything over a CNN-only twin?
          </p>
        </div>
        <div className="d2-s6__table"><PredictionTable on={ctx.at(1)} /></div>
      </div>
    ),
    script: script('question'),
    cues: CUES.question,
  },

  /* 7 ── What I built: option F, toured by zoom (N8) ──────────────────── */
  {
    id: 'built',
    part: 'mine',
    title: 'My network keeps convolutions shallow and adds Mamba only deep',
    steps: 4,
    margin: 'compact',
    cites: ['wasserthal2023'],
    media: ['figures/architecture-option-f.svg'],
    render: (ctx) => (
      <div className="d2-s7">
        <figure className="d2-s7__fig">
          <FigureReveal step={ctx.step} width={1000} height={590} />
          <figcaption className="d2-figcap" data-role="foot">The network as drawn in the dissertation (<span data-tick="">Figure 3.3</span>).</figcaption>
        </figure>
        <ol className="d2-notes-list">
          <li className="is-on" data-role="body"><span className="d2-notes-list__k" data-role="foot">a</span>Five stages, all convolutional</li>
          <li className={on(ctx.at(1))} data-role="body"><span className="d2-notes-list__k" data-role="foot">b</span><T>{'Mamba only in the deepest three: {{net.tok3}} to {{net.tok5}} tokens'}</T></li>
          <li className={on(ctx.at(2))} data-role="body"><span className="d2-notes-list__k" data-role="foot">c</span><T>{'Organ head (training only): false alarms on {{organ.neg}} lesion-free scans, {{organ.fc3}} to {{organ.fc4}}'}</T> <Ref k="wasserthal2023" refNum={ctx.refNum} /></li>
          <li className={on(ctx.at(3))} data-role="body"><span className="d2-notes-list__k" data-role="foot">d</span>One Mamba block: six scan orders, summed</li>
        </ol>
      </div>
    ),
    script: script('built'),
    cues: CUES.built,
  },

  /* 8 ── How I tested it: data and protocol (N3) ──────────────────────── */
  {
    id: 'tested',
    part: 'mine',
    title: '{{data.test}} scans were sealed away and scored once, at the end',
    steps: 5,
    margin: 'compact',
    cites: ['jeblick2026', 'jackson2025'],
    render: (ctx) => (
      <div className="d2-s8">
        <DataTiles step={ctx.step} refNum={ctx.refNum} />
        <div className="d2-s8__col">
          <p className="d2-kicker" data-role="foot">The protocol</p>
          <ol className="d2-steps">
            <li className={on(ctx.at(1))}><p data-role="body">Sealed scans: never trained on</p></li>
            <li className={on(ctx.at(2))}><p data-role="body">Five folds, five models, averaged into one ensemble</p></li>
            <li className={`d2-steps__stamp${on(ctx.at(3))}`}><p data-role="body">Pre-registered: rules fixed before testing</p></li>
            <li className={on(ctx.at(4))}><p data-role="body">Run 4 never trained on DEEP-PSMA</p></li>
          </ol>
        </div>
      </div>
    ),
    script: script('tested'),
    cues: CUES.tested,
  },

  /* 9 ── The final model works: the sealed test ───────────────────────── */
  {
    id: 'works',
    part: 'results',
    title: 'On {{data.test}} sealed scans, the ensemble reached F1 {{r5.f1}}',
    steps: 2,
    margin: 'compact',
    scans: true,
    media: ['clips/case-a-3-prediction.png', 'clips/case-a-4-ground-truth.mp4'],
    render: (ctx) => (
      <div className="d2-s9">
        {/* The A4 clip (ground truth over case A), cropped to the scan; its score card stays outside the window */}
        <Plate width={394} className="d2-plate--case" tag="Case A" caption={<T>{'Case A: {{a.found}} of {{a.gt}} found'}</T>}>
          <ClipWindow src="case-a-4-ground-truth" under="case-a-3-prediction" state={ctx.clip(0)} mode={ctx.mode} reduced={ctx.reduced} width={362} height={556} clipW={1227} x={0.128} y={0.08} label="Case A, a sealed test scan, against its ground truth: lesions found, missed and false alarms" />
        </Plate>
        <div className="d2-s9__col">
          <div className="d2-marks">
            <p className="d2-kicker" data-role="foot">Case A was chosen by a rule before viewing</p>
            <ul>
              <li><span className="d2-marks__chip"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="9" fill="none" stroke="#56b4e9" strokeWidth="4" /></svg></span><span data-role="chart">found</span></li>
              <li><span className="d2-marks__chip"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="6" y="6" width="18" height="18" fill="none" stroke="#d55e00" strokeWidth="4" strokeDasharray="5 3" /></svg></span><span data-role="chart">missed</span></li>
              <li><span className="d2-marks__chip"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M 15 4 L 26 15 L 15 26 L 4 15 Z" fill="none" stroke="#f0e442" strokeWidth="4" /></svg></span><span data-role="chart">false alarm</span></li>
            </ul>
          </div>
          <div className={`d2-s9__nums${on(ctx.at(1))}`}>
            <p className="d2-kicker" data-role="foot">All sealed scans, lesions pooled</p>
            <div className="d2-num is-lead"><span className="d2-num__v" data-role="chart"><Num k="r5.f1" /></span><span className="d2-num__k" data-role="body">F1</span></div>
            <div className="d2-nums3">
              <div className="d2-num"><span className="d2-num__v" data-role="chart"><Num k="r5.ppv" /></span><span className="d2-num__k" data-role="body">precision</span></div>
              <div className="d2-num"><span className="d2-num__v" data-role="chart"><Num k="r5.sens" /></span><span className="d2-num__k" data-role="body">sensitivity</span></div>
              <div className="d2-num"><span className="d2-num__v" data-role="chart"><Num k="r5.dsc" /></span><span className="d2-num__k" data-role="body">Dice</span></div>
            </div>
            <p className="d2-src" data-role="foot">In-domain; scored once, as pre-registered</p>
          </div>
        </div>
      </div>
    ),
    script: script('works'),
    cues: CUES.works,
  },

  /* 10 ── H1, the fair test (N4a, N4b) ────────────────────────────────── */
  {
    id: 'fair',
    part: 'results',
    title: 'On unseen scans, run 4 found more lesions, with more false alarms',
    steps: 4,
    margin: 'board',
    media: ['data/fair-per-case.json'],
    render: (ctx) => (
      <div className="d2-s10">
        {ctx.step === 0 ? (
          <UnderdogTable />
        ) : (
          <div className="d2-s10__chart">
            <FairChart step={ctx.step} />
            {ctx.step === 1 ? (
              <p className="d2-s10__say" data-role="body"><T>{'Scan by scan, no clear difference: better on {{fair.better}}, worse on {{fair.worse}}'}</T></p>
            ) : (
              <VerdictLine id="H1" on={ctx.at(3)}>more lesions found, lower precision</VerdictLine>
            )}
          </div>
        )}
      </div>
    ),
    script: script('fair'),
    cues: CUES.fair,
  },

  /* 11 ── H4, the twin (N5) ───────────────────────────────────────────── */
  {
    id: 'twin',
    part: 'results',
    title: 'A bigger window hurt the hybrid more than its CNN-only twin',
    steps: 4,
    margin: 'board',
    render: (ctx) => (
      <div className="d2-s11">
        <TwinChart step={ctx.step} />
        <VerdictLine id="H4" on={ctx.at(3)}>
          <T>{"interaction {{r6.inter}}, the hybrid's drop minus the twin's; real under the pre-registered rule"}</T>
        </VerdictLine>
      </div>
    ),
    script: script('twin'),
    cues: CUES.twin,
  },

  /* 12 ── H2 and H3: the loss and efficiency ──────────────────────────── */
  {
    id: 'loss-speed',
    part: 'results',
    title: 'The loss and speed predictions from my proposal were not supported',
    steps: 4,
    margin: 'board',
    cites: ['salehi2017'],
    render: (ctx) => (
      <div className="d2-s12">
        <section className="d2-half">
          <p className="d2-half__k" data-role="foot">H2 · Loss</p>
          <p className="d2-half__lead" data-role="body">Run 2: a loss weighted against misses <Ref k="salehi2017" refNum={ctx.refNum} /></p>
          <div className="d2-hbar">
            <span className="d2-hbar__lab" data-role="chart">Sensitivity</span>
            <span className="d2-hbar__track"><span className="d2-hbar__fill" style={{ width: pct('run2.sens') }} /></span>
            <span className="d2-hbar__v" data-role="chart"><Num k="run2.sens" /></span>
          </div>
          <div className="d2-hbar">
            <span className="d2-hbar__lab" data-role="chart">Precision</span>
            <span className="d2-hbar__track"><span className="d2-hbar__fill" style={{ width: pct('run2.ppv') }} /></span>
            <span className="d2-hbar__v" data-role="chart"><Num k="run2.ppv" /></span>
          </div>
          <p className="d2-half__note" data-role="foot"><T>{'Partial test: run 2 alone, {{train.val57}} validation scans, an older matcher'}</T></p>
          <div className={`d2-vline is-not${on(ctx.at(1))}`}><span className="d2-mark is-not"><VerdictGlyph state="not" size={40} /></span><p className="d2-vline__text" data-role="body"><span className="d2-vline__id">H2</span> <span className="d2-vline__state">not supported</span></p></div>
        </section>
        <section className={`d2-half${on(ctx.at(2))}`}>
          <p className="d2-half__k" data-role="foot">H3 · Efficiency, at equal passes</p>
          <p className="d2-half__lead" data-role="body">No faster in mean time per scan</p>
          <p className="d2-half__ct" data-role="chart">Peak memory at equal passes</p>
          <div className="d2-hbar">
            <span className="d2-hbar__lab" data-role="chart">Hybrid</span>
            <span className="d2-hbar__track"><span className="d2-hbar__fill" style={{ width: pct('eff.vram_h', 6) }} /></span>
            <span className="d2-hbar__v" data-role="chart"><Num k="eff.vram_h" /></span>
          </div>
          <div className="d2-hbar">
            <span className="d2-hbar__lab" data-role="chart">PSMASegmentator</span>
            <span className="d2-hbar__track"><span className="d2-hbar__fill is-psm" style={{ width: pct('eff.vram_p', 6) }} /></span>
            <span className="d2-hbar__v" data-role="chart"><Num k="eff.vram_p" /></span>
          </div>
          <p className="d2-half__note" data-role="foot">The default-setup speed gap, and the abstract&apos;s, came from eight-pass test-time augmentation.</p>
          <div className={`d2-vline is-not${on(ctx.at(3))}`}><span className="d2-mark is-not"><VerdictGlyph state="not" size={40} /></span><p className="d2-vline__text" data-role="body"><span className="d2-vline__id">H3</span> <span className="d2-vline__state">not supported</span></p></div>
        </section>
      </div>
    ),
    script: script('loss-speed'),
    cues: CUES['loss-speed'],
  },

  /* 13 ── What it means; limits; next; thank you ──────────────────────── */
  {
    id: 'meaning',
    part: 'meaning',
    title: 'Run 4 beat PSMASegmentator in pooled F1, but Mamba takes no credit',
    steps: 4,
    margin: 'board',
    scans: true,
    bigLogoAt: 3,
    media: ['clips/d1-model-run.mp4', 'data/d1-cues.json'],
    render: (ctx) => (
      <div className={`d2-s13 d2-step-${ctx.step}`}>
        <div className="d2-s13__top">
          {ctx.step < 3 ? (
            <p className="d2-s13__answer" data-role="body">Does Mamba earn its place? <em>The Mamba blocks added little, so the gain over PSMASegmentator is not credited to them.</em></p>
          ) : (
            <div className="d2-s13__thanks">
              <p className="d2-s13__ty" data-role="title">Thank you</p>
              <p className="d2-s13__qs" data-role="title">Questions?</p>
              <Logo size="large" />
            </div>
          )}
        </div>
        <div className="d2-s13__cols">
          <section className="is-on">
            <p className="d2-kicker" data-role="foot">What it means</p>
            <p data-role="body">On DEEP-PSMA, run 4 found more lesions; the CNN-only twin did as well</p>
          </section>
          <section className={on(ctx.at(1))} data-req="limitations">
            <p className="d2-kicker" data-role="foot">Limitations</p>
            <p data-role="body"><T>{'One run per cell; two label conventions; {{data.test_neg}} lesion-free test scans'}</T></p>
          </section>
          <section className={on(ctx.at(2))} data-req="future">
            <p className="d2-kicker" data-role="foot">Next step</p>
            <p data-role="body">Retrain and score on the Sir Charles Gairdner Hospital cohort</p>
          </section>
        </div>
        {ctx.step === 2 && (
          <div className="d2-s13__demo">
            <DemoClip state={ctx.clip(2)} mode={ctx.mode} reduced={ctx.reduced} layout="row" />
          </div>
        )}
      </div>
    ),
    script: script('meaning'),
    cues: CUES.meaning,
  },
];

export default {
  slug: 'verdict',
  name: 'Does Mamba Earn Its Place?',
  concept: 'The talk as an experiment with four written predictions: a hypothesis scoreboard in the margin changes state as the evidence arrives.',
  wow: [
    'A margin scoreboard that flips each verdict on the click where it is spoken',
    "Selective scan: a 3D block flattens into six token lanes, against attention's web",
    'One hundred scans as dots that grow by lesion count and pool into bars',
    'The 2x2 twin: the hybrid drops when the window grows; its twin barely moves',
  ],
  risk: 'Most beats are click-timed builds: a missed or extra click puts a verdict on screen before it is spoken.',
  className: 'd2',
  Frame,
  fonts: ['fraunces-normal-400-700.woff2', 'fraunces-italic-400-700.woff2', 'sourceserif-normal-400-700.woff2', 'sourceserif-italic-400-700.woff2', 'sourcesans-normal-400-700.woff2'],
  fontFaces: [
    { family: 'SD Fraunces', weight: 600, style: 'normal' },
    { family: 'SD Fraunces', weight: 500, style: 'italic' },
    { family: 'SD Source Serif', weight: 400, style: 'normal' },
    { family: 'SD Source Serif', weight: 400, style: 'italic' },
    { family: 'SD Source Sans', weight: 400, style: 'normal' },
    { family: 'SD Source Sans', weight: 600, style: 'normal' },
  ],
  slides,
  backups: BACKUPS.map((b) => (b.id === 'b-refs' ? { ...b, render: (ctx) => <div className="d2-refs" data-tick="">{b.render(ctx)}</div> } : b)),
};
