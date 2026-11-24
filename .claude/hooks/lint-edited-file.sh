#!/usr/bin/env bash
# Lints a file after Claude Code edits it: ESLint for JavaScript, ShellCheck for shell scripts.
# Exit code 2 sends the errors back to Claude so it fixes them straight away.
# Each failure is recorded in the harness event log, see docs/harness.md.

input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(JSON.parse(s).tool_input?.file_path ?? ""))')

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Records the failure. The arguments point at a report the logger reads rule IDs from.
# The payload goes in as a here-string: bash 3.2 closes a <(...) report inside a function's pipeline
log_event() {
  node scripts/log-harness-event.js --layer claude-hook --check lint-edited-file --outcome blocked "$@" <<< "$input" 2>/dev/null
}

if ! output=$(scripts/check-suppressions.sh "$file" 2>&1); then
  log_event --suppressions-report <(printf '%s\n' "$output")
  echo "$output" >&2
  exit 2
fi

case "$file" in
  *.js | *.cjs | *.mjs)
    [[ -x node_modules/.bin/eslint ]] || exit 0
    output=$(node_modules/.bin/eslint --no-warn-ignored "$file" 2>&1) && exit 0
    log_event --eslint-report <(node_modules/.bin/eslint --no-warn-ignored --format json "$file" 2>/dev/null)
    tool=ESLint
    ;;
  *.sh | */.husky/pre-commit | */.husky/commit-msg)
    output=$(scripts/lint-shell.sh "$file" 2>&1) && exit 0
    log_event --shellcheck-report <(scripts/lint-shell.sh --format=json1 "$file" 2>/dev/null)
    tool=ShellCheck
    ;;
  *) exit 0 ;;
esac

echo "$tool found problems in $file. Fix them before moving on:" >&2
echo "$output" >&2
exit 2
