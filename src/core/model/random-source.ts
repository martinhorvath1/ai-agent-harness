/** The core's only randomness. Always injected, never defaulted inside the core (D7). */
export type RandomSource = () => number; // 0 <= n < 1
