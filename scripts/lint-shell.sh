#!/usr/bin/env bash
# Runs ShellCheck on the given files, or on every shell script in the repo when none are given.
# require-double-brackets matches SonarCloud rule S7688.
# A missing ShellCheck fails in CI but only warns locally.

if ! command -v shellcheck >/dev/null; then
  if [[ -n "${CI:-}" ]]; then
    echo "ShellCheck is required in CI but is not installed" >&2
    exit 1
  fi
  echo "ShellCheck is not installed, so shell scripts were not checked. Install it with: brew install shellcheck" >&2
  exit 0
fi

files=("$@")
if [[ ${#files[@]} -eq 0 ]]; then
  files=(.claude/hooks/*.sh scripts/*.sh .husky/pre-commit .husky/commit-msg)
fi

shellcheck --enable=require-double-brackets "${files[@]}"
