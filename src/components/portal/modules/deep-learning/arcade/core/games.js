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
import descent from '../games/descent/index.js';
import kernelRush from '../games/kernel-rush/index.js';
import longLine from '../games/long-line/index.js';
import bottleneck from '../games/bottleneck/index.js';
import latentSurfer from '../games/latent-surfer/index.js';
import chainReaction from '../games/chain-reaction/index.js';
import boundaryBash from '../games/boundary-bash/index.js';
import signalKeeper from '../games/signal-keeper/index.js';
import forger from '../games/forger/index.js';
import forecastDesk from '../games/forecast-desk/index.js';
import blockBuilder from '../games/block-builder/index.js';
import waveStamp from '../games/wave-stamp/index.js';
import overfitClinic from '../games/overfit-clinic/index.js';

export const GAMES = [
  paramSniper,
  theExchange,
  descent,
  kernelRush,
  longLine,
  bottleneck,
  latentSurfer,
  chainReaction,
  boundaryBash,
  signalKeeper,
  forger,
  forecastDesk,
  blockBuilder,
  waveStamp,
  overfitClinic,
].filter(Boolean);

// Lazy React components, created once here (never during a render).
GAMES.forEach((g) => { g.Component = lazy(g.load); });

export const gameById = (id) => GAMES.find((g) => g.id === id) ?? null;
