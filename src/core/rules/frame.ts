import type { Board } from '../model/board.js';
import type { GameState } from '../model/game-state.js';
import { renderGrid } from './grid.js';
import { hasLegalMove, hasWinningTile } from './outcome.js';

const TITLE = '2048';
const HINT = 'Arrows/WASD to move - q to quit';

/**
 * `renderFrame` is driven from a `GameState` (score, sticky win, over) everywhere in the
 * session/turn flow. It also accepts a bare `Board` -- the state one frame is drawn from
 * when there is no running game to track score or stickiness against, deriving `won`/`over`
 * straight from that board's contents instead.
 */
function stateFromBoard(board: Board): GameState {
  return { board, score: 0, won: hasWinningTile(board), over: !hasLegalMove(board) };
}

function isBoard(input: Board | GameState): input is Board {
  return Array.isArray(input);
}

function toState(input: Board | GameState): GameState {
  return isBoard(input) ? stateFromBoard(input) : input;
}

function statusLine(state: GameState): string | undefined {
  if (state.over) {
    return 'Game over';
  }
  if (state.won) {
    return 'You win!';
  }
  return undefined;
}

/** Assembles one frame: title, score, blank, grid, blank, status line if one applies, hint (D7). */
export function renderFrame(input: Board | GameState): string {
  const state = toState(input);
  const status = statusLine(state);
  const lines = [
    TITLE,
    `Score: ${state.score}`,
    '',
    renderGrid(state.board),
    '',
    ...(status === undefined ? [] : [status]),
    HINT,
  ];
  return lines.join('\n');
}
