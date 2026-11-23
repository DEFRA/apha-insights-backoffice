# Conventions

Coding conventions that apply across the repo. Rules marked _(enforced)_ are checked automatically by ESLint, Prettier or a git hook.

## Modules

- ES modules, plain JavaScript with JSDoc for types
- Import with the `#/` and `#test/` aliases, never `../`
- Kebab-case file names
- Named exports only _(enforced)_

## Configuration

- Read settings through `config.get()` from `#/config/config.js`. Do not read `process.env` anywhere else in `src/` _(enforced)_
- Add new settings to `src/config/config.js` with a default, format and env var name

## UI

- Use GOV.UK Frontend macros rather than custom components
- Pages must meet WCAG 2.2 AA

## Logging

- Never log personal data, request or response bodies, headers, cookies or tokens
- Nest structured fields under `event` or `error`. See the [ecs-logging skill](../.claude/skills/ecs-logging/SKILL.md)

## Git

- Branch as `<type>/<description>`, for example `feat/risk-level-history`
- Conventional commit messages, `<type>(<optional scope>): <description>`, with type one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style` or `test` _(enforced)_
- Pull request titles use the same format, because pull requests are squash-merged and the title becomes the commit on `main`. Claude Code blocks `gh pr create` and `gh pr edit` with a non-conforming `--title`
