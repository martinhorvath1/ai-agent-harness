import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../src/core/rules/seed.js';

// Kills id460/id461 (the +/- arithmetic inside the mulberry32 state update and mix steps):
// `seededRandom`'s doc comment names the exact algorithm (mulberry32), so its output for a
// given seed is a documented behavioural contract, not an incidental implementation detail.
// These expected values come from an independent reimplementation of the published
// mulberry32 algorithm, run outside this codebase.
describe('seededRandom: mulberry32 conformance', () => {
  it('matches the published mulberry32 sequence for seed 0', () => {
    const random = seededRandom(0);
    expect(random()).toBeCloseTo(0.26642920868471265, 12);
    expect(random()).toBeCloseTo(0.0003297457005828619, 12);
    expect(random()).toBeCloseTo(0.2232720274478197, 12);
  });

  it('matches the published mulberry32 sequence for seed 1', () => {
    const random = seededRandom(1);
    expect(random()).toBeCloseTo(0.6270739405881613, 12);
    expect(random()).toBeCloseTo(0.002735721180215478, 12);
    expect(random()).toBeCloseTo(0.5274470399599522, 12);
  });
});
