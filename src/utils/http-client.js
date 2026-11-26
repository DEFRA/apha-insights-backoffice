import { createLogger } from '#/utils/logger.js'
import {
  buildHttpClientRequestLog,
  buildHttpClientSuccessLog,
  buildHttpClientErrorLog
} from '#/utils/build-http-client-log.js'

const logger = createLogger()

const CONTENT_TYPE = 'content-type'
const JSON_CONTENT_TYPE = 'application/json'
const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json'
const NO_CONTENT_STATUS = 204

/**
 * Error thrown when a request receives a non-2xx response.
 */
class HttpError extends Error {
  /**
   * @param {object} details
   * @param {number} details.status
   * @param {string} details.url
   * @param {string} details.method
   * @param {string} [details.title]
   * @param {string} [details.detail]
   * @param {string} [details.instance]
   */
  constructor({ status, url, method, title, detail, instance }) {
    super(`${method} ${url} failed with status ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.method = method
    this.title = title
    this.detail = detail
    this.instance = instance
  }
}

/**
 * Error thrown when a request fails before a response is received.
 */
class NetworkError extends Error {
  /**
   * @param {string} method
   * @param {string} url
   * @param {Error} cause - The original error
   */
  constructor(method, url, cause) {
    super(`Network error calling ${method} ${url}`, { cause })
    this.name = 'NetworkError'
  }
}

/**
 * Error thrown when a 2xx response says it is JSON but its body cannot be parsed.
 * The parser's own message quotes the body, so it is not kept as the cause.
 */
class InvalidResponseError extends Error {
  /**
   * @param {string} method
   * @param {string} url
   * @param {number} status
   */
  constructor(method, url, status) {
    super(
      `${method} ${url} responded with status ${status} and a body that is not valid JSON`
    )
    this.name = 'InvalidResponseError'
    this.status = status
  }
}

/**
 * @param {Response} response
 * @returns {string}
 */
const getMediaType = (response) =>
  (response.headers.get(CONTENT_TYPE) ?? '').split(';')[0].trim().toLowerCase()

/**
 * @param {string} mediaType
 * @returns {boolean}
 */
const isJson = (mediaType) =>
  mediaType === JSON_CONTENT_TYPE || mediaType.endsWith('+json')

/**
 * @param {Response} response
 * @param {string} method
 * @param {string} url
 * @returns {Promise<unknown>}
 * @throws {InvalidResponseError} When a JSON body cannot be parsed
 */
const parseSuccessBody = async (response, method, url) => {
  if (response.status === NO_CONTENT_STATUS) {
    return null
  }
  const text = await response.text()
  if (text === '') {
    return null
  }
  if (!isJson(getMediaType(response))) {
    return text
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new InvalidResponseError(method, url, response.status)
  }
}

/**
 * @param {Response} response
 * @returns {Promise<{ title?: string, detail?: string, instance?: string }>}
 */
const parseProblem = async (response) => {
  if (getMediaType(response) !== PROBLEM_JSON_CONTENT_TYPE) {
    return {}
  }
  try {
    const { title, detail, instance } = await response.json()
    return { title, detail, instance }
  } catch {
    return {}
  }
}

/**
 * @param {Record<string, string> | undefined} headers
 * @param {unknown} body
 * @returns {{ headers: Record<string, string> | undefined, body: string | undefined }}
 */
const prepareBody = (headers, body) => {
  if (body === undefined || typeof body === 'string') {
    return { headers, body }
  }
  const hasContentType = Object.keys(headers ?? {}).some(
    (name) => name.toLowerCase() === CONTENT_TYPE
  )
  return {
    headers: hasContentType
      ? headers
      : { [CONTENT_TYPE]: JSON_CONTENT_TYPE, ...headers },
    body: JSON.stringify(body)
  }
}

/**
 * @param {Response} response
 * @param {string} method
 * @param {string} url
 * @returns {Promise<HttpError>}
 */
const buildHttpError = async (response, method, url) => {
  const { title, detail, instance } = await parseProblem(response)
  return new HttpError({
    status: response.status,
    url,
    method,
    title: title ?? response.statusText,
    detail,
    instance
  })
}

/**
 * Make an outbound HTTP request using the global fetch.
 * No retries are applied, and no timeout unless one is given.
 * @param {string} url - Request URL
 * @param {object} [options]
 * @param {string} [options.method] - HTTP method, defaults to GET
 * @param {Record<string, string>} [options.headers] - Request headers
 * @param {object | string} [options.body] - Objects are sent as JSON, strings as-is
 * @param {number} [options.timeout] - Milliseconds to wait before giving up
 * @returns {Promise<unknown>} Parsed JSON, text, or null when there is no content
 * @throws {HttpError} When a non-2xx response is received
 * @throws {NetworkError} When the request fails or times out before a response is received
 * @throws {InvalidResponseError} When a 2xx JSON response body cannot be parsed
 */
const httpRequest = async (
  url,
  { method = 'GET', headers, body, timeout } = {}
) => {
  const prepared = prepareBody(headers, body)
  const startedAt = performance.now()
  const elapsed = () => performance.now() - startedAt

  logger.info(buildHttpClientRequestLog(method, url))

  let response
  try {
    response = await fetch(url, {
      method,
      headers: prepared.headers,
      body: prepared.body,
      signal: timeout === undefined ? undefined : AbortSignal.timeout(timeout)
    })
  } catch (cause) {
    const error = new NetworkError(method, url, cause)
    logger.error(buildHttpClientErrorLog(method, url, error, elapsed()))
    throw error
  }

  if (!response.ok) {
    const error = await buildHttpError(response, method, url)
    logger.error(
      buildHttpClientErrorLog(method, url, error, elapsed(), response.status)
    )
    throw error
  }

  let data
  try {
    data = await parseSuccessBody(response, method, url)
  } catch (error) {
    logger.error(
      buildHttpClientErrorLog(method, url, error, elapsed(), response.status)
    )
    throw error
  }

  logger.info(
    buildHttpClientSuccessLog(method, url, response.status, elapsed())
  )
  return data
}

export { HttpError, InvalidResponseError, NetworkError, httpRequest }
