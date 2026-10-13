import { useState } from 'react';
import { Num, T } from '../../shared/Num';
import { Logo } from '../../shared/chrome';
import { Ref } from './parts';
import { TALK } from '../../shared/meta';
import DemoClip from '../../shared/DemoClip';
import { ClipStack, Still, TitleLoop } from './parts';
import {
  Board, FairDotsPanel, FairResult, N1Legend, N1Windows, N2Lengths, N2Sequence, N3Tiles, OptionF,
  PooledBars, SealedGrid, Split, Thanks, TwinSlope, Underdog,
} from './figures';

/* ============================================================================
   ONE SCAN, START TO FINISH — SLIDE BODIES (components only)
   Each takes ctx and draws everything inside the frame's stage. Elements
   that leave the screen before a slide's last build drop their data-role,
   so the gates count only what is on screen at the end.
   ========================================================================== */

const on = (cond) => (cond ? ' is-on' : '');
const role = (cond, r = 'body') => (cond ? r : undefined);
const live = (ctx) => ctx.still || ctx.phase === 'current';

/* 1 ─ Title over the slow turn of case A */
export function TitleSlide({ ctx }) {
  return (
    <>
      <TitleLoop ctx={ctx} />
      <div className="d1-titleblock">
        <p className="d1-kicker" data-role="foot">Honours seminar · The University of Western Australia</p>
        <span className="d1-goldrule" aria-hidden="true" />
        <h1 className="d1-titleblock__title" data-req="title" data-role="title">{TALK.title}</h1>
        <div className="d1-titleblock__who" data-req="supervisors">
          <p className="d1-titleblock__name" data-role="body">{TALK.presenter}</p>
          <p className="d1-titleblock__sup" data-role="body">{TALK.supervisorsLine}</p>
        </div>
        <Logo size="large" chip className="d1-titleblock__logo" />
      </div>
    </>
  );
}

/* 2 ─ Case A: the scan, the count, the cost of doing it by hand */
export function ScanSlide({ ctx }) {
  // Once the clip has ended, its own large headline is covered (it competed
  // with the slide title); its small kicker "Case A · autoPET-III" stays.
  const [ended, setEnded] = useState(false);
  const covered = ended || ctx.step >= 1 || ctx.clip(0) === 'hold';
  return (
    <>
      <ClipStack ctx={ctx} clips={[{ src: 'case-a-1-scan', at: 0, label: 'Case A, a held-out whole-body PSMA PET/CT scan, turning once', onEnded: () => setEnded(true) }]} />
      <div className={`d1-cover d1-cover--a1head${on(covered)}`} aria-hidden="true" />
      <div className="d1-rcol">
        <div className={`d1-reveal${on(ctx.at(1))}`}>
          <p className="d1-body" data-role="body">Outlining every lesion in 3D is called segmentation.</p>
          <p className="d1-body is-soft" data-role="body">By hand, it is slow.</p>
        </div>
        <div className={`d1-reveal d1-scan__agree${on(ctx.at(2))}`}>
          <p className="d1-stat"><Num k="lit.obs_dsc_round" /></p>
          <p className="d1-body" data-role="body">
            <T>{"overlap (Dice) between two experts' outlines of the same {{lit.obs_scans}} scans"}</T> <Ref k="kendrick2022" ctx={ctx} />
          </p>
        </div>
      </div>
    </>
  );
}

/* 3 ─ The project in one breath (mirrors the published abstract) */
const OVERVIEW = [
  ['Problem', 'Lesions are small and scattered.'],
  ['Idea', 'More context per window, from Mamba.'],
  ['Network', 'Mamba in the deepest three stages, plus an organ task.'],
  ['Data', '{{data.total}} scans, {{data.test}} sealed until the end.'],
  ['Tests', 'A fair comparison and a CNN-only twin.'],
];

