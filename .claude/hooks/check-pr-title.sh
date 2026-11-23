#!/usr/bin/env bash
# Blocks `gh pr create` and `gh pr edit` when --title is not a Conventional Commits message.
# PRs are squash-merged, so the title becomes the commit on main. Exit code 2 sends the reason back to Claude.

title=$(node -e '
let s = ""
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const command = JSON.parse(s).tool_input?.command ?? ""
  if (!/\bgh\s+pr\s+(create|edit)\b/.test(command)) return
  const m = command.match(/(?:^|\s)(?:--title|-t)(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'"'"'([^'"'"']*)'"'"'|(\S+))/)
  if (!m) return
  process.stdout.write((m[1]?.replace(/\\(.)/g, "$1")) ?? m[2] ?? m[3])
})')

[[ -n "$title" ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
message_file=$(mktemp)
printf '%s\n' "$title" > "$message_file"

if ! output=$(sh .husky/commit-msg "$message_file" 2>&1); then
  rm -f "$message_file"
  echo "PR titles become the squash commit on main, so they must follow Conventional Commits." >&2
  echo "$output" >&2
  exit 2
fi

rm -f "$message_file"
