/* ============================================================================
   ARCADE — rules module registry
   ----------------------------------------------------------------------------
   The ONLY server-side file you touch when adding a game. Import the rules
   module and add it to GAMES, keyed by slug. The slug must match:
     • public/arcade/<slug>/index.html   (the page)
     • the "slug" field in public/arcade/games.json  (the cabinet)

   No Cloudflare config changes, no Durable Object migration — one ArcadeRoom
   class serves every game (ADR-005).

   A rules module is a pure reducer with this shape:

     {
       slug, title, seats,
       init()                    -> state
       nextTickAt(state)         -> epoch ms | null   (when to fire tick)
       start(state, ctx)         -> state | null
       rematch(state, ctx)       -> state | null
       action(state, ctx)        -> state | null      (ctx.msg is the client message)
       tick(state, ctx)          -> state | null
       view(state, {seat, players, seats, now}) -> what THAT seat may know
     }

   Returning null means "nothing happened" (illegal move, wrong phase, not your
   turn) and is not an error. ctx = { seat, now, players, seats, msg }, where
   `players` is the sorted list of seats currently connected.
   ========================================================================== */

import southernLights from './southern-lights.js';

export const GAMES = {
  [southernLights.slug]: southernLights,
};
