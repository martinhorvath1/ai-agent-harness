import { describe, expect, it } from 'vitest';
import { renderFrame } from '../../../src/core/rules/frame.js';
import type { Board } from '../../../src/core/model/board.js';
import type { GameState } from '../../../src/core/model/game-state.js';

const EMPTY_BOARD: Board = new Array(16).fill(null);

// Kills id250 (status === undefined -> false): when neither won nor over applies, no status
// line should be inserted at all. The existing unit test only checks that the line right
// before the hint is blank, which is also true if a spurious extra blank status line is
// inserted -- because Array.prototype.join renders an undefined element as ''. Asserting the
// total line count catches the spurious insertion the content-only check misses.
describe('renderFrame: no status line when neither won nor over', () => {
  it('produces exactly title, score, blank, 9 grid lines, blank, hint', () => {
    const state: GameState = { board: EMPTY_BOARD, score: 0, won: false, over: false };
    const lines = renderFrame(state).split('\n');
    expect(lines).toHaveLength(14);
  });
});
