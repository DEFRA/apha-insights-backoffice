import * as cheerio from 'cheerio'
import { createServer } from '#/server.js'
import { statusCodes } from '#/constants/status-codes.js'
import {
  getCurrentRiskLevels,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'
import {
  currentRiskLevels,
  validFormPayload,
  validRiskLevelChange
} from '#test/helpers/risk-level-fixtures.js'

vi.mock('#/services/risk-level-service.js', () => ({
  getCurrentRiskLevels: vi.fn(),
  submitRiskLevelChange: vi.fn()
}))

/**
 * A client that keeps cookies between requests, as a browser does, so the session and crumb carry across the journey
 */
const createSession = (server) => {
  const cookies = {}

  const send = async (method, url, payload) => {
    const cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    const response = await server.inject({
      method,
      url,
      headers: cookie ? { cookie } : {},
      payload
    })

    for (const header of [response.headers['set-cookie'] ?? []].flat()) {
      const [pair] = header.split(';')
      const separator = pair.indexOf('=')
      cookies[pair.slice(0, separator)] = pair.slice(separator + 1)
    }

    return { ...response, $: cheerio.load(response.payload) }
  }

  // Loads the form first so the crumb comes from the same session the POST is made in
  const submitForm = async (url, payload) => {
    const page = await send('GET', url)
    const crumb = page.$('main input[name="crumb"]').val()

    return send('POST', url, { ...payload, crumb })
  }

  return {
    get: (url) => send('GET', url),
    post: (url, payload) => send('POST', url, payload),
    submitForm
  }
}

const linksIn = ($, selector) =>
  $(selector)
    .map((_, a) => ({ text: $(a).text().trim(), href: $(a).attr('href') }))
    .get()

const summaryErrors = ($) =>
  $('.govuk-error-summary__list a')
    .map((_, a) => ({ text: $(a).text().trim(), href: $(a).attr('href') }))
    .get()

describe('#routes', () => {
  let server
  const logInfo = vi.fn()

  beforeAll(async () => {
    server = await createServer()
    server.ext('onPreHandler', (request, h) => {
      request.logger = { ...request.logger, info: logInfo }
      return h.continue
    })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    getCurrentRiskLevels.mockResolvedValue(currentRiskLevels())
    submitRiskLevelChange.mockResolvedValue()
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

    test('links to the add data page', async () => {
      const { $ } = await getPage('/')

      expect(linksIn($, 'main a.govuk-link')).toEqual([
        { text: 'Update risk level', href: '/add-data' }
      ])
    })

    test('marks Home as the current navigation item', async () => {
      const { $ } = await getPage('/')

      expect($('[aria-current="page"]').text().trim()).toBe('Home')
    })
  })

  describe('GET /add-data', () => {
    test('renders the form with its heading and instructions', async () => {
      const { $, statusCode } = await getPage('/add-data')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Update risk level')
      expect($('main p.govuk-body').first().text().trim()).toContain(
        'increase, decrease or stay the same'
      )
      expect($('.govuk-error-summary')).toHaveLength(0)
    })

    test('renders a radio group for each of the three diseases with its current risk level', async () => {
      const { $ } = await getPage('/add-data')
      const legends = $('fieldset legend')
        .map((_, legend) => $(legend).text().trim())
        .get()
      const hints = $('fieldset .govuk-hint')
        .map((_, hint) => $(hint).text().trim())
        .get()

      expect($('.govuk-radios')).toHaveLength(3)
      expect(legends).toEqual([
        'African swine fever',
        'Highly pathogenic avian influenza',
        'Bluetongue'
      ])
      expect(hints).toEqual([
        'Current risk level: Medium',
        'Current risk level: High',
        'Current risk level: Low'
      ])
    })

    test.each([
      ['direction-asf'],
      ['direction-hpai'],
      ['direction-bluetongue']
    ])('offers increase, decrease and stay the same for %s', async (name) => {
      const { $ } = await getPage('/add-data')
      const options = $(`input[name="${name}"]`)
        .map((_, input) => ({
          value: $(input).val(),
          text: $(input).next('label').text().trim()
        }))
        .get()

      expect(options).toEqual([
        { value: 'increase', text: 'Increase' },
        { value: 'decrease', text: 'Decrease' },
        { value: 'same', text: 'Stay the same' }
      ])
    })

    test('renders the expert comment text box with a character count', async () => {
      const { $ } = await getPage('/add-data')

      expect($('label[for="expertComment"]').text().trim()).toBe(
        'Expert comment'
      )
      expect($('textarea#expertComment').attr('name')).toBe('expertComment')
      expect(
        $('[data-module="govuk-character-count"]').attr('data-maxlength')
      ).toBe('2000')
    })

    test('renders a Continue button and a CSRF token', async () => {
      const { $ } = await getPage('/add-data')

      expect($('main form button').text().trim()).toBe('Continue')
      expect($('main form input[name="crumb"]').val()).toBeTruthy()
    })
  })

  describe('POST /add-data', () => {
    test('rejects an empty submission with one error per disease and one for the comment', async () => {
      const { $, statusCode } = await createSession(server).submitForm(
        '/add-data',
        {}
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('head > title').text().trim()).toBe(
        'Error: Update risk level | IDM Insights'
      )
      expect(summaryErrors($).map(({ href }) => href)).toEqual([
        '#direction-asf',
        '#direction-hpai',
        '#direction-bluetongue',
        '#expertComment'
      ])
      expect($('.govuk-error-message')).toHaveLength(4)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('links every error in the summary to a field on the page', async () => {
      const { $ } = await createSession(server).submitForm('/add-data', {})

      for (const { href } of summaryErrors($)) {
        expect($(href)).toHaveLength(1)
      }
    })

    test('keeps the chosen directions and the comment when re-rendering with an error', async () => {
      const { $ } = await createSession(server).submitForm('/add-data', {
        'direction-asf': 'increase',
        'direction-hpai': 'same',
        expertComment: 'Kept comment'
      })

      expect(
        $('input[name="direction-asf"][value="increase"]').attr('checked')
      ).toBeDefined()
      expect(
        $('input[name="direction-hpai"][value="same"]').attr('checked')
      ).toBeDefined()
      expect($('textarea#expertComment').text()).toBe('Kept comment')
      expect(summaryErrors($)).toEqual([
        {
          text: 'Select whether the risk level for Bluetongue increases, decreases or stays the same',
          href: '#direction-bluetongue'
        }
      ])
    })

    test('rejects increasing a disease that is already at the highest level', async () => {
      getCurrentRiskLevels.mockResolvedValue([
        {
          id: 'asf',
          name: 'African swine fever',
          currentRiskLevel: 'very-high'
        }
      ])

      const { $, statusCode } = await createSession(server).submitForm(
        '/add-data',
        { 'direction-asf': 'increase', expertComment: 'Comment' }
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(summaryErrors($)).toEqual([
        {
          text: 'African swine fever is already at the highest risk level, so it cannot increase',
          href: '#direction-asf'
        }
      ])
    })

    test('rejects a submission without a CSRF token', async () => {
      const session = createSession(server)
      await session.get('/add-data')
      const { statusCode } = await session.post('/add-data', validFormPayload())

      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('redirects a valid submission to check your answers without submitting it', async () => {
      const session = createSession(server)
      const { statusCode, headers } = await session.submitForm(
        '/add-data',
        validFormPayload()
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/add-data/check-answers')
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })
  })

  describe('GET /add-data/check-answers', () => {
    test('redirects to the form when there are no answers to check', async () => {
      const { statusCode, headers } = await createSession(server).get(
        '/add-data/check-answers'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/add-data')
    })

    test('shows a card for each disease with its current level, direction and new level', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())

      const { $, statusCode } = await session.get('/add-data/check-answers')
      const titles = $('.govuk-summary-card__title')
        .map((_, title) => $(title).text().trim())
        .get()
      const firstCard = $('.govuk-summary-list')
        .first()
        .find('.govuk-summary-list__value')
        .map((_, value) => $(value).text().trim())
        .get()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Check your answers')
      expect(titles).toEqual([
        'African swine fever',
        'Highly pathogenic avian influenza',
        'Bluetongue'
      ])
      expect(firstCard).toEqual(['Medium', 'Increase', 'High'])
    })

    test('shows the expert comment with a link back to the form', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())

      const { $ } = await session.get('/add-data/check-answers')
      const comment = $('.govuk-summary-list__row').filter(
        (_, row) => $(row).find('dt').text().trim() === 'Expert comment'
      )

      expect(comment.find('dd').first().text().trim()).toBe(
        'New outbreaks reported in domestic pigs.'
      )
      expect(comment.find('a').attr('href')).toBe('/add-data')
    })

    test('pre-fills the form with the answers when Change is used', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())

      const { $ } = await session.get('/add-data')

      expect(
        $('input[name="direction-asf"][value="increase"]').attr('checked')
      ).toBeDefined()
      expect(
        $('input[name="direction-bluetongue"][value="decrease"]').attr(
          'checked'
        )
      ).toBeDefined()
      expect($('textarea#expertComment').text()).toBe(
        'New outbreaks reported in domestic pigs.'
      )
    })
  })

  describe('POST /add-data/check-answers', () => {
    test('logs and submits the checked answers once', async () => {
      logInfo.mockClear()
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())
      await session.submitForm('/add-data/check-answers', {})

      expect(submitRiskLevelChange).toHaveBeenCalledTimes(1)
      expect(submitRiskLevelChange).toHaveBeenCalledWith(validRiskLevelChange())
      expect(logInfo).toHaveBeenCalledWith(
        'Risk level change submitted for asf:increase, hpai:same, bluetongue:decrease'
      )
    })

    test('never logs the expert comment', async () => {
      logInfo.mockClear()
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())
      await session.submitForm('/add-data/check-answers', {})

      expect(JSON.stringify(logInfo.mock.calls)).not.toContain(
        validRiskLevelChange().expertComment
      )
    })

    test('rejects a submission without a CSRF token', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())
      const { statusCode } = await session.post('/add-data/check-answers', {})

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('redirects to the confirmation page after submitting', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())
      const { statusCode, headers } = await session.submitForm(
        '/add-data/check-answers',
        {}
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/add-data/confirmation')
    })

    test('clears the answers after submitting, so they cannot be sent twice', async () => {
      const session = createSession(server)
      await session.submitForm('/add-data', validFormPayload())
      await session.submitForm('/add-data/check-answers', {})

      const { statusCode, headers } = await session.get(
        '/add-data/check-answers'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/add-data')
    })

    test('does not submit when there are no answers to check', async () => {
      const session = createSession(server)
      const { crumb } = {
        crumb: (await session.get('/add-data'))
          .$('main input[name="crumb"]')
          .val()
      }
      const { statusCode, headers } = await session.post(
        '/add-data/check-answers',
        { crumb }
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/add-data')
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })
  })

  describe('GET /add-data/confirmation', () => {
    test('renders the confirmation panel', async () => {
      const { $, statusCode } = await getPage('/add-data/confirmation')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1.govuk-panel__title').text().trim()).toBe(
        'Submission received'
      )
    })

    test('links back to home and to add another', async () => {
      const { $ } = await getPage('/add-data/confirmation')

      expect(linksIn($, 'main a.govuk-link')).toEqual([
        { text: 'Home', href: '/' },
        { text: 'Add another', href: '/add-data' }
      ])
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
