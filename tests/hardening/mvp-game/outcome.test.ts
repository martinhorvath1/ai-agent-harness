import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../../../src/core/rules/outcome.js';
import type { Board } from '../../../src/core/model/board.js';

// Kills id393 (right-neighbour index arithmetic index+1 -> index-1): the only real
// adjacent-equal pair in this board is horizontal at (row 0, col 2)-(row 0, col 3).
// Reading the neighbour from index-1 instead of index+1 makes every row-scan miss it,
// with no other pair anywhere to compensate.
describe('hasLegalMove: right-neighbour arithmetic', () => {
  it('finds a horizontal pair at the last two columns of a row', () => {
    const board: Board = [
      2, 4, 8, 8,
      4, 8, 2, 4,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ];
    expect(hasLegalMove(board)).toBe(true);
  });
});

// Kills id394/id396/id398 (the col+1 < BOARD_SIZE boundary check on the right neighbour):
// the last column of row 0 happens to equal the first column of row 1 -- cells that are
// NOT orthogonal neighbours. A disabled or shifted boundary wrongly treats them as adjacent.
describe('hasLegalMove: right-neighbour column boundary', () => {
  it('does not treat the end of one row and the start of the next as adjacent', () => {
    const board: Board = [
      1, 2, 3, 100,
      100, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ];
    expect(hasLegalMove(board)).toBe(false);
  });
});

// Kills id399 (down-neighbour index arithmetic index+BOARD_SIZE -> index-BOARD_SIZE): the
// only real adjacent-equal pair is vertical, between row 2 and row 3 at column 0.
describe('hasLegalMove: down-neighbour arithmetic', () => {
  it('finds a vertical pair between two rows', () => {
    const board: Board = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      200, 90, 91, 92,
      200, 130, 140, 150,
    ];
    expect(hasLegalMove(board)).toBe(true);
  });
});

// Kills id428/id429/id431 (the "some cell is null" check): a board with exactly one empty
// cell and otherwise all-distinct tiles (so no adjacent-equal pair exists anywhere) is only
// a legal move because of that one empty cell.
describe('hasLegalMove: empty-cell check', () => {
  it('is true for a full-of-distinct-values board with a single empty cell', () => {
    const board: Board = [
      null, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15,
    ];
    expect(hasLegalMove(board)).toBe(true);
  });

  it('is false for the same layout of distinct values with no empty cell', () => {
    const board: Board = [
      16, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15,
    ];
    expect(hasLegalMove(board)).toBe(false);
  });
});
