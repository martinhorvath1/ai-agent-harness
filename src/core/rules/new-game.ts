import { BOARD_SIZE, type Board, type Cell } from '../model/board.js';
import type { RandomSource } from '../model/random-source.js';
import { spawnTile } from './spawn.js';

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Two opening tiles on random empty cells; each is 2 with p=0.9 and 4 with p=0.1 (D5, D6). */
export function newGame(random: RandomSource): Board {
  const empty: Board = new Array<Cell>(CELL_COUNT).fill(null);
  return spawnTile(spawnTile(empty, random), random);
}
