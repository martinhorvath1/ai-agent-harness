import { BOARD_SIZE, type Board, type Cell } from '../model/board.js';
import type { Direction } from '../model/direction.js';
import { collapseLine } from './line.js';

export interface MoveResult {
  readonly board: Board;
  /** The score the merges in this move produced (D6). */
  readonly scoreGained: number;
  /** False when the board is identical to the one passed in: a no-op move (D3). */
  readonly changed: boolean;
}

/** The four lines of board indexes for `direction`, each ordered from its leading edge (D2). */
function lineIndexes(direction: Direction): readonly (readonly number[])[] {
  const range = Array.from({ length: BOARD_SIZE }, (_unused, index) => index);
  const rows = range.map((row) => range.map((col) => row * BOARD_SIZE + col));
  const columns = range.map((col) => range.map((row) => row * BOARD_SIZE + col));

  switch (direction) {
    case 'left':
      return rows;
    case 'right':
      return rows.map((line) => [...line].reverse());
    case 'up':
      return columns;
    case 'down':
      return columns.map((line) => [...line].reverse());
  }
}

function boardsDiffer(a: Board, b: readonly Cell[]): boolean {
  return a.some((cell, index) => cell !== b[index]);
}

/** Slides and merges every line toward the leading edge of `direction` (D2, D3, D6). */
export function applyMove(board: Board, direction: Direction): MoveResult {
  const result: Cell[] = [...board];
  let scoreGained = 0;

  for (const indexes of lineIndexes(direction)) {
    const line = indexes.map((index) => board[index] ?? null);
    const collapsed = collapseLine(line);
    scoreGained += collapsed.gained;
    indexes.forEach((index, position) => {
      result[index] = collapsed.cells[position] ?? null;
    });
  }

  return { board: result, scoreGained, changed: boardsDiffer(board, result) };
}
