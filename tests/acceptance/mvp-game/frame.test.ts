import { expect, it } from 'vitest';
import type { Board } from '../../../src/core/index.js';
import { HINT_LINE, KEY_BYTES, extractFrames, parseGridRows, renderFrame, runPlay, splitLines } from './support.js';

// @D7 @D15
it('a frame with no status line reads title, score, blank, grid, blank, hint', async () => {
  const result = await runPlay({ env: { PIPELINE_SEED: '1' }, keys: [KEY_BYTES.q] });
  expect(result.exitCode).toBe(0);

  const frames = extractFrames(result.stdout);
  expect(frames).toHaveLength(1);
  const frame = frames[0];

  expect(frame[0]).toBe('2048');
  expect(frame[1]).toBe('Score: 0');
  expect(frame[2]).toBe('');

  const rows = parseGridRows(frame);
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row).toHaveLength(4);
    for (const cell of row) {
      expect(cell).toHaveLength(6);
    }
  }

  expect(frame[frame.length - 2]).toBe('');
  expect(frame[frame.length - 1]).toBe(HINT_LINE);
  // no status line: the line straight after the grid's trailing blank is the hint itself
  const lastGridLineIndex = lastIndexOfBorder(frame);
  expect(frame[lastGridLineIndex + 1]).toBe('');
  expect(frame[lastGridLineIndex + 2]).toBe(HINT_LINE);
}, 30_000);

/** The index of the grid's bottom border: the last line made only of box-drawing border chars. */
function lastIndexOfBorder(lines: readonly string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes('─')) {
      return index;
    }
  }
  throw new Error('no grid border found in frame');
}

// @D7 @D8
it('the frame gains a status line between the grid and the hint when one applies', () => {
  const board: Board = [2048, ...Array<null>(15).fill(null)];
  const frame = renderFrame(board);
  const lines = splitLines(frame);

  const lastGridLineIndex = lastIndexOfBorder(lines);
  expect(lines[lastGridLineIndex + 1]).toBe('');
  expect(lines[lastGridLineIndex + 2]).toBe('You win!');
  expect(lines[lines.length - 1]).toBe(HINT_LINE);
});
