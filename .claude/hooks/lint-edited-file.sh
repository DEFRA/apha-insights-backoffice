#!/usr/bin/env bash
# Runs ESLint on a JavaScript file after Claude Code edits it.
# Exit code 2 sends the errors back to Claude so it fixes them straight away.

file=$(node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(JSON.parse(s).tool_input?.file_path ?? ""))')

case "$file" in
  *.js | *.cjs | *.mjs) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -x node_modules/.bin/eslint ] || exit 0

if ! output=$(node_modules/.bin/eslint --no-warn-ignored "$file" 2>&1); then
  echo "ESLint found problems in $file. Fix them before moving on:" >&2
  echo "$output" >&2
  exit 2
fi
