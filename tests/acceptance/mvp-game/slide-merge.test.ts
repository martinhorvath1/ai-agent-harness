import { describe, expect, it } from 'vitest';
import { boardWithLeftColumn, boardWithTopRow, leftColumnOf, movedBoard, parseLine, topRowOf } from './support.js';

// @D2
describe('tiles slide to the leading edge and merge at most once per move', () => {
  it.each([
    ['2 2 4 4', 'left', '4 8 empty empty'],
    ['2 2 4 empty', 'left', '4 4 empty empty'],
    ['4 4 4 empty', 'left', '8 4 empty empty'],
    ['2 empty empty 2', 'left', '4 empty empty empty'],
    ['2 empty 4 empty', 'left', '2 4 empty empty'],
    ['8 4 2 2', 'left', '8 4 4 empty'],
    ['2 2 4 4', 'right', 'empty empty 4 8'],
    ['4 4 4 empty', 'right', 'empty empty 4 8'],
    ['2 empty empty 2', 'right', 'empty empty empty 4'],
  ] as const)('%s pressed %s becomes %s', (before, direction, after) => {
    const board = boardWithTopRow(parseLine(before));
    const result = movedBoard(board, direction);
    expect(topRowOf(result)).toEqual(parseLine(after));
  });
});

// @D2
describe('a column slides and merges the same way', () => {
  it.each([
    ['2 2 4 4', 'up', '4 8 empty empty'],
    ['4 4 4 empty', 'up', '8 4 empty empty'],
    ['2 2 4 4', 'down', 'empty empty 4 8'],
    ['empty 2 empty 2', 'down', 'empty empty empty 4'],
  ] as const)('%s pressed %s becomes %s', (before, direction, after) => {
    const board = boardWithLeftColumn(parseLine(before));
    const result = movedBoard(board, direction);
    expect(leftColumnOf(result)).toEqual(parseLine(after));
  });
});
