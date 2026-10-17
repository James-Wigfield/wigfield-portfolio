import { useState } from 'react';
import Icon from '../../../icons';
import { SYMPTOMS, ADVANCED, SERVICE } from '../content';
import { Hook, Receipt, Seg, Lines, TipMark, Dot, Label } from '../ui';
import SceneWand from '../scenes/SceneWand';
import SceneGrinder from '../scenes/SceneGrinder';
import SceneScreen from '../scenes/SceneScreen';
import SceneTank from '../scenes/SceneTank';
import SceneAdvanced from '../scenes/SceneAdvanced';

/* ============================================================================
   BARISTA · TAB 06 — FIX-IT
   ----------------------------------------------------------------------------
   Pick a symptom → its causes (IB p.28–30, maintenance rows only) with the
   fix and a jump to the matching step → the animated fix. The grinder
   symptom carries Breville's advanced clean (blockages only, IB p.24) as a
   four-part stepper; the leak symptom carries the seal swap (its trigger is
   a tip — the IB just says the seal "will need to be replaced" over time).
   ========================================================================== */

function FixScene({ kind }) {
  switch (kind) {
    case 'wand':
      return <SceneWand part="off" />;
    case 'tamp':
      return <SceneGrinder part="tamp" />;
    case 'seal':
      return <SceneScreen variant="seal" />;
    case 'advanced':
      return <SceneGrinder part="grinder" />;
    default:
      return <SceneTank />;
  }
}

export default function FixIt({ nav }) {
  const [id, setId] = useState(SYMPTOMS[0].id);
  const [chunk, setChunk] = useState(ADVANCED[0].id);
  const s = SYMPTOMS.find((x) => x.id === id);
  const c = ADVANCED.find((x) => x.id === chunk);

  return (
    <>
      <Hook sub="The maintenance rows of Breville’s troubleshooting table, each with its fix animated.">
        What’s it doing?
      </Hook>
      <div className="bxi-symptoms">
        {SYMPTOMS.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className={`bxi-symptom${x.id === id ? ' bxi-symptom--on' : ''}`}
            onClick={() => setId(x.id)}
            aria-pressed={x.id === id}
          >
            <span className="bxi-symptom__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="bxi-symptom__q">{x.q}</span>
            <Icon name="chevron" size={14} />
          </button>
        ))}
      </div>

      <div className="bxi-split" key={id}>
        <FixScene kind={s.scene} />
        <div className="bxi-why">
          <p className="bxi-label">
            {s.q}
            {s.tip && <TipMark />}
          </p>
          <ul className="bxi-ruled">
            {s.causes.map((x) => (
              <li key={x.c}>
                <span className="bxi-dot bxi-dot--due" aria-hidden="true" />
                <span className="bxi-ruled__body">
                  <span className="bxi-ruled__t"><b>{x.c}.</b> {x.fix}</span>
                  <Receipt src={x.src} />
                </span>
                {x.to && (
                  <button type="button" className="bxi-go" onClick={() => nav.to(x.to)} aria-label={`Go to the step for: ${x.c}`}>
                    <Icon name="arrowRight" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="bxi-small">
            <Dot tone="care" /> Still stuck? Breville AU <span className="bxi-num">{SERVICE.au}</span> · NZ{' '}
            <span className="bxi-num">{SERVICE.nz}</span> <Receipt src={SERVICE.src} />
          </p>
        </div>
      </div>

      {id === 'grind' && (
        <section className="bxi-sect bxi-advanced">
          <Label>Advanced grinder clean · only for a blockage between the burrs and the outlet · IB p.24</Label>
          <Seg label="Advanced clean part" items={ADVANCED.map((a) => ({ id: a.id, label: a.title }))} value={chunk} onChange={setChunk} />
          <div className="bxi-split" key={chunk}>
            <SceneAdvanced chunk={chunk} />
            <div className="bxi-why">
              <Lines lines={c.lines} />
              <ul className="bxi-ruled bxi-safety">
                <li>
                  <Dot tone="sharp" label="Sharp burrs" />
                  <span className="bxi-ruled__body"><span className="bxi-ruled__t">Care: the grinder burrs are extremely sharp.</span></span>
                  <Receipt src="IB p.24" />
                </li>
              </ul>
              {chunk === 'close' && (
                <p className="bxi-small">
                  <Dot tone="good" /> Afterwards, re-dial your shot from GRIND SIZE <span className="bxi-num">16</span>, Breville’s suggested start. <Receipt src="IB p.12" />
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
