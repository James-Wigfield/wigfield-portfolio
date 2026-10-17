import { useState } from 'react';
import Icon from '../../../icons';
import { CAUSES } from '../content';
import { Hook, Receipt } from '../ui';
import SceneWaterPath from '../scenes/SceneWaterPath';
import { SceneOils, SceneMilk, SceneGrounds } from '../scenes/SceneDirt';

/* ============================================================================
   BARISTA · TAB 02 — HOW IT GETS DIRTY
   ----------------------------------------------------------------------------
   Four causes as level-select cards; each opens its scene and the routine
   that prevents it (with jumps straight to those steps).
   ========================================================================== */

const SCENES = { scale: SceneWaterPath, oils: SceneOils, milk: SceneMilk, grounds: SceneGrounds };

export default function Why({ nav }) {
  const [id, setId] = useState(CAUSES[0].id);
  const c = CAUSES.find((x) => x.id === id);
  const Scene = SCENES[id];

  return (
    <>
      <Hook sub="Four things build up in an espresso machine. Each one has a habit or a cycle that stops it.">
        Scale, oil, milk, stale grounds.
      </Hook>
      <div className="bxi-cards bxi-cards--four">
        {CAUSES.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className={`bxi-card${x.id === id ? ' bxi-card--on' : ''}`}
            onClick={() => setId(x.id)}
            aria-pressed={x.id === id}
          >
            <span className="bxi-card__no">{String(i + 1).padStart(2, '0')}</span>
            <span className="bxi-card__t">{x.name}</span>
            <span className="bxi-card__s">{x.where}</span>
          </button>
        ))}
      </div>
      <div className="bxi-split" key={id}>
        <Scene />
        <div className="bxi-why">
          <p className="bxi-why__line">{c.line}</p>
          <p className="bxi-body">
            {c.cost} <Receipt src={c.costSrc} />
          </p>
          <p className="bxi-label">What stops it</p>
          <ul className="bxi-ruled">
            {c.fixes.map((f) => (
              <li key={f.t}>
                <span className="bxi-dot bxi-dot--good" aria-hidden="true" />
                <span className="bxi-ruled__body">
                  <span className="bxi-ruled__t">{f.t}</span>
                  <Receipt src={f.src} />
                </span>
                <button type="button" className="bxi-go" onClick={() => nav.to(f.to)} aria-label={`Go to: ${f.t}`}>
                  <Icon name="arrowRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
