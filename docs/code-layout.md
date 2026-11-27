# Code layout

Where code goes in this repo. The reasoning is in [the flat src layout ADR](../adr/adopting-flat-src-layout.adr.md).

## Request flow

A route handler in `src/routes/<domain>/<domain>-routes.js`:

1. reads data through `src/services/`
2. validates form input with a Joi schema in `src/schemas/`
3. passes data through a pure presenter function in `src/presenters/<domain>/`
4. renders a Nunjucks template in `src/views/<domain>/`

Each routes file exports an array of route objects. `src/routes/routes.js` combines them.

## Folders

| Folder              | Holds                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| `src/routes/`       | Route definitions and handlers, one folder per domain                    |
| `src/services/`     | Data access. Reads the backend API when enabled, writes are stubbed      |
| `src/schemas/`      | Joi validation for form payloads                                         |
| `src/presenters/`   | Pure functions that turn data into a view model, one per page            |
| `src/views/`        | Nunjucks templates; `common/` for the layout, `components/` for macros   |
| `src/constants/`    | Values shared by more than one module (see [Constants](#constants))      |
| `src/utils/`        | Runtime helpers: logger, errors, caching, HTTP client                    |
| `src/plugins/`      | Hapi plugins, registered in order from `index.js`                        |
| `src/config/`       | The convict config, `config.js`. The only place that reads `process.env` |
| `src/client/`       | Browser JavaScript and SCSS, built by Vite                               |
| `test/unit/`        | Unit tests, mirroring `src/`                                             |
| `test/integration/` | Narrow integration tests that drive the server with `server.inject()`    |
| `test/helpers/`     | Shared fixtures and test helpers, imported through `#test/`              |
| `scripts/`          | Repo tooling run by npm scripts, such as `lint-shell.sh`                 |
| `.claude/`          | Claude Code settings, hooks in `hooks/` and skills in `skills/`          |
| `.husky/`           | Git hooks: `pre-commit` runs format and lint, `commit-msg` checks format |

`src/services/risk-level-service.js` reads from apha-risk-insights-backend through `src/utils/backend-api.js` when `BACKEND_API_ENABLED` is true, and returns placeholder data from `src/services/placeholder-risks.js` otherwise. Writes are still stubbed until the backend has an endpoint for them.

## Constants

- A constant used by more than one module goes in `src/constants/`, in the file for its domain (for example `risk-levels.js`)
- A constant used in only one file stays in that file, unexported, near the top
- Name scalar constants in `UPPER_SNAKE_CASE`. Shared lists and lookup objects use camelCase (`riskLevels`, `statusCodes`) and follow the same placement rule

ESLint rejects exporting an `UPPER_SNAKE_CASE` constant from outside `src/constants/`. It cannot see camelCase values, so place those by hand.