export function OverviewSlide({ ctx }) {
  return (
    <>
      <Still src="clips/case-a-1-scan.png" alt="Case A, the held-out scan, facing front" />
      <div className="d1-cover d1-cover--a1text" aria-hidden="true" />
      <div className="d1-cover d1-cover--a1legend" aria-hidden="true" />
      <ol className={`d1-overview${on(live(ctx))}`}>
        {OVERVIEW.map(([k, line], i) => (
          <li key={k} className="d1-overview__row" style={{ transitionDelay: `${0.15 + 0.22 * i}s` }}>
            <span className="d1-overview__k" data-role="chart">{k}</span>
            <span className="d1-overview__v" data-role="body"><T>{line}</T></span>
          </li>
        ))}
      </ol>
    </>
  );
}

/* 4 ─ Previous work: windows to scale (N1) */
export function WindowsSlide({ ctx }) {
  return (
    <>
      <Still src="clips/case-a-1-scan.png" alt="Case A, the held-out scan, facing front" />
      <div className="d1-cover d1-cover--a1text" aria-hidden="true" />
      <div className="d1-cover d1-cover--a1legend" aria-hidden="true" />
      <N1Windows step={ctx.step} />
      <div className="d1-lbody">
        <p className="d1-body" data-role="body">
          nnU-Net builds a convolutional neural network (CNN). <Ref k="isensee2021" ctx={ctx} />
        </p>
        <p className="d1-body is-soft" data-role="body">GPU memory caps how big each window can be.</p>
      </div>
      <div className={`d1-k22${on(ctx.at(2))}`}>
        <p className="d1-label" data-role={role(ctx.at(2), 'chart')}>Context only, not comparable</p>
        <p className="d1-k22__name" data-role={role(ctx.at(2), 'chart')}>The 2022 nnU-Net cascade (Kendrick et al.) <Ref k="kendrick2022" ctx={ctx} /></p>
        <p className="d1-k22__stats" data-role={role(ctx.at(2), 'chart')}>
          <span>F1 <Num k="k22.f1" /></span>
          <span>precision <Num k="k22.ppv" /></span>
          <span>sensitivity <Num k="k22.sens" /></span>
        </p>
        <p className="d1-k22__note" data-role={role(ctx.at(2), 'chart')}><T>{'on its own {{k22.test}}-scan test set and scoring rule'}</T></p>
      </div>
      <div className="d1-rcol d1-rcol--n1">
        <N1Legend step={ctx.step} />
      </div>
    </>
  );
}

/* 5 ─ The idea, the warning, the research question and H1 to H4 */
export function IdeaSlide({ ctx }) {
  const early = ctx.step < 2;
  return (
    <>
      <div className={`d1-idea${on(early)}`} aria-hidden={!early || undefined}>
        <div className="d1-idea__n2">
          <N2Sequence />
          <N2Lengths />
        </div>
        <div className={`d1-warn${on(ctx.step === 1)}`}>
          <p className="d1-label is-gold" data-role={role(ctx.step === 1, 'chart')}>A warning about U-Mamba</p>
          <p className="d1-warn__quote" data-role={role(ctx.step === 1)}>&quot;the mamba layers actually have no effect on performance&quot;</p>
          <p className="d1-warn__who" data-role={role(ctx.step === 1, 'chart')}>
            Isensee et al., re-running U-Mamba with its Mamba layers switched off <Ref k="ma2024" ctx={ctx} /> <Ref k="isensee2024" ctx={ctx} />
          </p>
          <p className="d1-warn__so" data-role={role(ctx.step === 1)}>So my test needs a twin without Mamba.</p>
        </div>
      </div>
      <div className={`d1-rq${on(ctx.step >= 2)}`}>
        <div data-req="rq">
          <p className="d1-label is-gold" data-role={role(ctx.step >= 2, 'chart')}>Research question</p>
          <p className="d1-rq__text" data-role={role(ctx.step >= 2)}>
            Does a hybrid CNN-Mamba network detect lesions better than PSMASegmentator on scans neither model trained on, and do its Mamba blocks add anything over a CNN-only twin?
          </p>
        </div>
        <Board show={ctx.step >= 3} />
      </div>
    </>
  );
}

