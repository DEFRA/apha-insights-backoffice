# Agent instructions

Back office frontend for APHA's International Disease Monitoring team, used to record risk level changes. Hapi, Nunjucks and GOV.UK Frontend on the CDP Node frontend template.

`src/services/risk-level-service.js` reads risk data from apha-risk-insights-backend when `BACKEND_API_ENABLED` is true, and returns placeholder data otherwise. Writes are still stubbed until the backend has an endpoint for them. Do not add a real data store.

## Before you finish

Run these and fix any failures. CI runs lint and format checks on every pull request, and a pull request cannot merge until they pass.

- `npm test`
- `npm run lint`: ESLint with SonarCloud's JavaScript rules, stylelint, ShellCheck, and a check that rejects rule-suppression comments (fix JavaScript with `npm run lint:js:fix`)
- `npm run format:check` (fix with `npm run format`)

SonarCloud also scans every pull request. In Claude Code, a background hook reports a failed quality gate after you push.

Fix lint and Sonar findings in the code. Do not suppress them with comments, and do not change the lint, hook or CI setup: Claude Code blocks and reverts those changes. If a rule is wrong for a case, tell the user. The protected files are listed in [docs/conventions.md](docs/conventions.md#lint-and-hook-setup).

## Proposing rules

Use the [propose-rule skill](.claude/skills/propose-rule/SKILL.md) to open a GitHub issue for a person to review when:

- a person corrects you, such as a review comment, "undo that" or a reverted change
- `npm run harness:report` shows the same rule tripped repeatedly
- you notice a rule in this file or a skill that a tool could check

Not after every session, and not for problems that have not happened.

## Contents

| When you need to                           | Read                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| Know where code or a constant goes         | [docs/code-layout.md](docs/code-layout.md)               |
| Follow module, config, UI and git rules    | [docs/conventions.md](docs/conventions.md)               |
| Add or change logging                      | [ecs-logging skill](.claude/skills/ecs-logging/SKILL.md) |
| Make a hard-to-reverse decision            | [create-adr skill](.claude/skills/create-adr/SKILL.md)   |
| See which rules fire, or propose a rule    | [docs/harness.md](docs/harness.md)                       |
| Understand why things are the way they are | [adr/](adr/)                                             |
| Run the app locally or in Docker           | [README.md](README.md)                                   |
