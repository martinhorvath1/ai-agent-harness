import type { GameState } from '../model/game-state.js';
import type { Direction } from '../model/direction.js';
import type { RandomSource } from '../model/random-source.js';
import { applyMove } from '../rules/move.js';
import { newGame } from '../rules/new-game.js';
import { hasLegalMove, hasWinningTile } from '../rules/outcome.js';
import { spawnTile } from '../rules/spawn.js';

/** The opening state: the opening board, score 0, not won, not over (D6). */
export function startGame(random: RandomSource): GameState {
  return { board: newGame(random), score: 0, won: false, over: false };
}

/** One turn: move, spawn when the board changed, then win and loss (D3, D4, D8, D9, D11). */
export function nextState(state: GameState, direction: Direction, random: RandomSource): GameState {
  const moved = applyMove(state.board, direction);
  if (!moved.changed) {
    return state;
  }
  const board = spawnTile(moved.board, random);
  return {
    board,
    score: state.score + moved.scoreGained,
    won: state.won || hasWinningTile(board),
    over: !hasLegalMove(board),
  };
}
