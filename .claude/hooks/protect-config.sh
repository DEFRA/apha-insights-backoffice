#!/usr/bin/env bash
# Stops Claude Code changing the lint, hook and CI setup, however the change is made.
# "snapshot" runs before a tool call and saves the protected files; "check" runs after it,
# puts back anything the tool changed, and exit code 2 tells Claude why.
# Switching branch, pulling or rebasing moves HEAD and is allowed, but a new local commit
# that touches protected files is reported.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
store=$(git rev-parse --git-path claude-protected 2>/dev/null) || exit 0

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

case "$1" in
  snapshot)
    rm -rf "${store:?}"
    mkdir -p "$store/files"
    git rev-parse HEAD > "$store/head"
    git config core.hooksPath > "$store/hooks-path"
    package_scripts > "$store/scripts"
    list_protected_files > "$store/list"
    while IFS= read -r file; do
      mkdir -p "$store/files/$(dirname "$file")"
      cp -p "$file" "$store/files/$file"
    done < "$store/list"
    exit 0
    ;;
  check) ;;
  *) exit 0 ;;
esac

[[ -f "$store/head" ]] || exit 0
old_head=$(cat "$store/head")

if [[ "$(git rev-parse HEAD)" != "$old_head" ]]; then
  commits=$(git log --oneline "$old_head..HEAD" --not --remotes -- "${protected_paths[@]}" 2>/dev/null)
  [[ -z "$commits" ]] && exit 0
  echo "These new commits change files that set up linting, hooks or CI, which Claude Code must not change:" >&2
  echo "$commits" >&2
  echo "Tell the user. Do not push them unless the user asks for these changes." >&2
  exit 2
fi

changed=()
while IFS= read -r file; do
  if ! cmp -s "$file" "$store/files/$file"; then
    mkdir -p "$(dirname "$file")"
    cp -p "$store/files/$file" "$file"
    changed+=("$file")
  fi
done < "$store/list"

while IFS= read -r file; do
  if ! grep -qxF "$file" "$store/list"; then
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

echo "These set up linting, hooks or CI, so Claude Code must not change them. The change was reverted:" >&2
printf -- '- %s\n' "${changed[@]}" >&2
echo "If the change is needed, ask the user to make it." >&2
exit 2
