# Adopting a flat src layout with domain folders

## Status

Accepted

## Context

This repository was created from the CDP Node frontend template. The template's code sits under `src/server/` (`plugins/`, `routes/<name>/` with a `controller.js` per page, `common/helpers/`, `common/templates/`, `common/components/`), its config is one flat convict file, and its tests are co-located beside source files.

The sibling service `fcp-sfd-frontend` uses a flat `src/` layout with domain folders for routes, presenters, services and views. It has a separate `test/` tree with unit and narrow integration tests. It has been in production use for longer than this repository.

The sibling service `apha-risk-insights-frontend` made this same decision, and this record is adapted from its ADR. This service is the back office for the same data, so engineers will move between the two repositories.

This service is a small skeleton. It has one form, no shared library needs and no authentication. Its data access is stubbed until the backend API exists. The layout is cheap to change now, because only a handful of routes exist.

## Decision

We will restructure `src/` to a flat layout with domain folders, following `fcp-sfd-frontend` and `apha-risk-insights-frontend`:

- `src/plugins/` holds an ordered `index.js` array of Hapi plugins, plus `router.js`.
- `src/routes/<domain>/` holds route modules that each export an array of route objects. `src/routes/routes.js` aggregates them.
- `src/presenters/<domain>/` holds one pure function per page that turns data into a view model. This applies to the home and about pages and the error page, even though they are static.
- `src/views/` holds Nunjucks templates, with `common/` for the layout and `components/` for reusable macros.
- `src/utils/` holds runtime helpers, including the logger, error handling and caching. Runtime code does not go in `src/config/`.
- `src/constants/` holds status codes.
- `src/config/` holds the convict config. It stays as one file, `config.js`, with flat keys.
- Tests live in a separate `test/` tree. `test/unit/` mirrors `src/`, `test/integration/narrow/` uses `server.inject()`, and `test/helpers/` holds shared support code.

- `src/services/` holds the functions that routes call to read and write data. They are stubs until the backend API exists.
- `src/schemas/` holds Joi validation for form payloads.

We will not create `src/data/` in this change. It is added when it has content.

We will keep these choices from the current repository:

- Vite stays as the build tool and dev server. We will not move to Webpack.
- The `#/` import alias stays. Imports under `src/` and `test/` do not use `../`. `fcp-sfd-frontend` uses relative imports, and we accept the difference.
- Node `>=24` and the existing lint, format and test scripts stay.

We will not add a shared engine package. The service is small enough to keep its logic local.

We will keep `@hapi/crumb` from the template, because the service has POST routes. Every form must include a `crumb` hidden field.

## Consequences

Positive:

- Engineers who know `fcp-sfd-frontend` will find the same folders and patterns here.
- Route and presenter code each have a clear home, which makes changes easier to review.
- Tests run in a separate tree. Production source contains no tests, and the production Docker image, which copies only `src/`, does not ship them.

Negative:

- The move touches many files and tests. Imports, Vite SCSS `loadPaths`, the `server:watch` and `server:debug` scripts, `nodemon.json`, `sonar-project.properties`, `.npmignore` and the `README.md` config reference all need updating.
- The `#/` alias and the relative imports in `fcp-sfd-frontend` differ, so code copied from that repository needs its imports rewritten.
- `fcp-sfd-frontend` has patterns that are not safe to copy as they are, such as two `onPreResponse` error handlers and a presenter that reads flash messages. Those are excluded from this decision.

Neutral:

- The Vite build is unchanged, so the production asset pipeline does not change.
- The template's cookie consent banner, cookies page and Google Tag Manager partials are kept and moved into this layout. `apha-risk-insights-frontend` does not have them.
- Config is not nested or split in this change. That can be revisited when the config grows.
- Future repositories may choose different layouts, and this repository does not need to match the backend API's layout.
