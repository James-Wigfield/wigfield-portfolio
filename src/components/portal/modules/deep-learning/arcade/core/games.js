/* ============================================================================
   GRADIENT ARCADE — THE GAMES INDEX
   ----------------------------------------------------------------------------
   One manifest per game (games/<id>/index.js, the frozen contract in
   tools/dl-arcade/PLAN.md). Order = the hub's cabinet order. The lead owns
   this file: a builder adds a game by writing its folder and asking for one
   line here.
   ========================================================================== */
import { lazy } from 'react';
import paramSniper from '../games/param-sniper/index.js';
import theExchange from '../games/the-exchange/index.js';

export const GAMES = [
  paramSniper,
  theExchange,
].filter(Boolean);

// Lazy React components, created once here (never during a render).
GAMES.forEach((g) => { g.Component = lazy(g.load); });

export const gameById = (id) => GAMES.find((g) => g.id === id) ?? null;
