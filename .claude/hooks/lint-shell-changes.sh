#!/usr/bin/env bash
# Runs ESLint on JavaScript files that a shell command changed.
# "start" runs before the command and marks the time; "check" runs after it,
# lints the files changed since the mark, and exit code 2 sends any errors back to Claude.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
marker=$(git rev-parse --git-path claude-shell-start 2>/dev/null) || exit 0

if [[ "$1" = "start" ]]; then
  touch "$marker"
  exit 0
fi

[[ -f "$marker" ]] || exit 0
[[ -x node_modules/.bin/eslint ]] || exit 0

changed=()
while IFS= read -r file; do
  case "$file" in
    *.js | *.cjs | *.mjs) ;;
    *) continue ;;
  esac
  [[ -f "$file" && -n "$(find "$file" -newer "$marker")" ]] && changed+=("$file")
done < <({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u)

[[ ${#changed[@]} -eq 0 ]] && exit 0

if ! output=$(node_modules/.bin/eslint --no-warn-ignored "${changed[@]}" 2>&1); then
  echo "ESLint found problems in files changed by that command. Fix them before moving on:" >&2
  echo "$output" >&2
  exit 2
fi
