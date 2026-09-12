# Plan: 2048 playable game

## Summary
This feature fills the empty **move** seam and closes the game loop. `applyMove` gains classic
2048 slide-and-merge semantics and starts reporting what the move produced (`{ board, gained,
changed }`), a new `spawn` rule places one tile after a move that changed the board, and a new
`outcome` rule answers "is there a 2048 tile" and "does any legal move remain". A new
`GameState` (board, score, won, over) becomes the thing a **frame** is drawn from, so the frame
can carry a `Score:` line and the optional **status line**. `src/core/game/turn.ts` sequences
one turn — move, spawn if changed, then win and loss on the board the player will see — and
`Session` carries that state and exposes `over` so the shell's loop draws the final frame and
exits 0 without waiting for another key.

## Affected modules and files
- **`src/core/model/`** — new `game-state.ts`: the state one frame is drawn from. No other
  model file changes; the board stays 4x4 (D16).
- **`src/core/rules/`** — new `line.ts` (collapse one line), `spawn.ts` (place one tile),
  `outcome.ts` (win tile / legal move left); `move.ts` gains real behaviour and a result type;
  `new-game.ts` is refactored to spawn its two opening tiles through `spawn.ts`;
  `frame.ts` renders from a `GameState`. `grid.ts` and `seed.ts` are untouched.
- **`src/core/game/`** — new `turn.ts` (one turn end to end); `session.ts` carries the state and
  exposes `over`. `registry.ts` is untouched (no new command, D16).
- **`src/core/index.ts`** — re-exports the new types and the session seam.
- **`src/cli/`** — `play.ts` stops the loop when the session reports the game over.
  `main.ts`, `keys.ts`, `screen.ts` and `render.ts` are unchanged.
- **Deletions** (not table rows; `check-placement.py` only inspects `src/` and would warn on a
  row that "was never touched"):
  - qa deletes `tests/acceptance/baseline/` while writing `tests/acceptance/mvp-game/` (D13).
  - a human runs `rm specs/baseline/acceptance.sha256` **before `/build`** (D14). No agent
    deletes anything under `specs/`.

## Module map

| Path | Status | Responsibility | Key exports |
|---|---|---|---|
| `src/core/model/game-state.ts` | new | The state one frame is drawn from: board, score, won, over | `GameState` |
| `src/core/rules/line.ts` | new | Collapses one line of cells toward the leading edge, merging each tile at most once | `collapseLine`, `LineResult` |
| `src/core/rules/move.ts` | changed | Applies a direction to the whole board and reports the score gained and whether anything changed | `applyMove`, `MoveResult` |
| `src/core/rules/spawn.ts` | new | Places one new tile on a uniformly chosen empty cell: 2 with p=0.9, 4 with p=0.1 | `spawnTile` |
| `src/core/rules/new-game.ts` | changed | Builds the opening board by spawning two tiles | `newGame` |
| `src/core/rules/outcome.ts` | new | Answers whether the board holds a 2048 tile and whether any legal move remains | `hasWinningTile`, `hasLegalMove`, `WINNING_TILE` |
| `src/core/rules/frame.ts` | changed | Assembles one frame: title, score, grid, optional status line, hint | `renderFrame` |
| `src/core/game/turn.ts` | new | Sequences one turn: move, spawn when the board changed, then win and loss | `startGame`, `nextState` |
| `src/core/game/session.ts` | changed | Holds the game state, renders its frame, and produces the next session from a direction | `Session`, `newSession`, `sessionFrom` |
| `src/core/index.ts` | changed | The public API of the core | `newSession`, `sessionFrom`, `Session`, `GameState`, `MoveResult`, `applyMove`, `renderFrame`, `newGame`, `run`, `commands`, `parseSeed`, `seededRandom` |
| `src/cli/play.ts` | changed | The interactive loop: draw a frame, stop if the game is over, otherwise take a key and repeat | `playLoop` |

