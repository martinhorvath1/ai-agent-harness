import type { Board, Cell } from '../model/board.js';
import type { RandomSource } from '../model/random-source.js';

const FOUR_PROBABILITY = 0.1;

function randomTileValue(random: RandomSource): Cell {
  return random() < FOUR_PROBABILITY ? 4 : 2;
}

function pickEmptyIndex(cells: readonly Cell[], random: RandomSource): number {
  const emptyIndexes = cells.reduce<number[]>((acc, cell, index) => {
    if (cell === null) {
      acc.push(index);
    }
    return acc;
  }, []);
  const choice = Math.floor(random() * emptyIndexes.length);
  const index = emptyIndexes[choice];
  if (index === undefined) {
    throw new Error('no empty cells to place a tile on');
  }
  return index;
}

/**
 * One new tile on a uniformly chosen empty cell: 2 with p=0.9, 4 with p=0.1 (D4).
 * Draws exactly twice from `random`: first the cell, then the value.
 * Throws when the board has no empty cell.
 */
export function spawnTile(board: Board, random: RandomSource): Board {
  const index = pickEmptyIndex(board, random);
  const cells = [...board];
  cells[index] = randomTileValue(random);
  return cells;
}
