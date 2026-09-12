# Plan: 2048 baseline

## Summary
This feature replaces the `hello` demo with the skeleton of a 2048 game: a 4x4 **board** model,
a pure seeded **random source**, **frame** rendering, key-to-**direction** mapping and an
interactive loop, with `applyMove` left as an empty **move seam**. The core gains a `model/`
layer for the board, direction and random-source types, a `rules/` layer for `newGame`, the
grid/frame text, the seam and seed handling, and a `game/session.ts` that sequences
"draw frame -> take a direction -> draw frame". `src/core/game/registry.ts` stops dispatching
`hello` and starts dispatching `play`, returning either text (usage, errors) or a live session.
The shell keeps its one job: read `PIPELINE_SEED` and `process.stdin`, pick `Math.random` or the
core's seeded generator, pump keys into the session, and write frames — clearing the screen only
on a real TTY.

## Affected modules and files
- **`src/core/model/`** — three new type-only files (`board.ts`, `direction.ts`,
  `random-source.ts`); `command-result.ts` loses the now-unimplemented `Command` type.
- **`src/core/rules/`** — new `new-game.ts`, `move.ts` (the seam), `grid.ts`, `frame.ts`,
  `seed.ts`. `hello.ts` is **deleted** by the implementer (D3).
- **`src/core/game/`** — new `session.ts`; `registry.ts` changed to register `play` and drop
  `hello` from the usage text.
- **`src/core/index.ts`** — re-exports the new public surface.
- **`src/cli/`** — `keys.ts` gains direction mapping and an end-of-input-aware key reader;
  new `screen.ts` (TTY-aware frame drawing) and `play.ts` (the loop); `main.ts` wires them
  together and supplies the random source. `render.ts` is unchanged.
- **Deletions** (not table rows, because `check-placement.py` ignores deleted paths and would
  warn on a row that "was never touched"):
  - implementer deletes `src/core/rules/hello.ts` and `tests/unit/hello.test.ts` (D3)
  - qa deletes `tests/acceptance/hello.test.ts` after re-homing its unknown-command
    assertion into the new acceptance suite (D3, D4)

## Module map

| Path | Status | Responsibility | Key exports |
|---|---|---|---|
| `src/core/model/board.ts` | new | The 4x4 board and its cells as data | `Board`, `Cell`, `BOARD_SIZE` |
| `src/core/model/direction.ts` | new | The four directions a move can take | `Direction` |
| `src/core/model/random-source.ts` | new | The injected randomness type the core accepts | `RandomSource` |
| `src/core/model/command-result.ts` | changed | What a command prints and exits with | `CommandResult` |
| `src/core/rules/seed.ts` | new | Validates a seed string and builds a deterministic random source from it | `parseSeed`, `seededRandom`, `SeedResult` |
| `src/core/rules/new-game.ts` | new | Builds the opening board with two tiles on random empty cells | `newGame` |
| `src/core/rules/move.ts` | new | The move seam: returns the board unchanged for now | `applyMove` |
| `src/core/rules/grid.ts` | new | Draws the board as a box-drawing grid of 6-wide cells | `renderGrid` |
| `src/core/rules/frame.ts` | new | Assembles one frame: title, grid, hint | `renderFrame` |
| `src/core/game/session.ts` | new | Holds the current board and produces the next one from a direction | `Session`, `newSession` |
| `src/core/game/registry.ts` | changed | Dispatches argv to text output or a play session | `run`, `commands`, `Dispatch` |
| `src/core/index.ts` | changed | The public API of the core | `run`, `commands`, `newSession`, `newGame`, `applyMove`, `renderFrame`, `parseSeed`, `seededRandom` |
| `src/cli/keys.ts` | changed | Normalises key presses, classifies quit and direction keys, reads keys until input ends | `KeyPress`, `KeyReader`, `toKeyPress`, `isQuit`, `toDirection`, `createKeyReader` |
| `src/cli/screen.ts` | new | Writes a frame to the output stream, clearing the screen first only on a TTY | `createScreen`, `Screen` |
| `src/cli/play.ts` | new | The interactive loop: draw a frame, take a key, repeat until quit or end of input | `playLoop` |
| `src/cli/main.ts` | changed | Entry point: seed from the environment, dispatch, write output, set the exit code | (none) |

Every path above matches a path pattern already present in `.dependency-cruiser.cjs`
(`^src/core/model/`, `^src/core/rules/`, `^src/core/(rules|game)/`, `^src/core/index\.ts$`,
`^src/cli/`), so **no new dependency-cruiser rules are required** for this feature.

## New or changed interfaces

