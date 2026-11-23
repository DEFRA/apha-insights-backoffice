#!/usr/bin/env bash
# Blocks `gh pr create` and `gh pr edit` when --title is not a Conventional Commits message.
# PRs are squash-merged, so the title becomes the commit on main. Exit code 2 sends the reason back to Claude.

title=$(node "$(dirname "$0")/extract-pr-title.js")

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
