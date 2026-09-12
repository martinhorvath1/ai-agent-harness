import { describe, expect, it } from 'vitest';
import { KEY_BYTES, boardWithTopRow, moveOutcome, parseLine, runPlay, splitLines } from './support.js';

// @D6
describe('the score rises by the value of each tile a merge produces', () => {
  it.each([
    ['4 4 empty empty', 8],
    ['2 2 4 4', 12],
    ['4 4 4 empty', 8],
    ['2 4 empty 2', 0],
  ] as const)('%s pressed left scores %s', (row, score) => {
    const board = boardWithTopRow(parseLine(row));
    const outcome = moveOutcome(board, 'left');
    expect(outcome.scoreGained).toBe(score);
  });
});

// @D6 @D7
it('the two opening tiles score nothing', async () => {
  const result = await runPlay({ env: { PIPELINE_SEED: '1' }, keys: [KEY_BYTES.q] });
  const lines = splitLines(result.stdout);
  expect(lines[1]).toBe('Score: 0');
}, 30_000);
