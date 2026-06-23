import ScanViewport from './ScanViewport';
import Reveal from './Reveal';
import CountUp from './CountUp';

const METRICS = [
  { label: 'Patient accuracy', to: 94.5, decimals: 1, suffix: '%', note: '121 / 128 · nnU-Net baseline' },
  { label: 'Lesion-level F1', to: 79.9, decimals: 1, suffix: '%', note: 'PPV 88.2% · Sensitivity 73%' },
  { label: 'Training scans', to: 300, prefix: '~', note: 'SCGH whole-body + open autoPET' },
  { label: 'The aim', display: '↑ Sensitivity', note: 'lift recall, hold precision, run faster', target: true },
];

const METHOD = [
  {
    title: 'Data & preprocessing',
    body: 'Whole-body PSMA PET volumes from Sir Charles Gairdner Hospital (~300 patients), augmented with the open-source autoPET dataset.',
  },
  {
    title: 'Hybrid CNN–Mamba',
    body: 'A convolutional encoder for local detail; Mamba state-space blocks for global context; skip connections preserve resolution. Inspired by U-Mamba.',
  },
  {
    title: 'Fitting whole volumes',
    body: "Mamba's hardware-aware parallel scan keeps sequences in SRAM, so larger 3D patches fit in VRAM — with overlap-tile, mirror-padded inference for seamless full-body output.",
  },
  {
    title: 'Loss & evaluation',
    body: 'Tversky loss penalises missed lesions more heavily to lift sensitivity; benchmarked on lesion-level F1 and voxel-level Dice against nnU-Net.',
  },
];

export default function Research() {
  return (
    <section id="research" className="hp-section hp-research" aria-labelledby="research-title">
      <div className="hp-wrap">
        <Reveal>
          <div className="hp-chead__bar" aria-hidden="true">
            <span className="hp-chead__n">05</span>
            <span className="hp-chead__line" />
          </div>
          <p className="hp-eyebrow">The flagship · Honours research · 2026</p>
          <p className="hp-research__tag">Bachelor of Advanced Computer Science (Honours) — UWA</p>
          <h2 id="research-title" className="hp-research__title">
            Optimising PSMA&nbsp;PET segmentation with a 3D&nbsp;Mamba architecture
          </h2>
          <p className="hp-research__lead">
            Prostate cancer is one of the most common cancers in men, and when it spreads, finding
            every metastatic lesion on a whole-body PET scan is what guides treatment. Doing that by
            hand is slow and varies between clinicians — so I'm building a model that does it
            automatically, consistently, and faster.
          </p>
        </Reveal>

        <div className="hp-research__cols">
          <Reveal className="hp-research__narrative">
            <p>
              The current state of the art, <strong>nnU-Net</strong>, is a deep 3D convolutional
              network. It's strong at the patient level, but its lesion-level sensitivity sits at
              73% — roughly one lesion in four can be missed — and processing a whole-body volume is
              heavy and slow.
            </p>
            <p>
              3D CNNs are bottlenecked by GPU memory: bigger patches force smaller batches, so the
              network never sees enough of the body at once to relate a primary tumour to its
              metastases. Transformers could capture that global context, but they scale
              quadratically with sequence length.
            </p>
            <p className="hp-research__pull">
              State Space Models scale linearly — so the network can hold the whole scan in view,
              and still run on hospital hardware.
            </p>
            <p>
              I'm designing a <strong>hybrid CNN–Mamba</strong> architecture. Convolutional blocks
              extract local detail; Mamba's selective state-space layers carry long-range context
              across the entire volume — filtering out healthy background tissue while remembering
              the small lesions that actually matter.
            </p>
          </Reveal>

          <Reveal className="hp-research__fig">
            <div className="hp-research__scanwrap">
              <ScanViewport variant="research" />
              <div className="hp-viewport__corners" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            </div>
            <p className="hp-figcap">
              <b>Fig.</b> — schematic of a segmentation pass isolating lesion signal (hot) from
              healthy background tissue (cool).
            </p>

            <div className="hp-metrics" aria-label="Baseline metrics and project aim">
              {METRICS.map((m) => (
                <div key={m.label} className={`hp-metric${m.target ? ' hp-metric--target' : ''}`}>
                  <div className="hp-metric__label">{m.label}</div>
                  <div className="hp-metric__value">
                    {m.display
                      ? m.display
                      : <CountUp to={m.to} decimals={m.decimals} prefix={m.prefix} suffix={m.suffix} />}
                  </div>
                  <div className="hp-metric__note">{m.note}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal className="hp-method">
          <p className="hp-eyebrow">Method · the pipeline</p>
          <div className="hp-method__grid">
            {METHOD.map((step, i) => (
              <div key={step.title} className="hp-step">
                <div className="hp-step__num">{String(i + 1).padStart(2, '0')}</div>
                <div className="hp-step__bar" aria-hidden="true" />
                <h3 className="hp-step__title">{step.title}</h3>
                <p className="hp-step__body">{step.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal as="ul" className="hp-research__cred">
          <li><b>Supervisor</b> — Dr Jake Kendrick</li>
          <li><b>Co-supervisor</b> — Dr Mubashar Hassan</li>
          <li><b>UWA</b> Medical Physics Research Group</li>
          <li><b>Sir Charles Gairdner</b> Hospital</li>
        </Reveal>
      </div>
    </section>
  );
}
