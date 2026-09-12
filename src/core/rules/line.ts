import type { Cell } from '../model/board.js';

export interface LineResult {
  /** The line after sliding and merging, padded with empty cells to its original length. */
  readonly cells: readonly Cell[];
  /** The score this line's merges produced. */
  readonly gained: number;
}

/** Slides tiles toward index 0 and merges each tile at most once, resolved from index 0 (D2). */
export function collapseLine(line: readonly Cell[]): LineResult {
  const values = line.filter((cell): cell is number => cell !== null);
  const cells: Cell[] = [];
  let gained = 0;

  let index = 0;
  while (index < values.length) {
    const current = values[index];
    if (current === undefined) {
      break;
    }
    const next = values[index + 1];
    if (next !== undefined && current === next) {
      const merged = current * 2;
      cells.push(merged);
      gained += merged;
      index += 2;
    } else {
      cells.push(current);
      index += 1;
    }
  }

  while (cells.length < line.length) {
    cells.push(null);
  }

  return { cells, gained };
}
