import { BOARD_SIZE, type Board } from '../model/board.js';

export const WINNING_TILE = 2048;

/** True once a tile of 2048 is on the board (D8). */
export function hasWinningTile(board: Board): boolean {
  return board.some((cell) => cell === WINNING_TILE);
}

function neighbourEquals(board: Board, index: number, neighbourIndex: number, inBounds: boolean): boolean {
  return inBounds && board[neighbourIndex] === board[index];
}

function hasAdjacentEqualAt(board: Board, row: number, col: number): boolean {
  const index = row * BOARD_SIZE + col;
  const right = neighbourEquals(board, index, index + 1, col + 1 < BOARD_SIZE);
  const down = neighbourEquals(board, index, index + BOARD_SIZE, row + 1 < BOARD_SIZE);
  return right || down;
}

function hasAdjacentEqualPair(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (hasAdjacentEqualAt(board, row, col)) {
        return true;
      }
    }
  }
  return false;
}

/** True while an empty cell or a pair of orthogonally adjacent equal tiles remains (D9). */
export function hasLegalMove(board: Board): boolean {
  return board.some((cell) => cell === null) || hasAdjacentEqualPair(board);
}
