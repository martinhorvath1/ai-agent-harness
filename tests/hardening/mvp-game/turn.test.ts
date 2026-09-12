import { describe, expect, it } from 'vitest';
import { nextState } from '../../../src/core/game/turn.js';
import type { GameState } from '../../../src/core/model/game-state.js';
import type { Board } from '../../../src/core/model/board.js';
import type { RandomSource } from '../../../src/core/model/random-source.js';

function sequence(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value as number;
  };
}

function boardWithTopRow(row: readonly (number | null)[]): Board {
  return [...row, ...new Array<null>(12).fill(null)];
}

// Kills id224 (state.won || hasWinningTile(board) -> true): a move that changes the board
// but never produces a 2048 tile, from a state that was not already won, must stay not won.
describe('nextState: won stays false without a winning tile', () => {
  it('does not set won for an ordinary merge', () => {
    const board = boardWithTopRow([2, 2, null, null]);
    const state: GameState = { board, score: 0, won: false, over: false };
    const result = nextState(state, 'left', sequence([0, 0.5]));
    expect(result.won).toBe(false);
  });
});
