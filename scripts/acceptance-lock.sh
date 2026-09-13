#!/usr/bin/env bash
# Lock or verify a feature's locked test suites via checksums.
#
#   ./scripts/acceptance-lock.sh lock             <slug>   # QA, after writing acceptance tests
#   ./scripts/acceptance-lock.sh verify           <slug>   # gate / reviewer
#   ./scripts/acceptance-lock.sh lock-hardening   <slug>   # hardener, after writing its tests
#   ./scripts/acceptance-lock.sh verify-hardening <slug>   # gate / reviewer
#   ./scripts/acceptance-lock.sh unclaimed-hardening       # gate: any mutation test nobody locked
#
#   acceptance -> tests/acceptance/<slug>/              locked by specs/<slug>/acceptance.sha256
#   hardening  -> tests/unit/*.mutation.test.ts         locked by specs/<slug>/hardening.sha256
#
# Acceptance tests are a directory per feature, so the lock is a snapshot of that directory.
# Hardening tests are NOT: a mutation-killing test belongs beside the unit tests of the module
# it constrains (tests/unit/grid.mutation.test.ts next to tests/unit/grid.test.ts), so they
# share one directory and are identified by the .mutation.test.ts suffix instead. Ownership is
# still per-feature: a file already listed in another slug's lock is left to that slug, so a
# hardener working on feature B cannot silently re-lock a test written for feature A.
#
# verify detects modified, added, and deleted files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

HARDENING_DIR="tests/unit"
HARDENING_SUFFIX="*.mutation.test.ts"

cmd="${1:-}"; slug="${2:-}"
usage() {
  echo "usage: $0 lock|verify|lock-hardening|verify-hardening <feature-slug>" >&2
  echo "       $0 unclaimed-hardening" >&2
  exit 2
}
[[ -n "$cmd" ]] || usage

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi
}
lock_paths() {  # strip the checksum column off a lock file
  sed 's/^[0-9a-f]*[[:space:]]*//' "$1"
}
hardening_files() {
  find "$HARDENING_DIR" -type f -name "$HARDENING_SUFFIX" | LC_ALL=C sort
}

# ---------------------------------------------------------------------------
# acceptance: a directory snapshot

acceptance_snapshot() {
  find "$dir" -type f | LC_ALL=C sort | while IFS= read -r f; do hash_file "$f"; done
}

# ---------------------------------------------------------------------------
# hardening: every mutation test not already claimed by another slug's lock

hardening_snapshot() {
  local others f l other_slug
  others="$(
    for l in specs/*/hardening.sha256; do
      [[ -f "$l" ]] || continue
      other_slug="$(basename "$(dirname "$l")")"
      [[ "$other_slug" == "$slug" ]] && continue
      lock_paths "$l"
    done
  )"
  hardening_files | while IFS= read -r f; do
    grep -qxF -- "$f" <<<"$others" && continue
    hash_file "$f"
  done
}

do_lock_acceptance() {
  [[ -d "$dir" ]] || { echo "no acceptance tests at $dir" >&2; exit 1; }
  mkdir -p "specs/$slug"
  acceptance_snapshot > "$lock"
  echo "locked $(wc -l < "$lock" | tr -d ' ') file(s) -> $lock"
}

do_lock_hardening() {
  local snap; snap="$(hardening_snapshot)"
  [[ -n "$snap" ]] || {
    echo "no unclaimed $HARDENING_DIR/$HARDENING_SUFFIX files to lock for '$slug'" >&2; exit 1; }
  mkdir -p "specs/$slug"
  printf '%s\n' "$snap" > "$lock"
  echo "locked $(wc -l < "$lock" | tr -d ' ') file(s) -> $lock"
}

# Verifying re-hashes exactly the files this slug locked -- not the whole suffix glob, so a
# half-finished hardening round for another feature cannot fail this one. Files written but
# never locked are caught separately, by unclaimed-hardening.
hardening_verify_snapshot() {
  local f
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    if [[ -f "$f" ]]; then hash_file "$f"; else echo "MISSING  $f"; fi
  done < <(lock_paths "$lock")
}

do_verify() {  # compares a fresh snapshot against the lock
  [[ -f "$lock" ]] || { echo "FAIL: no lock file at $lock ($kind tests have not been locked)" >&2; exit 1; }
  local diffout; diffout="$(mktemp)"
  if diff <($snapshot_fn) "$lock" > "$diffout" 2>&1; then
    echo "PASS: $kind tests for '$slug' match the lock"
    rm -f "$diffout"
  else
    echo "FAIL: $kind tests for '$slug' changed since they were locked:" >&2
    cat "$diffout" >&2; rm -f "$diffout"
    exit 1
  fi
}

# Any mutation test that no slug has locked. Checked once by the gate rather than per slug, so
# that a half-finished hardening round for one feature does not fail another feature's lock.
do_unclaimed() {
  local claimed unclaimed f l
  claimed="$(for l in specs/*/hardening.sha256; do [[ -f "$l" ]] && lock_paths "$l"; done)"
  unclaimed=""
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    grep -qxF -- "$f" <<<"$claimed" || unclaimed+="$f"$'\n'
  done < <(hardening_files)
  if [[ -z "$unclaimed" ]]; then
    echo "PASS: every $HARDENING_SUFFIX file is covered by a hardening lock"
  else
    echo "FAIL: hardening tests written but never locked (run lock-hardening <slug>):" >&2
    printf '%s' "$unclaimed" >&2
    exit 1
  fi
}

case "$cmd" in
  lock|verify)                     kind="acceptance"; dir="tests/acceptance/$slug" ;;
  lock-hardening|verify-hardening) kind="hardening" ;;
  unclaimed-hardening)             do_unclaimed; exit 0 ;;
  *) echo "unknown command: $cmd" >&2; usage ;;
esac
[[ -n "$slug" ]] || usage
lock="specs/$slug/$kind.sha256"

case "$cmd" in
  lock)             do_lock_acceptance ;;
  lock-hardening)   do_lock_hardening ;;
  verify)           [[ -d "$dir" ]] || { echo "FAIL: $dir is missing" >&2; exit 1; }
                    snapshot_fn=acceptance_snapshot; do_verify ;;
  verify-hardening) snapshot_fn=hardening_verify_snapshot; do_verify ;;
esac
