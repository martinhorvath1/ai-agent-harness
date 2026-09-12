---
description: Turn an approved brief into a plan and Gherkin scenarios via the architect.
argument-hint: <feature-slug>
---
Feature slug: $ARGUMENTS

1. Verify specs/$ARGUMENTS/brief.md exists. If it is missing, tell me to run /grill first and stop.
2. Use the architect subagent. Pass it ONLY the slug.
3. If the architect wrote specs/$ARGUMENTS/questions.md:
   - grill me on ONLY those questions, one at a time, with suggested defaults
   - add each answer to brief.md as a new numbered decision (continue the D numbering)
   - delete questions.md and run the architect again
4. Run ./scripts/check-spec.py $ARGUMENTS
   If it fails, send the failure output to the architect to fix, then re-run the check.
   Maximum 3 attempts, then stop and show me the failures.
5. Show me feature.feature with its decision tags, plus a 5-line summary of plan.md.
   Wait for my approval and apply corrections through the architect.
6. When I approve, create the file specs/$ARGUMENTS/APPROVED containing today's date,
   and tell me to run: /build $ARGUMENTS
