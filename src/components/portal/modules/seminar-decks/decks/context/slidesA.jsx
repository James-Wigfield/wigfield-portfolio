import Clip from '../../engine/Clip';
import { Logo, VerdictGlyph } from '../../shared/chrome';
import { HYPOTHESES, TALK, VERDICTS } from '../../shared/meta';
import { Num, T } from '../../shared/Num';
import { mediaUrl, useMediaVersion } from '../../engine/media';
import { A1_CROP, A4_CROP, SIDE, TOP, WIN_C, WIN_CROP, toView } from './geometry';
import { Camera, Countdown, Hold, Reveal, ScanView, Windows } from './stage';

/* ============================================================================
   DECK 3 (context) — SLIDES 1 TO 5: title, spot the lesions (with the
   talk in one breath), context, the window problem, the bet and the question.
   Each slide is one component; positions are canvas px (1920 x 1080).
   ========================================================================== */

const cls = (...a) => a.filter(Boolean).join(' ');

/* ── 1. Title on the body ──────────────────────────────────────────────── */
export function TitleSlide({ ctx }) {
  const view = { x: 350, y: 444, s: 1 };
  return (
    <div className="d3-s d3-title">
      <Camera ctx={ctx} frames={[view]} from={{ ...view, s: 1.14 }} x={1124} y={92} w={700} h={888}>
        <ScanView crop={A1_CROP} w={700}>
          <Hold src="clips/case-a-1-scan.png" alt="Case A, a whole-body PSMA PET/CT from the held-out test set" />
          <Windows show={{ small: true }} draw />
        </ScanView>
      </Camera>
      <div className="d3-title__text">
        <p className="d3-title__q" data-role="body">How much of the body does a model need to see?</p>
        <h1 className="d3-title__h" data-req="title" data-role="title">
          {TALK.title.split(/(Whole-Body|CNN-Mamba)/).map((part, i) => (i % 2 ? <span key={i} className="d3-nowrap">{part}</span> : part))}
        </h1>
        <div className="d3-title__who" data-req="supervisors" data-role="body">
          <p className="d3-title__name">{TALK.presenter}</p>
          <p>{TALK.supervisorsLine}</p>
        </div>
      </div>
      <div className="d3-title__logo">
        <Logo size="large" chip />
      </div>
    </div>
  );
}

/* ── 2. Spot the lesions, then the talk in one breath ──────────────────── */
// The overview (the abstract in one breath), one line per stop on a thin thread.
const BREATH = [
  'Small, scattered lesions; healthy organs glow too',
  'Mamba could buy more context',
  'Mamba in the deepest three stages, plus an organ task',
  '{{data.total}} scans, {{data.test}} held out',
  '{{r5.found_round}} found at {{r5.prec_round}} precision, then a twist',
];

