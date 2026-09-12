#!/usr/bin/env python3
"""Mechanical gate for a feature spec.

Usage: ./scripts/check-spec.py <feature-slug>

Fails (exit 1) if:
  - brief.md is missing a required section, or "Open questions" is not empty
  - decision IDs are duplicated
  - any decision D<n> has no @D<n>-tagged scenario
  - any scenario has no decision tag, or references an unknown decision
  - feature.feature has no Feature: line or no scenarios
"""
import re
import sys
from pathlib import Path

REQUIRED_SECTIONS = ["Goal", "Decisions", "Assumptions", "Out of scope", "Glossary", "Open questions"]
EMPTY_MARKERS = {"none", "- none", "-", "n/a", "- n/a"}
SCENARIO_RE = re.compile(r"^\s*(Scenario Outline|Scenario Template|Scenario|Example):\s*(.*)$")


def strip_comments(text):
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def parse_sections(text):
    sections, current = {}, None
    for line in text.splitlines():
        m = re.match(r"^##\s+([^(]+?)\s*(\(.*\))?\s*$", line)
        if m:
            current = m.group(1).strip()
            sections[current] = []
        elif current:
            sections[current].append(line)
    return sections


def check_brief(path, errors):
    text = strip_comments(path.read_text())
    sections = parse_sections(text)
    for name in REQUIRED_SECTIONS:
        if name not in sections:
            errors.append(f"brief.md: missing section '## {name}'")

    open_q = [l.strip() for l in sections.get("Open questions", []) if l.strip()]
    if any(l.lower() not in EMPTY_MARKERS for l in open_q):
        errors.append("brief.md: 'Open questions' is not empty - resolve them before planning")

    ids = []
    for line in sections.get("Decisions", []):
        m = re.match(r"^\s*-\s*\**D(\d+)\**\s*:", line)
        if m:
            ids.append(int(m.group(1)))
    if not ids:
        errors.append("brief.md: no decisions found (expected lines like '- D1: ...')")
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        errors.append("brief.md: duplicate decision IDs: " + ", ".join(f"D{i}" for i in dupes))
    return set(ids)


def check_feature(path, errors):
    lines = path.read_text().splitlines()
    if not any(re.match(r"^\s*Feature:", l) for l in lines):
        errors.append("feature.feature: no 'Feature:' line")

    scenarios, pending = [], []
    for n, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("@"):
            pending += re.findall(r"@(\S+)", stripped)
            continue
        m = SCENARIO_RE.match(line)
        if m:
            d_tags = {int(t[1:]) for t in pending if re.fullmatch(r"D\d+", t)}
            scenarios.append((n, m.group(2).strip() or f"<unnamed, line {n}>", d_tags))
            pending = []
        elif re.match(r"^\s*(Feature|Rule|Examples|Scenarios):", line):
            pending = []  # tags on these don't count toward decision coverage

    if not scenarios:
        errors.append("feature.feature: no scenarios found")
    for n, name, tags in scenarios:
        if not tags:
            errors.append(f"feature.feature:{n}: scenario '{name}' has no @D<n> decision tag")
    return scenarios


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    slug = sys.argv[1]
    spec = Path("specs") / slug
    brief, feature = spec / "brief.md", spec / "feature.feature"

    errors = []
    for p in (brief, feature):
        if not p.exists():
            errors.append(f"missing file: {p}")
    if errors:
        print("\n".join("FAIL  " + e for e in errors))
        sys.exit(1)

    decisions = check_brief(brief, errors)
    scenarios = check_feature(feature, errors)

    covered = set().union(*(t for _, _, t in scenarios)) if scenarios else set()
    for d in sorted(decisions - covered):
        errors.append(f"coverage: D{d} has no scenario tagged @D{d}")
    for d in sorted(covered - decisions):
        errors.append(f"coverage: @D{d} is used in feature.feature but D{d} is not in the brief")

    print(f"Decision coverage for '{slug}':")
    for d in sorted(decisions):
        names = [name for _, name, tags in scenarios if d in tags]
        print(f"  D{d}: {len(names)} scenario(s)" + (f"  <- {'; '.join(names)}" if names else ""))

    if errors:
        print()
        print("\n".join("FAIL  " + e for e in errors))
        sys.exit(1)
    print("\nPASS  spec is consistent")


if __name__ == "__main__":
    main()
