#!/usr/bin/env bash
# Fails if code contains comments that switch off a lint or analysis rule.
# Checks the given files, or every tracked and untracked file when none are given.
# Exceptions belong in the tool's config file, where they are reviewed.

pattern='eslint-disable|eslint-enable|/\*[[:space:]]*eslint[[:space:]]|shellcheck[[:space:]]+disable|stylelint-disable|NOSONAR'

if [[ $# -gt 0 ]]; then
  files=()
  for file in "$@"; do
    case "$file" in
      *.md | */check-suppressions.sh | check-suppressions.sh) ;;
      *) [[ -f "$file" ]] && files+=("$file") ;;
    esac
  done
  [[ ${#files[@]} -eq 0 ]] && exit 0
  matches=$(grep -nHE "$pattern" "${files[@]}")
else
  matches=$(git grep --untracked -nE "$pattern" -- . ':!*.md' ':!scripts/check-suppressions.sh')
fi

[[ -z "$matches" ]] && exit 0

echo "Comments that switch off lint or analysis rules are not allowed. Fix the code, or ask the user to add an exception to the tool's config:" >&2
echo "$matches" >&2
exit 1
