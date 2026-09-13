# Claude Code agent pipeline

A harness for building features with specialized Claude Code subagents. Each agent has its own
context window and owns exactly one category of files. Handoffs happen through files in
`specs/<slug>/`. The rules that matter are enforced by scripts and hooks, not by prompts —
**scripts decide pass/fail; agents never decide whether a gate passed.**

## Overview

```
/grill <slug> <request>
   you + main session ── scout ──► specs/<slug>/brief.md              ◄── YOU APPROVE

/plan <slug>
   architect ──► specs/<slug>/plan.md + feature.feature              ◄── YOU APPROVE
                 (check-spec gate)        └─► specs/<slug>/APPROVED

/build <slug>                                    orchestrator delegates; writes no code itself
   0  preconditions ── APPROVED, check-spec, clean tree, branch feat/<slug>
   1  qa           ──► tests/acceptance/<slug>/  ─► locked ─► must FAIL ─► commit
   2  implementer  ──► src/ + tests/unit/        ─► FAST gate  (orchestrator re-runs it) ─► commit
   3  harden       ──► FULL gate (mutation testing) ─► needs-hardening.py decides
                         skip? ───────────────────► straight to review
                         run?  ─► hardener ──► tests/unit/*.mutation.test.ts ─► locked
                                     └─ BUG / UNTESTABLE? ─► implementer ─► NEW hardener
                                        (max 2 rounds, then escalate to you)
                       ─► FULL gate (orchestrator re-runs it) ─► commit
   4  reviewer     ──► specs/<slug>/review-<n>.md      fresh context, read-only, FULL gate
   5  CHANGES_REQUESTED ─► implementer ─► fast ─► full ─► commit ─► NEW reviewer
                           (max 3 rounds, then escalate to you)
   6  APPROVE      ──► summary, then it waits. No merge, no push.
```

## Requirements

- Claude Code (recent version; subagent `hooks` and `effort` frontmatter need current releases)
- Node.js 20+, git, bash, python3

## Setup

1. **Copy into your repo:** `.claude/`, `scripts/`, `specs/`, `tests/`, `pipeline.config`,
   `stryker.config.json`, and `CLAUDE.md`. If you already have a CLAUDE.md, merge in the
   "Delivery pipeline" section.
2. **Make scripts executable:** `chmod +x scripts/*.sh scripts/*.py`
3. **Install dependencies:** `npm ci`
4. **Configure the quality gate.** Fill in `pipeline.config` for your stack (examples inside).
   Check both tiers on a clean branch — they must pass before you start, otherwise the
   implementer will chase pre-existing failures:
   ```
   ./scripts/quality-gate.sh          # fast
   ./scripts/quality-gate.sh full     # + mutation testing
   ```
5. **Fill in CLAUDE.md.** Stack, layout, conventions, how to run tests. Every agent reads it.
6. **Trust the folder.** Start `claude` in the repo and accept the workspace trust prompt.
   The guard hooks live in agent frontmatter and only run in trusted folders.
7. **Check permission rules.** `.claude/settings.json` pre-approves the pipeline scripts, both
   gate tiers, `npx stryker run`, and safe git commands; `git push` is denied. Run
   `/permissions` to confirm they load.
8. **Smoke-test the spec checker:** `./scripts/check-spec.py _example` should print PASS.
9. **Set up the layer map.** `.dependency-cruiser.cjs` ships with rules for the
   `src/core/{model,rules,game}` + `src/cli/` layout described in CLAUDE.md. If your repo is
   laid out differently, rewrite the `forbidden` rules and the layer map in CLAUDE.md together —
   they must agree, because the architect plans against CLAUDE.md and the gate enforces the
   config. Check it with `npx depcruise src tests --config .dependency-cruiser.cjs`.

## Running a new feature

```text
/grill pwd-reset let users reset their password by email
```
The scout reads your codebase and lists ambiguities; the main session then grills you one
question at a time ("default" is a valid answer) and writes the brief.

> **Checkpoint 1 — you approve `specs/pwd-reset/brief.md`.** Read the Decisions (D1, D2, …)
> and the Glossary. Everything downstream is generated from these, so fix them now.