### Core model
```ts
// src/core/model/board.ts
export const BOARD_SIZE = 4;
/** A cell: a tile value (a power of two) or null for an empty cell. */
export type Cell = number | null;
/** The board: 16 cells, row-major, index = row * BOARD_SIZE + column. */
export type Board = readonly Cell[];

// src/core/model/direction.ts
export type Direction = 'up' | 'down' | 'left' | 'right';

// src/core/model/random-source.ts
/** The core's only randomness. Always injected, never defaulted inside the core (D7). */
export type RandomSource = () => number; // 0 <= n < 1

// src/core/model/command-result.ts  (changed: `Command` removed, no implementations remain)
export interface CommandResult { readonly output: string; readonly exitCode: number }
```

### Core rules
```ts
// src/core/rules/seed.ts
export type SeedResult =
  | { readonly ok: true;  readonly seed: number | undefined }  // undefined = PIPELINE_SEED unset
  | { readonly ok: false; readonly message: string };
/** `undefined` -> ok with no seed; a non-negative integer string -> ok with that seed; anything
 *  else (including "", "-1", "1.5", "abc") -> not ok (D10). */
export function parseSeed(raw: string | undefined): SeedResult;
/** A pure integer PRNG (xorshift/LCG, implementer's choice per A1). */
export function seededRandom(seed: number): RandomSource;

// src/core/rules/new-game.ts
/** Two opening tiles on random empty cells; each is 2 with p=0.9 and 4 with p=0.1 (D5, D6). */
export function newGame(random: RandomSource): Board;

// src/core/rules/move.ts
/** The move seam. This feature returns the board unchanged (D19). */
export function applyMove(board: Board, direction: Direction): Board;

// src/core/rules/grid.ts
export function renderGrid(board: Board): string;

// src/core/rules/frame.ts
export function renderFrame(board: Board): string;
```

Exact rendering contract (D13, D14). Cell width 6, total grid width 29:
```
2048
<blank>
┌──────┬──────┬──────┬──────┐
│      │      │   2  │      │
├──────┼──────┼──────┼──────┤
│      │      │      │      │
├──────┼──────┼──────┼──────┤
│   4  │      │      │      │
├──────┼──────┼──────┼──────┤
│      │      │      │      │
└──────┴──────┴──────┴──────┘
<blank>
Arrows/WASD to move - q to quit
```
- An empty cell is six spaces.
- A tile is its plain decimal value (A3) centred in six columns; when the padding is odd the
  extra space goes on the right (`2` -> `"  2   "`, `128` -> `" 128  "`). Width 6 holds 131072.
- No trailing whitespace is trimmed; the frame has no trailing newline (the shell adds one).

### Core orchestration
```ts
// src/core/game/session.ts
export interface Session {
  /** The frame text for the current board. */
  readonly frame: string;
  /** The session after a direction key: runs the move seam and re-renders. */
  press(direction: Direction): Session;
}
export function newSession(random: RandomSource): Session;

// src/core/game/registry.ts
export type Dispatch =
  | { readonly kind: 'text';    readonly result: CommandResult }
  | { readonly kind: 'session'; readonly session: Session };
/** name -> one-line summary; the usage text is built from this map (A5). */
export const commands: ReadonlyMap<string, string>;  // { 'play' => 'play 2048' }
export function run(argv: readonly string[], random: RandomSource): Dispatch;
```
`run` behaviour:
- no argv -> `{ kind: 'text', result: { output: usage, exitCode: 1 } }`
- `--help` / `-h` -> usage, exit 0
- `play` with no further args -> `{ kind: 'session', session: newSession(random) }` (D2)
- `play <anything>` -> `usage: play`, exit 1 (D11)
- any other name -> `unknown command: <name>\n\n<usage>`, exit 1 (D4)

### Shell
```ts
// src/cli/keys.ts  (changed)
export interface KeyReader {
  /** The next key press, or undefined when input has ended (D16). */
  next(): Promise<KeyPress | undefined>;
  close(): void;
}
/** Attaches once and queues key presses, so a burst arriving in one chunk is never lost. */
export function createKeyReader(input?: NodeJS.ReadableStream): KeyReader;
/** Arrow keys and W/A/S/D, case-insensitive; undefined for any other key (D18). */
export function toDirection(key: KeyPress): Direction | undefined;
```
`toKeyPress` and `isQuit` keep their current signatures. `readKey` is **replaced** by
`createKeyReader` (see Risks).

```ts
// src/cli/screen.ts
export interface Screen { draw(frame: string): void }
/** Clears the screen before each frame only when `isTty` is true; otherwise appends (D15). */
export function createScreen(out: NodeJS.WritableStream, isTty: boolean): Screen;

// src/cli/play.ts
/** Draws, reads, repeats; resolves 0 on a quit key or end of input (D16, D17). */
export function playLoop(session: Session, screen: Screen, keys: KeyReader): Promise<number>;
```
Loop body: draw `session.frame`; `const key = await keys.next()`; `undefined` or `isQuit(key)`
ends the loop with 0; a `toDirection(key)` hit replaces the session with `session.press(d)`;
any other key leaves the session alone. Either way the loop redraws.

