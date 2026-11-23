# Agent instructions

Back office frontend for APHA's International Disease Monitoring team, used to record risk level changes. Hapi, Nunjucks and GOV.UK Frontend on the CDP Node frontend template.

It is a skeleton: `src/services/risk-level-service.js` is a stub until the backend API exists. Do not add a real data store.

## Before you finish

Run these and fix any failures. The pre-commit hook runs them too.

- `npm test`
- `npm run lint` (fix with `npm run lint:js:fix`)
- `npm run format:check` (fix with `npm run format`)

## Contents

| When you need to                           | Read                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| Know where code or a constant goes         | [docs/code-layout.md](docs/code-layout.md)               |
| Follow module, config, UI and git rules    | [docs/conventions.md](docs/conventions.md)               |
| Add or change logging                      | [ecs-logging skill](.claude/skills/ecs-logging/SKILL.md) |
| Make a hard-to-reverse decision            | [create-adr skill](.claude/skills/create-adr/SKILL.md)   |
| Understand why things are the way they are | [adr/](adr/)                                             |
| Run the app locally or in Docker           | [README.md](README.md)                                   |