```text
/clear          (optional: everything needed is in files from here on)
/plan pwd-reset
```
The architect turns the brief into `plan.md` and `feature.feature`. It raises questions instead
of guessing. `./scripts/check-spec.py` then mechanically verifies every decision `D<n>` has an
`@D<n>`-tagged scenario.

> **Checkpoint 2 — you approve the scenarios.** Approving creates `specs/pwd-reset/APPROVED`,
> which `/build` refuses to start without.

```text
/build pwd-reset
```
Runs stages 0–6 above without stopping, unless it hits an escape hatch.

> **Checkpoint 3 — you get a summary on APPROVE**, or an escalation. `/build` never merges
> and never pushes; the branch `feat/pwd-reset` is left for you.

Start with a small, well-understood feature so you can tell pipeline problems from feature
problems.

## Agents

| Role | Model | Writes | Runs | Blocked from |
|------|-------|--------|------|--------------|
| **scout** | sonnet | nothing (read-only) | — | everything; it only reports ambiguities |
| **architect** | opus | `specs/<slug>/plan.md` (incl. the `## Module map`), `feature.feature` | — | no Bash, no code; proposes dependency rules, never edits `.dependency-cruiser.cjs` |
| **qa** | sonnet | `tests/acceptance/<slug>/` | acceptance tests (must fail), `acceptance-lock.sh lock` | `src/`, `tests/unit/`, gate files, `lock-hardening`, dependency changes |
| **implementer** | sonnet | `src/`, `tests/unit/` except `*.mutation.test.ts` | `./scripts/quality-gate.sh` (fast) | `tests/acceptance/`, `tests/unit/*.mutation.test.ts`, gate files, either lock command, dependency changes |
| **hardener** | sonnet | `tests/unit/<module>.mutation.test.ts` | `./scripts/quality-gate.sh full`, `acceptance-lock.sh lock-hardening` | `src/`, every other file in `tests/unit/`, `tests/acceptance/`, gate files, `lock`, dependency changes |
| **reviewer** | opus (high effort) | nothing (read-only) | both lock verifies, `./scripts/quality-gate.sh full` | has no write tools at all |
| **orchestrator** (`/build`) | your session | commits, `specs/<slug>/*.md` reports | both gate tiers itself | writing code or tests; merging; pushing |

"Gate files" means `pipeline.config`, `scripts/`, `.claude/`, `eslint.config*`, `tsconfig*`,
`vitest.config*`, `stryker.config*`, `.dependency-cruiser*`, `package.json`, `package-lock.json`,
and `*.sha256` — owned by humans only, so no agent can change how its own work is graded.

Enforcement is `scripts/guard.sh <role>`, a PreToolUse hook wired into qa, implementer, and
hardener frontmatter. It blocks `Edit`/`Write`/`MultiEdit`/`NotebookEdit` to protected paths,
and `Bash` commands that both mention a protected path and contain a write operation
(`>`, `tee`, `sed -i`, `perl -i`, `rm`, `mv`, `cp`, `touch`, `truncate`, `patch`, `chmod`,
`git checkout/restore/rm/mv/stash`). Plain reads and test runs are allowed —
`npx vitest run tests/acceptance 2>&1` goes through.

The checksum locks are the second line of defense: even if a guard were bypassed, the gate's
`verify` step fails the build.

## Gate tiers

| | fast (`./scripts/quality-gate.sh`) | full (`./scripts/quality-gate.sh full`) |
|---|---|---|
| lint, typecheck | ✅ | ✅ |
| **structure** (dependency-cruiser) | ✅ required | ✅ required |
| unit tests (incl. `*.mutation.test.ts`) | ✅ | ✅ |
| acceptance tests | ✅ | ✅ |
| coverage (80%) | ✅ | ✅ |
| CRAP score (max 8) | ✅ | ✅ |
| **placement** (module map) | ✅ when `specs/<slug>/plan.md` exists | ✅ same |
| **scenario coverage** (feature.feature -> tests) | ✅ when `specs/<slug>/feature.feature` exists | ✅ same |
| mutation testing | — | ✅ required |
| **feature envy** | — | ✅ advisory, never fails |
| acceptance locks | ✅ | ✅ |
| hardening locks | — | ✅ |
| **who runs it** | implementer (its loop), orchestrator after stage 2 | orchestrator (stage 3, stage 5), hardener, reviewer |

