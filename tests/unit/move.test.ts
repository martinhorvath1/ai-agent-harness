import { describe, expect, it } from 'vitest';
import { applyMove } from '../../src/core/rules/move.js';
import type { Board } from '../../src/core/model/board.js';

function boardWithTopRow(row: readonly (number | null)[]): Board {
  return [...row, ...new Array<null>(12).fill(null)];
}

describe('applyMove', () => {
  it('slides and merges a row left, reporting the score gained', () => {
    const board = boardWithTopRow([2, 2, 4, 4]);
    const result = applyMove(board, 'left');
    expect(result.board.slice(0, 4)).toEqual([4, 8, null, null]);
    expect(result.scoreGained).toBe(12);
    expect(result.changed).toBe(true);
  });

  it('reports changed: false and gained: 0 for a no-op move', () => {
    const board = boardWithTopRow([2, 4, null, null]);
    const result = applyMove(board, 'left');
    expect(result.board).toEqual(board);
    expect(result.scoreGained).toBe(0);
    expect(result.changed).toBe(false);
  });

  it('slides a column up', () => {
    const board: Board = [2, null, null, null, 2, null, null, null, 4, null, null, null, 4, null, null, null];
    const result = applyMove(board, 'up');
    expect([result.board[0], result.board[4], result.board[8], result.board[12]]).toEqual([4, 8, null, null]);
  });

  it('slides a column down', () => {
    const board: Board = [2, null, null, null, 2, null, null, null, 4, null, null, null, 4, null, null, null];
    const result = applyMove(board, 'down');
    expect([result.board[0], result.board[4], result.board[8], result.board[12]]).toEqual([null, null, 4, 8]);
  });

  it('slides a row right', () => {
    const board = boardWithTopRow([2, 2, 4, 4]);
    const result = applyMove(board, 'right');
    expect(result.board.slice(0, 4)).toEqual([null, null, 4, 8]);
  });

  it('does not mutate the board passed in', () => {
    const board = boardWithTopRow([2, 2, null, null]);
    const before = [...board];
    applyMove(board, 'left');
    expect(board).toEqual(before);
  });
});
