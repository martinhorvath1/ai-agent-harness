#!/usr/bin/env python3
"""CRAP score for this TypeScript/Node stack.

    CRAP(f) = complexity(f)^2 * (1 - coverage(f))^3 + complexity(f)

Two inputs, both produced by tooling the project already uses:

  complexity  ESLint's built-in `complexity` rule, re-run with `--rule
              '{"complexity":["error",0]}'` so that *every* function is reported,
              not only the ones over the gate's limit of 8. Same rule, same
              parser, same numbers a developer sees from `npm run lint`.

  coverage    coverage/coverage-final.json, the istanbul-format report written by
              `vitest run --coverage` (the `json` reporter). Each function's
              coverage is the fraction of its own statements that were executed;
              a statement belongs to the innermost function whose body contains
              it, so a helper nested inside a big function does not distort the
              parent's number.

ESLint sees more functions than the v8-derived coverage report does (inline
arrow callbacks are usually folded into their parent there). An ESLint function
with no matching coverage entry inherits the coverage of the innermost function
that encloses it, which is what the callback's execution actually tracks.

Usage:
    scripts/crap.py [--max 30] [--paths src] [--coverage coverage/coverage-final.json]
                    [--top 10] [--json]

Exits non-zero if any function scores above --max, so it can be wired into
pipeline.config as CRAP_CMD. Run it after the coverage command: it reads the
report, it does not produce it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass

COMPLEXITY_RE = re.compile(r"complexity of (\d+)")
NAME_RE = re.compile(r"^(?:Function|Method|Arrow function|Function expression|Getter|Setter)?\s*'?([A-Za-z0-9_$.#]+)'?\s+has a complexity")


@dataclass(frozen=True)
class Position:
    line: int
    column: int


@dataclass
class CoverageFn:
    name: str
    start: Position
    end: Position
    hits: int
    covered_statements: int = 0
    total_statements: int = 0

    @property
    def coverage(self) -> float:
        if self.total_statements:
            return self.covered_statements / self.total_statements
        return 1.0 if self.hits > 0 else 0.0

    def contains(self, pos: Position) -> bool:
        if pos.line < self.start.line or pos.line > self.end.line:
            return False
        if pos.line == self.start.line and pos.column < self.start.column:
            return False
        if pos.line == self.end.line and pos.column > self.end.column:
            return False
        return True

    @property
    def span(self) -> tuple[int, int]:
        return (self.end.line - self.start.line, self.end.column - self.start.column)


@dataclass
class Function:
    path: str
    line: int
    column: int
    name: str
    complexity: int
    coverage: float

    @property
    def crap(self) -> float:
        gap = 1.0 - self.coverage
        return self.complexity**2 * gap**3 + self.complexity


def die(message: str) -> "None":
    print(f"crap.py: {message}", file=sys.stderr)
    sys.exit(2)


# --------------------------------------------------------------------------- #
# ESLint: complexity per function
# --------------------------------------------------------------------------- #


def run_eslint(paths: list[str]) -> list[dict]:
    """Run ESLint with the complexity rule forced to report every function."""
    command = [
        "npx",
        "eslint",
        *paths,
        "--format",
        "json",
        "--rule",
        '{"complexity":["error",0]}',
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        die("npx not found; install Node.js and run `npm install` first")
    if not result.stdout.strip():
        die(f"eslint produced no output (exit {result.returncode})\n{result.stderr.strip()}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        die(f"could not parse eslint JSON output\n{result.stdout[:500]}")
    return []  # unreachable; keeps type checkers quiet


def parse_function_name(message: str) -> str:
    match = NAME_RE.match(message)
    return match.group(1) if match else "(anonymous)"


def eslint_functions(report: list[dict]) -> dict[str, list[tuple[Position, str, int]]]:
    """-> {absolute path: [(position, name, complexity), ...]}"""
    found: dict[str, list[tuple[Position, str, int]]] = {}
    for file_report in report:
        path = os.path.realpath(file_report["filePath"])
        for message in file_report.get("messages", []):
            if message.get("ruleId") != "complexity":
                continue
            match = COMPLEXITY_RE.search(message.get("message", ""))
            if not match:
                continue
            position = Position(message["line"], message["column"] - 1)
            entry = (position, parse_function_name(message["message"]), int(match.group(1)))
            found.setdefault(path, []).append(entry)
    return found


# --------------------------------------------------------------------------- #
# Istanbul coverage: coverage per function
# --------------------------------------------------------------------------- #


def load_coverage(path: str) -> dict[str, list[CoverageFn]]:
    if not os.path.exists(path):
        die(
            f"coverage report not found: {path}\n"
            "  run the coverage command first, and make sure vitest's coverage\n"
            "  reporter list in vitest.config.ts includes 'json'"
        )
    with open(path, encoding="utf-8") as handle:
        raw = json.load(handle)
    return {os.path.realpath(p): file_coverage(entry) for p, entry in raw.items()}


def file_coverage(entry: dict) -> list[CoverageFn]:
    functions = [
        CoverageFn(
            name=fn.get("name", "(anonymous)"),
            start=Position(fn["loc"]["start"]["line"], fn["loc"]["start"].get("column") or 0),
            end=Position(fn["loc"]["end"]["line"], fn["loc"]["end"].get("column") or 0),
            hits=int(entry.get("f", {}).get(key, 0)),
        )
        for key, fn in entry.get("fnMap", {}).items()
    ]
    assign_statements(entry, functions)
    return functions


def innermost(functions: list[CoverageFn], pos: Position) -> CoverageFn | None:
    enclosing = [fn for fn in functions if fn.contains(pos)]
    return min(enclosing, key=lambda fn: fn.span) if enclosing else None


def assign_statements(entry: dict, functions: list[CoverageFn]) -> None:
    """Credit each statement to the innermost function whose body contains it."""
    hits = entry.get("s", {})
    for key, loc in entry.get("statementMap", {}).items():
        position = Position(loc["start"]["line"], loc["start"].get("column") or 0)
        owner = innermost(functions, position)
        if owner is None:
            continue  # top-level statement, not part of any function
        owner.total_statements += 1
        if int(hits.get(key, 0)) > 0:
            owner.covered_statements += 1


# --------------------------------------------------------------------------- #
# Joining the two
# --------------------------------------------------------------------------- #


def coverage_for(position: Position, functions: list[CoverageFn]) -> float:
    """Coverage of the function declared at `position`, else of its enclosing function."""
    exact = [fn for fn in functions if fn.start.line == position.line]
    if exact:
        best = min(exact, key=lambda fn: abs(fn.start.column - position.column))
        return best.coverage
    enclosing = innermost(functions, position)
    return enclosing.coverage if enclosing is not None else 0.0


def collect(paths: list[str], coverage_path: str, root: str) -> list[Function]:
    by_file = eslint_functions(run_eslint(paths))
    coverage = load_coverage(coverage_path)
    functions: list[Function] = []
    for path, entries in sorted(by_file.items()):
        file_fns = coverage.get(path, [])
        for position, name, complexity in entries:
            functions.append(
                Function(
                    path=os.path.relpath(path, root),
                    line=position.line,
                    column=position.column + 1,
                    name=name,
                    complexity=complexity,
                    coverage=coverage_for(position, file_fns),
                )
            )
    functions.sort(key=lambda fn: (-fn.crap, fn.path, fn.line))
    return functions


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #


def print_table(functions: list[Function], limit: int, max_crap: float) -> None:
    header = f"{'CRAP':>7}  {'CPLX':>4}  {'COV':>6}  FUNCTION"
    print(header)
    print("-" * len(header))
    for fn in functions[:limit]:
        flag = "  <-- over limit" if fn.crap > max_crap else ""
        location = f"{fn.path}:{fn.line}"
        print(f"{fn.crap:7.1f}  {fn.complexity:4d}  {fn.coverage * 100:5.1f}%  {fn.name} ({location}){flag}")
    if len(functions) > limit:
        print(f"... and {len(functions) - limit} more (use --top 0 for all)")


def main() -> int:
    parser = argparse.ArgumentParser(description="CRAP score per function (TypeScript/Node).")
    parser.add_argument("--max", type=float, default=8.0, help="fail if any function scores above this (default: 8)")
    parser.add_argument("--paths", nargs="*", default=["src"], help="paths to lint (default: src)")
    parser.add_argument(
        "--coverage",
        default="coverage/coverage-final.json",
        help="istanbul-format coverage report (default: coverage/coverage-final.json)",
    )
    parser.add_argument("--top", type=int, default=10, help="rows to print, 0 for all (default: 10)")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = parser.parse_args()

    root = os.path.realpath(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=False
        ).stdout.strip()
        or os.getcwd()
    )
    os.chdir(root)

    functions = collect(args.paths, args.coverage, root)
    if not functions:
        die("no functions found; check --paths and that eslint is configured")

    over = [fn for fn in functions if fn.crap > args.max]

    if args.json:
        print(
            json.dumps(
                {
                    "max": args.max,
                    "functions": [
                        {
                            "file": fn.path,
                            "line": fn.line,
                            "name": fn.name,
                            "complexity": fn.complexity,
                            "coverage": round(fn.coverage, 4),
                            "crap": round(fn.crap, 2),
                        }
                        for fn in functions
                    ],
                },
                indent=2,
            )
        )
    else:
        print_table(functions, len(functions) if args.top == 0 else args.top, args.max)
        print()
        worst = functions[0]
        print(f"{len(functions)} functions, worst CRAP {worst.crap:.1f} ({worst.name}), limit {args.max:g}")

    if over:
        print(f"\nFAIL: {len(over)} function(s) above the CRAP limit of {args.max:g}", file=sys.stderr)
        for fn in over:
            print(f"  {fn.crap:.1f}  {fn.name} ({fn.path}:{fn.line})", file=sys.stderr)
        print(
            "\nLower it by simplifying the function (complexity) or by testing its\n"
            "branches (coverage). Coverage helps cubically; complexity hurts squared.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