`src/cli/main.ts`:
1. `parseSeed(process.env.PIPELINE_SEED)`; on failure write the message to stderr, exit code 1 (D10).
2. random source = `seed === undefined ? Math.random : seededRandom(seed)` (D8, D9).
3. `run(process.argv.slice(2), random)`.
4. `kind === 'text'` -> write `render(result)` to stdout/stderr as today, set `result.exitCode`.
5. `kind === 'session'` -> `playLoop(session, createScreen(process.stdout, process.stdin.isTTY === true), createKeyReader(process.stdin))`, then exit 0.

No environment/CLI surface beyond `pipeline play`, `pipeline --help` and `PIPELINE_SEED`.

## Data changes and migrations
None. No persistence, no schema, no new dependency (A6).

## Sequencing
1. `src/core/model/` — `board.ts`, `direction.ts`, `random-source.ts`; trim `command-result.ts`.
2. `src/core/rules/seed.ts` (`parseSeed`, `seededRandom`) with unit tests; it unblocks
   deterministic tests for everything below.
3. `src/core/rules/new-game.ts`, driven by a stub random source in unit tests.
4. `src/core/rules/grid.ts` then `frame.ts` (frame imports grid).
5. `src/core/rules/move.ts` — the seam.
6. `src/core/game/session.ts`, then `registry.ts` (register `play`, rebuild the usage text,
   drop `hello`), then `src/core/index.ts`.
7. Delete `src/core/rules/hello.ts` and `tests/unit/hello.test.ts`. Typecheck must be green here.
8. `src/cli/keys.ts` (`createKeyReader`, `toDirection`; retire `readKey` and update
   `tests/unit/keys.test.ts`), then `screen.ts`, then `play.ts`, each with unit tests using
   `PassThrough`/fake streams.
9. `src/cli/main.ts` wiring last; run both gate tiers.

## Risks and how to mitigate them
- **Key loss on piped input.** `printf 'aq' | pipeline play` delivers both bytes in one chunk.
  A reader that attaches a `keypress` listener only when the loop asks for a key would drop the
  `q`. Mitigation: `createKeyReader` attaches once and queues presses; `next()` drains the queue
  before waiting. This is the reason `readKey` is replaced rather than extended.
- **`readKey` removal.** `tests/unit/keys.test.ts` currently covers it; it is implementer-owned,
  so the implementer updates it in step 8. No acceptance or hardening test imports `keys.ts`
  (the black-box rule forbids it), so nothing locked breaks.
- **`Command` type removal from the public API.** With `hello` gone nothing implements
  `(args) => CommandResult`; leaving the type exported would be dead surface. Nothing outside
  `registry.ts` imports it today. Called out here so the deletion is not a silent deviation.
- **Acceptance tests need to control stdin.** `execFile` has no `input` option; the existing
  helper cannot drive the loop. QA should `spawn` the CLI, write the key bytes, then `end()`
  stdin, and keep the per-test timeout. A test that never closes stdin would hang until the
  suite timeout.
- **A lone Escape byte over a pipe** can be held by readline while it waits for the rest of an
  escape sequence. Escape as a **quit key** stays covered by the existing `isQuit` unit tests;
  acceptance scenarios use `q` and Ctrl-C, which are unambiguous.
- **Unseeded randomness is not assertable per-run** (D8). Asserting "two runs differ" is flaky
  (~1 in 140). Mitigation: the scenario runs the opening board five times and requires that not
  all five are identical.
- **PRNG mutants may survive.** A1 contracts reproducibility only, so mutating a shift constant
  keeps every "same seed -> same board" test green. Mitigation: the hardener pins a golden
  frame for one seed, which fixes the algorithm after the implementer has chosen it. Flagged so
  the choice is deliberate rather than discovered at the mutation gate.
- **Complexity cap (8).** `renderGrid` (borders, rows, padding) and `playLoop` (quit / direction
  / ignored / end-of-input) are the two candidates. Both are already split: padding lives in a
  helper inside `grid.ts`, and key classification lives in `keys.ts`, not in the loop.
- **`src/cli/play.ts` and `screen.ts` are inside coverage** (only `main.ts` is excluded), so both
  take injected streams and an `isTty` boolean; no unit test touches a real TTY.
- **No new dependency-cruiser rules are needed.** Every new path falls under an existing pattern
  (`^src/core/model/`, `^src/core/rules/`, `^src/core/(rules|game)/`, `^src/cli/`). If review
  later moves the loop outside `src/cli/`, that would need a new rule and must come back here
  first.

## Out of scope
- Move, merge and slide logic — `applyMove` returns the board unchanged
- Scoring, win detection (the 2048 tile), loss detection (no legal moves remain)
- Spawning a tile after a move; only the two opening tiles are in scope
- Undo, persistence, saved games, high scores
- Board sizes other than 4x4
- Colour, animation, in-place cell updates, terminal-resize handling, mouse input
- Multiplayer
- Authentication, permissions and any network or filesystem access