Hardening tests run in **both** tiers on purpose: they are part of `tests/unit/`, so the
implementer finds out immediately when a change breaks one, instead of at the end of the run. The structural checks run in both tiers for
the same reason: a layering violation is as much a defect as a failing test.

## Structural checks

Tests say the code works. These say it is in the right place.

**Structure — `.dependency-cruiser.cjs`** (both tiers, required). Enforces the layer map in
CLAUDE.md: dependencies point one way, the core stays pure (no I/O, no node builtins, no npm),
the shell and the acceptance tests reach the core only through `src/core/index.ts`, and nothing
is circular or orphaned. Run it directly with
`npx depcruise src tests --config .dependency-cruiser.cjs`. The config is human-owned; agents
propose rules in the plan's Risks section and never edit it.

**Placement — `scripts/check-placement.py <slug>`** (fast tier, when `specs/<slug>/plan.md`
exists; the slug comes from the branch name `feat/<slug>`). The architect's plan carries a
`## Module map` table — Path, Status, Responsibility, Key exports — naming every file the
feature touches. The check diffs `main...HEAD` against it and **fails** when a changed `src/`
file is missing from the map, or sits in a directory no dependency rule covers. It **warns**
when a planned file was never touched, or a declared key export is missing.

The implementer is explicitly allowed to deviate from the map — the right home for a piece of
code is often only obvious once you are writing it. What it may not do is deviate silently.
`/build` routes each reported deviation: a stale map goes back to the architect, anything that
crosses a layer or needs a new dependency rule comes to you.

**Scenario coverage — `scripts/check-scenarios.py <slug>`** (fast tier, when
`specs/<slug>/feature.feature` exists). Every approved scenario must be claimed by an
acceptance test whose title is the scenario name verbatim, preceded by a comment line
carrying the scenario's tags:

```gherkin
  @D2 @D3
  Scenario: the usage text lists play and no longer lists hello
```

```ts
  // @D2 @D3
  it('the usage text lists play and no longer lists hello', async () => { ... })
```

A Scenario Outline is claimed by a tagged `describe()` wrapping an `it.each()`; the row titles
inside need no tags. Untagged blocks are ignored, so grouping `describe`s cost nothing.

It **fails** on a scenario with no test, a scenario claimed twice, tags that disagree with the
feature file, or a tagged test claiming a scenario that no longer exists. Without it, a dropped
scenario is invisible: the suite passes, coverage passes, the locks pass, and a slice of
approved behaviour is simply never tested. This is the check that makes the Gherkin
load-bearing instead of decorative.

**Feature envy — `scripts/feature-envy.ts`** (full tier, advisory). Uses ts-morph to count, for
every exported function in `src/`, which module its references live in. It flags functions where
more than 50% of references come from one *other* module and less than 20% from its own — the
classic signal that a function is declared in the wrong place. Output goes to
`reports/placement/<slug>.md`.

It **never fails the gate**, by design: in a layered codebase a leaf function used only by the
layer above scores 100% envy and is perfectly placed. The report is a list of questions, and the
reviewer is required to answer each one with MOVE, KEEP, or SPLIT rather than wave the table
through.

Commands come from `pipeline.config`. `MUTATION_CMD` is required in the full tier; the gate
fails rather than silently skipping it. Output format is unchanged: `PASS`/`FAIL`/`SKIP` lines
followed by a `RESULT:` line, exit 0 only when everything passed.

## Escape hatches

Agents are built to stop rather than work around a block. When one does, it is your call.

**"An acceptance test is wrong."** The implementer (or hardener) stops and reports which test
and why. `/build` stops and asks you. If the test really is wrong, the brief or scenario is
probably wrong too — fix that first, then have QA rewrite the test and re-lock
(`./scripts/acceptance-lock.sh lock <slug>`). Never edit a locked test by hand and leave the
lock stale; the gate will catch it, but you will have lost the audit trail.

**"A hardening test is wrong."** Same rule. Re-lock with
`./scripts/acceptance-lock.sh lock-hardening <slug>`. Be more willing to delete a hardening
test than an acceptance test: a hardening test that pins an implementation detail is a real
defect, and the reviewer is told to flag exactly that. If you delete the last
`*.mutation.test.ts` a slug owned, delete its `specs/<slug>/hardening.sha256` too — an empty
lock is not a thing `lock-hardening` will write.

