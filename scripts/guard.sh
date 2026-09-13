#!/usr/bin/env bash
# Role-based PreToolUse hook. Wire it into an agent's frontmatter:
#
#   hooks:
#     PreToolUse:
#       - matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash"
#         hooks:
#           - type: command
#             command: "./scripts/guard.sh implementer"
#
# Reads the hook JSON on stdin. Exit 0 = allow, exit 2 = block (stderr goes to the agent).
#
# Every writing agent owns exactly one category of files, and no agent grades its own work:
#   architect   owns specs/<slug>/ -- it has a Write tool, so it needs a guard like the rest
#   qa          owns tests/acceptance/<slug>/
#   implementer owns src/ and tests/unit/, EXCEPT tests/unit/*.mutation.test.ts
#   hardener    owns tests/unit/*.mutation.test.ts -- mutation-killing tests live beside the
#               unit tests of the same module, not in a tree of their own; ownership is by
#               filename suffix so the hook can still enforce it
#   gate configuration (scripts/, .claude/, pipeline.config, lint/ts/vitest/stryker/
#   dependency-cruiser configs, package.json, lockfiles, *.sha256) is owned by humans only.
#
# The checksum verify in the quality gate is the second line of defense.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

role="${1:-}"
if [[ -z "$role" ]]; then
  echo "guard.sh: usage: $0 <architect|implementer|hardener|qa>" >&2
  exit 2
fi

python3 -c "$(cat <<'PY'
import fnmatch
import json
import os
import re
import sys

role = sys.argv[1]

# Gate configuration: humans only. No agent may change how it is graded.
GATE_FILES = [
    "pipeline.config", "scripts/", ".claude/",
    "eslint.config*", "tsconfig*", "vitest.config*", "stryker.config*",
    ".dependency-cruiser*",
    "package.json", "package-lock.json", "*.sha256",
]

# Files each role must not touch, on top of GATE_FILES.
ROLE_FILES = {
    "architect":   ["src/", "tests/"],
    "implementer": ["tests/acceptance/", "*.mutation.test.ts"],
    "hardener":    ["src/", "tests/unit/", "tests/acceptance/"],
    "qa":          ["src/", "tests/unit/", "*.mutation.test.ts"],
}

# Carve-outs checked BEFORE the deny list: hardening tests sit inside a directory the hardener is
# otherwise locked out of, so the suffix has to win over "tests/unit/". Written as
# <dir>/*<suffix> and matched as both, so the carve-out cannot be used to reach outside the
# unit test directory.
ROLE_ALLOW = {
    "hardener": ["tests/unit/*.mutation.test.ts"],
}

OWNER = {
    "tests/":              "QA, the implementer and the hardener",
    "tests/acceptance/":   "QA",
    "*.mutation.test.ts":  "the hardener",
    "src/":                "the implementer",
    "tests/unit/":         "the implementer",
}

if role not in ROLE_FILES:
    print("guard.sh: unknown role %r (expected one of: %s)"
          % (role, ", ".join(sorted(ROLE_FILES))), file=sys.stderr)
    sys.exit(2)

PROTECTED = GATE_FILES + ROLE_FILES[role]
ALLOWED = ROLE_ALLOW.get(role, [])

ADVICE = ("Stop and report what you need changed and why. Do not work around this block.")


def reason(pattern):
    if pattern in OWNER:
        return ("%s is owned by %s and is locked. You are the %s."
                % (pattern, OWNER[pattern], role))
    return ("%s is gate configuration, owned by humans only. "
            "No agent may change how its own work is graded." % pattern)


def block(what, pattern):
    print("BLOCKED (%s): %s\n%s\n%s" % (role, what, reason(pattern), ADVICE), file=sys.stderr)
    sys.exit(2)


def normalize(path):
    path = (path or "").replace("\\", "/")
    if path.startswith("/"):
        try:
            path = os.path.relpath(path, os.getcwd()).replace("\\", "/")
        except ValueError:
            pass
    while path.startswith("./"):
        path = path[2:]
    return path


