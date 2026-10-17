import { useState } from 'react';
import Icon from '../../../icons';
import { KIT, STEPS } from '../content';
import { restockStore, useStore } from '../careLog';
import { Hook, Receipt, Dot } from '../ui';
import SceneKit from '../scenes/SceneKit';

/* ============================================================================
   BARISTA · TAB 03 — THE KIT
   ----------------------------------------------------------------------------
   Every cleaning item from the box (IB p.8), lettered as in the manual.
   Tap one to see it in use; jump to every step that uses it.
   ========================================================================== */

const titleOf = (id) => STEPS.find((s) => s.id === id)?.title || id;

export default function Kit({ nav }) {
  const [id, setId] = useState(KIT[0].id);
  const [stock] = useStore(restockStore);
  const k = KIT.find((x) => x.id === id);

  return (
    <>
      <Hook sub="Lettered as in Breville’s accessories list. Tap one to see it at work.">
        Eight things in the box, one job each.
      </Hook>
      <div className="bxi-kitgrid">
        {KIT.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`bxi-card bxi-kitcard${x.id === id ? ' bxi-card--on' : ''}`}
            onClick={() => setId(x.id)}
            aria-pressed={x.id === id}
          >
            <span className="bxi-card__no">{x.letter}</span>
            <span className="bxi-card__t">{x.name}</span>
          </button>
        ))}
      </div>
      <div className="bxi-split" key={id}>
        <SceneKit item={id} />
        <div className="bxi-why">
          <p className="bxi-label">{k.letter} · {k.name}</p>
          <p className="bxi-why__line">{k.job}</p>
          <Receipt src={k.src} />
          {k.id === 'tablets' && (
            <p className="bxi-small">
              <Dot tone={stock.tablets >= 2 ? 'good' : 'due'} /> You have {stock.tablets}; a deep clean uses 2.
            </p>
          )}
          {k.steps.length > 0 ? (
            <>
              <p className="bxi-label">Used in</p>
              <ul className="bxi-ruled">
                {k.steps.map((s) => (
                  <li key={s}>
                    <span className="bxi-num">{String(nav.stepIndex(s) + 1).padStart(2, '0')}</span>
                    <span className="bxi-ruled__body">
                      <span className="bxi-ruled__t">{titleOf(s)}</span>
                    </span>
                    <button type="button" className="bxi-go" onClick={() => nav.toStep(s)} aria-label={`Go to ${titleOf(s)}`}>
                      <Icon name="arrowRight" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="bxi-small">Not used in any cleaning step.</p>
          )}
        </div>
      </div>
    </>
  );
}
