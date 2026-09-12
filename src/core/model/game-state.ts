import type { Board } from './board.js';

/** Everything one frame is drawn from. */
export interface GameState {
  readonly board: Board;
  /** The running sum of the values of all tiles that merges have produced (D6). */
  readonly score: number;
  /** Sticky: true from the first frame on which a tile of 2048 has appeared (D8). */
  readonly won: boolean;
  /** True when no legal move remains; the run ends on this frame (D9). */
  readonly over: boolean;
}
