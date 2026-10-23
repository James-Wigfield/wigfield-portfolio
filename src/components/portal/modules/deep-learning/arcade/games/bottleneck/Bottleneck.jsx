import { useEffect, useMemo } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';
import { rng } from '../../core/rng';
import { makeItems } from '../../maths/bottleneck';
import { INTRO } from '../../content/bottleneck';
import { loadTsne, loadRecon } from '../../../lecture5-study/fashion';
import { PlaneStage } from './PlaneStage';
import { BuildStage, TieStage, IndexStage } from './SandwichStage';
import { OrderStage } from './OrderStage';
import { MapStage } from './MapStage';
import './bottleneck.css';

/* ============================================================================
   BOTTLENECK (Lecture 5)
   ----------------------------------------------------------------------------
   Four stages as one round of items (content/bottleneck.js LEVELS):
     1  the plane      tilt a plane through the 3D points to the lowest
                       reconstruction MSE: the linear autoencoder's PCA plane
     2  the sandwich   the biggest symmetric stack within a budget; tie the
                       weights and count; which W a layer uses
     3  one at a time  order Figure 17-7's phases, Figure 17-6's pretraining,
                       slide 24's code
     4  the map        drop a Fashion MNIST item on the page's own t-SNE map
   Items: maths/bottleneck.js (seeded, pure). Every word and number shown:
   content/bottleneck.js or a maths function.
   ========================================================================== */
const STAGE = { plane: PlaneStage, build: BuildStage, tie: TieStage, index: IndexStage, order: OrderStage, drop: MapStage };

export default function Bottleneck({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  // fetch the Fashion MNIST run early, so the map is ready when its item comes up
  useEffect(() => {
    loadTsne().catch(() => {});
    loadRecon().catch(() => {});
  }, []);
  const item = round.current;
  const Stage = item ? STAGE[item.stage] : null;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-bn">
      {Stage && <Stage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}
