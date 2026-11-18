import * as cheerio from 'cheerio'
import { config } from '#/config/config.js'
import { createServer } from '#/server.js'
import { statusCodes } from '#/constants/status-codes.js'
import {
  getCurrentRiskLevels,
  getLatestRiskLevelChange,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'
import {
  currentRiskLevels,
  validFormPayload,
  validRiskLevelChange
} from '#test/helpers/risk-level-fixtures.js'

vi.mock('#/services/risk-level-service.js', () => ({
  getCurrentRiskLevels: vi.fn(),
  getLatestRiskLevelChange: vi.fn(),
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

const tableRows = ($, panel) =>
  $(panel)
    .find('.govuk-table__body .govuk-table__row')
    .map((_, row) => [
      $(row)
        .find('.govuk-table__header, .govuk-table__cell')
        .map((_, cell) => $(cell).text().trim())
        .get()
    ])
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
    getLatestRiskLevelChange.mockResolvedValue(null)
    submitRiskLevelChange.mockResolvedValue()
  })

  const getPage = async (url) => {
    const { result, statusCode } = await server.inject({ method: 'GET', url })

    return { $: cheerio.load(result), result, statusCode }
  }

  describe('GET /', () => {
    test('shows the service in development banner', async () => {
      const { $ } = await getPage('/')

      expect($('[data-testid="phase-banner"] .govuk-tag').text().trim()).toBe(
        'Alpha'
      )
      expect(
        $('[data-testid="phase-banner"] .govuk-phase-banner__text')
          .text()
          .trim()
      ).toBe(
        'This service is in development. All the data shown is test data, not real information about diseases and risks.'
      )
    })

    test('hides the service in development banner when disabled', async () => {
      config.set('serviceInDevelopmentBanner.enabled', false)

      try {
        const { $ } = await getPage('/')

        expect($('[data-testid="phase-banner"]')).toHaveLength(0)
      } finally {
        config.set('serviceInDevelopmentBanner.enabled', true)
      }
    })

    test('renders the home page', async () => {
      const { $, statusCode } = await getPage('/')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('head > title').text().trim()).toBe('Home | IDM Insights')
      expect($('h1').text().trim()).toBe('IDM Insights')
    })

    test('links to the update risk level page', async () => {
      const { $ } = await getPage('/')

      expect(linksIn($, 'main a.govuk-link')).toEqual([
        { text: 'Update risk level', href: '/update-risk-level' }
      ])
    })

    test('marks Home as the current navigation item', async () => {
      const { $ } = await getPage('/')

      expect($('[aria-current="page"]').text().trim()).toBe('Home')
    })

    test('renders a tab per disease with only the default row when nothing has been submitted', async () => {
      const { $ } = await getPage('/')
      const tabs = $('.govuk-tabs__tab')
        .map((_, tab) => ({
          text: $(tab).text().trim(),
          href: $(tab).attr('href')
        }))
        .get()

      expect($('main h2').first().text().trim()).toBe('Risk level changes')
      expect(tabs).toEqual([
        { text: 'African swine fever', href: '#asf' },
        { text: 'Highly pathogenic avian influenza', href: '#hpai' },
        { text: 'Bluetongue', href: '#bluetongue' }
      ])
      expect(tableRows($, '#asf')).toEqual([
        ['Default', 'Medium', '–', '–', '–']
      ])
      expect(
        $('.govuk-tabs__panel')
          .map((_, panel) => tableRows($, panel).length)
          .get()
      ).toEqual([1, 1, 1])
    })

    test('renders the latest update row in each tab after a change is submitted', async () => {
      getLatestRiskLevelChange.mockResolvedValue({
        submittedAt: '2026-11-18T14:30:00.000Z',
        ...validRiskLevelChange()
      })

      const { $ } = await getPage('/')

      expect(tableRows($, '#asf')).toEqual([
        ['Default', 'Medium', '–', '–', '–'],
        [
          'Latest update',
          'High',
          'Increase',
          'New outbreaks reported in domestic pigs.',
          '18 November 2026 at 2:30pm'
        ]
      ])
      expect(tableRows($, '#bluetongue')).toHaveLength(2)
    })

    test('escapes a comment so it is shown as text and never injected', async () => {
      const comment = '<script>alert("x")</script>'
      const [asf] = validRiskLevelChange().changes
      getLatestRiskLevelChange.mockResolvedValue({
        submittedAt: '2026-11-18T14:30:00.000Z',
        changes: [{ ...asf, userComment: comment }]
      })

      const { $, result } = await getPage('/')

      expect(tableRows($, '#asf')[1][3]).toBe(comment)
      expect($('#asf script')).toHaveLength(0)
      expect(result).not.toContain(comment)
      expect(result).toContain('&lt;script&gt;')
    })
  })

  describe('GET /update-risk-level', () => {
    test('renders the form with its heading and instructions', async () => {
      const { $, statusCode } = await getPage('/update-risk-level')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Update risk level')
      expect($('main p.govuk-body').first().text().trim()).toContain(
        'increase, decrease or stay the same'
      )
      expect($('.govuk-error-summary')).toHaveLength(0)
    })

    test('renders a radio group for each of the three diseases with its current risk level', async () => {
      const { $ } = await getPage('/update-risk-level')
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
      const { $ } = await getPage('/update-risk-level')
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

    test.each([
      ['asf', 'African swine fever'],
      ['hpai', 'Highly pathogenic avian influenza'],
      ['bluetongue', 'Bluetongue']
    ])(
      'renders a comment box with a character count for %s',
      async (id, name) => {
        const { $ } = await getPage('/update-risk-level')
        const field = `userComment-${id}`

        expect($(`label[for="${field}"]`).text().trim()).toBe(
          `Comment for ${name}`
        )
        expect($(`textarea#${field}`).attr('name')).toBe(field)
        expect(
          $(`textarea#${field}`)
            .closest('[data-module="govuk-character-count"]')
            .attr('data-maxlength')
        ).toBe('500')
      }
    )

    test('does not render a shared comment box', async () => {
      const { $ } = await getPage('/update-risk-level')

      expect($('textarea')).toHaveLength(3)
    })

    test('renders a Continue button and a CSRF token', async () => {
      const { $ } = await getPage('/update-risk-level')

      expect($('main form button').text().trim()).toBe('Continue')
      expect($('main form input[name="crumb"]').val()).toBeTruthy()
    })
  })

  describe('POST /update-risk-level', () => {
    test('rejects an empty submission with a direction and a comment error per disease', async () => {
      const { $, statusCode } = await createSession(server).submitForm(
        '/update-risk-level',
        {}
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('head > title').text().trim()).toBe(
        'Error: Update risk level | IDM Insights'
      )
      expect(summaryErrors($).map(({ href }) => href)).toEqual([
        '#direction-asf',
        '#userComment-asf',
        '#direction-hpai',
        '#userComment-hpai',
        '#direction-bluetongue',
        '#userComment-bluetongue'
      ])
      expect($('.govuk-error-message')).toHaveLength(6)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('links every error in the summary to a field on the page', async () => {
      const { $ } = await createSession(server).submitForm(
        '/update-risk-level',
        {}
      )

      for (const { href } of summaryErrors($)) {
        expect($(href)).toHaveLength(1)
      }
    })

    test('rejects a submission missing a comment and shows the error', async () => {
      const { $, statusCode } = await createSession(server).submitForm(
        '/update-risk-level',
        { ...validFormPayload(), 'userComment-hpai': '' }
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(summaryErrors($)).toEqual([
        {
          text: 'Enter a comment for Highly pathogenic avian influenza',
          href: '#userComment-hpai'
        }
      ])
      expect($('#userComment-hpai-error').text().trim()).toContain(
        'Enter a comment for Highly pathogenic avian influenza'
      )
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('keeps the chosen directions and comments when re-rendering with an error', async () => {
      const { $ } = await createSession(server).submitForm(
        '/update-risk-level',
        {
          ...validFormPayload(),
          'direction-bluetongue': undefined,
          'userComment-asf': 'Kept comment'
        }
      )

      expect(
        $('input[name="direction-asf"][value="increase"]').attr('checked')
      ).toBeDefined()
      expect(
        $('input[name="direction-hpai"][value="same"]').attr('checked')
      ).toBeDefined()
      expect($('textarea#userComment-asf').text()).toBe('Kept comment')
      expect($('textarea#userComment-bluetongue').text()).toBe(
        'Vector season has ended.'
      )
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
        '/update-risk-level',
        { 'direction-asf': 'increase', 'userComment-asf': 'Comment' }
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
      await session.get('/update-risk-level')
      const { statusCode } = await session.post(
        '/update-risk-level',
        validFormPayload()
      )

      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('redirects a valid submission to check your answers without submitting it', async () => {
      const session = createSession(server)
      const { statusCode, headers } = await session.submitForm(
        '/update-risk-level',
        validFormPayload()
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level/check-answers')
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })
  })

  describe('GET /update-risk-level/check-answers', () => {
    test('redirects to the form when there are no answers to check', async () => {
      const { statusCode, headers } = await createSession(server).get(
        '/update-risk-level/check-answers'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level')
    })

    test('shows a card for each disease with its current level, direction, new level and comment', async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())

      const { $, statusCode } = await session.get(
        '/update-risk-level/check-answers'
      )
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
      expect(firstCard).toEqual([
        'Medium',
        'Increase',
        'High',
        'New outbreaks reported in domestic pigs.'
      ])
    })

    test("links each disease's answers back to their fields on the form", async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())

      const { $ } = await session.get('/update-risk-level/check-answers')
      const changeLinks = $('.govuk-summary-list')
        .first()
        .find('.govuk-summary-list__actions a')
        .map((_, link) => $(link).attr('href'))
        .get()

      expect(changeLinks).toEqual([
        '/update-risk-level#direction-asf',
        '/update-risk-level#userComment-asf'
      ])
      expect($('.govuk-summary-list')).toHaveLength(3)
    })

    test('pre-fills the form with the answers when Change is used', async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())

      const { $ } = await session.get('/update-risk-level')

      expect(
        $('input[name="direction-asf"][value="increase"]').attr('checked')
      ).toBeDefined()
      expect(
        $('input[name="direction-bluetongue"][value="decrease"]').attr(
          'checked'
        )
      ).toBeDefined()
      expect(
        currentRiskLevels().map(({ id }) =>
          $(`textarea#userComment-${id}`).text()
        )
      ).toEqual(
        validRiskLevelChange().changes.map(({ userComment }) => userComment)
      )
    })
  })

  describe('POST /update-risk-level/check-answers', () => {
    test('logs and submits the checked answers once', async () => {
      logInfo.mockClear()
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())
      await session.submitForm('/update-risk-level/check-answers', {})

      expect(submitRiskLevelChange).toHaveBeenCalledTimes(1)
      expect(submitRiskLevelChange).toHaveBeenCalledWith(validRiskLevelChange())
      expect(logInfo).toHaveBeenCalledWith(
        'Risk level change submitted for asf:increase, hpai:same, bluetongue:decrease'
      )
    })

    test('never logs any comment', async () => {
      logInfo.mockClear()
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())
      await session.submitForm('/update-risk-level/check-answers', {})

      const logged = JSON.stringify(logInfo.mock.calls)
      for (const { userComment } of validRiskLevelChange().changes) {
        expect(logged).not.toContain(userComment)
      }
    })

    test('rejects a submission without a CSRF token', async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())
      const { statusCode } = await session.post(
        '/update-risk-level/check-answers',
        {}
      )

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('redirects to the confirmation page after submitting', async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())
      const { statusCode, headers } = await session.submitForm(
        '/update-risk-level/check-answers',
        {}
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level/confirmation')
    })

    test('clears the answers after submitting, so they cannot be sent twice', async () => {
      const session = createSession(server)
      await session.submitForm('/update-risk-level', validFormPayload())
      await session.submitForm('/update-risk-level/check-answers', {})

      const { statusCode, headers } = await session.get(
        '/update-risk-level/check-answers'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level')
    })

    test('does not submit when there are no answers to check', async () => {
      const session = createSession(server)
      const { crumb } = {
        crumb: (await session.get('/update-risk-level'))
          .$('main input[name="crumb"]')
          .val()
      }
      const { statusCode, headers } = await session.post(
        '/update-risk-level/check-answers',
        { crumb }
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level')
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })
  })

  describe('GET /update-risk-level/confirmation', () => {
    test('renders the confirmation panel', async () => {
      const { $, statusCode } = await getPage('/update-risk-level/confirmation')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1.govuk-panel__title').text().trim()).toBe(
        'Submission received'
      )
    })

    test('links back to home and to add another', async () => {
      const { $ } = await getPage('/update-risk-level/confirmation')

      expect(linksIn($, 'main a.govuk-link')).toEqual([
        { text: 'Home', href: '/' },
        { text: 'Add another', href: '/update-risk-level' }
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
