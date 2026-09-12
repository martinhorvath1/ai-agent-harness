import { describe, expect, it } from 'vitest';
import { renderGrid } from '../../../src/core/rules/grid.js';
import type { Board } from '../../../src/core/model/board.js';

const EMPTY_BOARD: Board = new Array(16).fill(null);

// Kills id290/id291/id292 (the '├', '┼', '┤' string literals in the middle row separator
// replaced with ""): the existing unit tests only check the outer top/bottom borders and
// the first content row, never a separator line between rows.
describe('renderGrid: row separator', () => {
  it('draws a full box-drawing separator between rows', () => {
    const lines = renderGrid(EMPTY_BOARD).split('\n');
    expect(lines[2]).toBe('├──────┼──────┼──────┼──────┤');
  });
});
