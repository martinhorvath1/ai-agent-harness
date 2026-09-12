import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/core/rules/new-game.js';
import type { RandomSource } from '../../src/core/model/random-source.js';

function sequence(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value as number;
  };
}

describe('newGame', () => {
  it('places exactly two tiles on a 16-cell board', () => {
    const board = newGame(sequence([0.5, 0.5, 0.9, 0.9]));
    expect(board).toHaveLength(16);
    const filled = board.filter((cell) => cell !== null);
    expect(filled).toHaveLength(2);
  });

  it('places 2 when the value is at or above 0.1', () => {
    const board = newGame(sequence([0.5, 0.1, 0.5, 0.1]));
    const filled = board.filter((cell) => cell !== null);
    expect(filled).toEqual([2, 2]);
  });

  it('places 4 when the value is below 0.1', () => {
    const board = newGame(sequence([0.5, 0.05, 0.5, 0.05]));
    const filled = board.filter((cell) => cell !== null);
    expect(filled).toEqual([4, 4]);
  });

  it('never places both tiles on the same cell', () => {
    // random() always returns 0, which would pick index 0 in an empty-index list both times
    // if empty cells were not correctly excluded after the first placement.
    const board = newGame(sequence([0, 0.5, 0, 0.5]));
    const filledIndexes = board.reduce<number[]>((acc, cell, index) => {
      if (cell !== null) acc.push(index);
      return acc;
    }, []);
    expect(filledIndexes).toHaveLength(2);
    expect(filledIndexes[0]).not.toBe(filledIndexes[1]);
  });
});
