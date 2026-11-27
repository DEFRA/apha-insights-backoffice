# Harness feedback loop

The repo has many automated rules: ESLint, ShellCheck, a suppression check, git hooks, Claude Code hooks and SonarCloud. This page lists them, explains how we record which rules fire, how to read that record, and how agents propose new rules.

## Rules

Each rule runs in one or more places. In Claude Code, a failure goes back to Claude to fix straight away. In a git hook, it rejects the commit. In CI, it stops the pull request merging.

| Rule                    | What it enforces                                                                                       | Claude Code      | Git hook   | CI  | Logged as                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- | ---------- | --- | ------------------------------------------------ |
| JavaScript lint         | ESLint with neostandard and SonarCloud's rules. Inline directive comments are ignored                  | Edit, command    | pre-commit | Yes | ESLint rule ID, or `lint` from pre-commit        |
| Code conventions        | In `src/`: settings only through `config.js`, named exports only, shared constants in `src/constants/` | Edit, command    | pre-commit | Yes | ESLint rule ID, or `lint` from pre-commit        |
| Shell lint              | ShellCheck, with double brackets required                                                              | Edit, command    | pre-commit | Yes | ShellCheck `SC` code, or `lint` from pre-commit  |
| SCSS lint               | Stylelint with the GDS config                                                                          | No               | pre-commit | Yes | `lint`                                           |
| Formatting              | Prettier                                                                                               | No               | pre-commit | Yes | `format`                                         |
| No suppression comments | No `eslint-disable`, `shellcheck disable`, `stylelint-disable` or `NOSONAR`                            | Edit, command    | pre-commit | Yes | `suppression-comment`, or `lint` from pre-commit |
| Conventional Commits    | Commit messages and pull request titles                                                                | PR title         | commit-msg | No  | `conventional-commits`                           |
| Protected config        | Claude Code cannot change the lint, hook or CI setup. Changes are reverted                             | Every tool call  | No         | No  | `protected-config`                               |
| No bypassing hooks      | Claude Code cannot run `--no-verify`, `HUSKY=0` or change `core.hooksPath`                             | Refused          | No         | No  | Not logged                                       |
| Tests                   | `npm test` passes                                                                                      | No               | No         | Yes | Not logged                                       |
| SonarCloud quality gate | No new critical issues, reliability A, 90% coverage on new code                                        | After `git push` | No         | Yes | SonarCloud rule key, or `gate:<metric>`          |
| Dependency audit        | No critical npm vulnerabilities                                                                        | No               | No         | Yes | Not logged                                       |
| Auto mode refusal       | Claude Code's auto mode refused a tool call                                                            | Refused          | No         | No  | The refusal's category, or `auto-mode-denied`    |

In the Claude Code column, "Edit" is `lint-edited-file.sh` after Claude edits a file, and "command" is `lint-shell-changes.sh` on the files a shell command changed. The hooks are set up in `.claude/settings.json`. The conventions behind these rules are in [conventions.md](conventions.md).

## Event log

Every block, rejection or revert is appended to a JSON Lines file inside `.git`, so it is never committed. Each clone and worktree has its own log:

```bash
git rev-parse --git-path claude-harness/events.jsonl
```

There is one line per rule that fired:

```json
{
  "ts": "2026-11-23T16:40:00Z",
  "layer": "claude-hook",
  "check": "lint-edited-file",
  "outcome": "blocked",
  "actor": "claude-code",
  "session": "<session_id>",
  "model": "claude-opus-5-5",
  "tool": "Edit",
  "rule": "no-restricted-exports",
  "files": ["src/utils/x.js"]
}
```

| Field     | Meaning                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `layer`   | `claude-hook`, `claude-deny` (Claude Code's auto mode refused the tool call) or `git-hook`                 |
| `check`   | The hook or script that fired, such as `lint-edited-file` or `pre-commit`                                  |
| `outcome` | `blocked` (Claude was stopped), `reverted` (a change was put back) or `rejected` (a commit or push failed) |
| `actor`   | `claude-code` when it happened in a Claude Code session, otherwise `person`                                |
| `session` | The Claude Code session ID, where there is one                                                             |
| `model`   | The model the session was using, read from the session transcript                                          |
| `rule`    | An ESLint rule ID, ShellCheck `SC` code, SonarCloud rule key, `gate:<metric>`, or one of the harness rules |
| `files`   | Files the rule fired on, where known                                                                       |
| `detail`  | Extra context, such as the suppression comment that was found                                              |

The harness rules are `suppression-comment`, `conventional-commits`, `protected-config`, and `format` and `lint` from the pre-commit hook. See [Rules](#rules) for where each one runs.

`scripts/log-harness-event.js` writes the log, and every hook calls it. If writing fails, the hook carries on as normal. Nothing is logged in CI, or when `HARNESS_LOG=0` is set.

### What is not logged

- **Claude Code `deny` rules** in `.claude/settings.json`. Claude Code runs no hook when one of these refuses a tool call. Only auto mode refusals reach the `PermissionDenied` hook
- **Which ESLint rule failed in the pre-commit hook.** It records `lint` or `format`, not the rule ID
- **CI and SonarCloud history.** SonarCloud keeps issue history per rule. The `sonar-quality-gate` check only logs what Claude Code was told after a push

## Report

```bash
npm run harness:report -- --since 30d
```

This prints a table of each rule that fired, with how many times, the models involved and the check that caught it. Add `--detail` for how many Claude Code sessions and people tripped each rule, the files involved, and the names of the ESLint and harness rules that never fired in the period. Events older than 90 days are ignored. Delete the log file whenever you like.

Read the report with these patterns:

| Pattern                                      | Suggests                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Fires often, then fixed                      | Rule works. Consider a line in `AGENTS.md` so agents get it right first time |
| Fires, then the agent says the rule is wrong | Too strict or badly scoped. Tune it                                          |
| Same rule several times in one session       | Guidance gap more than a missing rule                                        |
| Never fires                                  | Review: cheap and silent (keep) or slow and noisy (remove)                   |

A rule that never fires is a prompt for review, not removal. Some rules never fire because the code complies and the rule keeps it that way. The protection hooks should almost never fire, and that is their job.

## Proposing a rule

Agents cannot change the lint, hook or CI setup. When they think something should be a rule, they open a GitHub issue labelled `harness-proposal` using the [propose-rule skill](../.claude/skills/propose-rule/SKILL.md). People can use the [harness proposal issue template](../.github/ISSUE_TEMPLATE/harness-proposal.md).

Proposals must come from something that happened:

- a person corrected the agent, such as a review comment, "undo that", or a reverted change
- the event log shows the same rule tripped repeatedly
- the agent noticed an agent rule that a tool could check

Not after every session, and not for problems that have not happened.

## Review

Every month or two, review three lists:

1. Open `harness-proposal` issues, to add
2. Rules that never fire, from the report, to remove
3. Rules agents dispute, to tune

Add each accepted rule to the [rules table](#rules). Record a new kind of check, such as a new hook or CI gate, with the [create-adr skill](../.claude/skills/create-adr/SKILL.md).
