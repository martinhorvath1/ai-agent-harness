#!/usr/bin/env python3
"""Prune a finished feature's spec directory down to what stays useful forever.

Usage: ./scripts/spec-prune.py <feature-slug> [--apply]

Run this AFTER the feature is merged. Without --apply it only prints the plan.

A spec directory holds three kinds of file:

  LOAD-BEARING   the gate reads it. Deleting it does not fail the gate, it makes the gate
                 SKIP a check -- a barrier disappears silently.
                   plan.md          -> check-placement.py
                   feature.feature  -> check-scenarios.py, check-spec.py
                   *.sha256         -> the acceptance and hardening locks

  DURABLE        not reconstructible from the code. The record of why.
                   request.md   the verbatim ask
                   brief.md     decisions D1..Dn and the glossary
                   survivors.md the mutants nobody killed, and why that was accepted
                   APPROVED     the approval marker

  RESIDUE        a transcript of a negotiation that has already concluded. It was worth
                 reading during the feature and in the PR; it is noise a year later, and it
                 is what every future agent greps through.
                   review-*.md  one per review round
                   hardening.md the hardener's full narrative report
                   placement.md the old in-specs home of the feature-envy report, which is
                                generated output and now lands in reports/ instead

Residue is not lost by pruning -- it stays in git history and in the PR. What IS lost is the
durable part buried inside hardening.md: the EQUIVALENT / UNTESTABLE / ACCEPTED survivor
verdicts. Delete those and the next hardener re-litigates the same mutants from scratch. So
this script REFUSES to prune hardening.md until specs/<slug>/survivors.md exists. Distilling
one into the other is a judgement call, which is why a human or an agent does it, not this
script.
"""
import subprocess
import sys
from pathlib import Path

LOAD_BEARING = ["plan.md", "feature.feature", "acceptance.sha256"]
DURABLE = ["request.md", "brief.md", "APPROVED", "hardening.sha256", "survivors.md"]
RESIDUE_GLOBS = ["review-*.md", "hardening.md", "placement.md"]


def dirty(path):
    """Paths under `path` with uncommitted changes. Pruning leans on git history."""
    result = subprocess.run(
        ["git", "status", "--porcelain", "--", str(path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return ["(git status failed -- is this a git repository?)"]
    return [line[3:] for line in result.stdout.splitlines() if line.strip()]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    apply = "--apply" in sys.argv[1:]
    if len(args) != 1:
        print("usage: ./scripts/spec-prune.py <feature-slug> [--apply]", file=sys.stderr)
        return 2
    slug = args[0]
    spec = Path("specs") / slug

    if not spec.is_dir():
        print("FAIL: %s does not exist." % spec)
        return 1

    errors = []

    missing = [n for n in LOAD_BEARING if not (spec / n).exists()]
    if missing:
        errors.append(
            "%s is missing %s. Those are read by the quality gate; a spec directory without "
            "them is not a finished feature, and pruning it would hide that."
            % (spec, ", ".join(missing))
        )

    residue = sorted({p for glob in RESIDUE_GLOBS for p in spec.glob(glob)})

    if (spec / "hardening.md").exists() and not (spec / "survivors.md").exists():
        errors.append(
            "%s/hardening.md exists but %s/survivors.md does not.\n"
            "       hardening.md carries the only record of which mutants were left alive and "
            "why\n"
            "       (EQUIVALENT / UNTESTABLE / ACCEPTED). Distil that list into survivors.md "
            "first --\n"
            "       one line per survivor, location and verdict -- then prune. Without it the "
            "next\n"
            "       hardener re-argues the same mutants from scratch." % (spec, spec)
        )

    unclean = dirty(spec)
    if unclean:
        errors.append(
            "%s has uncommitted changes (%s). Pruning relies on git history to keep the "
            "residue readable; commit first." % (spec, ", ".join(unclean))
        )

    for e in errors:
        print("FAIL: %s" % e)
    if errors:
        print("\nspec-prune: FAIL (%d error(s)), nothing deleted" % len(errors))
        return 1

    if not residue:
        print("spec-prune: nothing to prune in %s (already clean)" % spec)
        return 0

    kept = sorted(p.name for p in spec.iterdir() if p not in residue)
    print("%s" % spec)
    for name in kept:
        print("  keep    %s" % name)
    for path in residue:
        print("  %s %s" % ("DELETE " if apply else "delete ", path.name))

    if not apply:
        print("\nspec-prune: dry run. Re-run with --apply to delete %d file(s)." % len(residue))
        return 0

    for path in residue:
        path.unlink()
    print("\nspec-prune: deleted %d file(s). They remain in git history." % len(residue))
    return 0


if __name__ == "__main__":
    sys.exit(main())
