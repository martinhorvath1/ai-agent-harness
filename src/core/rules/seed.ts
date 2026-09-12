import type { RandomSource } from '../model/random-source.js';

export type SeedResult =
  | { readonly ok: true; readonly seed: number | undefined } // undefined = PIPELINE_SEED unset
  | { readonly ok: false; readonly message: string };

const NON_NEGATIVE_INTEGER = /^\d+$/;

/** `seededRandom` folds its seed through `>>> 0`, so anything outside this range aliases. */
const MAX_SEED = 2 ** 32 - 1;

/**
 * `undefined` -> ok with no seed; a non-negative integer string within `0 .. 2**32-1` -> ok
 * with that seed; anything else (including "", "-1", "1.5", "abc", and integers outside that
 * range, which would otherwise alias modulo 2**32 inside `seededRandom`) -> not ok (D10).
 */
export function parseSeed(raw: string | undefined): SeedResult {
  if (raw === undefined) {
    return { ok: true, seed: undefined };
  }
  if (!NON_NEGATIVE_INTEGER.test(raw) || Number(raw) > MAX_SEED) {
    return { ok: false, message: `PIPELINE_SEED must be a non-negative integer no greater than ${MAX_SEED}, got: "${raw}"` };
  }
  return { ok: true, seed: Number(raw) };
}

/** A pure integer PRNG (mulberry32), seeded deterministically from `seed`. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
