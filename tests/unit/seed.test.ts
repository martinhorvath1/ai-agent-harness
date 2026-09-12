import { describe, expect, it } from 'vitest';
import { parseSeed, seededRandom } from '../../src/core/rules/seed.js';

describe('parseSeed', () => {
  it('is ok with no seed when unset', () => {
    expect(parseSeed(undefined)).toEqual({ ok: true, seed: undefined });
  });

  it('accepts a non-negative integer string', () => {
    expect(parseSeed('0')).toEqual({ ok: true, seed: 0 });
    expect(parseSeed('42')).toEqual({ ok: true, seed: 42 });
  });

  it.each(['abc', '1.5', '-1', '', '1e3'])('rejects "%s"', (raw) => {
    const result = parseSeed(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('PIPELINE_SEED');
    }
  });

  it('accepts the largest seed seededRandom can use without aliasing (2**32 - 1)', () => {
    expect(parseSeed('4294967295')).toEqual({ ok: true, seed: 4294967295 });
  });

  it('rejects a seed one past the boundary, which would alias back to 0', () => {
    const result = parseSeed('4294967296');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('PIPELINE_SEED');
    }
  });
});

describe('seededRandom', () => {
  it('returns values in [0, 1)', () => {
    const random = seededRandom(1);
    for (let i = 0; i < 50; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = seededRandom(1)();
    const b = seededRandom(2)();
    expect(a).not.toBe(b);
  });
});