Every path above sits under a pattern `.dependency-cruiser.cjs` already constrains
(`^src/core/model/`, `^src/core/rules/`, `^src/core/(rules|game)/`, `^src/core/`,
`^src/core/index\.ts$`, `^src/cli/`), so **no new dependency-cruiser rules are required**.

## New or changed interfaces

### Model
```ts
// src/core/model/game-state.ts  (new)
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
```

### Rules
```ts
// src/core/rules/line.ts  (new)
export interface LineResult {
  /** The line after sliding and merging, padded with empty cells to its original length. */
  readonly cells: readonly Cell[];
  /** The score this line's merges produced. */
  readonly gained: number;
}
/** Slides tiles toward index 0 and merges each tile at most once, resolved from index 0 (D2). */
export function collapseLine(line: readonly Cell[]): LineResult;
```
`collapseLine` is the whole of D2's semantics in one place: drop the empty cells, then walk the
remaining values from the front; when two neighbours are equal emit one tile of twice the value,
add it to `gained`, and skip both; otherwise emit the tile and advance one. Pad back to length
with empty cells.

| input | output | gained |
|---|---|---|
| `[2, 2, 4, 4]` | `[4, 8, empty, empty]` | 12 |
| `[2, 2, 4, empty]` | `[4, 4, empty, empty]` | 8 |
| `[4, 4, 4, empty]` | `[8, 4, empty, empty]` | 8 |
| `[2, 4, empty, empty]` | `[2, 4, empty, empty]` | 0 |

```ts
// src/core/rules/move.ts  (changed)
export interface MoveResult {
  readonly board: Board;
  /** The score the merges in this move produced (D6). */
  readonly gained: number;
  /** False when the board is identical to the one passed in: a no-op move (D3). */
  readonly changed: boolean;
}
/** Slides and merges every line toward the leading edge of `direction` (D2, D3, D6). */
export function applyMove(board: Board, direction: Direction): MoveResult;
```
`applyMove` builds the four lines of cell indexes for the direction — rows for `left`/`right`,
columns for `up`/`down`, reversed for `right`/`down` so index 0 of each line is always at the
**leading edge** — runs `collapseLine` over each, writes the cells back at those indexes, and
sums `gained`. `changed` is an element-wise comparison against the input board.

```ts
// src/core/rules/spawn.ts  (new)
/** One new tile on a uniformly chosen empty cell: 2 with p=0.9, 4 with p=0.1 (D4).
 *  Draws exactly twice from `random`: first the cell, then the value.
 *  Throws when the board has no empty cell. */
export function spawnTile(board: Board, random: RandomSource): Board;

// src/core/rules/new-game.ts  (changed)
/** Two opening tiles, each spawned on a random empty cell (baseline D5, D6). */
export function newGame(random: RandomSource): Board;
```
`newGame` becomes `spawnTile(spawnTile(empty, random), random)`. **The draw order must stay
exactly as it is today — cell index first, tile value second, two draws per tile** — or seeded
opening boards change and the locked `tests/hardening/baseline/new-game.hardening.test.ts`
breaks. The `no empty cells to place a tile on` guard moves verbatim into `spawnTile`.

```ts
// src/core/rules/outcome.ts  (new)
export const WINNING_TILE = 2048;
/** True once a tile of 2048 is on the board (D8). */
export function hasWinningTile(board: Board): boolean;
/** True while an empty cell or a pair of orthogonally adjacent equal tiles remains (D9). */
export function hasLegalMove(board: Board): boolean;
```

