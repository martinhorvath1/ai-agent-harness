# Accepted survivors: baseline

The mutants no test kills, and why that was accepted. Distilled from `hardening.md`
(round 2, 2026-09-12), which is pruned once this file exists. One line per survivor:
location, mutant, verdict.

A future hardener reads this file **first** and does not re-argue anything listed as
EQUIVALENT or ACCEPTED. Anything listed as INVALIDATED is fair game and should be re-attempted.

Mutation score at the last full run: **98.39%** (181 killed, 2 timeout, 2 survived,
1 no-coverage). Mutant ids below are from that run; they shift when source lines move.

## ACCEPTED — killable, deliberately not killed

| Location | Mutant | Justification |
|---|---|---|
| `src/core/rules/seed.ts:31` | 313 — ArithmeticOperator, `+`→`-` in `state = (state + 0x6d2b79f5) >>> 0` | Part of the mulberry32 state-mixing arithmetic. Per **brief.md decision A1**, `seededRandom`'s contract is reproducibility only, not a specific algorithm; brief.md names this exact location as the deliberately-accepted risk. Killing it needs a golden-sequence assertion, which pins implementation over behaviour. **Re-check if A1 ever changes to specify an algorithm.** |
| `src/core/rules/seed.ts:34` | 314 — ArithmeticOperator, `+`→`-` in `t ^= t + Math.imul(...)` | Same justification and same brief.md citation as above. **Re-check if A1 ever changes.** |

## UNTESTABLE — no seam reaches it

| Location | Mutant | Justification |
|---|---|---|
| `src/core/rules/new-game.ts:21` | 278 — StringLiteral, `throw new Error('no empty cells to place a tile on')` → `throw new Error('')` | `pickEmptyIndex` is module-private, so even though hardening tests may now import any `src/` file directly, there is nothing exported that reaches this branch — the barrier is the missing export, not the import rule. `newGame` always starts from a fully-empty 16-cell board and places exactly 2 tiles, so `emptyIndexes` is provably never empty here. **Re-check if `pickEmptyIndex` is ever exported, or if `newGame` stops starting from an empty board.** |

## Resolved since round 1

- **The 22 `src/cli/keys.ts` survivors** (mutants 34, 35, 49, 53, 54, 55, 59, 60, 64, 81, 84,
  86, 91, 93, 102, 103, 105, 107, 109, 111, 113, 17) previously listed as INVALIDATED are
  **all killed**. `tests/unit/keys.test.ts` covers them and `keys.ts` now scores 100%
  (78 killed, 0 survived). Round 1's UNTESTABLE verdict on them was wrong and is withdrawn.
  Note for future rounds: the half of that reasoning which remains correct and permanent is
  that **spawning the real CLI kills nothing** — mutant-switching cannot cross a process
  boundary, so a black-box spawn registers zero Stryker coverage.
- `src/core/game/registry.ts:16` (`lines.join('\n')` → `lines.join('')`), previously
  EQUIVALENT-while-one-command, is **killed**; `registry.ts` scores 100%.
- `src/cli/keys.ts:69` (`input.resume()` removed), previously EQUIVALENT, is **killed**.
