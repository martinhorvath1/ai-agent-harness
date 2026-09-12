#!/usr/bin/env bash
# Lock or verify a feature's locked test suites via checksums.
#
#   ./scripts/acceptance-lock.sh lock             <slug>   # QA, after writing acceptance tests
#   ./scripts/acceptance-lock.sh verify           <slug>   # gate / reviewer
#   ./scripts/acceptance-lock.sh lock-hardening   <slug>   # hardener, after writing its tests
#   ./scripts/acceptance-lock.sh verify-hardening <slug>   # gate / reviewer
#
#   acceptance -> tests/acceptance/<slug>/  locked by specs/<slug>/acceptance.sha256
#   hardening  -> tests/hardening/<slug>/   locked by specs/<slug>/hardening.sha256
#
# verify detects modified, added, and deleted files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cmd="${1:-}"; slug="${2:-}"
usage() { echo "usage: $0 lock|verify|lock-hardening|verify-hardening <feature-slug>" >&2; exit 2; }
[[ -n "$cmd" && -n "$slug" ]] || usage

case "$cmd" in
  lock|verify)                     kind="acceptance"; dir="tests/acceptance/$slug" ;;
  lock-hardening|verify-hardening) kind="hardening";  dir="tests/hardening/$slug"  ;;
  *) echo "unknown command: $cmd" >&2; usage ;;
esac
lock="specs/$slug/$kind.sha256"

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi
}
snapshot() {
  find "$dir" -type f | LC_ALL=C sort | while IFS= read -r f; do hash_file "$f"; done
}

do_lock() {
  [[ -d "$dir" ]] || { echo "no $kind tests at $dir" >&2; exit 1; }
  mkdir -p "specs/$slug"
  snapshot > "$lock"
  echo "locked $(wc -l < "$lock" | tr -d ' ') file(s) -> $lock"
}

do_verify() {
  [[ -f "$lock" ]] || { echo "FAIL: no lock file at $lock ($kind tests have not been locked)" >&2; exit 1; }
  [[ -d "$dir" ]] || { echo "FAIL: $dir is missing" >&2; exit 1; }
  local diffout; diffout="$(mktemp)"
  if diff <(snapshot) "$lock" > "$diffout" 2>&1; then
    echo "PASS: $kind tests for '$slug' match the lock"
    rm -f "$diffout"
  else
    echo "FAIL: $kind tests for '$slug' changed since they were locked:" >&2
    cat "$diffout" >&2; rm -f "$diffout"
    exit 1
  fi
}

case "$cmd" in
  lock|lock-hardening)     do_lock ;;
  verify|verify-hardening) do_verify ;;
esac
