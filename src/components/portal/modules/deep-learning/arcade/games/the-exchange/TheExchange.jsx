import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';

/* PLACEHOLDER — replaced by the real switchboard game in this build. */
export default function TheExchange({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items: [] });
  return (
    <RoundShell game={manifest} round={round} host={host} intro={{ line: 'The switchboard is being wired.', controls: ['Come back shortly.'] }}>
      <p className="dla-loading">nothing here yet</p>
    </RoundShell>
  );
}
