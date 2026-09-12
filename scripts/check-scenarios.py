#!/usr/bin/env python3
"""Check that every approved Gherkin scenario has an acceptance test claiming it.

Usage: ./scripts/check-scenarios.py <feature-slug>

The architect writes specs/<slug>/feature.feature. QA turns it into executable tests in
tests/acceptance/<slug>/ and locks them. Nothing else in the gate notices when a scenario
quietly fails to make that trip -- the suite passes, coverage passes, the locks pass, and a
slice of approved behaviour is simply not tested. This closes that hole.

The contract QA must follow (it is the convention QA already used):

    # @D2 @D3
    it('the usage text lists play and no longer lists hello', async () => { ... })

A scenario is claimed by a `describe(...)` or `it(...)` whose title is exactly the scenario
name, preceded by a comment line carrying the scenario's tags. A Scenario Outline is claimed
the same way -- usually a `describe` wrapping an `it.each`; the example rows are the test's
business, not this script's.

FAIL (exit 1):
  - a scenario in feature.feature that no test title claims
  - a scenario claimed by more than one test title
  - a claimed scenario whose tags disagree with the feature file's tags
  - a tagged test title that claims no scenario (a renamed or deleted scenario left behind)

Untagged describes and its are ignored entirely, so grouping blocks and the example-row
titles inside an `it.each` need no annotation.
"""
import re
import sys
from pathlib import Path

SCENARIO_RE = re.compile(r"^\s*Scenario(?: Outline)?\s*:\s*(.+?)\s*$")
TAG_LINE_RE = re.compile(r"^\s*(@\S+(?:\s+@\S+)*)\s*$")
COMMENT_TAG_RE = re.compile(r"^\s*//\s*(@\S+(?:\s+@\S+)*)\s*$")
# describe('...'), it('...'), it.each([...])('...'), describe.skip('...') -- we want the title.
TITLE_RE = re.compile(
    r"\b(?:describe|it|test)"          # the block keyword
    r"(?:\.\w+)?"                      # .each / .skip / .only
    r"(?:\([^)]*\))?"                  # the .each table, if any
    r"\s*\(\s*"
    r"(['\"`])(.*?)\1"                 # the title
)


def parse_feature(path):
    """[(scenario name, frozenset of tags, line number)] in file order."""
    scenarios = []
    pending = set()
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        tags = TAG_LINE_RE.match(line)
        if tags:
            pending |= set(tags.group(1).split())
            continue
        scenario = SCENARIO_RE.match(line)
        if scenario:
            scenarios.append((scenario.group(1), frozenset(pending), lineno))
        pending = set()
    return scenarios


def parse_tests(directory):
    """[(title, frozenset of tags, 'file:line')] for every TAGGED describe/it title."""
    claims = []
    for path in sorted(directory.rglob("*.ts")):
        pending = set()
        for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            line = raw.rstrip()
            if not line.strip():
                continue
            comment = COMMENT_TAG_RE.match(line)
            if comment:
                pending |= set(comment.group(1).split())
                continue
            title = TITLE_RE.search(line)
            if title:
                if pending:
                    claims.append((title.group(2), frozenset(pending), "%s:%d" % (path, lineno)))
                pending = set()
            elif not line.lstrip().startswith("//"):
                # Any other code between the tag comment and the block detaches the claim.
                pending = set()
    return claims


def main():
    if len(sys.argv) != 2:
        print("usage: ./scripts/check-scenarios.py <feature-slug>", file=sys.stderr)
        return 2
    slug = sys.argv[1]

    feature = Path("specs/%s/feature.feature" % slug)
    tests = Path("tests/acceptance/%s" % slug)
    if not feature.is_file():
        print("check-scenarios: SKIP (no %s)" % feature)
        return 0
    if not tests.is_dir():
        print("FAIL: %s exists but %s does not." % (feature, tests))
        print("\ncheck-scenarios: FAIL (1 error)")
        return 1

    scenarios = parse_feature(feature)
    claims = parse_tests(tests)
    errors = []

    by_title = {}
    for title, tags, where in claims:
        by_title.setdefault(title, []).append((tags, where))

    claimed = set()
    for name, tags, lineno in scenarios:
        matches = by_title.get(name)
        if not matches:
            errors.append(
                "%s:%d scenario %r has no acceptance test.\n"
                "       Add a describe() or it() with exactly that title in %s/,\n"
                "       preceded by a comment line: // %s"
                % (feature, lineno, name, tests, " ".join(sorted(tags)) or "@<tags>")
            )
            continue
        claimed.add(name)
        if len(matches) > 1:
            errors.append(
                "%s:%d scenario %r is claimed %d times: %s"
                % (feature, lineno, name, len(matches), ", ".join(w for _t, w in matches))
            )
        test_tags, where = matches[0]
        if test_tags != tags:
            errors.append(
                "%s tags %s but %s:%d tags the scenario %s."
                % (
                    where,
                    " ".join(sorted(test_tags)),
                    feature,
                    lineno,
                    " ".join(sorted(tags)) or "(none)",
                )
            )

    known = {name for name, _tags, _lineno in scenarios}
    for title, _tags, where in claims:
        if title not in known:
            errors.append(
                "%s claims scenario %r, which is not in %s "
                "(renamed or deleted scenario?)." % (where, title, feature)
            )

    for e in errors:
        print("FAIL: %s" % e)

    if errors:
        print("\ncheck-scenarios: FAIL (%d error(s))" % len(errors))
        return 1
    print(
        "check-scenarios: PASS (%d scenario(s), all claimed by a tagged acceptance test)"
        % len(scenarios)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
