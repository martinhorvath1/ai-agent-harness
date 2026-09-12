# Hardening report: mvp-game

Round 1 of 1. Verbatim report from the hardener subagent.

---

Everything passes. Summary below.

**Mutation score:** 92.46% before → 97.70% after (full quality gate still PASS; break threshold 75).

**Tests added** (all in `tests/hardening/mvp-game/`):
- `outcome.test.ts` — 6 tests covering the row/column adjacency scan: a horizontal pair at the last two columns, a row-end vs next-row-start non-adjacency (boundary), a vertical pair between two rows, and the "empty cell makes a move legal" pair of tests. Kills ids 393, 394, 396, 398, 399, 428, 429, 431.
- `move.test.ts` — 1 test: `up` merge on column 1 (existing unit tests only used column 0, where `+col`/`-col` coincide). Kills id 343.
- `turn.test.ts` — 1 test: an ordinary merge that produces no 2048 tile must leave `won: false`. Kills id 224.
- `frame.test.ts` — 1 test: exact total line count (14) when no status line applies, catching a spurious extra blank line that `Array.prototype.join` was masking. Kills id 250.
- `grid.test.ts` — 1 test: exact content of the row-separator line (`├──────┼──────┼──────┼──────┤`). Kills ids 290, 291, 292.
- `seed.test.ts` — 2 tests: exact mulberry32 output sequence for seeds 0 and 1, computed independently from the published algorithm the docstring names. Kills ids 460, 461.

All tests pass against the current (unmutated) source; none required a source change.

**Classified survivors (7, all in `src/core/`, all EQUIVALENT):**

- `src/core/rules/line.ts:17` (id 305, `index < values.length` → `<=`) — EQUIVALENT: the loop body's first statement is `if (current === undefined) break;`, so the one extra iteration `<=` permits always breaks immediately with no side effects; output is identical for every input, including the empty-line case.
- `src/core/rules/line.ts:23` (id 316, `next !== undefined && current === next` → `true && current === next`) — EQUIVALENT: `current` is always a real number here (guarded by the earlier `undefined` break), so `current === next` can only be true when `next` is also a real number, i.e. exactly when `next !== undefined` already holds. The dropped clause is redundant by the types, not by chance.
- `src/core/rules/move.ts:37` (id 366, `[...board]` → `[]`) — EQUIVALENT: `lineIndexes(direction)` always partitions the full 0–15 index range across its four lines (verified structurally, independent of board contents), so every array index gets overwritten by `result[index] = ...` before `result` is read; the initial contents of `result` are unobservable.
- `src/core/rules/outcome.ts:17` (id 400 `row + 1 < BOARD_SIZE` → `true`; id 402 → `<=`; id 404 `row + 1` → `row - 1` inside the boundary check) — EQUIVALENT (all three): unlike the horizontal case, there is no real board cell "below" the last row to wrap onto — `index + BOARD_SIZE` for `row === BOARD_SIZE - 1` is simply out of the 16-cell array (`undefined`), and `undefined` can never strictly equal a real `Cell` (`number | null`). Disabling or shifting this boundary check by one never produces a new true comparison, verified for all three variants.
- `src/core/rules/outcome.ts:23` (id 415, `col < BOARD_SIZE` → `<=`) — EQUIVALENT: the extra `col === BOARD_SIZE` iteration computes `index = row * BOARD_SIZE + BOARD_SIZE`, which is numerically the same as `(row + 1) * BOARD_SIZE`, i.e. column 0 of the next row. Its "right" check is always suppressed by the (unmutated) column boundary; its "down" check duplicates — or, at the last row, again compares against an out-of-array `undefined` — a check the normal loop already performs at `row + 1, col 0`. No board can make this iteration find a pair the normal scan wouldn't already find.

No BUG-classified survivors were found; no code changes are being reported as needed.

Locked with `./scripts/acceptance-lock.sh lock-hardening mvp-game` → `specs/mvp-game/hardening.sha256`. Fast and full quality gates both PASS afterward.