**"The module map is wrong."** The implementer put a file somewhere the plan did not name, and
the placement check failed. This is expected and allowed — but it must be reported, not hidden.
`/build` sends a stale map back to the architect to update and re-runs the gate; you only hear
about it if the deviation crosses a layer boundary or needs a dependency rule that does not
exist. Adding that rule is your call: `.dependency-cruiser.cjs` is human-owned.

**The hardener reports BUG.** It wrote a test that fails on the current code. That is a genuine
defect the mutation run surfaced. `/build` resumes the implementer with the list, then runs a
*new* hardener. You see it in the stage-3 summary; nothing is needed from you unless it recurs.

**The hardener reports UNTESTABLE.** The code has no seam — hidden state, no injection point.
The implementer is asked to add one (inject the dependency, extract the decision into a pure
function, return the value instead of hiding it) without changing behavior.

**The hardener reports EQUIVALENT.** It claims the mutation cannot change observable behavior.
This is the one an agent can use to give up quietly, so the reviewer is instructed to challenge
every unconvincing proof. Read them yourself in `specs/<slug>/hardening.md` — a vague
justification is a sign the mutant is actually killable.

**Two hardening rounds or three review rounds exhausted.** `/build` stops and hands you the open
list. Decide: accept the risk, fix it yourself, or change the brief and start over.

**Mutation score below the threshold after hardening.** `/build` escalates. It will not lower
the threshold, and no agent can edit `stryker.config.json`. Tuning it is your decision — see
Troubleshooting.

## Per-feature artifacts

Everything for one feature lives in `specs/<slug>/`:

| File | Written by | Notes |
|------|-----------|-------|
| `request.md` | `/grill` | your verbatim request; never edited |
| `brief.md` | `/grill` | source of truth for decisions D1, D2, …; you approve it |
| `plan.md` | architect | implementation sequencing + the `## Module map`; QA never reads it |
| `feature.feature` | architect | Gherkin scenarios, each tagged `@D<n>` |
| `APPROVED` | you, via `/plan` | `/build` refuses to start without it |
| `acceptance.sha256` | `acceptance-lock.sh lock` | checksums of `tests/acceptance/<slug>/` |
| `hardening.sha256` | `acceptance-lock.sh lock-hardening` | checksums of the `tests/unit/*.mutation.test.ts` files this slug wrote |
| `survivors.md` | orchestrator, at the end of `/build` step 3 | the mutants nobody killed and why; a future hardener reads it first |
| `hardening.md` | orchestrator, from the hardener | mutation score, tests added, classified survivors |
| `review-1.md`, `review-2.md`, … | orchestrator, from each reviewer | one per review round, verbatim |

Tests live outside `specs/`: `tests/acceptance/<slug>/`, and `tests/unit/` for unit tests and
the hardener's `<module>.mutation.test.ts` files alike.
The feature-envy report is generated output, not spec: it lands in `reports/placement/<slug>.md`,
which is gitignored.

### Spec lifecycle — `scripts/spec-prune.py <slug> [--apply]`

Not every file above earns a permanent place. After the feature merges, prune:

| | Files | Why |
|---|---|---|
| **load-bearing** | `plan.md`, `feature.feature`, `*.sha256` | the gate reads these. Deleting one does not fail the gate — it makes the gate **SKIP** a check. A barrier disappears silently. |
| **durable** | `request.md`, `brief.md`, `survivors.md`, `APPROVED` | not reconstructible from the code. The record of *why*. |
| **residue** | `review-*.md`, `hardening.md` | a transcript of a negotiation that already concluded. Worth reading during the feature and in the PR; noise a year later, and what every future agent greps through. |

Pruning is **not** automatic and `/build` never runs it. The review rounds and
`hardening.md` are what you read to decide whether to merge at all; they become residue
only after that decision. `/build` ends by printing the prune command for you to run
once the feature is on main.

`spec-prune.py` deletes the residue and nothing else. It refuses when the load-bearing files
are missing, when the directory has uncommitted changes, and — the important one — when
`hardening.md` exists but `survivors.md` does not. That last guard exists because the durable
part is *buried inside* the residue: the EQUIVALENT / ACCEPTED / UNTESTABLE survivor verdicts
are the reason the mutation score stops where it does. Delete them and the next hardener
re-litigates the same mutants from scratch. Distil first, then prune.