```ts
// src/core/rules/frame.ts  (changed)
/** Assembles one frame: title, score, blank, grid, blank, status line if one applies, hint (D7). */
export function renderFrame(state: GameState): string;
```
The exact frame (D7, D8, D9, D10). No trailing newline; the shell adds one. Grid rendering,
cell width and the hint are unchanged from the baseline (A5, D16):
```
2048
Score: 12
<blank>
┌──────┬──────┬──────┬──────┐
│   4  │   8  │      │      │
├──────┼──────┼──────┼──────┤
...
└──────┴──────┴──────┴──────┘
<blank>
Arrows/WASD to move - q to quit
```
With a status line the two blanks stay where they are and one line is inserted before the hint:
```
└──────┴──────┴──────┴──────┘
<blank>
You win!
Arrows/WASD to move - q to quit
```
The status line is chosen by a private helper, `over` first so `Game over` replaces `You win!`
on a won game's final frame (D10):
`over -> 'Game over'`, else `won -> 'You win!'`, else no status line at all.

### Orchestration
```ts
// src/core/game/turn.ts  (new)
/** The opening state: the opening board, score 0, not won, not over (D6). */
export function startGame(random: RandomSource): GameState;

/** One turn: move, spawn when the board changed, then win and loss (D3, D4, D8, D9, D11). */
export function nextState(state: GameState, direction: Direction, random: RandomSource): GameState;
```
```ts
const moved = applyMove(state.board, direction);
if (!moved.changed) return state;                    // D3: nothing spawns, nothing scores
const board = spawnTile(moved.board, random);        // D4, D5
return {
  board,
  score: state.score + moved.gained,                 // D6
  won: state.won || hasWinningTile(board),           // D8: sticky
  over: !hasLegalMove(board),                        // D11: after the spawn
};
```
`startGame` returns `won: false, over: false` as literals: two opening tiles can be neither, and
deriving them there would only produce an always-false branch no test can pin.

```ts
// src/core/game/session.ts  (changed)
export interface Session {
  /** The frame text for the current state. */
  readonly frame: string;
  /** True when no legal move remains: the shell draws this frame and stops (D9). */
  readonly over: boolean;
  /** The session after a direction key. */
  press(direction: Direction): Session;
}
/** A session over an arbitrary state; the seam acceptance tests use to set a position up. */
export function sessionFrom(state: GameState, random: RandomSource): Session;
/** A session over a fresh game. */
export function newSession(random: RandomSource): Session;
```
`newSession(random)` is `sessionFrom(startGame(random), random)`; `press` is
`sessionFrom(nextState(state, direction, random), random)`. `sessionFrom` is exported for the
same reason `buildUsage(entries = commands)` is: it is the only way to observe a won or lost
position without playing thousands of real moves. The **random source** is still never
defaulted anywhere in the core (D5).

```ts
// src/core/index.ts  (changed)
export type { GameState } from './model/game-state.js';
export { applyMove, type MoveResult } from './rules/move.js';
export { newSession, sessionFrom, type Session } from './game/session.js';
// everything else unchanged
```

### Shell
```ts
// src/cli/play.ts  (changed)
for (;;) {
  screen.draw(current.frame);
  if (current.over) { keys.close(); return 0; }   // D9: no further key is read
  const key = await keys.next();
  if (key === undefined || isQuit(key)) { keys.close(); return 0; }
  current = nextSession(current, key);            // D12: a non-direction key leaves it alone
}
```
No change to argv, the command surface or the environment: `pipeline play`, `pipeline --help`
and `PIPELINE_SEED` are the whole surface (D16).

## Data changes and migrations
None. No persistence, no schema, no new npm dependency, no new environment variable (D16).

## Sequencing
1. `src/core/model/game-state.ts`.
2. `src/core/rules/line.ts` with unit tests over the D2 table above — this is where the merge
   rule is actually decided, so pin it first.
3. `src/core/rules/move.ts`: `MoveResult`, the four index sets, `changed`. Rewrite
   `tests/unit/move.test.ts` (it currently asserts the empty seam).
4. `src/core/rules/spawn.ts`, then refactor `new-game.ts` onto it. Run
   `npm run test:hardening` here: the locked baseline hardening test is the guard on draw order.
