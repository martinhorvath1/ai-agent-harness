import { describe, expect, it } from 'vitest';
import { applyMove } from '../../src/core/rules/move.js';
import type { Board } from '../../src/core/model/board.js';

// Kills id343 (column index arithmetic row * BOARD_SIZE + col -> - col): the existing unit
// tests only exercise column 0, where +col and -col coincide (both zero). Column 1 tells
// them apart.
describe('applyMove: non-zero column indexing for vertical directions', () => {
  it('slides and merges column 1 upward', () => {
    const board: Board = [
      null, 2, null, null,
      null, 2, null, null,
      null, 4, null, null,
      null, 4, null, null,
    ];
    const result = applyMove(board, 'up');
    expect([result.board[1], result.board[5], result.board[9], result.board[13]]).toEqual([4, 8, null, null]);
  });
});
