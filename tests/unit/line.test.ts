import { describe, expect, it } from 'vitest';
import { collapseLine } from '../../src/core/rules/line.js';

describe('collapseLine', () => {
  it.each([
    [[2, 2, 4, 4], [4, 8, null, null], 12],
    [[2, 2, 4, null], [4, 4, null, null], 4],
    [[4, 4, 4, null], [8, 4, null, null], 8],
    [[2, 4, null, null], [2, 4, null, null], 0],
  ] as const)('%j collapses to %j gaining %i', (input, cells, gained) => {
    const result = collapseLine(input);
    expect(result.cells).toEqual(cells);
    expect(result.gained).toBe(gained);
  });

  it('pads a fully empty line back to its original length', () => {
    const result = collapseLine([null, null, null, null]);
    expect(result.cells).toEqual([null, null, null, null]);
    expect(result.gained).toBe(0);
  });

  it('does not merge a tile a second time in the same pass', () => {
    // three equal tiles slide to two positions: first pair merges, the third stays alone
    const result = collapseLine([2, 2, 2, null]);
    expect(result.cells).toEqual([4, 2, null, null]);
    expect(result.gained).toBe(4);
  });
});
