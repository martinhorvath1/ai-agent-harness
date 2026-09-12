import { describe, expect, it } from 'vitest';
import { nextState, startGame } from '../../src/core/game/turn.js';
import type { GameState } from '../../src/core/model/game-state.js';
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

function boardWithTopRow(row: readonly (number | null)[]): Board {
  return [...row, ...new Array<null>(12).fill(null)];
}

describe('startGame', () => {
  it('returns score 0, not won, not over', () => {
    const state = startGame(sequence([0.5, 0.5, 0.9, 0.9]));
    expect(state.score).toBe(0);
    expect(state.won).toBe(false);
    expect(state.over).toBe(false);
  });
});

describe('nextState', () => {
  it('returns the same state for a no-op move: nothing spawns, nothing scores', () => {
    const board = boardWithTopRow([2, 4, null, null]);
    const state: GameState = { board, score: 7, won: false, over: false };
    const result = nextState(state, 'left', sequence([0.5, 0.5]));
    expect(result).toBe(state);
  });

  it('spawns a tile and adds the gained score for a move that changed the board', () => {
    const board = boardWithTopRow([2, 2, null, null]);
    const state: GameState = { board, score: 0, won: false, over: false };
    const result = nextState(state, 'left', sequence([0, 0.5]));
    expect(result.score).toBe(4);
    expect(result.board.filter((cell) => cell !== null)).toHaveLength(2);
  });

  it('sets won once a 2048 tile appears and keeps it sticky on a later move', () => {
    const board = boardWithTopRow([1024, 1024, null, null]);
    const state: GameState = { board, score: 0, won: false, over: false };
    const afterLeft = nextState(state, 'left', sequence([0, 0.5]));
    expect(afterLeft.won).toBe(true);

    const afterDown = nextState(afterLeft, 'down', sequence([0, 0.5]));
    expect(afterDown.won).toBe(true);
  });

  it('sets over based on the board after the spawn (D11)', () => {
    // one empty cell, at the start of row 0; moving left shifts the row's tiles into it
    // (changed: true, gained: 0) leaving a single empty cell at the row's end, which the
    // spawn then fills -- `over` must be read off that post-spawn, fully-packed board
    const before: Board = [
      null, 2, 4, 8,
      4, 8, 2, 4,
      2, 4, 8, 2,
      4, 8, 2, 4,
    ];
    const state: GameState = { board: before, score: 0, won: false, over: false };
    // spawn draws: any index (only one empty cell remains), value 0.5 -> 2
    const result = nextState(state, 'left', sequence([0.5, 0.5]));
    expect(result.board.every((cell) => cell !== null)).toBe(true);
    expect(result.board.slice(0, 4)).toEqual([2, 4, 8, 2]);
    expect(result.over).toBe(true);
  });
});
