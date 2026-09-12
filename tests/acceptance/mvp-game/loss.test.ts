import { expect, it } from 'vitest';
import type { Board, Cell } from '../../../src/core/index.js';
import { renderFrame, runUntilGameOver, splitLines } from './support.js';

const PALETTE: readonly [number, number, number] = [2, 4, 8];

/** A full 4x4 board with no two orthogonally adjacent equal tiles: `value(r,c) = palette[(r+c)%3]`,
 *  which guarantees every immediate neighbour (row or column) differs by exactly one step. */
function fullBoardNoLegalMove(): Board {
  const cells: Cell[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      cells.push(PALETTE[(row + col) % 3]);
    }
  }
  return cells;
}

function statusLineOf(board: Board): string {
  const lines = splitLines(renderFrame(board));
  const candidate = lines[lines.length - 2];
  return candidate === '' ? '' : candidate;
}

// @D9
it('the run ends when no legal move remains', async () => {
  // the status line reads Game over for a board with no empty cell and no adjacent equal pair
  const board = fullBoardNoLegalMove();
  expect(board.every((cell) => cell !== null)).toBe(true);
  expect(statusLineOf(board)).toBe('Game over');

  // and, played out for real, that condition ends the run: exit 0, without waiting for
  // whatever keys are still queued up
  const run = await runUntilGameOver({ pattern: ['w', 'a', 's', 'd'] });
  const frames = run.lines.filter((line) => line === '2048').length;

  expect(run.exitCode).toBe(0);
  expect(run.lines[run.lines.length - 2]).toBe('Game over'); // the hint is always the last line
  expect(frames).toBeLessThan(run.keysSent);
}, 30_000);

// @D9
it('a full board with an adjacent equal pair is not game over', () => {
  const board = fullBoardNoLegalMove().slice();
  board[1] = board[0]; // force one adjacent pair
  expect(board.every((cell) => cell !== null)).toBe(true);

  expect(statusLineOf(board)).toBe('');
});

// @D11
it('the spawned tile can fill the last cell and end the run in the same frame', async () => {
  // a board with exactly one empty cell (row0,col3), where sliding the last column down
  // leaves no pair of orthogonally adjacent equal tiles
  const before: Board = [
    2, 4, 16, 4,
    4, 8, 2, 8,
    2, 4, 16, 4,
    4, 8, 2, null,
  ];
  expect(before.filter((cell) => cell === null)).toHaveLength(1);

  // filling that one empty cell (row0,col3) with a 2 -- not a 4, which would equal its
  // neighbour at row1,col3 -- leaves a full board with no pair of adjacent equal tiles
  const afterSpawn: Board = [
    2, 4, 16, 2,
    4, 8, 2, 4,
    2, 4, 16, 8,
    4, 8, 2, 4,
  ];
  expect(afterSpawn.every((cell) => cell !== null)).toBe(true);
  expect(statusLineOf(afterSpawn)).toBe('Game over');

  // and, played out for real, a move that produces a game-over position ends the run in
  // that same frame: exit 0, without waiting for whatever keys are still queued up
  const run = await runUntilGameOver({ pattern: ['s', 'd', 'w', 'a'] });
  const frames = run.lines.filter((line) => line === '2048').length;

  expect(run.exitCode).toBe(0);
  expect(run.lines[run.lines.length - 2]).toBe('Game over'); // the hint is always the last line
  expect(frames).toBeLessThan(run.keysSent);
}, 30_000);

// @D10
it('Game over replaces You win! on the final frame of a won game', () => {
  const board = fullBoardNoLegalMove().slice();
  board[0] = 2048; // the game had been won at some point; the board no longer shows it winning

  expect(statusLineOf(board)).toBe('Game over');
  expect(renderFrame(board)).not.toContain('You win!');
});
