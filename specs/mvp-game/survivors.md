# Surviving mutants: mvp-game

Mutants still alive after the last hardening round (1 round). Mutation score 97.70,
break threshold 75. 7 survivors, all in `src/core/`, all classified EQUIVALENT by the
hardener; verdicts copied faithfully from `hardening.md`.

No BUG or UNTESTABLE survivors. The hardener added 12 tests in `tests/hardening/mvp-game/`
killing 16 of the original 23 survivors.

| Location | Mutant | Verdict | Justification |
|---|---|---|---|
| `src/core/rules/line.ts:17` | 305 EqualityOperator (`index < values.length` → `<=`) | EQUIVALENT | The loop body's first statement is `if (current === undefined) break;`, so the one extra iteration `<=` permits always breaks immediately with no side effects; output is identical for every input, including the empty-line case. |
| `src/core/rules/line.ts:23` | 316 ConditionalExpression (`next !== undefined && current === next` → `true && ...`) | EQUIVALENT | `current` is always a real number here (guarded by the earlier `undefined` break), so `current === next` can only be true when `next` is also a real number, i.e. exactly when `next !== undefined` already holds. The dropped clause is redundant by the types, not by chance. |
| `src/core/rules/move.ts:37` | 366 ArrayDeclaration (`[...board]` → `[]`) | EQUIVALENT ⚠ | `lineIndexes(direction)` always partitions the full 0–15 index range across its four lines, so every array index gets overwritten before `result` is read; the initial contents are unobservable. |
| `src/core/rules/outcome.ts:17` | 400 ConditionalExpression (`row + 1 < BOARD_SIZE` → `true`) | EQUIVALENT ⚠ | No real board cell exists "below" the last row to wrap onto — `index + BOARD_SIZE` at `row === BOARD_SIZE - 1` is out of the 16-cell array (`undefined`), and `undefined` never strictly equals a real `Cell` (`number \| null`). |
| `src/core/rules/outcome.ts:17` | 402 EqualityOperator (`row + 1 < BOARD_SIZE` → `<=`) | EQUIVALENT ⚠ | Same as 400: shifting the vertical boundary check by one never produces a new true comparison. |
| `src/core/rules/outcome.ts:17` | 404 ArithmeticOperator (`row + 1` → `row - 1` in the bounds check) | EQUIVALENT ⚠ | Same as 400: `row - 1 < BOARD_SIZE` holds for every row, so the check is disabled, and a disabled vertical check can only read out-of-array `undefined`. |
| `src/core/rules/outcome.ts:23` | 415 EqualityOperator (`col < BOARD_SIZE` → `<=`) | EQUIVALENT ⚠ | The extra `col === BOARD_SIZE` iteration computes `index = (row + 1) * BOARD_SIZE`, i.e. column 0 of the next row. Its "right" check is suppressed by the unmutated column boundary; its "down" check duplicates one the normal loop already performs at `row + 1, col 0`. |

## Verdicts to re-check if conditions change (⚠)

Every ⚠ row above is equivalent only because of a condition that a later feature could change.
Re-check these before trusting them again:

- **`BOARD_SIZE` is 4 and a `Board` is exactly 16 cells** (outcome.ts 400/402/404/415). The
  vertical-boundary verdicts rest entirely on `index + BOARD_SIZE` falling off the end of the
  array at the last row. A resizable board, a padded or sparse board representation, or any
  `Board` whose length exceeds `BOARD_SIZE²` would make these mutants killable — and would mean
  the missing bounds check is a real bug.
- **`Cell` stays `number | null`** (outcome.ts, all four). If `undefined` ever becomes a legal
  `Cell`, `board[out-of-range] === board[index]` could become true and these stop being equivalent.
- **`lineIndexes(direction)` covers all 16 indexes for every direction** (move.ts 366). If a
  direction were ever added or a line ever skipped an index, `[]` would leave holes where
  `[...board]` preserves cells, and the mutant becomes killable.
- **The column boundary inside `hasAdjacentEqualAt` stays unmutated** (outcome.ts 415). This
  verdict is explicitly conditional on *another* check being correct; it is the weakest of the
  seven and should be the first re-examined.

Note the deliberate asymmetry, which is the strongest evidence these verdicts were reasoned
rather than assumed: the sibling *horizontal* boundary mutants on `outcome.ts:16` (393, 396, 398)
were KILLED, because `index + 1` at the last column wraps onto a real cell of the next row. Only
the vertical direction falls off the array. A future hardener that finds the horizontal mutants
alive should treat that as a regression, not a new equivalence.
