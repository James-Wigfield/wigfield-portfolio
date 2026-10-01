import { useState } from 'react';
import Icon from '../../../../icons';
import { Code } from '../../kit';
import { Lab, Chips, Stat } from '../ui';
import { useStudy } from '../context';
import { SECTIONS } from '../sections';
import { RESNET_CODE, RESNET_PREDS, XCEPTION_CODE, OUTCOMES } from '../slideData';

/* ============================================================================
   LECTURE 3 STUDY — LABS FOR §13, §14 AND §15
     PretrainedLab   slides 48–49 as a pipeline: load → resize → preprocess →
                     predict → decode the top k, with the slide's own output
     TransferLab     slides 50–51: freeze / unfreeze the Xception base, and the
                     two-phase training timeline (head first, then fine-tune
                     the top of the base with a 10× lower learning rate)
     OutcomesLab     slide 52's outcomes as a self-check, each linked back to
                     its sections and notebook pages
   ========================================================================== */

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

/* ── §13 · the pretrained-model pipeline ─────────────────────────────────── */
const STAGES = [
  { id: 'load', name: 'load', title: 'Load ResNet-50 and the two sample images', shape: '(2, height, width, 3)', hl: [1, 2, 3] },
  { id: 'resize', name: 'Resizing', title: 'Resize to 224×224, cropping to the aspect ratio', shape: '(2, 224, 224, 3)', hl: [4, 5] },
  { id: 'prep', name: 'preprocess_input', title: 'RGB → BGR, each colour channel zero-centred', shape: '(2, 224, 224, 3)', hl: [6, 7] },
  { id: 'predict', name: 'predict', title: 'One probability per ImageNet class, per image', shape: '(2, 1000)', hl: [9, 10, 11] },
  { id: 'decode', name: 'decode_predictions', title: 'Each image’s top classes, by name', shape: 'top=3 per image', hl: [13, 14, 15, 16, 17] },
];

function StageVisual({ id }) {
  if (id === 'load') {
    return (
      <svg viewBox="0 0 240 90" className="dl3s-svg dl3s-pipe__vis" role="img" aria-label="Two sample photos: a palace and a dahlia">
        <rect x={6} y={8} width={104} height={70} rx={3} className="dl3s-pipe__photo" />
        <path d="M30 66 h56 M36 66 v-14 h44 v14 M42 52 v-10 h32 v10 M58 42 l-20 -10 h40 z M58 32 v-10" className="dl3s-pipe__ink" />
        <text x={58} y={88} textAnchor="middle" className="dl3s-tick">Image #0 · palace</text>
        <rect x={130} y={8} width={104} height={70} rx={3} className="dl3s-pipe__photo" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <ellipse key={a} cx={182} cy={30} rx={6} ry={14} transform={`rotate(${a} 182 43)`} className="dl3s-pipe__petal" />
        ))}
        <circle cx={182} cy={43} r={6} className="dl3s-pipe__ink" />
        <text x={182} y={88} textAnchor="middle" className="dl3s-tick">Image #1 · dahlia</text>
      </svg>
    );
  }
  if (id === 'resize') {
    return (
      <svg viewBox="0 0 240 90" className="dl3s-svg dl3s-pipe__vis" role="img" aria-label="A landscape photo cropped to a square, then resized to 224 by 224">
        <rect x={10} y={10} width={100} height={66} rx={2} className="dl3s-pipe__photo" />
        <rect x={27} y={10} width={66} height={66} className="dl3s-pipe__crop" />
        <text x={60} y={88} textAnchor="middle" className="dl3s-tick">crop_to_aspect_ratio=True</text>
        <path d="M120 43 h28 m-6 -5 6 5 -6 5" className="dl3s-pipe__ink" />
        <rect x={158} y={12} width={62} height={62} className="dl3s-pipe__crop dl3s-pipe__crop--done" />
        <text x={189} y={88} textAnchor="middle" className="dl3s-tick">224 × 224</text>
      </svg>
    );
  }
  if (id === 'prep') {
    const bars = [
      { n: 'R', c: 'var(--dlv-red)' },
      { n: 'G', c: 'var(--dlv-green)' },
      { n: 'B', c: 'var(--dlv-blue)' },
    ];
    return (
      <svg viewBox="0 0 240 90" className="dl3s-svg dl3s-pipe__vis" role="img" aria-label="Channels reordered from R G B to B G R and centred on zero">
        {bars.map((b, k) => (
          <g key={b.n}>
            <rect x={14 + k * 26} y={18} width={20} height={44} style={{ fill: b.c }} className="dl3s-pipe__chan" />
            <text x={24 + k * 26} y={76} textAnchor="middle" className="dl3s-svg__label">{b.n}</text>
          </g>
        ))}
        <path d="M100 40 h28 m-6 -5 6 5 -6 5" className="dl3s-pipe__ink" />
        {[...bars].reverse().map((b, k) => (
          <g key={`o${b.n}`}>
            <rect x={142 + k * 26} y={22 + k * 6} width={20} height={34 - k * 4} style={{ fill: b.c }} className="dl3s-pipe__chan" />
            <text x={152 + k * 26} y={76} textAnchor="middle" className="dl3s-svg__label">{b.n}</text>
          </g>
        ))}
        <line x1={136} y1={40} x2={226} y2={40} className="dl3s-marker" />
        <text x={230} y={44} className="dl3s-tick">0</text>
      </svg>
    );
  }
  if (id === 'predict') {
    return (
      <svg viewBox="0 0 240 90" className="dl3s-svg dl3s-pipe__vis" role="img" aria-label="Y_proba: two rows of one thousand class probabilities">
        {[0, 1].map((row) => (
          <g key={row}>
            <text x={4} y={28 + row * 30} className="dl3s-tick">#{row}</text>
            {Array.from({ length: 50 }, (_, k) => <rect key={k} x={22 + k * 4.2} y={16 + row * 30} width={3.4} height={16} className="dl3s-pipe__prob" />)}
          </g>
        ))}
        <text x={120} y={84} textAnchor="middle" className="dl3s-tick">Y_proba.shape = (2, 1000) — one value per class</text>
      </svg>
    );
  }
  return null;
}

