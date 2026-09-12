import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  applyMove,
  newGame,
  newSession,
  renderFrame,
  seededRandom,
  type Board,
  type Cell,
  type Direction,
  type RandomSource,
} from '../../../src/core/index.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tsx = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
const cli = fileURLToPath(new URL('../../../src/cli/main.ts', import.meta.url));

// ---------------------------------------------------------------------------
// Spawning the real CLI (adapted from the retired baseline suite's support.ts)
// ---------------------------------------------------------------------------

export interface CliRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export const KEY_BYTES: Readonly<Record<string, string>> = {
  q: 'q',
  'Ctrl-C': String.fromCharCode(3),
  w: 'w',
  a: 'a',
  s: 's',
  d: 'd',
  x: 'x',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEnv(overrides: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = value;
    }
  }
  return childEnv;
}

async function pressKeys(
  child: ChildProcessWithoutNullStreams,
  keys: readonly string[],
  keyDelayMs: number,
): Promise<void> {
  for (const key of keys) {
    child.stdin.write(key);
    if (keyDelayMs > 0) {
      await delay(keyDelayMs);
    }
  }
}

function collectRun(child: ChildProcessWithoutNullStreams): Promise<CliRun> {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  return new Promise<CliRun>((resolve) => {
    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
  });
}

export async function runPlay(options: {
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly keys?: readonly string[];
  readonly closeStdin?: boolean;
  readonly keyDelayMs?: number;
} = {}): Promise<CliRun> {
  const { args = ['play'], env = {}, keys = [], closeStdin = true, keyDelayMs = 20 } = options;

  const child = spawn(tsx, [cli, ...args], { cwd: repoRoot, env: buildEnv(env) });
  const run = collectRun(child);

  await pressKeys(child, keys, keyDelayMs);
  if (closeStdin) {
    child.stdin.end();
  }

  return run;
}

/**
 * Plays a poor, repeating direction pattern against a run of candidate seeds until one of
 * them locks the board up (D9): the game genuinely ends without any crafted board. Used to
 * exercise the loop's real stop-the-run mechanics (exit code, no waiting for more keys)
 * without pinning down exactly which seed produces that outcome.
 */
export async function runUntilGameOver(options: {
  readonly seeds?: readonly number[];
  readonly pattern?: readonly string[];
  readonly maxKeys?: number;
} = {}): Promise<{ readonly exitCode: number; readonly lines: readonly string[]; readonly keysSent: number }> {
  const {
    seeds = Array.from({ length: 30 }, (_, index) => index),
    pattern = [KEY_BYTES.w, KEY_BYTES.a],
    maxKeys = 250,
  } = options;

  for (const seed of seeds) {
    const keys = Array.from({ length: maxKeys }, (_, index) => pattern[index % pattern.length]);
    // Close stdin once the pattern is sent (rather than leaving it open) so a seed that does
    // not reach game over within `maxKeys` ends via "end of input" (D15) instead of hanging
    // forever waiting for a key that never comes -- the search then moves on to the next seed.
    // A seed that DOES reach game over will already have exited on its own by then (the very
    // thing this helper is proving), so closing stdin afterwards has no effect on that result.
    const result = await runPlay({ env: { PIPELINE_SEED: String(seed) }, keys, closeStdin: true, keyDelayMs: 0 });
    const lines = splitLines(result.stdout);
    // the hint is always the frame's last line (D7); the status line, when one applies, is
    // the line directly above it
    if (lines[lines.length - 2] === 'Game over') {
      return { exitCode: result.exitCode, lines, keysSent: keys.length };
    }
  }
  throw new Error('no seed under the search bound reached "Game over" with this move pattern');
}

export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/** Split stdout into frames: each frame begins at a line that is exactly the title `2048`. */
export function extractFrames(stdout: string): string[][] {
  const lines = splitLines(stdout);
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (line === '2048') {
      starts.push(index);
    }
  });
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    return lines.slice(start, end);
  });
}

export const HINT_LINE = 'Arrows/WASD to move - q to quit';

/** The grid content rows found anywhere in a frame's lines: rows carrying cell separators. */
export function parseGridRows(frame: readonly string[]): string[][] {
  const contentLines = frame.filter((line) => line.includes('│'));
  return contentLines.map((line) => {
    const parts = line.split('│');
    if (parts[0] === '') {
      parts.shift();
    }
    if (parts.length > 0 && parts[parts.length - 1] === '') {
      parts.pop();
    }
    return parts;
  });
}

/** Cells of a frame's grid, trimmed; empty string for an empty cell. */
export function gridCells(frame: readonly string[]): string[] {
  return parseGridRows(frame).flat().map((cell) => cell.trim());
}

