# Project guide

<!-- Fill in the sections marked TODO. Every agent loads this file, so keep it short and factual. -->

## Stack
- TypeScript 5.7 on Node.js 20+ (ESM, `"type": "module"`, `module`/`moduleResolution`: NodeNext).
- Package manager: npm. Lockfile is committed; use `npm ci` in CI.
- CLI only. Key input uses Node's built-in `node:readline` — no terminal UI libraries
  (no ink, blessed, inquirer, chalk); adding one needs an explicit decision in a brief.
- Tooling: ESLint 9 (flat config) + typescript-eslint, Vitest 2 with v8 coverage, tsx for
  running TypeScript directly.

## Layout
- src/core/               the pure core: no I/O, no node builtins, no npm dependencies
- src/core/model/         types and data shapes; the bottom layer, imports nothing
- src/core/rules/         behaviour of a single thing (one command, one rule); imports model
- src/core/game/          orchestration: dispatch, session, sequencing; imports rules + model
- src/core/index.ts       the public API; the ONLY path outside src/core/ may import
- src/cli/                the shell: argv, stdio, TTY, `node:readline`
- src/cli/main.ts         entry point: parses argv, writes output, sets the exit code
- src/cli/render.ts       pure `render(result): string`; the one shell file black-box tests may import
- dist/                   compiled output (`npm run build`); never edited by hand
- specs/<feature>/   feature specs: request, brief, plan, scenarios, and survivors.md
                    (the mutants left alive and why -- read it before hardening anything).
                    Review rounds and the hardener's narrative are residue: a human prunes
                    them after merge with `scripts/spec-prune.py <slug> --apply`. No agent
                    runs that, and no agent deletes anything under specs/.
- reports/   generated output (mutation, feature envy); gitignored, never committed
- tests/acceptance/<feature>/   acceptance tests (QA-owned, locked)
- tests/unit/   unit tests (implementer-owned)
- tests/hardening/<feature>/   mutation-killing tests (hardener-owned, locked)
- scripts/   pipeline tooling; do not modify during feature work

## Layer map

Dependencies point one way only. `.dependency-cruiser.cjs` enforces every arrow below, and
`npx depcruise` runs in **both** gate tiers, so a violation fails the implementer's own loop.

```
  tests/acceptance/ ─────────────────┐      (may import ONLY core/index.ts and cli/render.ts)
  tests/hardening/  ─────────────────┤      (may import any src/ file a mutant lives in)
  tests/unit/       ─────────────────┤
                                     │
  src/cli/  ──────────────────────────► src/core/index.ts      the public API
   main.ts, render.ts, keys.ts               │
   argv, stdio, TTY, node:readline           ▼
                                        src/core/game/         dispatch, orchestration
                                             │
                                             ▼
                                        src/core/rules/        one command's behaviour
                                             │
                                             ▼
                                        src/core/model/        types; imports nothing
```

The rules, by name, so you can read a failure message:

| Rule | Means |
|---|---|
| `no-circular` | two modules that import each other are really one module |
| `no-orphans` | a file nothing imports is dead code or forgotten wiring |
| `core-no-cli` | the core never reaches into the shell |
| `core-no-node-builtins` | no I/O in the core — inject what you need |
| `core-no-npm` | the core has no runtime dependencies; ask a human before adding one |
| `model-is-bottom` | `model/` imports neither `rules/` nor `game/` |
| `rules-below-game` | `rules/` never imports `game/`; `game/` sits above it |
| `only-index-imports-game-publicly` | internals never import the barrel; that is backwards |
| `cli-uses-public-api` | the shell imports `core/index.ts`, never a core internal |
| `acceptance-tests-use-public-api` | acceptance tests prove behaviour, not internals. Hardening tests are exempt: a mutant can live in a file the public API never re-exports, and locking the hardener out of it produces false `UNTESTABLE` verdicts rather than better tests |

`.dependency-cruiser.cjs` is human-owned. Agents propose rules; they never edit it.

## Conventions
- **Core/shell rule:** logic lives in the pure core (`src/core/`: no I/O, no randomness except
  through an injected random source); `src/cli/` is a thin terminal shell (input handling and
  drawing). Acceptance tests target the core's public API and the pure `render(result): string`
  function. Nothing in tests touches a real TTY.
- **Placement:** the architect's plan carries a `## Module map` naming every file the feature
  touches. `scripts/check-placement.py` fails the fast gate when a changed `src/` file is
  missing from it or sits in a directory no dependency rule covers. Deviating from the map is
  allowed; hiding the deviation is not.
