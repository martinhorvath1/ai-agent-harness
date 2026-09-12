import { expect, it } from 'vitest';
import { boardWithTopRow, movedBoard, parseLine, renderFrame, splitLines } from './support.js';

function statusLineOf(board: readonly (number | null)[]): string {
  const lines = splitLines(renderFrame(board));
  const hintIndex = lines.length - 1;
  const candidate = lines[hintIndex - 1];
  return candidate === '' ? '' : candidate;
}

// @D8
it('reaching 2048 announces a win and the run keeps going', () => {
  const board = boardWithTopRow(parseLine('1024 1024 empty empty'));
  const result = movedBoard(board, 'left');

  expect(result).toContain(2048);
  expect(statusLineOf(result)).toBe('You win!');
  expect(result.some((cell) => cell === null)).toBe(true); // empty cells remain: the run has not ended
});

// @D8
it('the win status stays on every later frame', () => {
  const board = boardWithTopRow(parseLine('1024 1024 empty empty'));
  const afterLeft = movedBoard(board, 'left');
  const afterDown = movedBoard(afterLeft, 'down');

  expect(statusLineOf(afterDown)).toBe('You win!');
});
