---
name: propose-rule
description: Opens a GitHub issue proposing a new or changed harness rule (an AGENTS.md line, Claude Code hook, git hook or CI check), for a person to review. Use after a person corrects you, when the harness event log shows the same rule tripping repeatedly, or when you notice an agent rule a tool could check. Never edit the lint, hook or CI setup yourself.
---

# Propose a rule

You cannot change the lint, hook or CI setup in this repo. When something should be a rule, propose it as a GitHub issue so a person decides. See [docs/harness.md](../../../docs/harness.md).

## When to propose

Only from something that happened:

- a person corrected you: a review comment, "undo that", a reverted change
- the event log shows the same rule tripped repeatedly (`npm run harness:report`)
- you noticed a rule in `AGENTS.md` or a skill that a tool could check

Do not propose at the end of every session, or for problems that have not happened. One correction is enough evidence when the mistake is likely to repeat.

## Steps

1. Gather the evidence: links to the pull request, commit or review comment, and the session ID. Run `npm run harness:report -- --since 30d` and note how often the related rule fired.
2. Check for an existing proposal: `gh issue list --label harness-proposal --state all --search "<keywords>"`. If one exists, add your evidence as a comment instead.
3. Choose the cheapest layer that would have caught the problem:
   - **`AGENTS.md` or skill guidance**: a judgement call no tool can check
   - **Claude Code hook**: catch it while the agent is working, with feedback it can act on
   - **git hook**: catch it for people and agents before a commit
   - **CI**: anything that must hold on every pull request
4. Draft the check, such as the ESLint rule config, script or hook change. Do not apply it.
5. Tell the user what you are proposing and why, then open the issue with the template below:

   ```bash
   gh issue create --label harness-proposal --title "Harness proposal: <short description>" --body-file <file>
   ```

6. Give the user the issue link.

## Issue template

Use the same headings as [.github/ISSUE_TEMPLATE/harness-proposal.md](../../../.github/ISSUE_TEMPLATE/harness-proposal.md):

```markdown
## What went wrong

<One or two sentences.>

## Evidence

- <Links to the PR, commit, review comment or session>
- <How often it happened, from the event log where possible>

## Proposed layer

<AGENTS.md or skill guidance, Claude Code hook, git hook, or CI, and why that layer.>

## Draft check

<The rule, script or config change. Not applied.>

## What it might wrongly block

<Valid code or actions the check could reject.>

## What it won't catch

<Cases that still get through.>
```
