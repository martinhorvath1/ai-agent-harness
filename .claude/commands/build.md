---
description: Run QA, implementation, hardening, and independent review for an approved feature.
argument-hint: <feature-slug>
---
Feature slug: $ARGUMENTS
You are the orchestrator. You delegate; you do not write production code or tests yourself.
Keep your own context lean: rely on the files in specs/$ARGUMENTS/ rather than long summaries.

0. Preconditions. Stop and tell me if any fails:
   - specs/$ARGUMENTS/APPROVED exists
   - ./scripts/check-spec.py $ARGUMENTS passes
   - the working tree is clean (git status)
   Then create or switch to branch feat/$ARGUMENTS.

1. QA: use the qa subagent with the slug.
   Then verify yourself: ./scripts/acceptance-lock.sh verify $ARGUMENTS must pass,
   and the acceptance tests must currently fail. Commit: "test($ARGUMENTS): acceptance tests".

2. Implement: use the implementer subagent with the slug.
   Do NOT trust its report. Run ./scripts/quality-gate.sh yourself.
   If it fails, send the failing output back to the implementer (resume it).
   If the implementer reports an acceptance test is wrong, STOP and ask me.
   When green, commit: "feat($ARGUMENTS): implementation".

3. Harden: run ./scripts/quality-gate.sh full yourself.
   - If it fails on anything other than mutation testing, that is the implementer's problem:
     send the failing output back (resume it) as in step 2, then re-run the full gate.
   - Then run ./scripts/needs-hardening.py $ARGUMENTS. It decides whether a round is
     warranted; you do not. Exit 1 means SKIP -- go to step 4. Exit 2 means the mutation
     report is missing -- re-run the full gate. Exit 0 means RUN:
     use the hardener subagent with the slug. Its response is a verbatim report,
     not a summary — save it as specs/$ARGUMENTS/hardening.md (append as a new "Round N" section
     if the file already exists from a previous round).
     - If the report contains a BUG finding: resume the implementer with the exact BUG entries
       (do not paraphrase). Re-run the fast gate, commit: "fix($ARGUMENTS): address hardening
       round <n>". Then run a NEW hardener (never resume the old one).
     - If the report contains an UNTESTABLE finding: same as BUG — send it to the implementer
       to add a seam, without changing behavior, then run a NEW hardener.
     - If every remaining survivor is EQUIVALENT or ACCEPTED with a sound justification, this
       round is done.
     - Maximum 2 hardening rounds. If mutation score is still below the break threshold after
       round 2, STOP and escalate to me with the open survivors.
   - Once hardening is settled, distill specs/$ARGUMENTS/hardening.md into
     specs/$ARGUMENTS/survivors.md yourself: one line per surviving mutant (location, mutant,
     verdict), carrying forward only EQUIVALENT/UNTESTABLE/ACCEPTED verdicts that still hold.
   - Re-run ./scripts/quality-gate.sh full. It must pass. Commit:
     "test($ARGUMENTS): hardening tests". The hardener's tests are
     tests/unit/*.mutation.test.ts — they sit beside the unit tests they reinforce, and are
     locked by specs/$ARGUMENTS/hardening.sha256 rather than by living in a tree of their own.

4. Review: use the reviewer subagent. Your delegation message must contain ONLY:
   "Feature slug: $ARGUMENTS. Branch: feat/$ARGUMENTS."
   No summaries, no reasoning, nothing about how the code was written.
   Save its output verbatim to specs/$ARGUMENTS/review-<n>.md (n = 1, 2, 3).

5. If the verdict is CHANGES_REQUESTED:
   - resume the implementer and point it at the new review file
   - re-run ./scripts/quality-gate.sh full yourself, commit: "fix($ARGUMENTS): address review <n>"
   - if the fix touches mutation coverage meaningfully, treat it like step 3 again (a new
     hardener round may be warranted; use judgment)
   - run a NEW reviewer (never resume the old one) with the same minimal message
   - maximum 3 review rounds, then stop and escalate to me with the open findings

6. On APPROVE: give me a summary (commits, files changed, hardening rounds, review rounds, any
   plan deviations) and the prune command (`./scripts/spec-prune.py $ARGUMENTS`), and wait.
   Do not merge, push, or run the prune command yourself.
