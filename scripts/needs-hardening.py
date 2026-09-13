#!/usr/bin/env python3
"""Decide whether a hardening round is warranted for this branch.

Usage: ./scripts/needs-hardening.py <feature-slug>

Exit 0  -> run the hardener
Exit 1  -> skip it; the suite already constrains this feature's code
Exit 2  -> cannot tell (no mutation report); run `npx stryker run` first

Why this exists
---------------
`/build` used to skip the hardener whenever the full gate passed, i.e. whenever the mutation
score cleared the BREAK threshold. That made one number do two different jobs:

    break (75)  "is this branch good enough to ship?"
    ...also...  "is another hardening round worth the time?"

Those want different answers. A feature that scores 97 ships fine, but if three of its own
new functions have mutants nobody kills, that is exactly when a hardener earns its keep --
and under the old rule it was never called. In practice the hardener almost never ran.

So this splits them. `break` keeps its ship/no-ship job in stryker.config.json; hardening is
triggered by either of two signals:

  1. the score is below the HIGH threshold (90) -- the suite is weak overall; or
  2. a surviving mutant lives in a src/ file this branch changed -- the feature shipped code
     whose behaviour no test pins down, whatever the repo-wide average says.

Signal 2 is the important one, and it is deliberately blind to previous verdicts: mutant ids
shift between runs and location lines move, so matching against survivors.md would be
guesswork. Re-triggering is bounded by the round limit in /build, and a hardener that finds
only already-classified survivors says so and the round ends immediately.
"""
import json
import subprocess
import sys
from pathlib import Path

REPORT = Path("reports/mutation/mutation.json")
BASE = "main"

# Statuses that mean "no test noticed this change". Timeout counts as detected, as it does in
# Stryker's own score: an infinite loop is a test noticing, however crudely.
ALIVE = {"Survived", "NoCoverage"}
DETECTED = {"Killed", "Timeout"}


def run_git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    return None if result.returncode != 0 else result.stdout


def changed_src_files():
    """src/ files added or modified on this branch, working tree included."""
    merge_base = run_git("merge-base", BASE, "HEAD")
    if merge_base is None:
        return None
    out = run_git("diff", "--name-status", merge_base.strip())
    if out is None:
        return None

    def is_source(path):
        return path.startswith("src/") and path.endswith(".ts")

    files = set()
    for line in out.splitlines():
        parts = line.split("\t")
        status, path = parts[0], parts[-1]
        if not status.startswith("D") and is_source(path):
            files.add(path)

    untracked = run_git("ls-files", "--others", "--exclude-standard")
    if untracked:
        files.update(p for p in untracked.split() if is_source(p))
    return files


def load_report():
    if not REPORT.exists():
        return None
    with REPORT.open(encoding="utf-8") as handle:
        return json.load(handle)


def survivors_of(report):
    """[(path, line, id, mutator)] for every mutant still alive."""
    alive = []
    for path, entry in report.get("files", {}).items():
        for mutant in entry.get("mutants", []):
            if mutant.get("status") in ALIVE:
                line = mutant.get("location", {}).get("start", {}).get("line", 0)
                alive.append((path, line, mutant.get("id"), mutant.get("mutatorName")))
    return sorted(alive)


def score_of(report):
    detected = alive = 0
    for entry in report.get("files", {}).values():
        for mutant in entry.get("mutants", []):
            status = mutant.get("status")
            detected += status in DETECTED
            alive += status in ALIVE
    total = detected + alive
    return 100.0 if total == 0 else detected / total * 100.0


def normalize(path, root):
    """Stryker writes absolute paths; the git diff is repo-relative."""
    path = path.replace("\\", "/")
    root = (root or "").replace("\\", "/").rstrip("/")
    if root and path.startswith(root + "/"):
        return path[len(root) + 1:]
    return path.lstrip("/")


def main():
    if len(sys.argv) != 2:
        print("usage: needs-hardening.py <feature-slug>", file=sys.stderr)
        return 2
    slug = sys.argv[1]

    report = load_report()
    if report is None:
        print("needs-hardening: no %s -- run `npx stryker run` first" % REPORT, file=sys.stderr)
        return 2

    root = report.get("projectRoot", "")
    high = report.get("thresholds", {}).get("high", 90)
    score = score_of(report)
    alive = [(normalize(p, root), line, mid, mut) for p, line, mid, mut in survivors_of(report)]

    changed = changed_src_files()
    if changed is None:
        print("needs-hardening: cannot diff against '%s' -- assuming a round is warranted" % BASE)
        return 0

    in_feature = [m for m in alive if m[0] in changed]

    print("mutation score: %.2f (high threshold %s)" % (score, high))
    print("surviving mutants: %d total, %d in files this branch changed" % (len(alive), len(in_feature)))

    reasons = []
    if score < high:
        reasons.append("score %.2f is below the high threshold %s" % (score, high))
    if in_feature:
        reasons.append("%d surviving mutant(s) live in code this feature touched" % len(in_feature))

    if not reasons:
        print("\nneeds-hardening: SKIP -- nothing this feature changed is left unconstrained.")
        return 1

    for mutant in in_feature[:20]:
        print("  alive: %s:%s  id %s  %s" % mutant)
    if len(in_feature) > 20:
        print("  ... and %d more" % (len(in_feature) - 20))

    print("\nneeds-hardening: RUN the hardener on '%s' -- %s." % (slug, "; ".join(reasons)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
