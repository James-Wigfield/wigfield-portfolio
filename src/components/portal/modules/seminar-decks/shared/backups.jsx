import DemoClip from './DemoClip';
import { BarGroups, Legend } from './charts';
import { FairDots, RefList } from './BackupParts';
import Exhibit from './Exhibit';
import { Num, T } from './Num';

/* ============================================================================
   SEMINAR DECKS — BACKUP SLIDES (shared content, themed by each deck)
   ----------------------------------------------------------------------------
   Twelve slides for questions, reached from the presenter view's Q&A crib.
   One message each. Every deck appends BACKUPS (or a themed copy) after its
   main slides; the deck's Frame draws the chrome and its CSS variables colour
   the content (classes sd-bk-*). Scripts are 40 to 90 words, written as the
   answer to the likely question. Numbers only through {{keys}} and <Num>.
   ========================================================================== */

const row = (cells, key) => (
  <tr key={key}>{cells.map((c, i) => <td key={i}>{c}</td>)}</tr>
);

// A structural label (run or stage number): a name, not a measured value (gate G1 allow-list).
const lbl = (n) => <span data-tick="">{n}</span>;

export const BACKUPS = [
  {
    id: 'b-cohorts',
    backupId: 'b-cohorts',
    title: 'Both cohorts reach F1 {{r5.ap_f1}}, by different routes',
    media: [],
    render: () => (
      <div className="sd-bk sd-bk--split">
        <div className="sd-bk__chart">
          <BarGroups
            width={980}
            height={540}
            groups={[
              { label: 'F1', bars: [{ k: 'r5.ap_f1', series: 'a' }, { k: 'r5.dp_f1', series: 'b' }] },
              { label: 'Precision', bars: [{ k: 'r5.ap_ppv', series: 'a' }, { k: 'r5.dp_ppv', series: 'b' }] },
              { label: 'Sensitivity', bars: [{ k: 'r5.ap_sens', series: 'a' }, { k: 'r5.dp_sens', series: 'b' }] },
            ]}
          />
          <Legend items={[{ series: 'a', label: <T>{'autoPET-III, {{data.test_autopet}} scans'}</T> }, { series: 'b', label: <T>{'DEEP-PSMA, {{data.test_deeppsma}} scans (in-domain)'}</T> }]} />
        </div>
        <ul className="sd-bk__notes">
          <li data-role="body">autoPET-III: expert-corrected outlines</li>
          <li data-role="body"><T>{'DEEP-PSMA: every voxel at SUV {{data.suv}} or more, normal uptake painted out'}</T></li>
          <li data-role="body"><T>{'About {{data.dp_components}} pieces per DEEP-PSMA scan'}</T></li>
        </ul>
      </div>
    ),
    script: {
      text: 'The two cohorts label lesions differently, so I report them separately. autoPET-III outlines were corrected slice by slice by an expert. DEEP-PSMA marks every voxel at SUV {{data.suv}} or more, with normal uptake painted out, so a scan splits into about {{data.dp_components}} small pieces. The likely reason for the gap: on DEEP-PSMA nearly everything the model predicts lands on disease, so precision is {{r5.dp_ppv}}, but it misses many small pieces. Both land on the same F1.',
    },
  },
  {
    id: 'b-cv',
    backupId: 'b-cv',
    title: 'Cross-validation agreed with the sealed test',
    render: () => (
      <div className="sd-bk sd-bk--figures">
        <div className="sd-bk__fig"><span className="sd-bk__big"><Num k="cv.f1" /></span><span className="sd-bk__cap" data-role="body"><T>{'Cross-validation, {{data.pool}} scans pooled (fold sd {{cv.sd}})'}</T></span></div>
        <div className="sd-bk__fig"><span className="sd-bk__big"><Num k="r5.f1" /></span><span className="sd-bk__cap" data-role="body"><T>{'Sealed test, {{data.test}} scans ({{r5.f1_lo}} to {{r5.f1_hi}})'}</T></span></div>
        <div className="sd-bk__fig"><span className="sd-bk__big"><Num k="r5.single_f1" /></span><span className="sd-bk__cap" data-role="body"><T>{'One fold model alone, plus or minus {{r5.single_sd}}'}</T></span></div>
      </div>
    ),
    script: {
      text: 'Before the test, each of the {{data.pool}} pool scans was predicted by the fold model that never trained on it. That pooled F1 was {{cv.f1}}, with a fold-to-fold spread of {{cv.sd}} points, and it sits inside the test interval of {{r5.f1_lo}} to {{r5.f1_hi}}. A single fold model scored {{r5.single_f1}} on average on the test set, so averaging the five added about {{r5.ens_f1_gain}} points.',
    },
  },
  {
    id: 'b-departures',
    backupId: 'b-departures',
    title: 'Most recipe differences favour PSMASegmentator',
    render: () => (
      <table className="sd-bk-table" data-role="body">
        <thead data-role="chart">
          <tr><th>Factor</th><th>Run 4 (mine)</th><th>PSMASegmentator</th><th>Favours</th></tr>
        </thead>
        <tbody>
          {row(['Training scans', <Num k="train.run4_cases" key="a" />, <Num k="psm.train" key="b" />, 'PSMASegmentator'], 1)}
          {row(['Models at inference', 'one', <><Num k="psm.folds" /> averaged</>, 'PSMASegmentator'], 2)}
          {row(['Test-time augmentation', 'off', <><Num k="psm.tta" /> mirrored passes</>, 'PSMASegmentator'], 3)}
          {row(['Training window', <><Num k="patch.small_vox" /> voxels</>, <><Num k="psm.patch_vox" /> voxels</>, 'PSMASegmentator'], 4)}
          {row(['Parameters', <Num k="net.params" key="a" />, <Num k="psm.params" key="b" />, 'PSMASegmentator'], 5)}
          {row(['Optimiser', 'AdamW', 'SGD', 'unclear'], 6)}
          {row(['Post-processing', 'none', 'off for this test', 'neither'], 8)}
          {row(['Matching rule, grid, labels', 'same', 'same', 'neither'], 7)}
        </tbody>
      </table>
    ),
    script: {
      text: 'This is the honest list of what differs. PSMASegmentator trained on {{psm.train}} scans against my {{train.run4_cases}}, averages five models with eight mirrored passes, uses a bigger window, and has {{psm.params}} parameters against {{net.params}}. It also has deep supervision and a misalignment augmentation that I did not port. Most factors favour it, so my gain is more likely to understate than overstate the recipe, but none was tested on run 4.',
    },
  },
  {
    id: 'b-percase',
    backupId: 'b-percase',
    title: 'Scan by scan, there is no clear difference',
    media: ['data/fair-per-case.json'],
    render: () => (
      <div className="sd-bk sd-bk--chart">
        <FairDots />
        <p className="sd-bk__caption" data-role="body">
          <T>{'Run 4 minus PSMASegmentator, per scan. Better on {{fair.better}}, worse on {{fair.worse}}, tied on {{fair.tied}}. Mean {{fair.pc_df1}} ({{fair.pc_lo}} to {{fair.pc_hi}}).'}</T>
        </p>
      </div>
    ),
    script: {
      text: 'Each dot is one of the {{fair.n}} DEEP-PSMA scans. Pooled F1 weighs lesion-heavy scans most, so the pooled gain comes from the right of this plot. Run 4 was below PSMASegmentator on {{fair.lt20_lower}} of the {{fair.lt20_n}} scans with under {{fair.lt20_cut}} lesions and above it on {{fair.ge100_higher}} of the {{fair.ge100_n}} with {{fair.ge100_cut}} or more. The mean per-scan difference was {{fair.pc_df1}} points, with an interval spanning zero.',
    },
  },
  {
    id: 'b-run6',
    backupId: 'b-run6',
    title: 'Every run 6 comparison, against the pre-registered rule',
    media: ['figures/results-context-interaction.svg'],
    render: () => (
      <div className="sd-bk sd-bk--chart">
        <Exhibit src="figures/results-context-interaction.svg" alt="The five pre-registered run 6 comparisons on DEEP-PSMA and autoPET, with 95% intervals" width={1560} height={520} />
        <p className="sd-bk__caption" data-role="body">
          <T>{'Real: interval excludes zero and size at least {{r6.rule}} point. One run per cell; large window at batch size {{r6.batch_large}}; large hybrid selected at epoch {{r6.epoch}}.'}</T>
        </p>
      </div>
    ),
    script: {
      text: 'These are all five comparisons I committed to before scoring, from the dissertation. On DEEP-PSMA the interaction was {{r6.inter}} points, from {{r6.inter_lo}} to {{r6.inter_hi}}, a real effect under the rule. On autoPET it was {{r6.ap_inter}}, no clear effect. The caveats: one training run per cell, the large window trained at batch size {{r6.batch_large}}, and the large hybrid was selected at epoch {{r6.epoch}}.',
    },
  },
  {
    id: 'b-timing',
    backupId: 'b-timing',
    title: 'The speed gap is test-time augmentation, not the architecture',
    render: () => (
      <table className="sd-bk-table" data-role="body">
        <thead data-role="chart">
          <tr><th>Configuration</th><th>Passes per tile</th><th>Mean per scan</th></tr>
        </thead>
        <tbody>
          {row(['Hybrid, as scored', <Num k="eff.passes_h" key="a" />, <Num k="eff.h5" key="b" />], 1)}
          {row(['PSMASegmentator, default', <Num k="eff.passes_p" key="a" />, <Num k="eff.p40" key="b" />], 2)}
          {row(['PSMASegmentator, augmentation off', <Num k="eff.passes_h" key="a" />, <Num k="eff.p5" key="b" />], 3)}
          {row(['Hybrid, augmentation on', <Num k="eff.passes_p" key="a" />, <Num k="eff.h40" key="b" />], 4)}
        </tbody>
      </table>
    ),
    script: {
      text: 'Timed on one {{eff.gpu}} over {{eff.n}} test scans, each model already loaded. As scored, the hybrid took {{eff.h5}} against {{eff.p40}} for PSMASegmentator, but that gap is its eight-pass augmentation. At equal passes the hybrid was no faster in mean time and used {{eff.vram_h}} of memory against {{eff.vram_p}}. The abstract quoted {{abs.home_h}} against {{abs.home_p}} seconds from an earlier run on my home {{abs.home_gpu}}; the same caveat applies.',
    },
  },
  {
    id: 'b-dev',
    backupId: 'b-dev',
    title: 'Development runs 1 to 4 fixed stability, resolution and false alarms',
    render: () => (
      <table className="sd-bk-table sd-bk-table--dev" data-role="body">
        <thead data-role="chart">
          <tr><th>Run</th><th>What changed</th><th>What it showed</th></tr>
        </thead>
        <tbody>
          {row([lbl('1'), 'recall-weighted loss, no gradient clipping', <T key="a">{'loss spiked to {{dev.run1_peak}}; weights later lost'}</T>], 1)}
          {row([lbl('2'), 'clipping, tiled validation (same loss)', <T key="a">{'precision about {{run2.ppv}} (old matcher)'}</T>], 2)}
          {row([lbl('3'), <T key="g">{'{{spacing.mm}} grid, Dice loss, bigger window'}</T>, <T key="a">{'false alarms on all {{organ.neg}} lesion-free scans'}</T>], 3)}
          {row([lbl('4'), 'organ head', <T key="a">{'same predictions: F1 {{dev.run4_f1_old}} under the old matcher, {{dev.run4_f1_new}} under any-overlap'}</T>], 4)}
        </tbody>
      </table>
    ),
    script: {
      text: 'Run 1 had no gradient clipping and lost about {{dev.run1_hours}} of its {{dev.run1_total}} hours to loss spikes. Run 2 added clipping, but the recall-weighted loss left precision at about {{run2.ppv}}. Run 3 moved to the finer grid and Dice, then flagged every lesion-free validation scan. Run 4 added the organ head. Runs 2 to 4 were scored under an older one-to-one matcher; on identical run 4 predictions it gave {{dev.run4_f1_old}} where the adopted rule gives {{dev.run4_f1_new}}.',
    },
  },
  {
    id: 'b-deep',
    backupId: 'b-deep',
    title: 'Mamba sits only where the flattened sequence is short',
    render: () => (
      <table className="sd-bk-table" data-role="body">
        <thead data-role="chart">
          <tr><th>Stage</th><th>Channels</th><th>Tokens per direction</th><th>Block</th></tr>
        </thead>
        <tbody>
          {row([lbl('1'), <Num k="net.ch1" key="a" />, <Num k="net.tok1" key="b" />, 'convolution'], 1)}
          {row([lbl('2'), <Num k="net.ch2" key="a" />, <Num k="net.tok2" key="b" />, 'convolution'], 2)}
          {row([lbl('3'), <Num k="net.ch3" key="a" />, <Num k="net.tok3" key="b" />, <T key="c">{'convolution + {{net.mb3}} Mamba'}</T>], 3)}
          {row([lbl('4'), <Num k="net.ch4" key="a" />, <Num k="net.tok4" key="b" />, <T key="c">{'convolution + {{net.mb4}} Mamba'}</T>], 4)}
          {row([lbl('5'), <Num k="net.ch5" key="a" />, <Num k="net.tok5" key="b" />, <T key="c">{'convolution + {{net.mb5}} Mamba'}</T>], 5)}
        </tbody>
      </table>
    ),
    script: {
      text: 'Each deeper stage halves the grid, so the sequence a Mamba layer would scan shrinks fast. The shallow stages would be at least {{net.tok2}} tokens per direction, and their features are fine texture a convolution handles cheaply. In the deep three, each block scans {{net.dirs}} directions and sums them. I never tested the alternatives, such as alternating directions across layers or a larger state.',
    },
  },
  {
    id: 'b-caseb',
    backupId: 'b-caseb',
    title: 'Case B: both lesions found, {{b.fa}} false alarms',
    scans: true,
    media: ['clips/case-b-4-ground-truth.png'],
    render: () => (
      <div className="sd-bk sd-bk--split">
        <Exhibit src="clips/case-b-4-ground-truth.png" alt="Case B held-out test scan with its verdicts: both lesions found and 14 false alarms" width={1040} height={585} plate={false} />
        <ul className="sd-bk__notes">
          <li data-role="body"><T>{'{{b.fa_bone}} false alarms in bone, {{b.fa_soft}} in soft tissue'}</T></li>
          <li data-role="body">None in the kidneys or bladder</li>
          <li data-role="body"><T>{'Not the worst scan: {{r5.zero_found}} had no lesion found'}</T></li>
          <li data-role="body">Chosen by rule before viewing</li>
        </ul>
      </div>
    ),
    script: {
      text: 'Case B was chosen by rule before I looked: the lowest F1 among scans where F1 is defined. It is not the worst scan, because {{r5.zero_found}} scans had no lesion found and so have no F1. Both of its lesions were found. Its {{b.fa}} false alarms were {{b.fa_bone}} in bone and {{b.fa_soft}} in soft tissue, and none sat in the kidneys or bladder, which the organ task targets.',
    },
  },
  {
    id: 'b-operating',
    backupId: 'b-operating',
    title: 'The threshold and size filter were fixed before the test',
    render: () => (
      <div className="sd-bk sd-bk--chart">
        <BarGroups
          width={1180}
          height={500}
          groups={[
            { label: 'F1', bars: [{ k: 'r5.f1', series: 'a' }, { k: 'r5.nf_f1', series: 'b' }] },
            { label: 'Precision', bars: [{ k: 'r5.ppv', series: 'a' }, { k: 'r5.nf_ppv', series: 'b' }] },
            { label: 'Sensitivity', bars: [{ k: 'r5.sens', series: 'a' }, { k: 'r5.nf_sens', series: 'b' }] },
          ]}
        />
        <Legend items={[{ series: 'a', label: <T>{'Headline: threshold {{inf.thr}}, {{inf.minvox}}-voxel filter'}</T> }, { series: 'b', label: 'No filter (PSMASegmentator\'s setting)' }]} />
      </div>
    ),
    script: {
      text: 'The operating point came from the five-fold validation sweep, before any test inference. With the {{inf.minvox}}-voxel filter, F1 moved by less than a point across thresholds, so I kept {{inf.thr}}. The protocol fixed two rows: the filtered headline and an unfiltered row, because PSMASegmentator has no filter. On the test set the filter trades a little sensitivity for precision, and both rows are reported.',
    },
  },
  {
    id: 'b-refs',
    backupId: 'b-refs',
    title: 'References',
    render: (ctx) => <RefList ctx={ctx} />,
    script: {
      text: 'These are the works cited on the slides, in the order they appear, in the same IEEE style as the dissertation. The dissertation has the full list.',
      seconds: 0,
    },
  },
  {
    id: 'b-demo',
    backupId: 'b-demo',
    title: 'The full recorded run in my app',
    scans: true,
    steps: 1,
    media: ['clips/d1-model-run.mp4', 'data/d1-cues.json'],
    render: (ctx) => (
      <div className="sd-bk sd-bk--demo">
        <DemoClip state={ctx.clip(0)} mode={ctx.mode} reduced={ctx.reduced} layout="row" />
      </div>
    ),
    script: {
      text: 'This is a real run of the five-model ensemble in the app I built, on a held-out test scan, sped up {{d1.speed}}. It needs a CUDA GPU, so I recorded it on my PC. The colours are the app\'s own: found, missed and false alarm. The code will be released so the UWA Medical Physics Research Group can retrain and score it.',
    },
  },
];

// Word ranges for gate G2 (40 to 90 spoken words per backup, references exempt).
export const BACKUP_WORDS = { min: 40, max: 90, exempt: ['b-refs'] };
