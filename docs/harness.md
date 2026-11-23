# Harness feedback loop

The repo has many automated rules: ESLint, ShellCheck, a suppression check, git hooks, Claude Code hooks and SonarCloud. This page explains how we record which rules fire, how to read that record, and how agents propose new rules.

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

The harness rules are `suppression-comment`, `conventional-commits`, `protected-config`, and `format` and `lint` from the pre-commit hook.

`scripts/log-harness-event.js` writes the log, and every hook calls it. If writing fails, the hook carries on as normal. Nothing is logged in CI, or when `HARNESS_LOG=0` is set.

### What is not logged

- **Claude Code `deny` rules** in `.claude/settings.json`. Claude Code runs no hook when one of these refuses a tool call. Only auto mode refusals reach the `PermissionDenied` hook
- **Which ESLint rule failed in the pre-commit hook.** It records `lint` or `format`, not the rule ID
- **CI and SonarCloud history.** SonarCloud keeps issue history per rule. The `sonar-quality-gate` check only logs what Claude Code was told after a push

## Report

```bash
npm run harness:report -- --since 30d
```

This lists each rule that fired, with how many times, in how many Claude Code sessions and by how many people, plus the files and models involved. It also lists ESLint and harness rules that never fired in the period. Add `--verbose` to name them. Events older than 90 days are ignored. Delete the log file whenever you like.

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

Record each accepted rule with the [create-adr skill](../.claude/skills/create-adr/SKILL.md).
