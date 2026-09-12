/**
 * The public API of the pure core.
 *
 * The shell (`src/cli/`) and the acceptance/hardening tests may import from here
 * and nowhere else inside `src/core/`; `.dependency-cruiser.cjs` enforces that.
 */
export type { CommandResult } from './model/command-result.js';
export type { Board, Cell } from './model/board.js';
export type { Direction } from './model/direction.js';
export type { GameState } from './model/game-state.js';
export type { RandomSource } from './model/random-source.js';
export { commands, run, type Dispatch } from './game/registry.js';
export { newSession, sessionFrom, type Session } from './game/session.js';
export { newGame } from './rules/new-game.js';
export { applyMove, type MoveResult } from './rules/move.js';
export { renderFrame } from './rules/frame.js';
export { parseSeed, seededRandom, type SeedResult } from './rules/seed.js';