5. `src/core/rules/outcome.ts` with unit tests, including a full board with no adjacent equals
   and a full board with one adjacent pair.
6. `src/core/rules/frame.ts` onto `GameState`; update `tests/unit/frame.test.ts`.
7. `src/core/game/turn.ts`, then `session.ts`, then `src/core/index.ts`. Typecheck must be green.
8. `src/cli/play.ts` and `tests/unit/play.test.ts` (a stub session that reports `over` must not
   be asked for a key).
9. Both gate tiers.

## Risks and how to mitigate them
- **The locked baseline hardening suite (A3).** `tests/hardening/baseline/new-game.hardening.test.ts`
  asserts, through `newGame`, that a random value near 1 selects a late empty cell. Extracting
  `spawnTile` keeps it green only if the draw order (cell, then value) and the count (two draws
  per tile) are preserved. Step 4 runs the hardening suite before anything else is built on top.
  `grid` and `registry` hardening tests cover files this feature does not touch. If any of the
  three fails, that is a finding to report, not a test to change.
- **D14 is a human step.** `scripts/quality-gate.sh` globs `specs/*/acceptance.sha256`, and
  `acceptance-lock.sh verify` fails once `tests/acceptance/baseline/` is gone. A human must run
  `rm specs/baseline/acceptance.sha256` before `/build`, or every gate run fails on a file no
  agent is allowed to delete.
- **`renderFrame`'s signature changes** from `(board)` to `(state)`. Every caller is in this
  plan (`session.ts`) plus `tests/unit/frame.test.ts` (implementer-owned) and the retired
  baseline acceptance suite. Nothing locked imports it.
- **The frame grows a line.** The baseline acceptance helper `parseGridRows` slices
  `frame.slice(2, length - 2)`, which assumes the grid starts on line 3. QA rewrites the helper
  in `tests/acceptance/mvp-game/support.ts`; `extractFrames` still works because the title line
  is unchanged.
- **A lost game cannot be reached through the real CLI inside a test budget.** Losing needs a
  full board, which is dozens of moves from a random opening. So the `over -> draw and exit 0`
  behaviour is proven in two halves: the public API half (`sessionFrom` over a nearly-full
  position reports `over` and renders `Game over`) is an acceptance scenario; the wiring half
  (`playLoop` never asks for a key after an over frame) is an implementer unit test in
  `tests/unit/play.test.ts`. Called out so the split is deliberate rather than discovered at
  review.
- **Mutation survivors to pre-empt.** Three spots mutate into silently-passing code unless a
  test pins both sides: the sticky `state.won ||` (needs a frame *after* the winning one),
  `!hasLegalMove(board)` on the post-spawn rather than the pre-spawn board (needs D11's
  fill-the-last-cell case), and `random() < 0.1` in `spawnTile` (needs a draw on each side of
  the boundary). The feature file has a scenario for each.
- **Complexity cap (8).** `applyMove` is the candidate: direction to index sets, collapse,
  write back, compare. It is split three ways — `collapseLine` in `line.ts`, a private
  `lineIndexes(direction)`, and a private board comparison — so no single function carries the
  whole move.
- **The `no empty cells` guard in `spawnTile` is unreachable from `nextState`** (a changed move
  always leaves an empty cell), so it will not be covered by playing. The implementer covers it
  with a direct unit test on a full board; otherwise it costs branch coverage and leaves a
  mutant alive.
- **No new dependency-cruiser rules are needed.** Every path in the module map falls under an
  existing pattern. If review moves the turn sequencing out of `src/core/game/`, that needs a
  new rule and must come back to this plan first.

## Out of scope
- Restart, undo, persistence, saved games, high scores
- Board sizes other than 4x4
- Colour, animation, in-place cell updates, terminal-resize handling, mouse input
- Any move-count, timer or statistics display
- A farewell message on quit; the last frame is still the final output
- Multiplayer, authentication, network and filesystem access