Left unpruned, a feature costs roughly 800 lines of spec against 400 lines of source. Pruned,
about 500 — and the 300 that go are precisely the ones nobody will read again.

## Tuning

- **Models and effort** are set per agent in frontmatter (`model:`, `effort:`). Check what's
  running with `/tasks`.
- **Fewer permission prompts:** add `permissionMode: acceptEdits` to the qa, implementer, and
  hardener frontmatter, or start Claude Code with `--permission-mode acceptEdits`. The guard
  hooks still fire.
- **Round limits** (2 hardening, 3 review) and the grill question budget are plain text in the
  command files; edit freely.
- **Expect to iterate on prompts** after your first few features. Keep a note of each failure
  (bad scenario, gamed test, missed edge case) and fix it in the agent that should have caught it.

## Troubleshooting

- *An agent doesn't show up:* check frontmatter starts on line 1 and has `name` and
  `description`. Run `claude --debug` to see skipped files.
- *A guard hook doesn't fire:* the folder isn't trusted, or `scripts/guard.sh` isn't executable.
  Test it by hand:
  ```
  echo '{"tool_name":"Edit","tool_input":{"file_path":"src/x.ts"}}' | ./scripts/guard.sh hardener
  ```
  Exit 2 with a message on stderr means it works.
- *A guard blocks something legitimate:* it blocks writes, not reads. If a read-only command is
  blocked, it almost certainly contains a redirect or a `tee`. Drop the redirect, or run it
  without piping to a protected path.
- *Quality gate says "not configured":* fill in `pipeline.config`. In the full tier,
  `MUTATION_CMD` is required and an empty value is a hard failure, not a skip.
- *Mutation runs are slow.* This is the main cost of the full tier. In order of effectiveness:
  - Keep `incremental: true` (already on). The first run is the expensive one; later runs only
    re-test mutants affected by your changes. Delete `.stryker-tmp/incremental.json` if results
    ever look stale.
  - Narrow `mutate` in `stryker.config.json`. It currently mutates `src/**` except `src/cli/main.ts`,
    because logic belongs in the pure core and the CLI shell is covered by acceptance tests.
    Excluding thin adapters and generated code is usually free accuracy.
  - Leave `coverageAnalysis: "perTest"` on — it is what lets Stryker run only the tests that
    cover each mutant.
  - Only the orchestrator, the hardener, and the reviewer pay this cost. The implementer's loop
    is the fast tier and stays quick.
- *Tuning the Stryker threshold.* `thresholds` in `stryker.config.json`: `break: 75` is the one
  that fails the build (`high`/`low` only colour the report). Raise it as your suite matures;
  a jump straight to 90 on an existing codebase will mostly produce `EQUIVALENT` reports and
  wasted hardening rounds. If a whole file is genuinely not worth mutating, exclude it from
  `mutate` rather than lowering `break` for the entire project. This file is human-owned; no
  agent can change it, and that is deliberate.
- *A vacuous mutation score.* A very small codebase can report a high score simply because there
  is little to mutate. Treat the score as meaningful only once the core has real branching logic.
- *The structure check fails on a file you think is fine.* Read the rule name in the output and
  look it up in CLAUDE.md's layer map table. If the rule is genuinely wrong for your codebase,
  change `.dependency-cruiser.cjs` and CLAUDE.md together — never just silence the rule, and
  never let an agent talk you into an exception it cannot make itself.
- *The placement check fails on every file.* The branch is probably not `feat/<slug>`, or
  `specs/<slug>/plan.md` has no `## Module map` section. The gate skips the check entirely when
  there is no plan, so a failure means the plan exists but the table does not match reality.
- *The feature-envy report flags everything.* Expected on a small or strictly layered codebase —
  a function used only by the layer above is 100% "envious" and correctly placed. The thresholds
  live at the top of `scripts/feature-envy.ts`. It never fails the gate, so tune it only if the
  noise is costing the reviewer real time.
- *Main session context gets large during `/build`:* agent reports should stay short; if they
  don't, tighten the "Return" section of that agent's prompt.
