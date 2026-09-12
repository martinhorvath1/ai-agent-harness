import { describe, expect, it } from 'vitest';
import { newSession, sessionFrom } from '../../src/core/game/session.js';
import type { GameState } from '../../src/core/model/game-state.js';
import type { Board } from '../../src/core/model/board.js';

function fixedRandom(value: number) {
  return () => value;
}

function boardWithTopRow(row: readonly (number | null)[]): Board {
  return [...row, ...new Array<null>(12).fill(null)];
}

describe('newSession', () => {
  it('builds a session whose frame matches the opening board', () => {
    const session = newSession(fixedRandom(0.5));
    expect(session.frame).toContain('2048');
    expect(session.over).toBe(false);
  });

  it('press() runs a real move and re-renders a new frame', () => {
    const board = boardWithTopRow([2, 2, null, null]);
    const session = sessionFrom({ board, score: 0, won: false, over: false }, fixedRandom(0.5));
    const next = session.press('left');
    expect(next.frame).not.toBe(session.frame);
    expect(next).not.toBe(session);
  });

  it('press() on a no-op move re-renders the same frame', () => {
    const board = boardWithTopRow([2, 4, null, null]);
    const session = sessionFrom({ board, score: 0, won: false, over: false }, fixedRandom(0.5));
    const next = session.press('left');
    expect(next.frame).toBe(session.frame);
  });
});

describe('sessionFrom', () => {
  it('reports over: true for a state whose board has no legal move', () => {
    const palette = [2, 4, 8];
    const cells: (number | null)[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        cells.push(palette[(row + col) % 3]);
      }
    }
    const state: GameState = { board: cells, score: 0, won: false, over: true };
    const session = sessionFrom(state, fixedRandom(0.5));
    expect(session.over).toBe(true);
    expect(session.frame).toContain('Game over');
  });
});