/* 6 ─ Data and protocol (N3) */
export function DataSlide({ ctx }) {
  return <N3Tiles step={ctx.step} />;
}

/* 7 ─ The network: option F (N8) */
export function NetworkSlide({ ctx }) {
  return <OptionF step={ctx.step} />;
}

/* 8 ─ Windows, five models, threshold and filter: clips A2a, A2b, A2c */
export function EnsembleSlide({ ctx }) {
  return (
    <ClipStack
      ctx={ctx}
      clips={[
        { src: 'case-a-2a-model', at: 0, under: 'case-a-1-scan', label: 'Case A read by the network one overlapping window at a time' },
        { src: 'case-a-2b-ensemble', at: 1, under: 'case-a-2a-model', label: "The five fold models' probability maps" },
        { src: 'case-a-2c-threshold', at: 2, under: 'case-a-2b-ensemble', label: 'The averaged map, thresholded, with small specks removed' },
      ]}
    />
  );
}

/* 9 ─ The prediction, the verdicts, the score: clips A3, A4, A5 */
export function VerdictsSlide({ ctx }) {
  return (
    <ClipStack
      ctx={ctx}
      clips={[
        { src: 'case-a-3-prediction', at: 0, under: 'case-a-2c-threshold', label: "Case A's predicted regions, turning once" },
        { src: 'case-a-4-ground-truth', at: 1, under: 'case-a-3-prediction', label: 'Case A against the ground truth: found, missed and false alarms' },
        { src: 'case-a-5-accuracy', at: 2, under: 'case-a-4-ground-truth', label: "Case A's score card" },
      ]}
    />
  );
}

/* 10 ─ Zoom out: all sealed scans, pooled */
export function SealedSlide({ ctx }) {
  return (
    <>
      <SealedGrid live={live(ctx)} />
      <div className="d1-sealedright">
        <PooledBars show={ctx.at(1)} />
        <div className={`d1-sealednotes${on(ctx.at(2))}`}>
          <p className="d1-body" data-role={role(ctx.at(2))}><T>{'Pooled: lesions added up over all {{data.test}} scans.'}</T></p>
          <p className="d1-body" data-role={role(ctx.at(2))}>In-domain: the same two datasets the models trained on.</p>
          <p className="d1-body is-soft" data-role={role(ctx.at(2))}><T>{'{{ci.level}} interval on F1: {{r5.f1_lo}} to {{r5.f1_hi}}.'}</T></p>
        </div>
      </div>
    </>
  );
}

/* 11 ─ The fair comparison: underdog card, result, one dot per scan */
export function FairSlide({ ctx }) {
  const dots = ctx.step >= 2;
  return (
    <>
      {!dots && (
        <div className="d1-fair">
          <p className="d1-fair__sub" data-role="body"><T>{'{{fair.n}} DEEP-PSMA scans that neither model trained on'}</T></p>
          <Underdog />
          <div className={`d1-fair__res${on(ctx.at(1))}`}>{ctx.at(1) && <FairResult />}</div>
        </div>
      )}
      {dots && (
        <div className="d1-fairdots">
          <p className="d1-fairdots__head" data-role="body">
            <T>{'Pooled, run 4 was {{fair.df1}} F1 points ahead. Scan by scan, there is no clear difference.'}</T>
          </p>
          <FairDotsPanel />
          <p className="d1-fairdots__cap" data-role="body">
            <T>{'Each dot is one scan. Run 4 better on {{fair.better}}, worse on {{fair.worse}}, tied on {{fair.tied}}.'}</T>
          </p>
        </div>
      )}
    </>
  );
}

