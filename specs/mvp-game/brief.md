# Brief: 2048 playable game

## Goal
A player can run `pipeline play` and actually play 2048 to a finish: tiles slide and merge in
all four directions, a new tile appears after every move that changed the board, the score
rises, a win is announced at 2048, and the run ends when no legal move remains. This fills the
`applyMove` seam the baseline deliberately left empty and closes the game loop.

## Decisions
- D1: This feature delivers the **full playable loop**: slide and merge, spawn after a changed board, score, win announcement, and loss detection. The game is playable end to end.
- D2: `applyMove(board, direction)` gains real behaviour. Classic 2048 semantics: tiles slide to the leading edge in the pressed direction, and each tile merges **at most once per move**, resolved from the leading edge (example: row `[2, 2, 4, 4]` pressed LEFT -> `[4, 8, empty, empty]`, never `[8, empty, empty, empty]`; example: `[2, 2, 4, empty]` LEFT -> `[4, 4, empty, empty]`; example: `[4, 4, 4, empty]` LEFT -> `[8, 4, empty, empty]`).
- D3: A move that leaves the board identical is a **no-op move**: nothing spawns, the score does not change, and the frame is simply redrawn (example: `[2, 4, empty, empty]` pressed LEFT -> unchanged, no new tile).
- D4: A move that changed the board spawns **one new tile** on a uniformly chosen random empty cell. It is a `2` with probability 0.9 and a `4` with probability 0.1 — the same distribution as the opening tiles (baseline D6).
- D5: The spawn draws from the **same injected random source** the session already holds (baseline D7). Nothing in the core reaches randomness on its own, and the source is never defaulted. Consequence: with `PIPELINE_SEED` set, a given key sequence produces a byte-identical run every time (example: `PIPELINE_SEED=1` with keys `a a q` twice -> identical output).
- D6: The **score** starts at 0 and rises by the value of each tile a merge produces (example: two `4`s merge -> `+8`). The two opening tiles score nothing. A no-op move adds nothing.
- D7: The **frame** gains a score line and an optional status line. Layout, top to bottom: title `2048`, `Score: <n>`, blank, grid, blank, **status line if one applies**, hint. When neither win nor loss applies, the frame has no status line and reads title, score, blank, grid, blank, hint.
- D8: **Win**: the first time a tile of value 2048 appears, the status line reads `You win!`. The loop **keeps going** — the player may play on past 2048. Once won, the win status stays on every later frame.
- D9: **Loss**: when no legal move remains — no empty cell and no pair of orthogonally adjacent equal tiles — the status line reads `Game over`, that frame is drawn, and the loop **exits 0** without waiting for another key.
- D10: `Game over` **replaces** `You win!` on the final frame when a won game later ends.
- D11: Loss is checked **after** the spawn of D4, on the board the player will actually see. A move can therefore fill the last cell and end the game in the same frame.
- D12: A key that is neither a direction key nor a quit key is still ignored and the frame redrawn unchanged (unchanged from baseline D18).
- D13: The whole of `tests/acceptance/baseline/` is **retired** by this feature. Three of its assertions become false the moment moves work (`a direction key redraws the same board`, `the loop repeats for as long as keys arrive`, `the frame shows nothing that this feature does not yet implement`) and a fourth pins the frame's second line to blank, which D7 changes. The **qa** agent deletes the directory as part of writing `tests/acceptance/mvp-game/`, because `tests/acceptance/` is qa-owned.
- D14: `specs/baseline/acceptance.sha256` must also be removed, because `scripts/quality-gate.sh` globs `specs/*/acceptance.sha256` and `acceptance-lock.sh verify` fails when the directory it names is missing. Nothing under `specs/` may be deleted by an agent, so this is **one human step before `/build`**: `rm specs/baseline/acceptance.sha256`.
- D15: Every still-valid assertion from the retired suite is **re-homed** into `tests/acceptance/mvp-game/`. The full list: seeded reproducibility of a run; a `4` can appear as an opening tile; `PIPELINE_SEED` validation (example: `PIPELINE_SEED=abc` -> exit 1; `PIPELINE_SEED=4294967296` -> exit 1); `pipeline play extra` -> `usage: play` on stderr, exit 1; `pipeline nope` -> `unknown command: nope` on stderr, exit 1; end of input ends the loop with exit 0; no ANSI escape codes in piped output; the opening board holds exactly two tiles; the frame's shape per D7.
- D16: No new npm dependency, no new command, no new environment variable. The board stays 4x4 and the hint line stays `Arrows/WASD to move - q to quit`.

## Assumptions
- A1: `Session` grows to carry score and terminal state alongside the board, and exposes whatever the shell needs to know that the loop should stop. The exact shape is the architect's call at `/plan`; the contract here is only the observable behaviour in D6 to D11.
- A2: Where the slide/merge and loss-detection logic lives under `src/core/rules/` (one file or several) is the architect's call, subject to the existing layer map.
- A3: `tests/hardening/baseline/` targets `grid`, `new-game` and `registry`, none of which change behaviour here, so it is expected to survive untouched and stay locked. If it does not, that is a finding to report, not to work around.
- A4: The status line is a single line and carries no punctuation beyond what D8 and D9 quote.
- A5: Tile values keep the plain-decimal, 6-character-wide cell rendering of baseline D13; the score is rendered as a plain decimal with no separators.
- A6: `specs/game-mvp/` is an empty stray directory from a mistyped slug. It is untouched by this feature; a human may remove it.

## Out of scope
- Restart, undo, persistence, saved games, high scores
- Board sizes other than 4x4
- Colour, animation, in-place cell updates, terminal-resize handling, mouse input
- Any move-count, timer or statistics display
- A farewell message on quit; the last frame is still the final output
- Multiplayer, authentication, network and filesystem access

## Glossary
- **board**: the 4x4 grid holding the current position
- **cell**: one of the 16 positions on the board; either empty or holding a tile
- **tile**: a value on the board, always a power of two
- **empty cell**: a cell holding no tile; drawn blank
- **direction**: one of up, down, left, right
- **leading edge**: the side of the board a move pushes tiles toward
- **move**: one application of `applyMove` for a pressed direction
- **no-op move**: a move that leaves the board identical; spawns nothing and scores nothing
- **merge**: two equal adjacent tiles combining into one tile of twice the value, at most once per tile per move
- **spawn**: placing one new tile on a random empty cell after a move that changed the board
- **score**: the running sum of the values of all tiles that merges have produced
- **status line**: the optional frame line carrying `You win!` or `Game over`
- **win**: the first appearance of a tile of value 2048; announced, does not end the run
- **game over**: no empty cell and no pair of orthogonally adjacent equal tiles; ends the run with exit code 0
- **frame**: the full block of text drawn for one turn — title, score, grid, optional status, hint
- **random source**: the injected `() => number` in `0 <= n < 1` that is the core's only randomness
- **quit key**: `q`, Escape or Ctrl-C

## Open questions
none
