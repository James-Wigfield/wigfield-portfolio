import { useCallback, useRef, useState } from 'react';
import Clip from '../../engine/Clip';
import { useJson } from '../../engine/hooks';
import { FACTS } from '../../shared/facts';
import { Num, T } from '../../shared/Num';

/* ============================================================================
   PLAIN DECK — THE DEMO SLIDE AND THE BACKUP SLIDES
   ----------------------------------------------------------------------------
   The demo slide follows slide 14 (one Space press) and is left up during
   questions: the real recorded run of the five-model ensemble in the app,
   looping (clips/d1-model-run-loop.mp4, tools/seminar-decks/make_d1_loop.py).
   The backups answer likely questions, one message each, with no motion.
   Words come from the dissertation; every digit is a manifest key. The
   question index for the presenter view, the phone page and the palm cards
   is ./qa.js; the slide list is in ./index.jsx.
   ========================================================================== */

/* ── The demo slide ─────────────────────────────────────────────────────── */
// The app's own overlay colours (tools/seminar-decks/make_d1.py, APP_COLOURS).
const APP = { found: '#2ECC71', missed: '#22D3EE', fa: '#FF4FD8' };
// The app's image panel inside the 1920 x 1080 clip, in clip pixels (measured
// on its frames: x 554 to 1366, y 40 to 1040), shown at DEMO.k.
const DEMO = { x0: 554, y0: 40, w: 812, h: 1000, k: 0.68 };
const MIP_TEXT = 'Result in the app\'s 3D view'; // the cues' last stage (finished state)

function stageAt(cues, t) {
  let cur = cues.stages[0];
  cues.stages.forEach((s) => {
    if (t + 1e-6 >= s.t) cur = s;
  });
  return cur;
}

export function DemoSlide({ ctx }) {
  const cues = useJson('data/d1-loop-cues.json');
  const live = ctx.mode === 'present' && ctx.phase === 'current' && !ctx.still;
  const state = live ? 'play' : ctx.phase === 'next' ? 'start' : 'hold';
  const [stage, setStage] = useState(null);
  const bar = useRef(null);
  // Called every frame while playing: the bar moves directly; the status line
  // re-renders only when the app's stage changes.
  const onTime = useCallback((t) => {
    if (!cues) return;
    const frac = Math.max(0, Math.min(1, (t - cues.run.start) / (cues.run.end - cues.run.start)));
    if (bar.current) bar.current.style.transform = `scaleX(${frac.toFixed(4)})`;
    const s = stageAt(cues, t);
    setStage((cur) => (cur?.t === s.t ? cur : s));
  }, [cues]);
  const text = live && stage ? stage.text : MIP_TEXT;
  const k = DEMO.k;
  return (
    <div className="dp-stage dpd">
      <div className="dpd-panel" style={{ left: 96, top: 262, width: DEMO.w * k, height: DEMO.h * k }}>
        <Clip
          src="d1-model-run-loop"
          state={state}
          mode={ctx.mode}
          reduced={ctx.reduced}
          loop
          onTime={onTime}
          label="A real run of the five-model ensemble in the app on a sealed test scan, sped up; then the result in the app's 3D view"
          style={{ left: -DEMO.x0 * k, top: -DEMO.y0 * k, width: 1920 * k, height: 1080 * k, right: 'auto', bottom: 'auto' }}
        />
      </div>
      <div className="dpd-text" style={{ left: 96 + DEMO.w * k + 72, top: 262 }}>
        <p className="dpd-lead" data-role="body">The five-model ensemble in my app, on a sealed test scan</p>
        <p className="dp-label dp-label--muted dpd-speed" data-role="chart"><T>{'Sped up {{d1.speed}} while it runs; the result then turns in the app\'s 3D view'}</T></p>
        <p className="dpd-status" data-role="body">{text}</p>
        <div className="dpd-bar" aria-hidden="true"><span ref={bar} style={{ transform: live ? 'scaleX(0)' : 'scaleX(1)' }} /></div>
        <ul className="dpd-legend">
          <li className="dp-label" data-role="chart"><span className="dpd-sw" style={{ background: APP.found }} />Found</li>
          <li className="dp-label" data-role="chart"><span className="dpd-sw" style={{ background: APP.missed }} />Missed</li>
          <li className="dp-label" data-role="chart"><span className="dpd-sw" style={{ background: APP.fa }} />False alarm</li>
        </ul>
        <p className="dp-tag" data-role="foot">The app&apos;s own colours. Before the run, cyan shows the ground truth.</p>
        <p className="dp-tag" data-role="foot">Threshold and size filter as written down beforehand; no test-time augmentation.</p>
      </div>
    </div>
  );
}