export function SpotSlide({ ctx }) {
  const { step } = ctx;
  const run = ctx.mode === 'present' && ctx.active && step === 1 && ctx.dir === 'forward';
  // The camera glides the scan from where the title slide left it (right, at
  // 700 px wide) to this slide's monitor on the left.
  const home = { x: 960, y: 540, s: 1, t: 1500 };
  const fromTitle = { x: -78, y: 516, s: 700 / SIDE.w };
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[home]} from={fromTitle} w={1920} h={1080}>
        <div className={cls('d3-monitor', (step === 2 || step === 3) && 'is-hidden')} style={{ left: SIDE.x, top: SIDE.y }}>
          <ScanView crop={A1_CROP} w={SIDE.w}>
            <Hold src="clips/case-a-1-scan.png" alt="Case A before the reveal: a whole-body PSMA PET/CT" />
          </ScanView>
        </div>
        <div className={cls('d3-monitor', (step < 2 || step === 4) && 'is-hidden')} style={{ left: SIDE.x, top: SIDE.y }}>
          <ScanView crop={A4_CROP} w={SIDE.w}>
            <Clip src="case-a-4-ground-truth" state={ctx.clip(2)} mode={ctx.mode} reduced={ctx.reduced} under="case-a-3-prediction" label="Case A against the expert's outlines" />
          </ScanView>
        </div>
      </Camera>
      {step === 1 && <Countdown run={run} box={{ x: SIDE.x, y: SIDE.y, w: SIDE.w, h: SIDE.h }} />}
      {step < 2 && (
        <div className="d3-col" style={{ top: 360 }}>
          <p className="d3-prompt" data-role="body">Spot the lesions.</p>
          <p className="d3-label" data-role="foot">Case A · autoPET-III · held-out test scan</p>
        </div>
      )}
      {(step === 2 || step === 3) && (
        <div className="d3-col" style={{ top: 340 }}>
          <p className="d3-lead" data-role="body"><T>{'{{a.gt}} lesions in the expert-corrected labels'}</T></p>
          <p className="d3-kick" data-role="foot">Preview: blue is my model's output, scored later</p>
          <p className="d3-note" data-role="foot">Picked from the results table by a rule, before any image was viewed.</p>
        </div>
      )}
      {step === 3 && (
        <div className="d3-col d3-col--card" style={{ top: 720 }}>
          <p className="d3-body" data-role="body">By hand, outlining is slow. Two experts' outlines overlapped by only <Num k="lit.obs_dsc_round" /> (Dice).</p>
        </div>
      )}
      {step === 4 && (
        <div className="d3-col" style={{ top: 330 }}>
          <p className="d3-kick" data-role="foot">The talk in one breath</p>
          <ol className="d3-thread">
            {BREATH.map((t, i) => (
              <li key={t} data-role="body" style={{ transitionDelay: `${i * 120}ms` }}><T>{t}</T></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ── 3. Why context matters (dissertation Figure 2.1, panel a) ─────────── */
function MipPanel() {
  useMediaVersion();
  return (
    <div className="d3-mip">
      <img src={mediaUrl('figures/bg-psma-mip.png')} width={1707} height={992} alt="Coronal PSMA PET projection of an autoPET-III study with eight expert-corrected lesion outlines and labelled organs" draggable="false" />
    </div>
  );
}

export function ContextSlide({ ctx }) {
  const close = { x: 487, y: 626, s: 2.6, t: 1800 };
  const wide = { x: 405, y: 542, s: 0.9185, t: 1800 }; // header (y < 92) cropped
  return (
    <div className="d3-s">
      <div className="d3-plate" style={{ left: SIDE.x, top: SIDE.y, width: SIDE.w, height: SIDE.h }}>
        <Camera ctx={ctx} frames={[close, wide, wide]} from={{ ...close, s: 3.4 }} w={SIDE.w} h={SIDE.h}>
          <MipPanel />
          <svg className="d3-finder" viewBox="0 0 1707 992" aria-hidden="true">
            <rect x="428" y="566" width="128" height="122" />
          </svg>
        </Camera>
      </div>
      <div className="d3-col" style={{ top: 340 }}>
        <p className="d3-body" data-role="body">Up close: a hot spot. Is it cancer?</p>
        <Reveal on={ctx.at(1)} as="p" className="d3-body" data-role="body">Pulled back: the bladder, with lesions beside it. Glands, liver, spleen and kidneys take up the tracer too.</Reveal>
        <Reveal on={ctx.at(2)} as="p" className="d3-body d3-accent" data-role="body">Telling them apart needs the anatomy around each spot.</Reveal>
        <p className="d3-note" data-role="foot">Dissertation Figure <span data-tick="">2.1</span> (a): an autoPET-III study, expert-corrected outlines in blue.</p>
      </div>
    </div>
  );
}

/* ── 4. Previous work: the window problem ──────────────────────────────── */
export function WindowSlide({ ctx }) {
  const c = toView(WIN_CROP, SIDE.w, WIN_C);
  const wide = { x: SIDE.w / 2, y: SIDE.h / 2, s: 1, t: 1800 };
  return (
    <div className="d3-s">
      <Camera ctx={ctx} frames={[wide]} from={{ x: c.x, y: c.y, s: 2.4 }} x={SIDE.x} y={SIDE.y} w={SIDE.w} h={SIDE.h} className="d3-monitor-cam">
        <ScanView crop={WIN_CROP} w={SIDE.w}>
          <Hold src="clips/case-a-1-scan.png" alt="Case A with PSMASegmentator's window drawn to scale" />
          <Windows show={{ psm: true }} />
        </ScanView>
      </Camera>
      <div className="d3-col" style={{ top: 330 }}>
        <p className="d3-body" data-role="body">nnU-Net, the standard tool, is a CNN that configures itself to each dataset.</p>
        <div className="d3-key">
          <span className="d3-key__swatch is-psm" aria-hidden="true" />
          <span className="d3-key__name" data-role="chart">PSMASegmentator's window</span>
          <span className="d3-key__mm" data-role="chart"><Num k="psm.patch_x_mm" /> x <Num k="psm.patch_z_mm" /></span>
        </div>
        <p className="d3-note" data-role="foot">Left-right x head-toe, to scale on case A. Depth not shown.</p>
        <Reveal on={ctx.at(1)} as="p" className="d3-body d3-accent" data-role="body">GPU memory caps the window: bigger window, smaller batch.</Reveal>
        <Reveal on={ctx.at(2)} className="d3-ctx">
          <p className="d3-ctx__k" data-role="foot">Context only · its own test set</p>
          <p className="d3-ctx__name" data-role="body">2022 nnU-Net cascade (Kendrick et al.)</p>
          <p className="d3-ctx__nums" data-role="chart">Precision <Num k="k22.ppv" /> · found <Num k="k22.sens" /> · F1 <Num k="k22.f1" /></p>
          <p className="d3-note" data-role="foot"><T>{'{{k22.test}} recurrent-disease test scans, its own matching rule'}</T></p>
        </Reveal>
      </div>
    </div>
  );
}

/* ── 5. The bet and the question ───────────────────────────────────────── */
function Schematic() {
  const n = 12;
  const pitch = 64;
  const x0 = 380;
  const xs = Array.from({ length: n }, (_, i) => x0 + i * pitch);
  const arcs = [];
  xs.forEach((a, i) => xs.slice(i + 1).forEach((b) => {
    const h = (b - a) * 0.42;
    arcs.push(`M ${a} 150 Q ${(a + b) / 2} ${150 - h} ${b} 150`);
  }));
  return (
    <div className="d3-schem">
      <svg width="1728" height="420" viewBox="0 0 1728 420" aria-hidden="true">
        <g className="d3-schem__arcs">{arcs.map((d) => <path key={d} d={d} />)}</g>
        {xs.map((x) => <rect key={`a${x}`} className="d3-schem__tok" x={x - 16} y="150" width="32" height="32" />)}
        {xs.map((x) => <rect key={`b${x}`} className="d3-schem__tok" x={x - 16} y="330" width="32" height="32" />)}
        <path className="d3-schem__pass" d={`M ${xs[0] - 16} 346 H ${xs[n - 1] + 30}`} />
        <path className="d3-schem__head" d={`M ${xs[n - 1] + 30} 336 L ${xs[n - 1] + 48} 346 L ${xs[n - 1] + 30} 356 Z`} />
        <g className="d3-schem__state">
          <rect x={xs[n - 1] - 22} y="286" width="44" height="28" rx="4" />
        </g>
      </svg>
      <p className="d3-schem__name" style={{ top: 140 }} data-role="chart">Attention</p>
      <p className="d3-schem__name" style={{ top: 320 }} data-role="chart">Mamba</p>
      <p className="d3-schem__cap" style={{ top: 112 }} data-role="chart">Every position against every other: cost grows with the square of the length</p>
      <p className="d3-schem__cap" style={{ top: 292 }} data-role="chart">One pass, small running memory: cost grows linearly</p>
      <p className="d3-schem__tag" data-role="foot">Schematic</p>
    </div>
  );
}

// What each hypothesis found (chapter 5, tab:disc-hypotheses), for the verdict board.
const EVIDENCE = {
  H1: '{{fair.df1}} F1 on {{fair.n}} unseen scans, at lower precision',
  H2: '{{run2.sens}} found, {{run2.ppv}} precision (run 2, older matcher)',
  H3: 'Equal passes: no faster in mean time, no lower in peak memory',
  H4: 'Interaction {{r6.inter}} on DEEP-PSMA; no clear effect on autoPET',
};

/**
 * The H1 to H4 board. Pending (slide 5) shows each prediction; with verdicts it
 * shows the evidence and the verdict (shape plus label); compact keeps only the
 * name and the verdict, for the question frame.
 */
export function Scoreboard({ verdicts = false, compact = false }) {
  return (
    <ol className={cls('d3-board', compact && 'is-compact')}>
      {HYPOTHESES.map((h) => {
        const state = verdicts ? h.verdict : 'pending';
        return (
          <li key={h.id} className={`d3-board__row is-${state}`}>
            <span className="d3-board__id" data-role="chart">{h.id}</span>
            <span className="d3-board__name" data-role="chart">{h.name}</span>
            {!compact && <span className="d3-board__line" data-role="chart"><T>{verdicts ? EVIDENCE[h.id] : h.line}</T></span>}
            <span className="d3-board__verdict" data-role="chart">
              <VerdictGlyph state={state} size={compact ? 32 : 40} />
              {VERDICTS[state].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BetSlide({ ctx }) {
  const { step } = ctx;
  return (
    <div className="d3-s">
      {step < 2 && (
        <Camera ctx={ctx} frames={[{ x: TOP.w / 2, y: 230, s: 1 }]} from={{ x: TOP.w / 2, y: 230, s: 1.25 }} x={TOP.x} y={TOP.y} w={TOP.w} h={460}>
          <Schematic />
        </Camera>
      )}
      {step === 1 && (
        <p className="d3-wide d3-body" style={{ top: 780 }} data-role="body">
          Switching off U-Mamba's Mamba layers made no difference. So the test needs a CNN-only twin.
        </p>
      )}
      {step >= 2 && (
        <div className={cls('d3-rq', step >= 3 && 'is-small')}>
          <p className="d3-rq__k" data-role="foot">Research question</p>
          <p className="d3-rq__q" data-req="rq" data-role="body">
            Does a hybrid CNN-Mamba network find lesions better than PSMASegmentator on scans neither model trained on, and do its Mamba blocks add anything over a CNN-only twin?
          </p>
        </div>
      )}
      {step >= 3 && (
        <div className="d3-wide" style={{ top: 476 }}>
          <Scoreboard />
        </div>
      )}
    </div>
  );
}
