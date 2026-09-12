import { describe, expect, it } from 'vitest';
import { hasLegalMove, hasWinningTile, WINNING_TILE } from '../../src/core/rules/outcome.js';
import type { Board } from '../../src/core/model/board.js';

describe('hasWinningTile', () => {
  it('is false when no 2048 tile is present', () => {
    const board: Board = new Array(16).fill(null);
    expect(hasWinningTile(board)).toBe(false);
  });

  it('is true once a 2048 tile is on the board', () => {
    const board: Board = [WINNING_TILE, ...new Array<null>(15).fill(null)];
    expect(hasWinningTile(board)).toBe(true);
  });
});

describe('hasLegalMove', () => {
  it('is true when an empty cell remains', () => {
    const board: Board = new Array(16).fill(2);
    (board as (number | null)[])[0] = null;
    expect(hasLegalMove(board)).toBe(true);
  });

  it('is false for a full board with no adjacent equal pair', () => {
    const palette = [2, 4, 8];
    const cells: (number | null)[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        cells.push(palette[(row + col) % 3]);
      }
    }
    expect(hasLegalMove(cells)).toBe(false);
  });

  it('is true for a full board with one horizontally adjacent equal pair', () => {
    const palette = [2, 4, 8];
    const cells: (number | null)[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        cells.push(palette[(row + col) % 3]);
      }
    }
    cells[1] = cells[0];
    expect(hasLegalMove(cells)).toBe(true);
  });

  it('is true for a full board with one vertically adjacent equal pair', () => {
    const palette = [2, 4, 8];
    const cells: (number | null)[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        cells.push(palette[(row + col) % 3]);
      }
    }
    cells[4] = cells[0];
    expect(hasLegalMove(cells)).toBe(true);
  });
});
