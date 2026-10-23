import { useEffect, useMemo } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';
import { rng } from '../../core/rng';
import { makeItems } from '../../maths/forger';
import { warm } from '../../maths/forgerStudio';
import { INTRO } from '../../content/forger';
import {
  WhichStage, RecipeStage, OrderStage, FactStage, DiagnoseStage, PairStage, GapStage, BuildStage, SpotStage, NumberStage, ShapeStage,
} from './stages.jsx';
import './forger.css';

/* ============================================================================
   FORGER (Lectures 6–7, slides 19–30)
   ----------------------------------------------------------------------------
   A forger's studio. This page's own toy GAN (lecture6-7-study/gen.js
   ToyGan: 1-D numbers, slide 25's loop) draws the originals, the forgeries
   and the discriminator's P(real) curve live.
     level 1  the two phases: which phase ran (what moved), build each
              phase's batch (batch · labels · who learns), order slide 25
     level 2  repeat yourself: read GAN_PRESETS.weak vs .balanced (mode
              collapse, diverse, unstable), Nash / instability / the
              trainable toggles, fill the gap in slide 25's loop
     level 3  DCGAN: build by the slide-28 guidelines, spot where slide 29
              departs, batch / codings arithmetic
   Items: maths/forger.js; runs: maths/forgerStudio.js; words and receipts:
   content/forger.js.
   ========================================================================== */
const STAGES = {
  which: WhichStage, recipe: RecipeStage, order: OrderStage, fact: FactStage, diagnose: DiagnoseStage, pair: PairStage,
  gap: GapStage, build: BuildStage, spot: SpotStage, number: NumberStage, shape: ShapeStage,
};

export default function Forger({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  // train the toy runs this round draws while the intro is up (memoised per page)
  useEffect(() => {
    const id = window.setTimeout(() => warm(items), 40);
    return () => window.clearTimeout(id);
  }, [items]);
  const item = round.current;
  const Stage = item ? STAGES[item.type] : null;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-fg">
      {Stage && <Stage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}
