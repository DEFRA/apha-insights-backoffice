import * as cheerio from 'cheerio'
import { createServer } from '#/server.js'
import { statusCodes } from '#/constants/status-codes.js'

describe('#routes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const getPage = async (url) => {
    const { result, statusCode } = await server.inject({ method: 'GET', url })

    return { $: cheerio.load(result), result, statusCode }
  }

  describe('GET /', () => {
    test('renders the home page', async () => {
      const { $, statusCode } = await getPage('/')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('head > title').text().trim()).toBe('Home | IDM Insights')
      expect($('h1').text().trim()).toBe('IDM Insights')
    })

    test('marks Home as the current navigation item', async () => {
      const { $ } = await getPage('/')

      expect($('[aria-current="page"]').text().trim()).toBe('Home')
    })
  })

  test('GET /health returns success', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({ message: 'success' })
  })

  test('GET /nope renders the error page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/nope'
    })

    expect(statusCode).toBe(statusCodes.notFound)
    expect(result).toEqual(expect.stringContaining('Page not found'))
  })
})
