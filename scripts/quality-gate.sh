#!/usr/bin/env bash
# The "physical barrier". Exit 0 only if every configured check passes.
# Configure the commands in pipeline.config.
#
#   ./scripts/quality-gate.sh [fast]   lint, typecheck, structure, unit, acceptance, hardening,
#                                      coverage, CRAP, placement, scenario coverage,
#                                      acceptance locks
#                                      (the implementer's loop)
#   ./scripts/quality-gate.sh full     fast + mutation testing + feature envy + hardening locks
#                                      (the orchestrator, the hardener, and the reviewer)
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# shellcheck source=/dev/null
source ./pipeline.config

mode="${1:-fast}"
case "$mode" in
  fast|full) ;;
  *) echo "usage: $0 [fast|full]" >&2; exit 2 ;;
esac

# Optional commands that an older pipeline.config may not define at all.
HARDENING_TEST_CMD="${HARDENING_TEST_CMD:-}"
MUTATION_CMD="${MUTATION_CMD:-}"
DEPS_CMD="${DEPS_CMD:-}"

# The feature slug comes from the branch name: feat/<slug>. Empty on any other branch,
# which makes the placement check skip rather than guess.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
slug=""
[[ "$branch" == feat/* ]] && slug="${branch#feat/}"

fail=0
results=()

run() {  # run <name> <command> <required|optional>
  local name="$1" cmd="$2" required="$3"
  if [[ -z "$cmd" ]]; then
    if [[ "$required" == required ]]; then
      results+=("FAIL  $name (not configured in pipeline.config)"); fail=1
    else
      results+=("SKIP  $name (not configured)")
    fi
    return
  fi
  echo "==> $name: $cmd"
  if bash -c "$cmd"; then results+=("PASS  $name"); else results+=("FAIL  $name"); fail=1; fi
  echo
}

verify_locks() {  # verify_locks <lock-file-name> <verify-subcommand> <label>
  local lockname="$1" subcmd="$2" label="$3" lock slug
  for lock in specs/*/"$lockname"; do
    [[ -f "$lock" ]] || continue
    slug="$(basename "$(dirname "$lock")")"
    if ./scripts/acceptance-lock.sh "$subcmd" "$slug" >/dev/null 2>&1; then
      results+=("PASS  $label lock: $slug")
    else
      results+=("FAIL  $label lock: $slug ($label tests were modified)"); fail=1
    fi
  done
}

run "lint"             "$LINT_CMD"            required
run "typecheck"        "$TYPECHECK_CMD"       optional
run "structure"        "$DEPS_CMD"            required
run "unit tests"       "$UNIT_TEST_CMD"       required
run "acceptance tests" "$ACCEPTANCE_TEST_CMD" required
run "hardening tests"  "$HARDENING_TEST_CMD"  optional
run "coverage"         "$COVERAGE_CMD"        optional
run "CRAP score"       "$CRAP_CMD"            optional

# Placement: do the changed src files match the plan's module map? Only meaningful on a
# feature branch whose plan exists -- otherwise there is nothing to compare against.
if [[ -n "$slug" && -f "specs/$slug/plan.md" ]]; then
  run "placement" "./scripts/check-placement.py $slug" required
else
  results+=("SKIP  placement (no specs/<slug>/plan.md for this branch)")
fi

# Traceability: does every approved scenario have an acceptance test claiming it? Without
# this, a dropped scenario is invisible -- the suite passes and the locks pass regardless.
if [[ -n "$slug" && -f "specs/$slug/feature.feature" ]]; then
  run "scenario coverage" "./scripts/check-scenarios.py $slug" required
else
  results+=("SKIP  scenario coverage (no specs/<slug>/feature.feature for this branch)")
fi

# Mutation testing is the expensive check: full tier only, and required there.
if [[ "$mode" == full ]]; then
  run "mutation testing" "$MUTATION_CMD"      required

  # Feature envy is advisory: it reports functions that look misplaced so a human can judge.
  # It never fails the gate -- a high-envy function is sometimes exactly right.
  # The report is generated output, not spec: it lands in reports/ (gitignored), never in
  # specs/. A gate that writes into a source directory leaves build artifacts in the history.
  if [[ -n "$slug" ]]; then
    mkdir -p reports/placement
    if npx tsx scripts/feature-envy.ts > "reports/placement/$slug.md" 2>/dev/null; then
      results+=("INFO  feature envy -> reports/placement/$slug.md (advisory, never fails)")
    else
      results+=("INFO  feature envy could not run (advisory, never fails)")
    fi
  else
    results+=("SKIP  feature envy (not on a feat/<slug> branch)")
  fi
fi

# Every locked feature's acceptance tests must be untouched.
verify_locks acceptance.sha256 verify acceptance

# Hardening tests are locked by the hardener; only the full tier checks them.
if [[ "$mode" == full ]]; then
  verify_locks hardening.sha256 verify-hardening hardening
fi

echo "================ quality gate ($mode) ================"
printf '%s\n' "${results[@]}"
if [[ $fail -eq 0 ]]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; fi
exit $fail
