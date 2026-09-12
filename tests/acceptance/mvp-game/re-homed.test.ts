import { describe, expect, it } from 'vitest';
import { KEY_BYTES, extractFrames, findSeed, gridCells, runPlay } from './support.js';

const ESCAPE_CODE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*[A-Za-z]`);

// @D15
describe('the opening board holds exactly two tiles', () => {
  it.each([0, 1, 7, 42])('seed %i', async (seed) => {
    const result = await runPlay({ env: { PIPELINE_SEED: String(seed) }, keys: [KEY_BYTES.q] });
    expect(result.exitCode).toBe(0);

    const frames = extractFrames(result.stdout);
    expect(frames[0]).toHaveLength(14); // title, score, blank, 9 grid lines, blank, hint
    const cells = gridCells(frames[0]);
    expect(cells).toHaveLength(16);

    const filled = cells.filter((cell) => cell !== '');
    const empty = cells.filter((cell) => cell === '');
    expect(filled).toHaveLength(2);
    expect(empty).toHaveLength(14);
    for (const cell of filled) {
      expect([2, 4]).toContain(Number(cell));
    }
  }, 30_000);
});

// @D15
it('a 4 can appear as an opening tile', async () => {
  const seed = findSeed((board) => board.includes(4));
  const result = await runPlay({ env: { PIPELINE_SEED: String(seed) }, keys: [KEY_BYTES.q] });
  const frames = extractFrames(result.stdout);
  const cells = gridCells(frames[0]);
  expect(cells).toContain('4');
}, 30_000);

// @D15
describe('a seed that is not a non-negative integer no greater than 4294967295 is an error', () => {
  it.each(['abc', '4294967296'])('rejects seed "%s"', async (seed) => {
    const result = await runPlay({ args: ['play'], env: { PIPELINE_SEED: seed }, keys: [] });
    expect(result.stderr).toContain('PIPELINE_SEED');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  }, 30_000);
});

// @D15
it('play takes no arguments', async () => {
  const result = await runPlay({ args: ['play', 'extra'], keys: [KEY_BYTES.q] });
  expect(result.stderr).toContain('usage: play');
  expect(result.exitCode).toBe(1);
}, 30_000);

// @D15
it('an unrecognised command name is reported', async () => {
  const result = await runPlay({ args: ['nope'], keys: [] });
  expect(result.stderr).toContain('unknown command: nope');
  expect(result.exitCode).toBe(1);
}, 30_000);

// @D15
it('end of input ends the loop', async () => {
  const result = await runPlay({ keys: [], closeStdin: true });
  const frames = extractFrames(result.stdout);
  expect(frames).toHaveLength(1);
  expect(result.exitCode).toBe(0);
}, 30_000);

// @D15
it('piped output carries no escape codes', async () => {
  const result = await runPlay({ keys: [KEY_BYTES.q] });
  expect(result.stdout).not.toMatch(ESCAPE_CODE);
  expect(result.exitCode).toBe(0);
}, 30_000);

