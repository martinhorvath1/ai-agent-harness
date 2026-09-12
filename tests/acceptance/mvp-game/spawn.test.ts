import { describe, expect, it } from 'vitest';
import type { Board } from '../../../src/core/index.js';
import { KEY_BYTES, gridCells, movedBoard, newSession, randomForOpeningThenSpawn, runPlay, splitLines } from './support.js';

const OPENING = [{ index: 0, value: 2 }, { index: 1, value: 2 }] as const;
const OPENING_BOARD: Board = [2, 2, ...Array<null>(14).fill(null)];

// @D4 @D5
it('a move that changed the board spawns one new tile on an empty cell', () => {
  const random = randomForOpeningThenSpawn([...OPENING], 0.5);
  const before = newSession(random);
  const after = before.press('left');

  const cells = gridCells(splitLines(after.frame));
  const filled = cells.filter((cell) => cell !== '');
  expect(filled).toHaveLength(2);
  expect(filled).toContain('4'); // the tile the merge produced
  const spawned = filled.filter((cell) => cell !== '4');
  expect(spawned).toHaveLength(1);
  expect(['2', '4']).toContain(spawned[0]);
});

// @D4 @D5
describe('a spawned tile is a 2 with probability 0.9 and a 4 with probability 0.1', () => {
  it.each([
    [0.0, '4'],
    [0.05, '4'],
    [0.1, '2'],
    [0.5, '2'],
    [0.99, '2'],
  ])('random value %s spawns a %s', (value, tile) => {
    const random = randomForOpeningThenSpawn([...OPENING], value);
    const before = newSession(random);
    const after = before.press('left');

    const afterCells = gridCells(splitLines(after.frame));
    // identify the spawned tile positionally -- the one cell where the real (spawning)
    // move differs from the pure slide-and-merge result -- rather than by value, since the
    // merge product can itself be a '4' and can even coincide with a cell the spawn could use
    const pureMergeCells = movedBoard(OPENING_BOARD, 'left').map((cell) => (cell === null ? '' : String(cell)));
    const spawnedIndexes = afterCells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell, index }) => pureMergeCells[index] !== cell);
    expect(spawnedIndexes).toHaveLength(1);
    expect(spawnedIndexes[0].cell).toBe(tile);
  });
});

// @D4 @D5
it('the spawn lands on a uniformly chosen empty cell', () => {
  const random = randomForOpeningThenSpawn([...OPENING], 0.999);
  const before = newSession(random);
  const after = before.press('left');

  const rows = splitLines(after.frame);
  const cells = gridCells(rows);
  expect(cells[0]).toBe('4'); // the merge product, at the leading edge
  expect(cells[cells.length - 1]).not.toBe(''); // lands on one of the LAST empty cells
  expect(cells[1]).toBe(''); // not the first empty cell after the merge product
});

// @D5 @D15
it('a seeded run is reproducible', async () => {
  const keys = [KEY_BYTES.a, KEY_BYTES.a, KEY_BYTES.q];
  const first = await runPlay({ env: { PIPELINE_SEED: '1' }, keys });
  const second = await runPlay({ env: { PIPELINE_SEED: '1' }, keys });
  expect(first.stdout).toBe(second.stdout);
  expect(first.exitCode).toBe(0);
  expect(second.exitCode).toBe(0);
}, 30_000);
