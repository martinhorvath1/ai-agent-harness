export const BOARD_SIZE = 4;

/** A cell: a tile value (a power of two) or null for an empty cell. */
export type Cell = number | null;

/** The board: 16 cells, row-major, index = row * BOARD_SIZE + column. */
export type Board = readonly Cell[];
