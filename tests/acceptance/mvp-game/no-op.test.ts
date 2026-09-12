import { describe, expect, it } from 'vitest';
import {
  boardWithTopRow,
  gridCells,
  movedBoard,
  newSession,
  parseLine,
  randomForOpeningThenSpawn,
  splitLines,
} from './support.js';

// @D3
describe('a no-op move spawns nothing and scores nothing', () => {
  it.each([
    ['2 4 empty empty', 'left', [{ index: 0, value: 2 }, { index: 1, value: 4 }]],
    ['empty empty 2 4', 'right', [{ index: 2, value: 2 }, { index: 3, value: 4 }]],
  ] as const)('%s pressed %s is a no-op', (row, direction, placements) => {
    // the pure move itself leaves the board identical
    const board = boardWithTopRow(parseLine(row));
    expect(movedBoard(board, direction)).toEqual(board);

    // and a real session redraws the same board, spending neither a tile nor a point
    const random = randomForOpeningThenSpawn(placements, 0.5);
    const before = newSession(random);
    const beforeLines = splitLines(before.frame);
    expect(beforeLines[1]).toBe('Score: 0');

    const after = before.press(direction);
    const afterLines = splitLines(after.frame);

    expect(gridCells(afterLines)).toEqual(gridCells(beforeLines));
    expect(afterLines[1]).toBe('Score: 0');
    expect(after.frame.length).toBeGreaterThan(0);
  });
});

// @D13
it('a direction key now changes the board', () => {
  const board = boardWithTopRow(parseLine('2 2 empty empty'));
  const result = movedBoard(board, 'left');
  expect(result).not.toEqual(board);
});
