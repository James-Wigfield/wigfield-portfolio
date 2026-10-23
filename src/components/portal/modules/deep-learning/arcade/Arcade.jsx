import { useCallback, useEffect, useMemo } from 'react';
import { usePortalRoute } from '../../../portalRoute';
import { GAMES, gameById } from './core/games';
import { migrate } from './core/storage';
import { Hub } from './hub/Hub';
import { Run } from './hub/Run';
import { GamePlayer } from './GamePlayer';
import '../common.css';
import '../lecture8-study/stage.css';
import './kit/kit.css';
import './arcade.css';

/* ============================================================================
   CITS5017 · GRADIENT ARCADE — MODULE ENTRY
   ----------------------------------------------------------------------------
   A hub of short, replayable mini games, each drilling one of the unit's
   hardest concepts, tied together by spaced repetition (core/scheduler.js),
   a Daily Mix, an Exam mode, mastery per lecture, streaks and bests.

   Routes (usePortalRoute, so the browser's back/forward work):
     /portal/dl-arcade              the hub
     /portal/dl-arcade/mix          today's Daily Mix
     /portal/dl-arcade/exam         Exam mode
     /portal/dl-arcade/<gameId>     one game, free play
   DEV only: ?seed=<n>&level=<n> on a game route fixes the round (the
   headless bot in tools/dl-arcade/arcade-check.mjs uses it).

   Layout: hub/ (cabinets, the run), kit/ (the round engine and inputs),
   core/ (concepts, scheduler, storage, progress, rng), content/ (pure data
   with slide receipts), maths/ (pure functions), games/<id>/. CSS prefix
   .dla-, storage prefix dla:. The root also carries .dl and .dl8s so the
   lecture palette (--dlv-*) and the L8 role tokens (--dl8s-*) apply.
   ========================================================================== */
export default function DeepLearningArcade() {
  const { sub, setSub } = usePortalRoute();
  const head = (sub || '').split('/')[0];
  const game = useMemo(() => gameById(head), [head]);

  useEffect(() => {
    migrate();
    // DEV: the headless check reads the game list from here
    if (import.meta.env.DEV) window.__dlaGames = GAMES.map((g) => ({ id: g.id, title: g.title, levels: g.levels ?? 3, concepts: g.concepts }));
  }, []);

  const go = useCallback((to) => setSub(to === 'hub' ? '' : to), [setSub]);
  const exitToHub = useCallback(() => setSub(''), [setSub]);

  // DEV: a fixed seed / level from the query string, for the bot
  const dev = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const seed = dev?.get('seed') ? Number(dev.get('seed')) : undefined;
  const level = dev?.get('level') ? Number(dev.get('level')) : 1;
  const durationMs = dev?.get('ms') ? Number(dev.get('ms')) : 60000;

  let view;
  if (head === 'mix' || head === 'exam') view = <Run key={head} kind={head} onExit={exitToHub} />;
  else if (game) view = <GamePlayer key={`${game.id}:${seed ?? 'free'}`} game={game} mode="free" seed={seed} level={level} durationMs={durationMs} onExit={exitToHub} />;
  else view = <Hub onOpen={go} />;

  return (
    <div className="pt-module dl dl8s dla" data-view={head || 'hub'} data-games={GAMES.length}>
      {view}
    </div>
  );
}
