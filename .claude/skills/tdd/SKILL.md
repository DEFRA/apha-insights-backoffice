---
name: tdd
description: Builds a feature or fixes a bug in this repo with a strict red-green loop in Vitest. Use when asked to build, add or fix behaviour test-first, or when the user invokes /tdd.
---

# TDD

## Loop

For each behaviour, smallest slice first:

1. Write one failing test.
2. Run it and confirm it fails for the expected reason. If it passes, stop and find out why.
3. Write the least code that makes it pass.
4. Run `npm test` to catch regressions before the next slice.

Order the slices unhappy paths first (invalid input, missing data, service failures, boundaries), then happy paths. A bug fix starts with a test that reproduces the bug.

Stop at green. Do not refactor inside the loop; tidy up afterwards with the suite passing.

## Choosing the test

| What changed                | Test                                                            | Where                                    |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| Presenter, schema, util     | Unit test of the function                                       | `test/unit/` mirroring `src/`            |
| Route, view or page journey | Narrow integration test with `server.inject()`, services mocked | `test/integration/narrow/routes.test.js` |
| Nunjucks component          | Render test using `test/helpers/component-helpers.js`           | `test/unit/views/components/`            |

Mock only what is outside the boundary under test, with `vi.mock()` and `vi.fn()`. Put shared data in `test/helpers/` and import it through `#test/`.

For a route, cover: valid submission, Joi validation failure (400 with the error summary), missing CSRF crumb on POST, and the redirect or rendered page.

## Running tests

`npm test` runs the suite once with coverage. `npm run test:watch` re-runs on change. If the user has a Docker watch container running (`npm run docker:test:watch`), read its output instead of starting another run.
