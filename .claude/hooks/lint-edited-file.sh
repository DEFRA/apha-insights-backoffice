#!/usr/bin/env bash
# Lints a file after Claude Code edits it: ESLint for JavaScript, ShellCheck for shell scripts.
# Exit code 2 sends the errors back to Claude so it fixes them straight away.

file=$(node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(JSON.parse(s).tool_input?.file_path ?? ""))')

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$file" in
  *.js | *.cjs | *.mjs)
    [[ -x node_modules/.bin/eslint ]] || exit 0
    output=$(node_modules/.bin/eslint --no-warn-ignored "$file" 2>&1) && exit 0
    tool=ESLint
    ;;
  *.sh | */.husky/pre-commit | */.husky/commit-msg)
    output=$(scripts/lint-shell.sh "$file" 2>&1) && exit 0
    tool=ShellCheck
    ;;
  *) exit 0 ;;
esac

echo "$tool found problems in $file. Fix them before moving on:" >&2
echo "$output" >&2
exit 2