/* 12 ─ The twist: the CNN-only twin, efficiency, the scoreboard */
export function TwinSlide({ ctx }) {
  const board = ctx.step >= 3;
  return (
    <>
      <div className={`d1-twinchart${on(!board)}`} aria-hidden={board || undefined}>
        <TwinSlope step={ctx.step} />
        <p className="d1-note" data-role={role(!board, 'foot')}>Only run 4&apos;s gap to PSMASegmentator was bootstrapped. One training run per cell.</p>
      </div>
      <div className={`d1-twinside${on(!board)}`}>
        <div className="d1-reveal is-on">
          <p className="d1-label" data-role={role(!board, 'chart')}>The twin</p>
          <p className="d1-body" data-role={role(!board)}>
            <T>{'Same network and recipe, every Mamba block removed: {{net.twin_params}} parameters, {{net.twin_pct}} of the hybrid.'}</T>
          </p>
        </div>
        <div className={`d1-reveal${on(ctx.at(1))}`}>
          <p className="d1-label is-gold" data-role={role(!board && ctx.at(1), 'chart')}>Pre-registered test</p>
          <p className="d1-body" data-role={role(!board && ctx.at(1))}>
            <T>{'Difference between the drops: {{r6.inter}} points ({{r6.inter_lo}} to {{r6.inter_hi}}). Real under the rule.'}</T>
          </p>
        </div>
        <div className={`d1-reveal${on(ctx.at(2))}`}>
          <p className="d1-label" data-role={role(!board && ctx.at(2), 'chart')}>Efficiency</p>
          <p className="d1-body" data-role={role(!board && ctx.at(2))}>At equal passes, no faster in mean time and no lower in peak memory.</p>
          <p className="d1-body is-soft d1-twinside__tta" data-role={role(!board && ctx.at(2))}>
            <T>{"The abstract's {{abs.home_h}} against {{abs.home_p}} seconds came from PSMASegmentator's {{psm.tta}} mirrored passes."}</T>
          </p>
        </div>
      </div>
      <div className={`d1-twinboard${on(board)}`}>
        <Board resolved show={board} />
      </div>
    </>
  );
}

/* 13 ─ Where it fails, limits, meaning and next step, the demo, then the
   closing frame: case A beside case B with the conclusion */
export function CloseSlide({ ctx }) {
  const s = ctx.step;
  return (
    <>
      <ClipStack
        ctx={ctx}
        hidden={s >= 3}
        clips={[
          { src: 'case-b-4-ground-truth', at: 0, under: 'case-b-3-prediction', label: 'Case B against the ground truth: both lesions found, 14 false alarms' },
        ]}
      />
      <div className={`d1-closepanel${on(s === 1 || s === 2)}`}>
        {s === 1 && (
          <div className="d1-closepanel__in" data-req="limitations">
            <p className="d1-label is-gold" data-role="chart">Limitations</p>
            <p className="d1-body" data-role="body">Two public datasets with different labels; never the SCGH data the research proposal named.</p>
            <p className="d1-body" data-role="body">One training run per run 6 cell.</p>
            <p className="d1-body" data-role="body"><T>{'Only {{data.test_neg}} test scans without lesions.'}</T></p>
          </div>
        )}
        {s === 2 && (
          <div className="d1-closepanel__in">
            <p className="d1-label is-gold" data-role="chart">What it means</p>
            <p className="d1-body" data-role="body">On unseen scans, run 4 found more lesions than PSMASegmentator, at lower precision. There the CNN-only twin did as well.</p>
            <p className="d1-body" data-role="body">The contribution: a fair test on scans unseen by both, and a pre-registered test of what the Mamba blocks add.</p>
            <p className="d1-body is-next" data-req="future" data-role="body">Next: retrain and score it on the Sir Charles Gairdner Hospital cohort, once the code is released.</p>
          </div>
        )}
      </div>
      {s >= 2 && s <= 3 && (
        <div className={`d1-demo${on(s === 3)}`}>
          <p className="d1-label" data-role={role(s === 3, 'chart')}>Recorded in my app</p>
          <div className="d1-demo__box">
            <DemoClip state={ctx.clip(3)} mode={ctx.mode} reduced={ctx.reduced} layout="row" />
          </div>
        </div>
      )}
      {s === 4 && (
        <div className="d1-closing">
          <Split />
          <Thanks />
        </div>
      )}
    </>
  );
}
