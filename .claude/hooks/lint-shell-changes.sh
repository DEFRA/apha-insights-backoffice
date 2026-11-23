#!/usr/bin/env bash
# Lints files that a shell command changed: ESLint for JavaScript, ShellCheck for shell scripts.
# "start" runs before the command and marks the time; "check" runs after it,
# lints the files changed since the mark, and exit code 2 sends any errors back to Claude.
# Failures are recorded in the harness event log, see docs/harness.md.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
marker=$(git rev-parse --git-path claude-shell-start 2>/dev/null) || exit 0

if [[ "$1" = "start" ]]; then
  touch "$marker"
  exit 0
fi

[[ -f "$marker" ]] || exit 0

all_files=()
js_files=()
shell_files=()
while IFS= read -r file; do
  [[ -f "$file" && -n "$(find "$file" -newer "$marker")" ]] || continue
  all_files+=("$file")
  case "$file" in
    *.js | *.cjs | *.mjs) js_files+=("$file") ;;
    *.sh | .husky/pre-commit | .husky/commit-msg) shell_files+=("$file") ;;
    *) ;;
  esac
done < <({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u)

suppressions=""
if [[ ${#all_files[@]} -gt 0 ]]; then
  suppressions=$(scripts/check-suppressions.sh "${all_files[@]}" 2>&1) || failed=1
fi
output=$suppressions
if [[ ${#js_files[@]} -gt 0 && -x node_modules/.bin/eslint ]]; then
  output+=$(node_modules/.bin/eslint --no-warn-ignored "${js_files[@]}" 2>&1) || { failed=1; eslint_failed=1; }
fi
if [[ ${#shell_files[@]} -gt 0 ]]; then
  output+=$(scripts/lint-shell.sh "${shell_files[@]}" 2>&1) || { failed=1; shell_failed=1; }
fi

[[ -n "${failed:-}" ]] || exit 0

# The hook payload is still on stdin, so the logger reads the session from it
node scripts/log-harness-event.js --layer claude-hook --check lint-shell-changes --outcome blocked \
  --suppressions-report <(printf '%s\n' "$suppressions") \
  --eslint-report <([[ -n "${eslint_failed:-}" ]] && node_modules/.bin/eslint --no-warn-ignored --format json "${js_files[@]}" 2>/dev/null) \
  --shellcheck-report <([[ -n "${shell_failed:-}" ]] && scripts/lint-shell.sh --format=json1 "${shell_files[@]}" 2>/dev/null) \
  2>/dev/null

echo "Lint found problems in files changed by that command. Fix them before moving on:" >&2
echo "$output" >&2
exit 2
