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

let server

const SELECT_PATH = '/update-risk-level'
const CHANGE_PATH = '/update-risk-level/change'
const CHECK_ANSWERS_PATH = '/update-risk-level/check-answers'
const ALL_IDS = ['asf', 'hpai', 'bluetongue']

/**
 * Ticks the given diseases on the select page, as a user does before the risk level form
 */
const selectDiseases = (session, ids = ALL_IDS) =>
  session.submitForm(SELECT_PATH, { diseases: ids })

/**
 * Selects diseases and opens the risk level form in a new session
 */
const openForm = async (ids = ALL_IDS) => {
  const session = createSession(server)
  await selectDiseases(session, ids)

  return session.get(CHANGE_PATH)
}

/**
 * Selects diseases then submits the risk level form in a new session
 */
const submitChange = async (payload, ids = ALL_IDS) => {
  const session = createSession(server)
  await selectDiseases(session, ids)

  return session.submitForm(CHANGE_PATH, payload)
}

/**
 * Completes the select and risk level form steps, leaving the user on check your answers
 */
const fillForm = async (session, payload = validFormPayload()) => {
  await selectDiseases(session)

  return session.submitForm(CHANGE_PATH, payload)
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
    test('renders the select diseases page with a checkbox for each disease', async () => {
      const { $, statusCode } = await getPage(SELECT_PATH)
      const labels = $('.govuk-checkboxes__label')
        .map((_, label) => $(label).text().trim())
        .get()
      const values = $('input[name="diseases"]')
        .map((_, input) => $(input).val())
        .get()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('head > title').text().trim()).toBe(
        'Which diseases do you want to update? | IDM Insights'
      )
      expect($('fieldset legend h1').text().trim()).toBe(
        'Which diseases do you want to update?'
      )
      expect($('fieldset .govuk-hint').text().trim()).toBe(
        'Select all that apply'
      )
      expect(labels).toEqual([
        'African swine fever',
        'Highly pathogenic avian influenza',
        'Bluetongue'
      ])
      expect(values).toEqual(ALL_IDS)
      expect($('input[name="diseases"][checked]')).toHaveLength(0)
      expect($('.govuk-error-summary')).toHaveLength(0)
    })

    test('sends the security headers', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: SELECT_PATH
      })

      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['strict-transport-security']).toBeDefined()
      expect(headers['content-security-policy']).toBeDefined()
    })

    test('renders a Continue button and a CSRF token', async () => {
      const { $ } = await getPage(SELECT_PATH)

      expect($('main form button').text().trim()).toBe('Continue')
      expect($('main form input[name="crumb"]').val()).toBeTruthy()
      expect($('main form').attr('action')).toBe(SELECT_PATH)
    })

    test('ticks the diseases already chosen when the user comes back', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf', 'bluetongue'])

      const { $ } = await session.get(SELECT_PATH)
      const checked = $('input[name="diseases"][checked]')
        .map((_, input) => $(input).val())
        .get()

      expect(checked).toEqual(['asf', 'bluetongue'])
    })
  })

  describe('POST /update-risk-level', () => {
    test('rejects an empty selection with the error summary and inline error', async () => {
      const { $, statusCode } = await createSession(server).submitForm(
        SELECT_PATH,
        {}
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('head > title').text().trim()).toBe(
        'Error: Which diseases do you want to update? | IDM Insights'
      )
      expect(summaryErrors($)).toEqual([
        { text: 'Select at least one disease to update', href: '#diseases' }
      ])
      expect($('#diseases-error').text().trim()).toContain(
        'Select at least one disease to update'
      )
      expect($('#diseases')).toHaveLength(1)
      expect($('fieldset legend')).toHaveLength(1)
    })

    test('does not echo a malicious submitted value back in the page', async () => {
      const malicious = '<script>alert(1)</script>'
      const response = await createSession(server).submitForm(SELECT_PATH, {
        diseases: [malicious]
      })

      expect(response.statusCode).toBe(statusCodes.badRequest)
      expect(response.payload).not.toContain(malicious)
    })

    test('does not keep unknown values when a known disease is also ticked', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf', '../etc/passwd'])
      const { $ } = await session.get(SELECT_PATH)
      const checked = $('input[name="diseases"][checked]')
        .map((_, input) => $(input).val())
        .get()

      expect(checked).toEqual(['asf'])
    })

    test('rejects a selection of only unknown diseases', async () => {
      const { $, statusCode } = await createSession(server).submitForm(
        SELECT_PATH,
        { diseases: ['not-a-disease'] }
      )

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(summaryErrors($)).toHaveLength(1)
    })

    test('rejects a submission without a CSRF token', async () => {
      const session = createSession(server)
      await session.get(SELECT_PATH)
      const { statusCode } = await session.post(SELECT_PATH, {
        diseases: 'asf'
      })

      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('redirects a single selection to the risk level form', async () => {
      const { statusCode, headers } = await selectDiseases(
        createSession(server),
        ['asf']
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(CHANGE_PATH)
    })

    test('ignores submitted values that are not known diseases', async () => {
      const session = createSession(server)
      const { headers } = await selectDiseases(session, [
        'not-a-disease',
        'hpai'
      ])
      const { $ } = await session.get(CHANGE_PATH)

      expect(headers.location).toBe(CHANGE_PATH)
      expect($('.govuk-radios')).toHaveLength(1)
      expect($('input[name="direction-hpai"]')).toHaveLength(3)
    })

    test('keeps the answers for diseases that are still selected and drops the rest', async () => {
      const session = createSession(server)
      await fillForm(session)
      await selectDiseases(session, ['hpai', 'bluetongue'])

      const { $ } = await session.get(CHANGE_PATH)
      const checkAnswers = await session.get(CHECK_ANSWERS_PATH)

      expect($('input[name="direction-asf"]')).toHaveLength(0)
      expect(
        $('input[name="direction-hpai"][value="same"]').attr('checked')
      ).toBeDefined()
      expect($('textarea#userComment-bluetongue').text()).toBe(
        'Vector season has ended.'
      )
      expect(
        checkAnswers
          .$('.govuk-summary-card__title')
          .map((_, title) => checkAnswers.$(title).text().trim())
          .get()
      ).toEqual(['Highly pathogenic avian influenza', 'Bluetongue'])
    })
  })

  describe('GET /update-risk-level/change', () => {
    test('redirects to the select page when no diseases are selected', async () => {
      const { statusCode, headers } =
        await createSession(server).get(CHANGE_PATH)

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(SELECT_PATH)
    })

    test('redirects to the select page when no selected disease exists any more', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf'])
      getCurrentRiskLevels.mockResolvedValue([
        { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'low' }
      ])

      const { statusCode, headers } = await session.get(CHANGE_PATH)

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(SELECT_PATH)
    })

    test('drops a selected disease that no longer exists and shows the rest', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf', 'bluetongue'])
      getCurrentRiskLevels.mockResolvedValue([
        { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'low' }
      ])

      const { $ } = await session.get(CHANGE_PATH)

      expect($('.govuk-radios')).toHaveLength(1)
      expect($('input[name="direction-bluetongue"]')).toHaveLength(3)
    })

    test('shows only the selected diseases, in the order of the select page', async () => {
      const { $, statusCode } = await openForm(['bluetongue', 'asf'])
      const legends = $('fieldset legend')
        .map((_, legend) => $(legend).text().trim())
        .get()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Update risk level')
      expect(legends).toEqual(['African swine fever', 'Bluetongue'])
      expect($('textarea')).toHaveLength(2)
      expect($('.govuk-error-summary')).toHaveLength(0)
    })

    test('has a back link to the select page', async () => {
      const { $ } = await openForm()

      expect($('.govuk-back-link').attr('href')).toBe(SELECT_PATH)
    })

    test('posts the form to the change path', async () => {
      const { $ } = await openForm()

      expect($('main form').attr('action')).toBe(CHANGE_PATH)
    })

    test('renders a radio group for each of the three diseases with its current risk level', async () => {
      const { $ } = await openForm()
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
      const { $ } = await openForm()
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
        const { $ } = await openForm()
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
      const { $ } = await openForm()

      expect($('textarea')).toHaveLength(3)
    })

    test('renders a Continue button and a CSRF token', async () => {
      const { $ } = await openForm()

      expect($('main form button').text().trim()).toBe('Continue')
      expect($('main form input[name="crumb"]').val()).toBeTruthy()
    })
  })

  describe('POST /update-risk-level/change', () => {
    test('redirects to the select page when no diseases are selected', async () => {
      const session = createSession(server)
      const crumb = (await session.get(SELECT_PATH))
        .$('main input[name="crumb"]')
        .val()
      const { statusCode, headers } = await session.post(CHANGE_PATH, {
        ...validFormPayload(),
        crumb
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(SELECT_PATH)
    })

    test('only asks about, validates and stores the selected diseases', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf', 'bluetongue'])
      const { statusCode, headers } = await session.submitForm(CHANGE_PATH, {
        ...validFormPayload(),
        'direction-hpai': 'sideways',
        'userComment-hpai': ''
      })
      await session.submitForm(CHECK_ANSWERS_PATH, {})

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(CHECK_ANSWERS_PATH)
      expect(submitRiskLevelChange).toHaveBeenCalledWith({
        changes: validRiskLevelChange().changes.filter(
          ({ id }) => id !== 'hpai'
        )
      })
    })

    test('rejects an empty submission with a direction and a comment error per selected disease', async () => {
      const { $, statusCode } = await submitChange({}, ['asf', 'hpai'])

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(summaryErrors($).map(({ href }) => href)).toEqual([
        '#direction-asf',
        '#userComment-asf',
        '#direction-hpai',
        '#userComment-hpai'
      ])
      expect($('.govuk-back-link').attr('href')).toBe(SELECT_PATH)
    })

    test('rejects an empty submission with a direction and a comment error per disease', async () => {
      const { $, statusCode } = await submitChange({})

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
      const { $ } = await submitChange({})

      for (const { href } of summaryErrors($)) {
        expect($(href)).toHaveLength(1)
      }
    })

    test('rejects a submission missing a comment and shows the error', async () => {
      const { $, statusCode } = await submitChange({
        ...validFormPayload(),
        'userComment-hpai': ''
      })

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
      const { $ } = await submitChange({
        ...validFormPayload(),
        'direction-bluetongue': undefined,
        'userComment-asf': 'Kept comment'
      })

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

      const { $, statusCode } = await submitChange(
        { 'direction-asf': 'increase', 'userComment-asf': 'Comment' },
        ['asf']
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
      await selectDiseases(session)
      await session.get(CHANGE_PATH)
      const { statusCode } = await session.post(CHANGE_PATH, validFormPayload())

      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('redirects a valid submission to check your answers without submitting it', async () => {
      const { statusCode, headers } = await submitChange(validFormPayload())

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(CHECK_ANSWERS_PATH)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })
  })

  describe('GET /update-risk-level/check-answers', () => {
    test('redirects to the select page when there are no answers to check', async () => {
      const { statusCode, headers } =
        await createSession(server).get(CHECK_ANSWERS_PATH)

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(SELECT_PATH)
    })

    test('redirects to the select page when diseases are selected but the form is not filled in', async () => {
      const session = createSession(server)
      await selectDiseases(session)

      const { statusCode, headers } = await session.get(CHECK_ANSWERS_PATH)

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(SELECT_PATH)
    })

    test('redirects to the form when a disease was added to the selection after the form was filled in', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf'])
      await session.submitForm(CHANGE_PATH, validFormPayload())
      await selectDiseases(session, ['asf', 'hpai'])

      const { statusCode, headers } = await session.get(CHECK_ANSWERS_PATH)

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe(CHANGE_PATH)
    })

    test('shows only the selected diseases and a link to change the selection', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['asf', 'bluetongue'])
      await session.submitForm(CHANGE_PATH, validFormPayload())

      const { $ } = await session.get(CHECK_ANSWERS_PATH)
      const titles = $('.govuk-summary-card__title')
        .map((_, title) => $(title).text().trim())
        .get()
      const selectionRow = $('.govuk-summary-list')
        .first()
        .find('.govuk-summary-list__row')

      expect(titles).toEqual(['African swine fever', 'Bluetongue'])
      expect(selectionRow.find('.govuk-summary-list__key').text().trim()).toBe(
        'Diseases to update'
      )
      expect(
        selectionRow.find('.govuk-summary-list__value').text().trim()
      ).toBe('African swine fever, Bluetongue')
      expect(selectionRow.find('a').attr('href')).toBe(SELECT_PATH)
    })

    test('shows a card for each disease with its current level, direction, new level and comment', async () => {
      const session = createSession(server)
      await fillForm(session)

      const { $, statusCode } = await session.get(
        '/update-risk-level/check-answers'
      )
      const titles = $('.govuk-summary-card__title')
        .map((_, title) => $(title).text().trim())
        .get()
      const firstCard = $('.govuk-summary-card .govuk-summary-list')
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
      await fillForm(session)

      const { $ } = await session.get('/update-risk-level/check-answers')
      const changeLinks = $('.govuk-summary-card .govuk-summary-list')
        .first()
        .find('.govuk-summary-list__actions a')
        .map((_, link) => $(link).attr('href'))
        .get()

      expect(changeLinks).toEqual([
        '/update-risk-level/change#direction-asf',
        '/update-risk-level/change#userComment-asf'
      ])
      expect($('.govuk-summary-card')).toHaveLength(3)
    })

    test('pre-fills the form with the answers when Change is used', async () => {
      const session = createSession(server)
      await fillForm(session)

      const { $ } = await session.get(CHANGE_PATH)

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
      await fillForm(session)
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
      await fillForm(session)
      await session.submitForm('/update-risk-level/check-answers', {})

      const logged = JSON.stringify(logInfo.mock.calls)
      for (const { userComment } of validRiskLevelChange().changes) {
        expect(logged).not.toContain(userComment)
      }
    })

    test('rejects a submission without a CSRF token', async () => {
      const session = createSession(server)
      await fillForm(session)
      const { statusCode } = await session.post(
        '/update-risk-level/check-answers',
        {}
      )

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(submitRiskLevelChange).not.toHaveBeenCalled()
    })

    test('redirects to the confirmation page after submitting', async () => {
      const session = createSession(server)
      await fillForm(session)
      const { statusCode, headers } = await session.submitForm(
        '/update-risk-level/check-answers',
        {}
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level/confirmation')
    })

    test('clears the answers after submitting, so they cannot be sent twice', async () => {
      const session = createSession(server)
      await fillForm(session)
      await session.submitForm('/update-risk-level/check-answers', {})

      const { statusCode, headers } = await session.get(
        '/update-risk-level/check-answers'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/update-risk-level')
    })

    test('clears the selected diseases after submitting', async () => {
      const session = createSession(server)
      await fillForm(session)
      await session.submitForm(CHECK_ANSWERS_PATH, {})

      const { $ } = await session.get(SELECT_PATH)
      const change = await session.get(CHANGE_PATH)

      expect($('input[name="diseases"][checked]')).toHaveLength(0)
      expect(change.headers.location).toBe(SELECT_PATH)
    })

    test('submits only the selected diseases', async () => {
      const session = createSession(server)
      await selectDiseases(session, ['hpai'])
      await session.submitForm(CHANGE_PATH, validFormPayload())
      await session.submitForm(CHECK_ANSWERS_PATH, {})

      expect(submitRiskLevelChange).toHaveBeenCalledWith({
        changes: validRiskLevelChange().changes.filter(
          ({ id }) => id === 'hpai'
        )
      })
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
