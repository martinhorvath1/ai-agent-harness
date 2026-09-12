---
description: Clarify a raw feature request by grilling the user, then write an approved brief.
argument-hint: <feature-slug> <request text>
---
We are clarifying a feature request before any planning happens.

Arguments: $ARGUMENTS
The first word is the feature slug (lowercase, hyphens). Everything after it is the request.

1. Create specs/<slug>/ and save the request text VERBATIM to specs/<slug>/request.md.
   Never edit request.md afterwards.
2. Use the scout subagent with the slug to find ambiguities.
3. Grill me:
   - Ask ONE question at a time, most impactful first.
   - Each question says briefly why it matters and offers a suggested default.
     I can answer "default".
   - Push back if an answer contradicts an earlier answer or opens a new ambiguity.
   - When a rule is fuzzy, ask for a concrete example (input -> expected result).
     Examples become Gherkin later.
   - Don't ask anything the code already answers.
   - If this is heading past ~15 questions, stop and propose splitting the feature.
4. Stop when all of these are resolved or explicitly out of scope:
   scope, happy path, business rules, edge cases, error handling, permissions,
   data changes, integration points, non-goals.
   If I say "enough", stop and record the remaining items as Assumptions.
5. Write specs/<slug>/brief.md following specs/_templates/brief.md exactly.
   Number decisions D1, D2, ... Put examples inline with their decision.
   "Open questions" must be empty (write "none").
6. Show me the brief and wait for my approval. Apply my corrections.
   Do NOT start planning. When I approve, tell me to run: /plan <slug>
