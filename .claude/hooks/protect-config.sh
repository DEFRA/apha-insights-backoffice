#!/usr/bin/env bash
# Stops Claude Code changing the lint, hook and CI setup, however the change is made.
# "snapshot" runs before a tool call and saves the protected files; "check" runs after it,
# puts back anything the tool changed, and exit code 2 tells Claude why.
# Switching branch, pulling or rebasing moves HEAD and is allowed, but a new local commit
# that touches protected files is reported.
# Each session keeps its own snapshot, so sessions sharing a checkout cannot overwrite each
# other's. If the snapshot is missing or incomplete, "check" does nothing rather than revert.
# A protected file that is committed at HEAD is never deleted.
# Reverts and reports are recorded in the harness event log, see docs/harness.md.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

input=$(cat)
session=$(printf '%s' "$input" | node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => process.stdout.write(JSON.parse(s).session_id ?? ""))' 2>/dev/null)
session=${session//[^A-Za-z0-9_-]/}
stores=$(git rev-parse --git-path claude-protected 2>/dev/null) || exit 0
store="$stores/${session:-default}"

protected_paths=(
  eslint.config.js stylelint.config.js .prettierrc.js .prettierignore .shellcheckrc
  sonar-project.properties .claude/settings.json .claude/hooks .husky/pre-commit
  .husky/commit-msg scripts .github/workflows
)

list_protected_files() {
  local path
  for path in "${protected_paths[@]}"; do
    if [[ -d "$path" ]]; then
      find "$path" -type f
    elif [[ -f "$path" ]]; then
      printf '%s\n' "$path"
    fi
  done | sort
}

package_scripts() {
  node -p 'JSON.stringify(require("./package.json").scripts)' 2>/dev/null
}

# Records the block. The logger reads the session from the hook payload
log_event() {
  node scripts/log-harness-event.js --layer claude-hook --check protect-config --rule protected-config "$@" <<< "$input" 2>/dev/null
}

case "$1" in
  snapshot)
    mkdir -p "$stores" || exit 0
    # Remove stores left by sessions that ended more than a day ago
    find "$stores" -mindepth 1 -maxdepth 1 -mmin +1440 -exec rm -rf {} + 2>/dev/null
    # Build the snapshot aside and move it into place, so "check" never sees half of one
    tmp=$(mktemp -d "$stores/.tmp.XXXXXX") || exit 0
    mkdir -p "$tmp/files"
    git rev-parse HEAD > "$tmp/head"
    git config core.hooksPath > "$tmp/hooks-path"
    package_scripts > "$tmp/scripts"
    list_protected_files > "$tmp/list"
    while IFS= read -r file; do
      mkdir -p "$tmp/files/$(dirname "$file")"
      cp -p "$file" "$tmp/files/$file"
    done < "$tmp/list"
    rm -rf "${store:?}"
    mv "$tmp" "$store" || rm -rf "$tmp"
    exit 0
    ;;
  check) ;;
  *) exit 0 ;;
esac

# Fail open: without a complete snapshot there is nothing safe to compare against
for part in head hooks-path scripts list files; do
  [[ -e "$store/$part" ]] || exit 0
done
old_head=$(cat "$store/head")

if [[ "$(git rev-parse HEAD)" != "$old_head" ]]; then
  commits=$(git log --oneline "$old_head..HEAD" --not --remotes -- "${protected_paths[@]}" 2>/dev/null)
  [[ -z "$commits" ]] && exit 0
  log_event --outcome blocked --detail "new commits change protected files"
  echo "These new commits change files that set up linting, hooks or CI, which Claude Code must not change:" >&2
  echo "$commits" >&2
  echo "Tell the user. Do not push them unless the user asks for these changes." >&2
  exit 2
fi

changed=()
while IFS= read -r file; do
  if ! cmp -s "$file" "$store/files/$file"; then
    mkdir -p "$(dirname "$file")"
    if cp -p "$store/files/$file" "$file" 2>/dev/null; then
      changed+=("$file")
    fi
  fi
done < "$store/list"

# A file committed at HEAD is never removed: putting one back is not a change to stop
while IFS= read -r file; do
  if ! grep -qxF "$file" "$store/list" && ! git cat-file -e "HEAD:$file" 2>/dev/null; then
    rm -f "$file"
    changed+=("$file (new file removed)")
  fi
done < <(list_protected_files)

if [[ "$(package_scripts)" != "$(cat "$store/scripts")" ]]; then
  node -e '
    const fs = require("fs")
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
    pkg.scripts = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")' "$store/scripts"
  changed+=("package.json scripts")
fi

saved_hooks_path=$(cat "$store/hooks-path")
if [[ "$(git config core.hooksPath)" != "$saved_hooks_path" ]]; then
  if [[ -n "$saved_hooks_path" ]]; then
    git config core.hooksPath "$saved_hooks_path"
  else
    git config --unset core.hooksPath
  fi
  changed+=("git config core.hooksPath")
fi

[[ ${#changed[@]} -eq 0 ]] && exit 0

log_event --outcome reverted "${changed[@]/#/--file=}"
echo "These set up linting, hooks or CI, so Claude Code must not change them. The change was reverted:" >&2
printf -- '- %s\n' "${changed[@]}" >&2
echo "If the change is needed, ask the user to make it." >&2
exit 2
