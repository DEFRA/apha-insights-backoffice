import { getTraceId } from '@defra/hapi-tracing'

import { config } from '#/config/config.js'
import { getFromBackend } from '#/utils/backend-api.js'
import { httpRequest } from '#/utils/http-client.js'

vi.mock('@defra/hapi-tracing', () => ({ getTraceId: vi.fn() }))
vi.mock('#/utils/http-client.js', () => ({ httpRequest: vi.fn() }))

describe('#getFromBackend', () => {
  beforeEach(() => {
    config.set('backendApi.url', 'http://backend.test:3001')
    config.set('backendApi.timeout', 1500)
  })

  afterEach(() => {
    config.reset('backendApi.url')
    config.reset('backendApi.timeout')
  })

  test('Should request the path from the configured backend URL', async () => {
    await getFromBackend('/risks')

    expect(httpRequest).toHaveBeenCalledWith(
      'http://backend.test:3001/risks',
      expect.any(Object)
    )
  })

  test('Should add the query parameters to the URL', async () => {
    await getFromBackend('/risks', { pageSize: 200, q: 'foot & mouth' })

    expect(httpRequest.mock.calls[0][0]).toBe(
      'http://backend.test:3001/risks?pageSize=200&q=foot+%26+mouth'
    )
  })

  test('Should apply the configured timeout', async () => {
    await getFromBackend('/risks')

    expect(httpRequest.mock.calls[0][1].timeout).toBe(1500)
  })

  test('Should pass the trace ID on in the tracing header', async () => {
    getTraceId.mockReturnValue('trace-123')

    await getFromBackend('/risks')

    expect(httpRequest.mock.calls[0][1].headers).toEqual({
      'x-cdp-request-id': 'trace-123'
    })
  })

  test('Should send no headers when there is no trace ID', async () => {
    getTraceId.mockReturnValue(undefined)

    await getFromBackend('/risks')

    expect(httpRequest.mock.calls[0][1].headers).toBeUndefined()
  })

  test('Should resolve with the response body', async () => {
    httpRequest.mockResolvedValue({ items: [] })

    await expect(getFromBackend('/risks')).resolves.toEqual({ items: [] })
  })
})