// ---------------------------------------------------------------------------
// Driving the pure core directly (board construction, moves, frames)
// ---------------------------------------------------------------------------

const EMPTY_WORD = 'empty';

/** Parses the feature file's line notation, e.g. `2 2 4 4` or `4 8 empty empty`. */
export function parseLine(text: string): Cell[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => (token === EMPTY_WORD ? null : Number(token)));
}

/** A 4x4 board whose top row is `row` and whose other 12 cells are empty. */
export function boardWithTopRow(row: readonly Cell[]): Board {
  return [...row, ...new Array<Cell>(12).fill(null)];
}

/** A 4x4 board whose left column is `column` and whose other 12 cells are empty. */
export function boardWithLeftColumn(column: readonly Cell[]): Board {
  const cells = new Array<Cell>(16).fill(null);
  column.forEach((value, row) => { cells[row * 4] = value; });
  return cells;
}

export function topRowOf(board: Board): Cell[] {
  return board.slice(0, 4);
}

export function leftColumnOf(board: Board): Cell[] {
  return [board[0], board[4], board[8], board[12]];
}

export function cellsText(cells: readonly Cell[]): string {
  return cells.map((cell) => (cell === null ? EMPTY_WORD : String(cell))).join(' ');
}

/** The result of one `applyMove`, tolerant of either a bare board or `{ board, scoreGained }`
 *  shape -- this feature must add score reporting somewhere, and the exact carrier is an
 *  implementation choice this suite does not pin down beyond "reachable from `applyMove`". */
export interface MoveOutcome {
  readonly board: Board;
  readonly scoreGained: number | undefined;
}

export function moveOutcome(board: Board, direction: Direction): MoveOutcome {
  const raw = applyMove(board, direction) as unknown;
  if (Array.isArray(raw)) {
    return { board: raw as Board, scoreGained: undefined };
  }
  if (raw !== null && typeof raw === 'object' && 'board' in raw) {
    const obj = raw as { board: Board; scoreGained?: number; score?: number };
    return { board: obj.board, scoreGained: obj.scoreGained ?? obj.score };
  }
  throw new Error('applyMove returned a value this suite does not recognise as a board or a scored move');
}

export function movedBoard(board: Board, direction: Direction): Board {
  return moveOutcome(board, direction).board;
}

/** A `RandomSource` that yields a fixed sequence, then a constant for every later call. */
export function sequenceRandom(values: readonly number[], fallback = 0.5): RandomSource {
  let call = 0;
  return () => {
    const value = call < values.length ? values[call] : fallback;
    call += 1;
    return value;
  };
}

/**
 * The exact `random()` sequence `newGame` (unchanged by this feature -- see brief A3) consumes
 * to place tiles at each `{ index, value }` in turn: an index draw picking that cell among the
 * empty cells remaining, then a value draw landing on the 2-vs-4 side of the 0.1 threshold.
 */
export function openingSequenceFor(placements: readonly { index: number; value: 2 | 4 }[]): number[] {
  const sequence: number[] = [];
  let empties = Array.from({ length: 16 }, (_, i) => i);
  for (const { index, value } of placements) {
    const position = empties.indexOf(index);
    if (position === -1) {
      throw new Error(`cell ${index} is not empty when placing it`);
    }
    sequence.push((position + 0.5) / empties.length);
    sequence.push(value === 4 ? 0.05 : 0.5);
    empties = empties.filter((cell) => cell !== index);
  }
  return sequence;
}

/**
 * A `RandomSource` that opens a session on exactly `placements` (both cells filled, the rest
 * empty) and then, for every random draw after that, returns `afterOpening` -- so a single
 * post-opening move's spawn (index draw and value draw alike) is pinned to one value.
 */
export function randomForOpeningThenSpawn(
  placements: readonly { index: number; value: 2 | 4 }[],
  afterOpening: number,
): RandomSource {
  return sequenceRandom(openingSequenceFor(placements), afterOpening);
}

/** Finds the smallest seed (search bounded by `limit`) whose opening board satisfies `predicate`. */
export function findSeed(predicate: (board: Board) => boolean, limit = 5000): number {
  for (let seed = 0; seed < limit; seed += 1) {
    const board = newGame(seededRandom(seed));
    if (predicate(board)) {
      return seed;
    }
  }
  throw new Error(`no seed under ${limit} produced the requested opening board`);
}

export function boardEquals(a: Board, b: Board): boolean {
  return a.length === b.length && a.every((cell, index) => cell === b[index]);
}

export { applyMove, newGame, newSession, renderFrame, seededRandom };
export type { Board, Cell, Direction, RandomSource };
