import { describe, expect, it } from 'vitest';
import { newGame, type RandomSource } from '../../../src/core/index.js';

function sequence(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value as number;
  };
}

describe('newGame empty-cell placement', () => {
  it('maps a random value near 1 to a cell near the end of the empty list, not the start', () => {
    // 16 empty cells; a random value close to 1 should select near the last empty index.
    const board = newGame(sequence([0.99, 0.5, 0.99, 0.5]));
    const filledIndexes = board.reduce<number[]>((acc, cell, index) => {
      if (cell !== null) acc.push(index);
      return acc;
    }, []);
    expect(filledIndexes).toContain(15);
    expect(filledIndexes).not.toContain(0);
  });
});
