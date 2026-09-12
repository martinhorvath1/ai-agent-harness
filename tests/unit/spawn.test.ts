import { describe, expect, it } from 'vitest';
import { spawnTile } from '../../src/core/rules/spawn.js';
import type { Board } from '../../src/core/model/board.js';
import type { RandomSource } from '../../src/core/model/random-source.js';

function sequence(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value as number;
  };
}

const EMPTY_BOARD: Board = new Array(16).fill(null);

describe('spawnTile', () => {
  it('places a 2 when the value draw is at or above 0.1', () => {
    const board = spawnTile(EMPTY_BOARD, sequence([0, 0.5]));
    expect(board.filter((cell) => cell !== null)).toEqual([2]);
  });

  it('places a 4 when the value draw is below 0.1', () => {
    const board = spawnTile(EMPTY_BOARD, sequence([0, 0.05]));
    expect(board.filter((cell) => cell !== null)).toEqual([4]);
  });

  it('draws the cell index before the tile value', () => {
    const board = spawnTile(EMPTY_BOARD, sequence([0.999, 0.5]));
    // a value near 1 selects the last empty cell
    expect(board[15]).toBe(2);
    expect(board.filter((cell) => cell !== null)).toHaveLength(1);
  });

  it('only places the tile on a cell that was empty', () => {
    const board: Board = [2, ...new Array<null>(14).fill(null), 4];
    const result = spawnTile(board, sequence([0, 0.5]));
    // index 0 and 15 are already filled; the first empty cell is index 1
    expect(result[1]).not.toBeNull();
    expect(result[0]).toBe(2);
    expect(result[15]).toBe(4);
  });

  it('throws when the board has no empty cell', () => {
    const full: Board = new Array(16).fill(2);
    expect(() => spawnTile(full, sequence([0, 0.5]))).toThrow('no empty cells to place a tile on');
  });
});