/* ── Backups: a plain table ─────────────────────────────────────────────── */
function Table({ head, rows, className = '' }) {
  return (
    <table className={`dpb-table ${className}`} data-role="chart">
      {head && (
        <thead>
          <tr>{head.map((h, i) => <th key={i} className={h.cls}>{h.t}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.cls}>{r.cells.map((c, j) => <td key={j} className={c?.cls}>{c?.t ?? c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const num = (k, cls = '') => ({ t: <Num k={k} />, cls: `is-num ${cls}` });
const tx = (s, cls = '') => ({ t: <T>{s}</T>, cls });
const tick = (s) => <span data-tick="">{s}</span>;
const hyb = 'is-hyb';

/* Setup differences (Ch3 tab:method-departures). */
export function SetupBackup() {
  return (
    <div className="dpb">
      <Table
        className="dpb-table--dense"
        head={[{ t: 'Factor' }, { t: 'Hybrid, single version', cls: hyb }, { t: 'PSMASegmentator' }, { t: 'Favours' }]}
        rows={[
          { cells: ['Training scans', tx('{{train.run4_cases}} autoPET-III', hyb), tx('{{psm.train}} ({{psm.train_autopet}} autoPET-III, {{psm.train_wa}} Western Australian)'), 'PSMASegmentator'] },
          { cells: ['Models at inference', { t: 'one', cls: hyb }, tx('{{psm.folds}}, averaged'), 'PSMASegmentator'] },
          { cells: ['Test-time augmentation', { t: 'off', cls: hyb }, tx('on, {{psm.tta}} mirrored passes'), 'PSMASegmentator'] },
          { cells: ['Deep supervision', { t: 'none', cls: hyb }, 'yes', 'PSMASegmentator'] },
          { cells: ['PET/CT misalignment augmentation', { t: 'none', cls: hyb }, 'yes', 'PSMASegmentator'] },
          { cells: ['Training patch', tx('{{patch.small_vox}} voxels', hyb), tx('{{psm.patch_vox}} voxels'), 'PSMASegmentator'] },
          { cells: ['Parameters', tx('{{net.params}}', hyb), tx('about {{psm.params}}'), 'PSMASegmentator'] },
          { cells: ['Optimiser', { t: 'AdamW, cosine decay', cls: hyb }, 'SGD, polynomial decay', 'unclear'] },
          { cells: ['Post-processing', { t: 'none', cls: hyb }, 'disabled for this comparison', 'neither'] },
          { cells: ['Matching rule and scoring grid', { t: 'same script and grid', cls: hyb }, 'same script and grid', 'neither'] },
        ]}
      />
      <p className="dp-label dpb-note" data-role="chart">Most factors favour PSMASegmentator, so the gain is more likely to understate than overstate the recipe; none was tested</p>
    </div>
  );
}

/* Paired differences on the 100 DEEP-PSMA scans (Ch4 tab:results-baseline-differences). */
export function PairedBackup() {
  return (
    <div className="dpb">
      <Table
        head={[{ t: 'Hybrid minus PSMASegmentator' }, { t: 'Points', cls: 'is-num' }, { t: tx('{{ci.level}} interval').t, cls: 'is-num' }]}
        rows={[
          { cells: ['Pooled F1', num('fair.df1', hyb), tx('{{fair.df1_lo}} to {{fair.df1_hi}}', 'is-num')] },
          { cells: ['Pooled found (sensitivity)', num('fair.dsens', hyb), tx('{{fair.dsens_lo}} to {{fair.dsens_hi}}', 'is-num')] },
          { cells: ['Pooled flagged and real (PPV)', num('fair.dppv', hyb), tx('{{fair.dppv_lo}} to {{fair.dppv_hi}}', 'is-num')] },
          { cells: ['Per-scan F1, mean', num('fair.pc_df1', hyb), tx('{{fair.pc_lo}} to {{fair.pc_hi}}', 'is-num')] },
          { cells: ['Per-scan Dice, mean', num('fair.ddsc', hyb), tx('{{fair.ddsc_lo}} to {{fair.ddsc_hi}}', 'is-num')] },
        ]}
      />
      <div className="dpb-notes">
        <p className="dp-label" data-role="chart"><T>{'Per scan: better on {{fair.better}}, worse on {{fair.worse}}, tied on {{fair.tied}}'}</T></p>
        <p className="dp-label" data-role="chart"><T>{'Fewer than {{fair.lt20_cut}} lesions: worse on {{fair.lt20_lower}} of {{fair.lt20_n}}; {{fair.ge100_cut}} or more: better on {{fair.ge100_higher}} of {{fair.ge100_n}}'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart">Paired bootstrap over patients; pooled F1 weighs lesion-heavy scans the most</p>
      </div>
    </div>
  );
}

/* A large figure with its label. */
function Stat({ children, label, sub, accent }) {
  return (
    <div className="dpb-stat">
      <p className={`dpb-stat__n${accent ? ' is-hyb' : ''}`} data-role="chart">{children}</p>
      <div>
        <p className="dp-label" data-role="chart">{label}</p>
        {sub && <p className="dp-label dp-label--muted" data-role="chart">{sub}</p>}
      </div>
    </div>
  );
}

/* False alarms on scans with no lesions (Ch4:120-122, Ch5:185-213). */
export function NegativesBackup() {
  return (
    <div className="dpb dpb--stats">
      <Stat accent label={<T>{'of the {{data.test_neg}} sealed test scans with no lesions were flagged'}</T>} sub="by the final five-model ensemble">
        <Num k="r5.neg_flag" />
      </Stat>
      <Stat label="each version alone, before averaging" sub="the ensemble flagged fewer than any version alone">
        <T>{'{{r5.neg_fold_min}} to {{r5.neg_fold_max}}'}</T>
      </Stat>
      <Stat label={<T>{'false alarms on the {{organ.neg}} validation scans with no lesions'}</T>} sub="an earlier version, before and after the organ head">
        <T>{'{{organ.fc3}} to {{organ.fc4}}'}</T>
      </Stat>
      <p className="dp-label dpb-note" data-role="chart">First change to try: the organ head at every deep-supervision level, as PSMASegmentator has</p>
      <p className="dp-label dp-label--muted" data-role="chart">Here the organ head is single-scale, with no post-processing behind it</p>
    </div>
  );
}

/* The lesion matching rule and Dice (Ch3 sec:method-evaluation-lesion, Ch5:311-316). */
export function MatchingBackup() {
  return (
    <div className="dpb dpb--two">
      <div className="dpb-col">
        <p className="dp-kicker" data-role="chart">The rule</p>
        <p className="dp-label" data-role="chart"><b>Found:</b> a lesion that any predicted voxel touches</p>
        <p className="dp-label" data-role="chart"><b>False alarm:</b> a predicted component touching no lesion</p>
        <p className="dp-label" data-role="chart">The same scoring script for both models, on the same grid</p>
        <p className="dp-label dp-label--muted" data-role="chart">written by Joel Noble, used with his permission</p>
        <p className="dp-label" data-role="chart">The rule is blind to over-segmentation, so Dice is reported beside every lesion figure</p>
      </div>
      <div className="dpb-col">
        <p className="dp-kicker" data-role="chart"><T>{'Dice on the {{fair.n}} DEEP-PSMA scans'}</T></p>
        <Stat accent label="Hybrid, single version"><Num k="fair.r4_dsc" /></Stat>
        <Stat label="PSMASegmentator"><Num k="fair.psm_dsc" /></Stat>
        <p className="dp-label" data-role="chart"><T>{'{{fair.ddsc}} points ({{fair.ddsc_lo}} to {{fair.ddsc_hi}}), consistent with finding more lesions without smearing'}</T></p>
      </div>
    </div>
  );
}

/* Labels of the two datasets (Ch3 tab:method-datasets, Ch5:324-340). */
export function LabelsBackup() {
  return (
    <div className="dpb dpb--two">
      <div className="dpb-col">
        <p className="dp-kicker" data-role="chart">autoPET-III</p>
        <p className="dp-label" data-role="chart">SUV threshold within drawn volumes of interest, then corrected slice by slice by an expert</p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'Sealed test, {{data.test_autopet}} scans: found {{r5.ap_sens}}, flagged and real {{r5.ap_ppv}}'}</T></p>
      </div>
      <div className="dpb-col">
        <p className="dp-kicker" data-role="chart">DEEP-PSMA</p>
        <p className="dp-label" data-role="chart"><T>{'SUV of at least {{data.suv}}, physiological uptake removed by a nuclear medicine physician'}</T></p>
        <p className="dp-label" data-role="chart"><T>{'About {{data.dp_components}} separate pieces per scan'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'Sealed test, {{data.test_deeppsma}} scans: found {{r5.dp_sens}}, flagged and real {{r5.dp_ppv}}'}</T></p>
      </div>
      <div className="dpb-wide">
        <p className="dp-kicker" data-role="chart">Possible explanation, not tested</p>
        <p className="dp-label" data-role="chart">A model trained mostly on expert-corrected labels covers the bulk of each lesion but misses many small thresholded pieces</p>
        <p className="dp-label" data-role="chart">Nearly everything it predicts then lands on thresholded disease</p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'The final model trained on {{data.pool_deeppsma}} of the {{data.deeppsma}} DEEP-PSMA scans; Dice is not comparable across the two'}</T></p>
      </div>
    </div>
  );
}

/* Mamba only in the deepest three stages (Ch3:252-300). */
export function StagesBackup() {
  const conv = 'convolutions';
  return (
    <div className="dpb">
      <Table
        head={[{ t: 'Stage' }, { t: 'Channels', cls: 'is-num' }, { t: 'Sequence length per direction', cls: 'is-num' }, { t: 'Blocks' }]}
        rows={[
          { cells: [tick('1'), num('net.ch1'), num('net.tok1'), conv] },
          { cells: [tick('2'), num('net.ch2'), num('net.tok2'), conv] },
          { cells: [tick('3'), num('net.ch3'), num('net.tok3', hyb), tx('convolutions and {{net.mb3}} Mamba blocks', hyb)] },
          { cells: [tick('4'), num('net.ch4'), num('net.tok4', hyb), tx('convolutions and {{net.mb4}} Mamba blocks', hyb)] },
          { cells: [tick('5'), num('net.ch5'), num('net.tok5', hyb), tx('convolutions and {{net.mb5}} Mamba blocks', hyb)] },
        ]}
      />
      <div className="dpb-notes">
        <p className="dp-label" data-role="chart">The shallow stages hold low-level texture, which convolution handles more cheaply than a scan of that length</p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'Each Mamba block scans {{net.dirs}} directions and sums them; neither choice was tested against an alternative'}</T></p>
      </div>
    </div>
  );
}

/* The CNN-only version's size (Ch3:262-272, 591-598). */
export function SizeBackup() {
  const W = 1100 / 105; // px per million parameters
  const bars = [
    { name: 'Hybrid CNN-Mamba', k: 'net.params', cls: 'is-hyb', sub: <T>{'of which {{net.params_mamba}} in the Mamba blocks'}</T> },
    { name: 'CNN-only version', k: 'net.twin_params', cls: 'is-cnn', sub: <T>{'{{net.twin_pct}} of the hybrid'}</T> },
    { name: 'PSMASegmentator', k: 'psm.params', cls: 'is-psm', pre: 'about ' },
  ];
  return (
    <div className="dpb">
      <p className="dp-kicker" data-role="chart">Parameters</p>
      <div className="dpb-bars">
        {bars.map((b) => (
          <div key={b.k} className="dpb-barrow">
            <p className="dp-label dpb-barrow__name" data-role="chart">{b.name}</p>
            <span className={`dpb-bar ${b.cls}`} style={{ width: FACTS[b.k].value * W }} aria-hidden="true" />
            <p className="dp-label dpb-barrow__v" data-role="chart"><b>{b.pre}<Num k={b.k} /></b>{b.sub && <span className="dp-label--muted"> {b.sub}</span>}</p>
          </div>
        ))}
      </div>
      <div className="dpb-notes">
        <p className="dp-label" data-role="chart">Capacity is a confound in the comparison with PSMASegmentator</p>
        <p className="dp-label" data-role="chart">In the CNN-only comparison the parameter gap is the same at both patch sizes, so it cannot on its own make the gap between them change with patch size, if the effects add</p>
      </div>
    </div>
  );
}

/* One training run per model, and batch size 1 (Ch3:588-598, Ch4:351-357, Ch5:406-409). */
export function OneRunBackup() {
  const ci = (lo, hi) => tx(`{{${lo}}} to {{${hi}}}`, 'is-num');
  return (
    <div className="dpb">
      <Table
        head={[{ t: tx('F1 on the {{fair.n}} DEEP-PSMA scans').t }, { t: 'Points', cls: 'is-num' }, { t: tx('{{ci.level}} interval').t, cls: 'is-num' }, { t: 'Under the rule' }]}
        rows={[
          { cells: ['Hybrid minus CNN-only, larger patch', num('r6.gap_large_dp', hyb), ci('r6.gap_large_dp_lo', 'r6.gap_large_dp_hi'), 'real'] },
          { cells: ['Hybrid minus CNN-only, final model\'s patch', num('r6.gap_small_dp', hyb), ci('r6.gap_small_dp_lo', 'r6.gap_small_dp_hi'), 'no clear effect'] },
          { cls: 'is-strong', cells: ['Difference between those two gaps', num('r6.inter', hyb), ci('r6.inter_lo', 'r6.inter_hi'), 'real'] },
          { cells: ['Larger patch, hybrid', num('r6.h_patch', hyb), ci('r6.h_patch_lo', 'r6.h_patch_hi'), 'real'] },
          { cells: ['Larger patch, CNN-only version', num('r6.c_patch', hyb), ci('r6.c_patch_lo', 'r6.c_patch_hi'), 'no clear effect'] },
        ]}
      />
      <div className="dpb-notes">
        <p className="dp-label" data-role="chart"><T>{'Rule, written down before scoring: the interval excludes zero and the size is at least {{r6.rule}} point'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'One training run per model; the final model\'s five versions spread by about {{r6.seed_spread}} points'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'Larger patch at batch size {{r6.batch_large}}, the final model\'s patch at {{r6.batch_small}}; several seeds per model, with the larger patch at batch size {{r6.batch_small}}, would settle both'}</T></p>
      </div>
    </div>
  );
}

/* Timing in the dissertation and in the abstract (Ch4:654-690; the abstract's home-PC benchmark). */
export function TimingBackup() {
  return (
    <div className="dpb">
      <Table
        head={[{ t: tx('Mean time per scan, one {{eff.gpu}}, {{eff.n}} sealed DEEP-PSMA test scans').t }, { t: 'Hybrid', cls: `is-num ${hyb}` }, { t: 'PSMASegmentator', cls: 'is-num' }]}
        rows={[
          { cells: [tx('Default settings: {{eff.passes_h}} against {{eff.passes_p}} passes'), num('eff.h5', hyb), num('eff.p40')] },
          { cells: [tx('Same passes, {{eff.passes_h}} each'), num('eff.h5', hyb), num('eff.p5')] },
          { cells: [tx('Same passes, {{eff.passes_p}} each'), num('eff.h40', hyb), num('eff.p40')] },
          { cells: [tx('Median, {{eff.passes_h}} passes each'), num('eff.h5_med', hyb), num('eff.p5_med')] },
          { cells: ['Peak memory', num('eff.vram_h', hyb), num('eff.vram_p')] },
        ]}
      />
      <Table
        className="dpb-table--second"
        head={[{ t: tx('The abstract\'s home-PC benchmark, one {{abs.home_gpu}} (not in the dissertation)').t }, { t: 'Hybrid', cls: `is-num ${hyb}` }, { t: 'PSMASegmentator', cls: 'is-num' }]}
        rows={[
          { cells: ['Published settings, mean seconds per scan', num('abs.home_h', hyb), num('abs.home_p')] },
          { cells: [tx('Same passes, {{eff.passes_h}} each, mean seconds'), num('abs.home_eq_h', hyb), num('abs.home_eq_p')] },
        ]}
      />
      <p className="dp-label dpb-note" data-role="chart">The default gap comes from PSMASegmentator&apos;s test-time augmentation, not the architecture</p>
    </div>
  );
}

/* Cross-validation and the five folds (Ch3:148-161, Ch4:26-37, 96-108). */
export function FoldsBackup() {
  return (
    <div className="dpb dpb--stats">
      <Stat label={<T>{'scans in the cross-validation pool, in {{data.folds}} folds split by patient'}</T>} sub={<T>{'{{data.fold0}} in the first fold, {{data.fold_n}} in each of the others'}</T>}>
        <Num k="data.pool" />
      </Stat>
      <Stat label={<T>{'pooled F1 over the {{data.pool}} scans, each scored by the version that never trained on it'}</T>} sub={<T>{'fold-to-fold standard deviation {{cv.sd}} points'}</T>}>
        <Num k="cv.f1" />
      </Stat>
      <Stat accent label="F1 of the five versions averaged, on the sealed test set" sub={<T>{'one version alone: {{r5.single_f1}} on average (standard deviation {{r5.single_sd}})'}</T>}>
        <Num k="r5.f1" />
      </Stat>
    </div>
  );
}

/* Test-set results by cohort, with intervals (Ch4 tab:results-test). */
export function CohortsBackup() {
  const cell = (k, lo, hi, cls = '') => ({
    t: (
      <>
        <Num k={k} />
        <span className="dpb-ci" data-role="foot"><T>{`{{${lo}}} to {{${hi}}}`}</T></span>
      </>
    ),
    cls: `is-num ${cls}`,
  });
  return (
    <div className="dpb">
      <Table
        className="dpb-table--ci"
        head={[{ t: 'Sealed test set' }, { t: 'F1', cls: 'is-num' }, { t: 'Found', cls: 'is-num' }, { t: 'Flagged and real', cls: 'is-num' }]}
        rows={[
          { cls: 'is-strong', cells: [tx('Pooled, {{data.test}} scans'), cell('r5.f1', 'r5.f1_lo', 'r5.f1_hi', hyb), cell('r5.sens', 'r5.sens_lo', 'r5.sens_hi'), cell('r5.ppv', 'r5.ppv_lo', 'r5.ppv_hi')] },
          { cells: [tx('autoPET-III, {{data.test_autopet}} scans'), cell('r5.ap_f1', 'r5.ap_f1_lo', 'r5.ap_f1_hi', hyb), cell('r5.ap_sens', 'r5.ap_sens_lo', 'r5.ap_sens_hi'), cell('r5.ap_ppv', 'r5.ap_ppv_lo', 'r5.ap_ppv_hi')] },
          { cells: [tx('DEEP-PSMA, {{data.test_deeppsma}} scans (in-domain)'), cell('r5.dp_f1', 'r5.dp_f1_lo', 'r5.dp_f1_hi', hyb), cell('r5.dp_sens', 'r5.dp_sens_lo', 'r5.dp_sens_hi'), cell('r5.dp_ppv', 'r5.dp_ppv_lo', 'r5.dp_ppv_hi')] },
        ]}
      />
      <div className="dpb-notes">
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'{{ci.level}} intervals from a bootstrap over patients, added after the test set was scored; no point estimate changed'}</T></p>
        <p className="dp-label dp-label--muted" data-role="chart"><T>{'In-domain: the final model trained on {{data.pool_deeppsma}} of the {{data.deeppsma}} DEEP-PSMA scans'}</T></p>
      </div>
    </div>
  );
}
