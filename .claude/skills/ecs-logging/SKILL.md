---
name: ecs-logging
description: Writes ECS-compliant Pino log builder functions and their Vitest tests for this CDP service. Use when adding or changing logging in a route, service, plugin or HTTP client call.
---

# ECS logging

The logger (`src/utils/logger-options.js`) uses `@elastic/ecs-pino-format`. The CDP platform drops flat top-level fields, so all structured data goes under `event` or `error`, using only the fields in [ECS-FIELDS.md](ECS-FIELDS.md).

`src/utils/build-http-client-log.js` and its test `test/unit/utils/build-http-client-log.test.js` are the reference implementation. Copy their shape.

## Rules

- Put each builder in `src/utils/build-<name>-log.js`, with a named export per log (`build<Name>RequestLog`, `build<Name>SuccessLog`, `build<Name>ErrorLog`)
- Use `event.*` for operations and `event.*` plus `error.*` for failures
- Drop undefined values with an `omitUndefined` helper, as the reference does, rather than logging empty keys
- `event.duration` is nanoseconds: `durationMs * NANOSECONDS_PER_MILLISECOND`
- `event.outcome` is `success`, `failure` or `unknown`
- Never log personal data, request or response bodies, headers, cookies or tokens
- Name constants (`EVENT_TYPE`, outcomes) rather than repeating strings

## Tests

Write `test/unit/utils/build-<name>-log.test.js`, using Vitest globals. Cover:

- the exact object each builder returns (`toEqual`)
- that the only top-level keys are `event` and, for errors, `error`
- that undefined optional values are omitted
- the millisecond to nanosecond conversion
- `error.type`, `error.message` and `error.stack_trace` on error builders

Then call the builder at the log site: `logger.info(buildXRequestLog(...), 'message')`.
