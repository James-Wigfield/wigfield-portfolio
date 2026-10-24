import { useMemo } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';
import { rng } from '../../core/rng';
import { makeItems } from '../../maths/blockBuilder';
import { INTRO } from '../../content/block-builder';
import { Stage } from './Stages';
import './block-builder.css';

/* ============================================================================
   BLOCK BUILDER (Lecture 3, slides 33–51)
   ----------------------------------------------------------------------------
   Level 1 names the net from a part (a slide claim, a number, two or three
   table rows, Figure 14-14 / 14-16, a tower fragment). Level 2 builds it:
   tap the missing blocks of LeNet-5 / AlexNet / GoogLeNet into their slots,
   pick the inception module's four branches, wire ResNet's skip connection.
   Level 3 fills the spec: a blank LeNet-5 / AlexNet table cell (sized with
   maths/shapes.js), a GoogLeNet depth concat, slides 33–34's kernel advice
   and slide 51's fine-tuning steps.

   Items: maths/blockBuilder.js (seeded). Text: content/block-builder.js.
   ========================================================================== */
export default function BlockBuilder({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-bk">
      {item && <Stage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}