export function PretrainedLab() {
  const [stage, setStage] = useState(0);
  const [img, setImg] = useState(0);
  const [k, setK] = useState(3);
  const st = STAGES[stage];
  const pred = RESNET_PREDS[img];
  const shown = pred.top.slice(0, k);
  const rest = 100 - pred.top.reduce((a, p) => a + p.p, 0);
  const right = pred.top[0].name === pred.truth;

  return (
    <Lab
      title="Slides 48–49 as a pipeline · predict, then decode the top k"
      slides="slides 48–49"
      tryThis="step through the five stages and watch the tensor shape change, then compare the two images’ top 3: the palace is right at 54.69%, but the dahlia can’t be — it isn’t one of the 1,000 ImageNet classes."
    >
      <ol className="dl3s-pipe">
        {STAGES.map((s, n) => (
          <li key={s.id} className="dl3s-pipe__item">
            <button type="button" className={`dl3s-pipe__btn${n === stage ? ' dl3s-pipe__btn--on' : ''}`} onClick={() => setStage(n)} aria-pressed={n === stage}>
              <span className="dl3s-pipe__no">{n + 1}</span>
              <code>{s.name}</code>
              <span className="dl3s-pipe__shape">{s.shape}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="dl3s-pipe__body">
        <div className="dl3s-pipe__left">
          <p className="dl3s-stagehead">stage {stage + 1} · {st.title}</p>
          {st.id !== 'decode' ? (
            <StageVisual id={st.id} />
          ) : (
            <div className="dl3s-decode">
              <Chips label="Image" value={img} options={RESNET_PREDS.map((p, n) => ({ v: n, l: p.image }))} onChange={setImg} compact />
              <Chips label="top" value={k} options={[1, 2, 3]} onChange={setK} compact />
              <ul className="dl3s-decode__list">
                {shown.map((p, n) => (
                  <li key={p.id} className={p.name === pred.truth ? 'dl3s-decode__row dl3s-decode__row--hit' : 'dl3s-decode__row'}>
                    <span className="dl3s-decode__rank">{n + 1}</span>
                    <code>{p.id}</code>
                    <b>{p.name}</b>
                    <span className="dl3s-decode__track"><span style={{ width: `${p.p}%` }} /></span>
                    <span className="dl3s-decode__p">{p.p.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
              <p className={`dl3s-verdict${right ? ' dl3s-verdict--ok' : ''}`}>
                {right && <Icon name="check" size={14} strokeWidth={2.2} />}
                Correct class: <b>{pred.truth}</b> — {right ? 'the model’s top prediction.' : 'not among the predictions: it is not one of the 1,000 ImageNet classes.'}
              </p>
              <p className="dl3s-cap">The top 3 add up to {(100 - rest).toFixed(2)}%, so the other 997 classes share {rest.toFixed(2)}%.</p>
            </div>
          )}
        </div>
        <Code code={RESNET_CODE} label="resnet50_pretrained.py" meta="slide 48" hl={st.hl} />
      </div>
    </Lab>
  );
}

/* ── §14 · transfer learning with Xception ───────────────────────────────── */
const PHASES = [
  { id: 'build', name: 'build the model', hl: [1, 2, 4, 5, 6], low: false, high: false, lr: null, epochs: 0 },
  { id: 'p1', name: 'phase 1 · train the head', hl: [8, 9, 10, 12, 13, 14], low: true, high: true, lr: 0.1, epochs: 3 },
  { id: 'p2', name: 'phase 2 · fine-tune', hl: [16, 17, 18, 20, 21, 22], low: true, high: false, lr: 0.01, epochs: 10 },
];

function Lock({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" className="dl3s-lock">
      <rect x="5" y="11" width="14" height="9" rx="1.8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d={open ? 'M8 11V7.5A4 4 0 0 1 15.6 6' : 'M8 11V7.5a4 4 0 0 1 8 0V11'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TransferLab() {
  const [phase, setPhase] = useState(1);
  const [low, setLow] = useState(true); // layers 0–55 frozen?
  const [high, setHigh] = useState(true); // layers 56+ frozen?
  const ph = PHASES[phase];
  const pickPhase = (n) => {
    setPhase(n);
    setLow(PHASES[n].low);
    setHigh(PHASES[n].high);
  };
  const custom = phase > 0 && (low !== ph.low || high !== ph.high);
  const epochCells = Array.from({ length: 13 }, (_, e) => (e < 3 ? 1 : 2));

  const rows = [
    { id: 'dense', name: 'Dense(n_classes, activation="softmax")', note: 'new output layer (5 flower classes)', kind: 'new' },
    { id: 'gap', name: 'GlobalAveragePooling2D()', note: 'new · no weights', kind: 'gap' },
    { id: 'high', name: 'base_model.layers[56:]', note: 'pretrained Xception (top part)', kind: 'base', frozen: high, toggle: () => setHigh((v) => !v) },
    { id: 'low', name: 'base_model.layers[:56]', note: 'pretrained Xception (bottom part)', kind: 'base', frozen: low, toggle: () => setLow((v) => !v) },
    { id: 'in', name: 'input · 224×224×3', note: 'xception.preprocess_input → pixels in −1 … 1', kind: 'input' },
  ];

  const trains = [
    phase > 0 ? 'the new Dense head' : null,
    phase > 0 && !high ? 'layers 56 and up' : null,
    phase > 0 && !low ? 'layers 0–55' : null,
  ].filter(Boolean);

  return (
    <Lab
      title="Slides 50–51 · freeze, train the head, unfreeze, fine-tune"
      slides="slides 50–51"
      tryThis="click phase 1 then phase 2 on the timeline — the padlocks show which layers train, and the learning rate drops from 0.1 to 0.01 once layers[56:] are unfrozen."
    >
      <div className="dl3s-split" aria-label="tf_flowers split: 10% test, 15% validation, 75% training of 3,670 images">
        <span style={{ flex: 10 }} className="dl3s-split__seg dl3s-split__seg--test">test 10%</span>
        <span style={{ flex: 15 }} className="dl3s-split__seg dl3s-split__seg--valid">valid 15%</span>
        <span style={{ flex: 75 }} className="dl3s-split__seg dl3s-split__seg--train">train 75% · of 3,670 images, 5 classes</span>
      </div>

      <div className="dl3s-tl">
        <div className="dl3s-tl__left">
          <div className="dl3s-tl__phases" role="group" aria-label="Training phase">
            {PHASES.map((p, n) => (
              <button key={p.id} type="button" className={`dl-chip${n === phase ? ' dl-chip--on' : ''}`} aria-pressed={n === phase} onClick={() => pickPhase(n)}>{p.name}</button>
            ))}
          </div>
          <div className="dl3s-tl__stack">
            {rows.map((r) => {
              const isTrain = phase > 0 && (r.kind === 'new' || (r.kind === 'base' && !r.frozen));
              return (
                <div key={r.id} className={`dl3s-tl__layer dl3s-tl__layer--${r.kind}${r.kind === 'base' && r.frozen ? ' dl3s-tl__layer--frozen' : ''}${isTrain ? ' dl3s-tl__layer--train' : ''}`}>
                  <span className="dl3s-tl__name"><code>{r.name}</code><small>{r.note}</small></span>
                  {r.kind === 'base' ? (
                    <button type="button" className="dl3s-tl__lock" onClick={r.toggle} aria-pressed={!r.frozen} aria-label={`${r.name}: ${r.frozen ? 'frozen — click to unfreeze' : 'trainable — click to freeze'}`}>
                      <Lock open={!r.frozen} /> {r.frozen ? 'frozen' : 'trainable'}
                    </button>
                  ) : (
                    <span className="dl3s-tl__state">{r.kind === 'new' ? (phase > 0 ? 'trains' : 'new') : r.kind === 'gap' ? 'no weights' : ''}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="dl3s-epochs" role="group" aria-label="Epoch timeline: 3 epochs of phase 1, then 10 of phase 2">
            {epochCells.map((p, e) => (
              <button key={e} type="button" className={`dl3s-epoch dl3s-epoch--p${p}${phase === p ? ' dl3s-epoch--on' : ''}`} onClick={() => pickPhase(p)} aria-label={`epoch ${e + 1}: phase ${p}`}>
                {e + 1}
              </button>
            ))}
          </div>
          <p className="dl3s-cap">epochs 1–3: phase 1, SGD(learning_rate=0.1, momentum=0.9) · epochs 4–13: phase 2, SGD(learning_rate=0.01, momentum=0.9)</p>
        </div>
        <Code code={XCEPTION_CODE} label="transfer_xception.py" meta="slide 51" hl={ph.hl} />
      </div>

      <div className="dl3s-stats">
        <Stat k="updated by training" v={trains.length ? trains.join(' + ') : 'nothing yet'} tone="accent" sub={phase === 0 ? 'build the model first' : custom ? 'your own freeze pattern (not the slide’s)' : 'as on slide 51'} />
        <Stat k="learning rate" v={ph.lr ?? '—'} sub={phase === 2 ? '10× lower than phase 1 · SGD, momentum 0.9' : phase === 1 ? 'SGD, momentum 0.9' : ''} />
        <Stat k="epochs" v={ph.epochs || '—'} sub={phase === 2 ? 'after the 3 of phase 1' : ''} />
      </div>
      {custom && (
        <p className="dl3s-readout">
          To get this pattern you would write{' '}
          <code>
            {!low && !high ? 'for layer in base_model.layers: layer.trainable = True' : !high ? 'for layer in base_model.layers[56:]: layer.trainable = True' : !low ? 'for layer in base_model.layers[:56]: layer.trainable = True' : 'for layer in base_model.layers: layer.trainable = False'}
          </code>{' '}
          and then compile again.
        </p>
      )}
      <p className="dl3s-cap">Result (slide 51): about 92% test accuracy; a bit more training reaches 95% to 97%.</p>
    </Lab>
  );
}

/* ── §15 · the slide-52 outcomes ─────────────────────────────────────────── */
export function OutcomesLab() {
  const { stats, jumpTo, outcomes, toggleOutcome } = useStudy();
  const done = outcomes.length;
  return (
    <Lab
      title="Slide 52 · can you do each of these?"
      slides="slide 52"
      tryThis="tick an outcome once you can explain it from your notes without looking; if you can’t yet, its chips jump back to the section — or straight to its notebook page."
    >
      <p className="dl3s-readout"><b>{done}/{OUTCOMES.length}</b> outcomes ticked · <b>{stats.pages}/{SECTIONS.length}</b> notebook pages copied</p>
      <ol className="dl3s-outcomes">
        {OUTCOMES.map((o, n) => {
          const on = outcomes.includes(n);
          const lines = o.secs.reduce((a, id) => a + (stats.per[id]?.done ?? 0), 0);
          const total = o.secs.reduce((a, id) => a + (stats.per[id]?.total ?? 0), 0);
          return (
            <li key={o.text} className={`dl3s-outcome${on ? ' dl3s-outcome--on' : ''}`}>
              <button type="button" className="dl3s-outcome__tick" aria-pressed={on} onClick={() => toggleOutcome(n)} aria-label={`${o.text}: ${on ? 'ticked' : 'not ticked'}`}>
                {on && <Icon name="check" size={13} strokeWidth={2.4} />}
              </button>
              <span className="dl3s-outcome__text">{o.text}</span>
              <span className="dl3s-outcome__links">
                {o.secs.map((id) => (
                  <span key={id} className="dl3s-outcome__sec">
                    <button type="button" className="dl3s-secchip" onClick={() => jumpTo(id)}><b>§{SEC[id].no}</b> {SEC[id].short}</button>
                    <button type="button" className="dl3s-link dl3s-outcome__nb" onClick={() => jumpTo(id, { nb: true })}>notebook page{stats.per[id]?.complete ? ' · copied' : ''}</button>
                  </span>
                ))}
              </span>
              <span className="dl3s-outcome__prog">{lines}/{total} lines</span>
            </li>
          );
        })}
      </ol>
    </Lab>
  );
}
