import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';

/* PLACEHOLDER — the game builder replaces this file. */
export default function LatentSurfer({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items: [] });
  return (
    <RoundShell game={manifest} round={round} host={host} intro={{ line: 'This cabinet is still being wired.', controls: ['Come back shortly.'] }}>
      <p className="dla-loading">nothing here yet</p>
    </RoundShell>
  );
}
