import { describe, expect, it } from 'vitest';
import { renderGrid } from '../../src/core/rules/grid.js';
import type { Board } from '../../src/core/model/board.js';

const EMPTY_BOARD: Board = new Array(16).fill(null);

describe('renderGrid', () => {
  it('draws 4 rows of 4 six-wide empty cells with borders', () => {
    const grid = renderGrid(EMPTY_BOARD);
    const lines = grid.split('\n');
    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe('┌──────┬──────┬──────┬──────┐');
    expect(lines[8]).toBe('└──────┴──────┴──────┴──────┘');
    expect(lines[1]).toBe('│      │      │      │      │');
  });

  it('centres a short value with the extra space on the right', () => {
    const board: Board = [2, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null];
    const grid = renderGrid(board);
    const firstRow = grid.split('\n')[1];
    expect(firstRow).toBe('│  2   │      │      │      │');
  });

  it('centres a three-digit value', () => {
    const board: Board = [128, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null];
    const grid = renderGrid(board);
    const firstRow = grid.split('\n')[1];
    expect(firstRow).toBe('│ 128  │      │      │      │');
  });
});
