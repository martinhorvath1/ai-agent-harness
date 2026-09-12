import { expect, it } from 'vitest';
import { KEY_BYTES, extractFrames, gridCells, parseGridRows, runPlay } from './support.js';

// @D16
it('the command surface, the board and the hint are unchanged', async () => {
  const help = await runPlay({ args: ['--help'], keys: [] });
  expect(help.stdout).toMatch(/\bplay\b/);
  expect(help.stdout.toLowerCase()).not.toMatch(/\bhello\b/);
  expect(help.exitCode).toBe(0);

  const play = await runPlay({ env: { PIPELINE_SEED: '1' }, keys: [KEY_BYTES.q] });
  const frames = extractFrames(play.stdout);
  const rows = parseGridRows(frames[0]);
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row).toHaveLength(4);
  }
  expect(gridCells(frames[0])).toHaveLength(16);
  expect(frames[0][frames[0].length - 1]).toBe('Arrows/WASD to move - q to quit');

  // no environment variable other than PIPELINE_SEED affects the run
  const withNoise = await runPlay({
    env: { PIPELINE_SEED: '1', SOME_UNRELATED_ENV_VAR: 'noise' },
    keys: [KEY_BYTES.q],
  });
  expect(withNoise.stdout).toBe(play.stdout);
}, 30_000);
