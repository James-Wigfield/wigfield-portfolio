import { Component, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { recordRound, maxLevelUnlocked } from './core/progress';
import { getProfile } from './core/storage';
import { freshSeed } from './core/rng';

/* ============================================================================
   GRADIENT ARCADE — GAME PLAYER (mounts one game under the frozen contract)
   ----------------------------------------------------------------------------
   <GamePlayer game={manifest} mode seed level durationMs onDone onExit />
   Lazy-loads the game's component (three.js etc. only arrive when a game is
   opened), wraps it in an error boundary so one broken game never takes
   the hub down, hands it { seed, level, mode, durationMs, onRoundEnd,
   onExit } plus the host extras ({ onLevelChange, levels, unlocked,
   onReplay, exitLabel }), records the round when onRoundEnd fires and
   returns the summary to the game for its results screen.
     free mode   Play again = a fresh seed; the level switcher works
     mix / exam  the host fixes seed and level; Continue goes to the next
                 round (continueOnExit)
   ========================================================================== */
class GameBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="dla-broken" role="alert">
          <p className="dla-k"><span className="dla-dot" style={{ background: 'var(--dlv-red)' }} />this game hit an error</p>
          <p className="dla-broken__msg">{String(this.state.error?.message ?? this.state.error)}</p>
          <div className="dla-res__actions">
            <button type="button" className="dla-btn dla-btn--primary" onClick={this.props.onExit}>Back to the arcade</button>
            <button type="button" className="dla-btn" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GamePlayer({ game, mode = 'free', seed: seedIn, level: levelIn = 1, durationMs = 60000, onDone, onExit, onContinue, exitLabel, continueOnExit = false }) {
  const [seed, setSeed] = useState(() => seedIn ?? freshSeed());
  const [level, setLevel] = useState(levelIn);
  const [run, setRun] = useState(0);
  const Game = game.Component;
  const ended = useRef(false);
  const unlocked = useMemo(() => maxLevelUnlocked(game.id, getProfile().bests, game.levels ?? 3), [game, run]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRoundEnd = useCallback((result) => {
    if (ended.current) return null;
    ended.current = true;
    let summary = null;
    try {
      summary = recordRound({ gameId: game.id, level, mode, result });
    } catch {
      summary = null;
    }
    onDone?.(result, summary);
    return summary;
  }, [game.id, level, mode, onDone]);

  const onReplay = mode === 'free'
    ? () => { ended.current = false; setSeed(freshSeed()); setRun((r) => r + 1); }
    : undefined;
  const onLevelChange = mode === 'free'
    ? (L) => { if (L >= 1 && L <= unlocked) { ended.current = false; setLevel(L); setRun((r) => r + 1); } }
    : undefined;

  const host = {
    onExit: () => onExit?.(),
    // the results screen's Continue: the host's next step (mix / exam), else leave
    onContinue: () => (onContinue ?? onExit)?.(),
    onReplay,
    onLevelChange,
    levels: game.levels ?? 3,
    levelNames: game.levelNames,
    unlocked: mode === 'free' ? unlocked : level,
    exitLabel: exitLabel ?? (continueOnExit ? 'Continue' : 'Back to the arcade'),
  };

  return (
    <GameBoundary onExit={() => onExit?.()} key={`${game.id}:${run}`}>
      <Suspense fallback={<p className="dla-loading"><span className="dla-dot" />loading {game.title}…</p>}>
        <Game
          key={`${seed}:${level}:${run}`}
          seed={seed}
          level={level}
          mode={mode}
          durationMs={durationMs}
          onRoundEnd={onRoundEnd}
          onExit={host.onExit}
          host={host}
        />
      </Suspense>
    </GameBoundary>
  );
}
