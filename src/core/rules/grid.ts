import { BOARD_SIZE, type Board, type Cell } from '../model/board.js';

const CELL_WIDTH = 6;

function border(left: string, mid: string, right: string): string {
  const segment = '─'.repeat(CELL_WIDTH);
  return `${left}${new Array(BOARD_SIZE).fill(segment).join(mid)}${right}`;
}

/** Render one cell's text, centred within `CELL_WIDTH`; odd padding goes on the right. */
function renderCell(cell: Cell): string {
  if (cell === null) {
    return ' '.repeat(CELL_WIDTH);
  }
  const text = String(cell);
  const totalPadding = CELL_WIDTH - text.length;
  const left = Math.floor(totalPadding / 2);
  const right = totalPadding - left;
  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

function renderRow(cells: readonly Cell[]): string {
  return `│${cells.map(renderCell).join('│')}│`;
}

/** Draws the board as a box-drawing grid of 6-wide cells. */
export function renderGrid(board: Board): string {
  const rows: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const start = row * BOARD_SIZE;
    rows.push(renderRow(board.slice(start, start + BOARD_SIZE)));
  }
  const lines = [
    border('┌', '┬', '┐'),
    rows.join(`\n${border('├', '┼', '┤')}\n`),
    border('└', '┴', '┘'),
  ];
  return lines.join('\n');
}
