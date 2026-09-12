import { expect, it } from 'vitest';
import { KEY_BYTES, extractFrames, runPlay } from './support.js';

// @D12
it('a key that is neither a direction key nor a quit key is ignored', async () => {
  const result = await runPlay({
    env: { PIPELINE_SEED: '1' },
    keys: [KEY_BYTES.x, KEY_BYTES.q],
  });
  const frames = extractFrames(result.stdout);
  expect(frames).toHaveLength(2);
  expect(frames[0].join('\n')).toBe(frames[1].join('\n'));
  expect(result.exitCode).toBe(0);
}, 30_000);

// @D1
it('a player plays a seeded game end to end', async () => {
  const result = await runPlay({
    env: { PIPELINE_SEED: '1' },
    keys: [KEY_BYTES.a, KEY_BYTES.s, KEY_BYTES.d, KEY_BYTES.w, KEY_BYTES.q],
  });
  const frames = extractFrames(result.stdout);
  expect(frames).toHaveLength(5);

  const texts = frames.map((frame) => frame.join('\n'));
  expect(new Set(texts).size).toBeGreaterThan(1);

  for (const frame of frames) {
    expect(frame[0]).toBe('2048');
    expect(frame[1]).toMatch(/^Score: \d+$/);
    expect(frame[2]).toBe('');
    expect(frame[frame.length - 1]).toBe('Arrows/WASD to move - q to quit');
  }

  const scoreOf = (frame: readonly string[]): number => Number(frame[1].replace('Score: ', ''));
  expect(scoreOf(frames[frames.length - 1])).toBeGreaterThanOrEqual(scoreOf(frames[0]));
  expect(result.exitCode).toBe(0);
}, 30_000);
