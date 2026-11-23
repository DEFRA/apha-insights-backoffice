#!/usr/bin/env bash
# Lints files that a shell command changed: ESLint for JavaScript, ShellCheck for shell scripts.
# "start" runs before the command and marks the time; "check" runs after it,
# lints the files changed since the mark, and exit code 2 sends any errors back to Claude.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
marker=$(git rev-parse --git-path claude-shell-start 2>/dev/null) || exit 0

if [[ "$1" = "start" ]]; then
  touch "$marker"
  exit 0
fi

[[ -f "$marker" ]] || exit 0

js_files=()
shell_files=()
while IFS= read -r file; do
  [[ -f "$file" && -n "$(find "$file" -newer "$marker")" ]] || continue
  case "$file" in
    *.js | *.cjs | *.mjs) js_files+=("$file") ;;
    *.sh | .husky/pre-commit | .husky/commit-msg) shell_files+=("$file") ;;
    *) ;;
  esac
done < <({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u)

output=""
if [[ ${#js_files[@]} -gt 0 && -x node_modules/.bin/eslint ]]; then
  output+=$(node_modules/.bin/eslint --no-warn-ignored "${js_files[@]}" 2>&1) || failed=1
fi
if [[ ${#shell_files[@]} -gt 0 ]]; then
  output+=$(scripts/lint-shell.sh "${shell_files[@]}" 2>&1) || failed=1
fi

if [[ -n "${failed:-}" ]]; then
  echo "Lint found problems in files changed by that command. Fix them before moving on:" >&2
  echo "$output" >&2
  exit 2
fi