def path_matches(path, pattern):
    """True if `path` lies inside (or is) a protected pattern."""
    norm = normalize(path)
    if pattern.endswith("/"):
        stem = pattern.rstrip("/")
        return (norm == stem
                or norm.startswith(stem + "/")
                or ("/" + stem + "/") in ("/" + norm))
    base = norm.rsplit("/", 1)[-1]
    if "*" in pattern:
        return fnmatch.fnmatch(base, pattern)
    return base == pattern


def allow_matches(path, allow):
    """True if `path` is a file the role is explicitly allowed to write."""
    directory, _, suffix_glob = allow.rpartition("/")
    norm = normalize(path)
    return (norm.startswith(directory + "/")
            and "/" not in norm[len(directory) + 1:]
            and fnmatch.fnmatch(norm.rsplit("/", 1)[-1], suffix_glob))


def allow_regex(allow):
    """Regex matching a whole allowed path token inside a shell command."""
    directory, _, suffix_glob = allow.rpartition("/")
    return re.compile(re.escape(directory + "/")
                      + r"[\w.-]*" + re.escape(suffix_glob.lstrip("*")))


def command_regex(pattern):
    """Regex that finds a mention of `pattern` inside a shell command."""
    if pattern.endswith("/"):
        body = re.escape(pattern.rstrip("/"))
    elif pattern == "*.sha256":
        return re.compile(r"[\w./-]*\.sha256")
    elif "*" in pattern:
        body = re.escape(pattern.rstrip("*")) + r"[\w.-]*"
    else:
        body = re.escape(pattern)
    return re.compile(r"(?<![\w-])" + body + r"(?![\w-])")


# Write operations. Plain reads and test runs (including `2>&1`) are deliberately allowed.
WRITE_OPS = re.compile(
    r"(?<![0-9&])>(?!&)|\btee\b|\bsed\s+-i|\bperl\s+-i|\brm\b|\bmv\b|\bcp\b|\btouch\b|"
    r"\btruncate\b|\bpatch\b|\bchmod\b|\bgit\s+(checkout|restore|rm|mv|stash)\b")

RELOCK = re.compile(r"acceptance-lock\.sh\s+lock(?![\w-])")
RELOCK_HARDENING = re.compile(r"acceptance-lock\.sh\s+lock-hardening(?![\w-])")
DEPS = re.compile(
    r"(?<![\w-])npm\s+(i|install|add|uninstall|remove|rm|un)(?![\w-])|"
    r"(?<![\w-])pnpm\s+(i|install|add|remove|rm|un)(?![\w-])|"
    r"(?<![\w-])yarn\s+(add|remove)(?![\w-])")

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
ti = data.get("tool_input") or {}

if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    path = ti.get("file_path") or ti.get("notebook_path") or ""
    if any(allow_matches(path, a) for a in ALLOWED):
        sys.exit(0)
    for pattern in PROTECTED:
        if path_matches(path, pattern):
            block("writing %s is not allowed." % normalize(path), pattern)

elif tool == "Bash":
    cmd = ti.get("command", "")

    # Remove whole path tokens the role is allowed to write, so that a command like
    # `cat > tests/unit/grid.mutation.test.ts` no longer reads as a mention of tests/unit/.
    for allow in ALLOWED:
        cmd = allow_regex(allow).sub("", cmd)

    if RELOCK_HARDENING.search(cmd):
        if role != "hardener":
            block("re-locking hardening tests is not allowed.", "*.mutation.test.ts")
    elif RELOCK.search(cmd):
        if role != "qa":
            block("re-locking acceptance tests is not allowed.", "tests/acceptance/")

    if DEPS.search(cmd):
        print("BLOCKED (%s): changing dependencies is not allowed.\n"
              "package.json and package-lock.json are gate configuration, owned by humans only.\n"
              "%s" % (role, ADVICE), file=sys.stderr)
        sys.exit(2)

    if WRITE_OPS.search(cmd):
        for pattern in PROTECTED:
            if command_regex(pattern).search(cmd):
                block("shell commands that modify %s are not allowed." % pattern, pattern)

sys.exit(0)
PY
)" "$role"
