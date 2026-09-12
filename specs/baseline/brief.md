# Brief: 2048 baseline

## Goal
A player can run `pipeline play` and see a real 2048 opening board drawn in the terminal,
move the cursor keys or WASD, and quit — with every piece of the game's foundation in place
(board model, seeded randomness, rendering, key mapping, interactive loop) except the move
logic itself, which is left as a single named, empty seam for the next feature to fill.

## Decisions
- D1: This feature ships the **skeleton only** — model, opening board, frame rendering, key mapping and the interactive loop. It is deliberately not yet playable.
- D2: The command is `pipeline play`, registered in `src/core/game/registry.ts` and listed in the usage text.
- D3: The `hello` command is **removed**. The **implementer** deletes `src/core/rules/hello.ts` and `tests/unit/hello.test.ts`; the **qa** agent deletes `tests/acceptance/hello.test.ts`, because `tests/acceptance/` is qa-owned and `scripts/guard.sh` enforces that.
- D4: `tests/acceptance/hello.test.ts` holds the only coverage of the generic "unknown command" behaviour. That assertion is re-homed into the new acceptance tests (example: `pipeline nope` -> stderr contains `unknown command: nope`, exit code 1).
- D5: The board is a fixed **4x4** grid. A cell is either empty or holds a tile whose value is a power of two.
- D6: `newGame` places **two opening tiles** on random empty cells. Each is a `2` with probability 0.9 and a `4` with probability 0.1.
- D7: Randomness enters the core only through an injected **random source**, typed `() => number` returning `0 <= n < 1`. It is a **required parameter** — never defaulted inside the core — so no core function can reach randomness on its own.
- D8: `src/cli/main.ts` supplies the random source. With no seed it passes `Math.random`. (example: `PIPELINE_SEED` unset -> a different opening board each run)
- D9: When the environment variable `PIPELINE_SEED` is set to a non-negative integer, `main.ts` injects a deterministic pure PRNG from the core instead of `Math.random`, making the opening board reproducible (example: `PIPELINE_SEED=1 pipeline play` twice -> byte-identical opening board).
- D10: `PIPELINE_SEED` set to anything that is not a non-negative integer **no greater than 4294967295 (2^32-1)** is an error, not a fallback (example: `PIPELINE_SEED=abc pipeline play` -> error on stderr, exit code 1; `PIPELINE_SEED=4294967296` -> the same). The upper bound is part of the contract because the seeded generator reduces its seed modulo 2^32: without it, `0` and `4294967296` would silently produce identical boards, which is the same class of surprise this decision exists to prevent. *Amended during /build after review round 3, finding 3; the original wording said only "non-negative integer".*
- D11: `play` takes no arguments. Any argument is rejected (example: `pipeline play extra` -> `usage: play` on stderr, exit code 1).
- D12: Board-to-text rendering lives in **core**, because `Command` returns `CommandResult.output` and `src/cli/render.ts` is fixed at the pure `render(result): string` signature. The shell never formats a board.
- D13: The board renders as a **box-drawing grid** with fixed 6-character-wide cells, values centred or right-aligned consistently, and empty cells drawn blank. Width 6 fits every tile value up to 131072.
- D14: A **frame** is: the title line `2048`, a blank line, the grid, a blank line, then the hint line `Arrows/WASD to move - q to quit`. The frame text is produced by the core.
- D15: On a real TTY the shell clears the screen between frames; when stdin is not a TTY it simply appends each frame. The clear lives in `src/cli/` and no ANSI escape appears in piped output (example: `echo q | pipeline play` -> plain text only, no escape codes).
- D16: The **interactive loop** always runs, on a TTY or a pipe. It draws a frame, waits for a key, and repeats. `keys.ts` gains end-of-input handling so a closed stdin ends the loop.
- D17: The loop ends on a **quit key** (`q`, Escape or Ctrl-C, via the existing `isQuit`) or on end of input, and exits 0 in both cases (example: `printf 'q' | pipeline play` -> one frame printed, exit code 0).
- D18: Direction keys are the four **arrow keys and W/A/S/D** (case-insensitive), mapped to the four directions. Any other key is ignored and the frame is simply redrawn.
- D19: A direction key calls the **move seam** `applyMove(board, direction)`, which in this feature returns the board unchanged. It is the single, named hole the next feature fills (example: `printf 'aq' | pipeline play` -> two identical frames, exit code 0).
- D20: `src/cli/keys.ts` is wired into `main.ts` by this feature, resolving the `no-orphans` dependency-cruiser risk it currently carries as an unimported file.

## Assumptions
- A1: The PRNG for D10 is a small pure integer generator (xorshift or LCG) written in the core with no dependencies; the exact algorithm is the implementer's choice, since only reproducibility is contracted, not any specific sequence. The implementer chose **mulberry32**.
  - **Accepted risk, decided by the human during /build (2026-09-12), after review rounds 2 and 3 raised it.** Mutation testing leaves the two mulberry32 constants uncovered (`src/core/rules/seed.ts:31,34`). The only test that would kill those mutants is a golden-sequence assertion, which would pin the exact algorithm and so contradict this assumption. The plan's "Risks" section had proposed exactly that pin; it was considered and declined in favour of A1.
  - Known consequence: **nothing anywhere pins the PRNG constants**, so an accidental edit to them changes every seeded board while the full quality gate stays green. Reproducibility within a single build is still covered by the D7/D9 acceptance scenarios (same seed -> byte-identical output).
  - This line is the verifiable record of that decision, per review round 3, finding 4.
- A2: The exact hint text in D15 is `Arrows/WASD to move - q to quit`; wording may be adjusted at review without changing behaviour.
- A3: Tile values are rendered as plain decimal numbers with no thousands separators.
- A4: Quitting prints no farewell message; the last frame is the final output.
- A5: The usage text in `registry.ts` is updated to list `play` and no longer list `hello`.
- A6: No new npm dependency is added; nothing here needs one.

## Out of scope
- Move, merge and slide logic — `applyMove` returns the board unchanged
- Scoring, win detection (the 2048 tile), loss detection (no legal moves remain)
- Spawning a tile after a move; only the two opening tiles are in scope
- Undo, persistence, saved games, high scores
- Board sizes other than 4x4
- Colour, animation, in-place cell updates, terminal-resize handling, mouse input
- Multiplayer
- Authentication, permissions and any network or filesystem access

## Glossary
- **board**: the 4x4 grid holding the current position
- **cell**: one of the 16 positions on the board; either empty or holding a tile
- **tile**: a value on the board, always a power of two
- **empty cell**: a cell holding no tile; drawn blank
- **opening board**: the board produced by `newGame`, holding exactly two tiles
- **direction**: one of up, down, left, right
- **move seam**: `applyMove(board, direction)`, the named function this feature leaves empty
- **frame**: the full block of text drawn for one turn — title, grid and hint
- **random source**: the injected `() => number` in `0 <= n < 1` that is the core's only randomness
- **seed**: the `PIPELINE_SEED` environment variable that makes the opening board reproducible
- **quit key**: `q`, Escape or Ctrl-C

## Open questions
none
