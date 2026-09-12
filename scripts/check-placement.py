#!/usr/bin/env python3
"""Check that changed source files match the plan's module map.

Usage: ./scripts/check-placement.py <feature-slug>

The architect declares, in specs/<slug>/plan.md under "## Module map", every file the
feature will touch. This compares that declaration against what actually changed on the
branch (`git diff main...HEAD`).

FAIL (exit 1):
  - a changed or added file under src/ is not listed in the module map
  - a changed or added file under src/ sits in a directory that no rule in
    .dependency-cruiser.cjs mentions, so nothing constrains what it may import

WARN (exit 0):
  - a file the map marks new/changed was never touched
  - a key export named in the map is missing from the file

The point is not to stop the implementer from deviating -- plans are wrong sometimes.
It is to make every deviation visible instead of silent.
"""
import re
import subprocess
import sys
from pathlib import Path

CONFIG = Path(".dependency-cruiser.cjs")
BASE = "main"


def run_git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return result.stdout


def changed_src_files():
    """Files added or modified under src/ on this branch, relative to BASE."""
    merge_base = run_git("merge-base", BASE, "HEAD")
    if merge_base is None:
        return None
    out = run_git("diff", "--name-status", merge_base.strip(), "HEAD")
    if out is None:
        return None
    files = []
    for line in out.splitlines():
        parts = line.split("\t")
        status, path = parts[0], parts[-1]
        if status.startswith("D"):
            continue
        if path.startswith("src/") and path.endswith(".ts"):
            files.append(path)
    return sorted(set(files))


def covered_prefixes():
    """Path patterns from .dependency-cruiser.cjs that constrain something under src/.

    The bare `^src/` used by the black-box-test rule is dropped: it matches every source
    file, so counting it would make this check vacuous.
    """
    if not CONFIG.exists():
        return []
    text = CONFIG.read_text()
    patterns = set(re.findall(r'"(\^src/[^"]*)"', text))
    return sorted(p for p in patterns if p != "^src/")


def rule_covers(path, patterns):
    return any(re.search(p, path) for p in patterns)


def parse_module_map(plan_path, errors):
    """Rows of the '## Module map' table: {path: (status, responsibility, exports)}."""
    text = plan_path.read_text()
    section = re.search(r"^##\s+Module map\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    if section is None:
        errors.append(
            "plan.md has no '## Module map' section. The architect must declare every "
            "file the feature touches before the implementer starts."
        )
        return None

    rows = {}
    for line in section.group(1).splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 4:
            continue
        path = cells[0].strip("`").strip()
        if not path or path.lower() == "path" or set(path) <= set("-: "):
            continue
        rows[path] = (cells[1].lower(), cells[2], cells[3])
    if not rows:
        errors.append("'## Module map' has no table rows (columns: Path, Status, Responsibility, Key exports).")
        return None
    return rows


def missing_exports(path, declared):
    """Key exports named in the map that the file does not actually export."""
    source = Path(path)
    if not source.exists():
        return []
    text = source.read_text()
    missing = []
    for name in re.split(r"[,;]", declared):
        name = name.strip().strip("`").strip()
        if not name or name in {"-", "n/a", "none"}:
            continue
        name = re.sub(r"\(.*\)$", "", name).strip()
        if not re.search(r"\bexport\b[^\n]*\b%s\b" % re.escape(name), text):
            missing.append(name)
    return missing


def main():
    if len(sys.argv) != 2:
        print("usage: check-placement.py <feature-slug>", file=sys.stderr)
        return 2
    slug = sys.argv[1]
    plan_path = Path("specs") / slug / "plan.md"
    if not plan_path.exists():
        print("check-placement: no %s -- nothing to check" % plan_path)
        return 0

    errors, warnings = [], []
    rows = parse_module_map(plan_path, errors)
    if rows is None:
        for e in errors:
            print("FAIL: %s" % e)
        return 1

    changed = changed_src_files()
    if changed is None:
        print("check-placement: cannot diff against '%s' -- skipping" % BASE)
        return 0

    patterns = covered_prefixes()
    mapped = set(rows)

    for path in changed:
        if path not in mapped:
            errors.append(
                "%s changed but is not in the module map. Add it to plan.md (architect), "
                "or report the deviation -- do not leave it undeclared." % path
            )
        if patterns and not rule_covers(path, patterns):
            errors.append(
                "%s is in a directory no dependency rule covers. Nothing constrains what it "
                "may import. Propose a rule for it rather than editing "
                ".dependency-cruiser.cjs (human-owned)." % path
            )

    changed_set = set(changed)
    for path, (status, _resp, exports) in sorted(rows.items()):
        if status.startswith(("new", "changed")) and path not in changed_set:
            warnings.append("%s is planned as '%s' but was never touched." % (path, status))
        for name in missing_exports(path, exports):
            warnings.append("%s does not export '%s', which the module map names." % (path, name))

    for w in warnings:
        print("WARN: %s" % w)
    for e in errors:
        print("FAIL: %s" % e)

    if errors:
        print("\ncheck-placement: FAIL (%d error(s), %d warning(s))" % (len(errors), len(warnings)))
        return 1
    print("check-placement: PASS (%d file(s) checked, %d warning(s))" % (len(changed), len(warnings)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
