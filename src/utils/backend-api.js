import { getTraceId } from '@defra/hapi-tracing'

import { config } from '#/config/config.js'
import { httpRequest } from '#/utils/http-client.js'

/**
 * GET a resource from apha-risk-insights-backend.
 * Passes the request's trace ID on, so backend logs can be tied to the page view.
 * @param {string} path - Path from the backend base URL, starting with a slash
 * @param {Record<string, string | number>} [query] - Query string parameters
 * @returns {Promise<unknown>} The parsed response body
 * @throws {import('#/utils/http-client.js').HttpError} When a non-2xx response is received
 * @throws {import('#/utils/http-client.js').NetworkError} When the request fails or times out
 */
export const getFromBackend = (path, query = {}) => {
  const url = new URL(path, config.get('backendApi.url'))
  url.search = new URLSearchParams(query).toString()

  const traceId = getTraceId()

  return httpRequest(url.href, {
    headers: traceId ? { [config.get('tracing.header')]: traceId } : undefined,
    timeout: config.get('backendApi.timeout')
  })
}