- Naming: files kebab-case, exported functions camelCase, types/interfaces PascalCase.
- Commands return a `CommandResult` (`{ output, exitCode }`) instead of printing or
  calling `process.exit` themselves.
- Errors: no silent catches. `catch (error: unknown)` and narrow before use.
- Logging: write to stdout for success output, stderr for failures; nothing else prints.
- Dependencies (streams, clocks, spawners) are passed in as parameters with a default,
  so tests can substitute them without mocking modules.
- Cyclomatic complexity is capped at 8 per function by ESLint; split the function rather
  than disabling the rule.

## Testing
- Vitest. Tests live in `tests/unit/`, `tests/acceptance/`, and `tests/hardening/`,
  named `*.test.ts`. All three are discovered by `vitest.config.ts` and all three are run by
  the fast quality gate and by Stryker.
- Run everything: `npm test`. Unit only: `npm run test:unit`. Acceptance only:
  `npm run test:acceptance`. Hardening only: `npm run test:hardening`.
- A single file: `npx vitest run tests/unit/hello.test.ts`.
  A single test by name: `npx vitest run -t "greets the given name"`.
- Coverage: `npm run coverage` (v8 provider, 80% lines/functions/branches/statements;
  `src/cli/main.ts` is excluded because acceptance tests cover it by spawning the binary).
- Unit tests import from `src/` directly and must not spawn processes or touch the
  filesystem. Acceptance tests drive the real CLI by spawning `tsx src/cli/main.ts`.
- Imports of local modules use the `.js` extension (NodeNext resolution), even from `.ts`.
- CRAP score: `python3 scripts/crap.py --max 8` (reads `coverage/coverage-final.json`, so run
  the coverage command first). `--top 0` lists every function; `--json` for machine output.
- Mutation testing: `npm run mutation` (StrykerJS; config in `stryker.config.json`, break
  threshold 75). It mutates `src/**` except `src/cli/main.ts`, and writes
  `reports/mutation/mutation.json` for agents to parse plus an HTML report beside it.
  Runs are incremental (`.stryker-tmp/incremental.json`); delete that file for a clean run.
- Structural rules: `npx depcruise src tests --config .dependency-cruiser.cjs` (both tiers).
- Placement: `./scripts/check-placement.py <slug>` (fast tier, when `specs/<slug>/plan.md` exists).
- Scenario traceability: `./scripts/check-scenarios.py <slug>` (fast tier, when
  `specs/<slug>/feature.feature` exists). Every scenario must be claimed by an acceptance
  test whose title is the scenario name verbatim, preceded by a comment line carrying the
  scenario's tags (`// @D2 @D3`). Untagged blocks are ignored.
- Feature envy: `npx tsx scripts/feature-envy.ts` (full tier; advisory, never fails).
  Output goes to `reports/placement/<slug>.md`, not into `specs/`.

## Delivery pipeline
Features flow: /grill -> /plan -> /build.
- specs/<feature>/request.md is the user's verbatim request and is never edited.
- specs/<feature>/brief.md is the source of truth for decisions (D1, D2, ...).
- Use glossary terms from the brief exactly, in code, tests, and scenarios.

**File ownership.** Each writing agent owns exactly one category of files, and no agent grades
its own work. `scripts/guard.sh <role>` is a PreToolUse hook that enforces this; the checksum
locks in the quality gate are the second line of defense.

| Owner | May write |
|-------|-----------|
| qa | `tests/acceptance/<feature>/` (then locks it: `acceptance-lock.sh lock`) |
| implementer | `src/`, `tests/unit/` |
| hardener | `tests/hardening/<feature>/` (then locks it: `acceptance-lock.sh lock-hardening`) |
| reviewer | nothing (read-only) |
| humans only | `pipeline.config`, `scripts/`, `.claude/`, `eslint.config*`, `tsconfig*`, `vitest.config*`, `stryker.config*`, `.dependency-cruiser*`, `package.json`, `package-lock.json`, `*.sha256` |

No agent may install or remove dependencies. Scripts decide pass/fail; agents never decide
whether a gate passed.

**Quality gate tiers.** Both must pass before work is called done:
- `./scripts/quality-gate.sh` (fast, the default): lint, typecheck, **structure**, unit,
  acceptance, hardening, coverage, CRAP, **placement**, **scenario traceability**,
  acceptance locks. This is the implementer's loop.
- `./scripts/quality-gate.sh full`: fast + mutation testing (`npx stryker run`) +
  **feature envy** (advisory) + hardening locks. Run by the orchestrator, the hardener, and
  the reviewer.

If you believe a locked test is wrong, STOP and report which test and why. Do not work around it.
