# Reading risk data from the backend API

## Status

Proposed

## Context

Until now, `src/services/risk-level-service.js` has been a stub that returns placeholder diseases and keeps submitted changes in memory. `AGENTS.md` and `docs/code-layout.md` say it stays a stub until the backend API exists.

apha-risk-insights-backend now serves risk data. `GET /risks` lists one summary per disease, and `GET /risks/{riskId}` adds that disease's assessment history. It has no endpoint for creating risk level changes, and no date-range filter.

The homepage needs 6 months of assessment history for each disease. Engineers also need to run this service without running the backend. Before this decision, the reusable fetch-based HTTP client in `src/utils/http-client.js` was in the repo with no callers. This decision gives it its first caller.

## Decision

We will read risk data from apha-risk-insights-backend over HTTP, and integrate one endpoint at a time:

- All backend calls go through `getFromBackend` in `src/utils/backend-api.js`. It uses `httpRequest`, takes the base URL and timeout from config, and passes the trace ID on.
- A `BACKEND_API_ENABLED` setting, `false` by default, switches the backend on. When it is off, the service returns placeholder data in the same shape as backend data, and makes no HTTP calls.
- `BACKEND_API_URL` has no default. The service fails at startup if the backend is switched on without it, rather than calling a guessed URL.
- The service fetches the summaries, then each disease's detail, and filters the history to a configurable window (`RISK_HISTORY_MONTHS`, default 6). This is because the backend has no date-range filter.
- Any backend failure, and any disease with no assessments in the window, fails the request with a 500 through the existing error page. We do not show partial or stale data.
- When the backend has no risks at all, the homepage says no risk levels have been recorded yet and logs a warning. An empty database is a valid state, not a failure.
- Writes stay stubbed until the backend has an endpoint for them. Changes submitted through this service are not shown on the homepage.

## Consequences

- The homepage shows real backend data, and local development still works without the backend.
- Each page view makes 1 + N backend calls with no caching. That is acceptable for 5 diseases, but it gets slower as diseases are added. A backend date-range filter and caching in this service are recorded as follow-ups.
- Failing the whole page on any error is simple and never shows misleading data, but one slow or broken disease record takes the homepage down.
- The placeholder data has to be kept in the same shape as backend data by hand, until contract tests against the backend's OpenAPI spec exist.
- `AGENTS.md` and `docs/code-layout.md` need to stop describing the service as a stub for reads.
