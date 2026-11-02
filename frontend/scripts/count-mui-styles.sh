#!/usr/bin/env bash
# Progress tracker for the @mui/styles removal (issue #2290).
#   scripts/count-mui-styles.sh          -> prints the number of files still importing @mui/styles
#   scripts/count-mui-styles.sh --list   -> prints those files (relative to frontend/)
#   scripts/count-mui-styles.sh --json   -> prints them as a JSON array (used for the ESLint allowlist)
set -euo pipefail
cd "$(dirname "$0")/.."

files=$(grep -rlF "@mui/styles" src pages public \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' | sort || true)

case "${1:-}" in
  --list) echo "$files" ;;
  --json)
    echo "$files" | awk 'BEGIN{print "["} NF{printf "%s  \"%s\"", (n++ ? ",\n" : ""), $0} END{print "\n]"}'
    ;;
  *) echo "$files" | grep -c . || true ;;
esac
