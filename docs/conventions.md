# Conventions

Coding conventions that apply across the repo. Rules marked _(lint)_ are enforced by ESLint or Prettier.

## Modules

- ES modules, plain JavaScript with JSDoc for types
- Import with the `#/` and `#test/` aliases, never `../`
- Kebab-case file names
- Named exports only _(lint)_

## Configuration

- Read settings through `config.get()` from `#/config/config.js`. Do not read `process.env` anywhere else in `src/` _(lint)_
- Add new settings to `src/config/config.js` with a default, format and env var name

## UI

- Use GOV.UK Frontend macros rather than custom components
- Pages must meet WCAG 2.2 AA

## Logging

- Never log personal data, request or response bodies, headers, cookies or tokens
- Nest structured fields under `event` or `error`. See the [ecs-logging skill](../.claude/skills/ecs-logging/SKILL.md)

## Git

- Branch as `<type>/<description>`, for example `feat/risk-level-history`
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
