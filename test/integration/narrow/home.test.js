import * as cheerio from 'cheerio'
import { JSDOM } from 'jsdom'

import { config } from '#/config/config.js'
import { statusCodes } from '#/constants/status-codes.js'
import { createServer } from '#/server.js'
import { submitRiskLevelChange } from '#/services/risk-level-service.js'
import {
  BACKEND_URL,
  NOW,
  assessment,
  backendFetch,
  riskDetails
} from '#test/helpers/backend-risk-fixtures.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

const TABLE_HEAD = ['Risk level', 'Change', 'Comment', 'Submitted', 'Source']

const textsOf = ($, elements) =>
  elements.map((_, element) => $(element).text().trim()).get()

const tabsOf = ($) =>
  $('.govuk-tabs__tab')
    .map((_, tab) => ({
      text: $(tab).text().trim(),
      href: $(tab).attr('href')
    }))
    .get()

const tableRows = ($, panel) =>
  $(panel)
    .find('.govuk-table__body .govuk-table__row')
    .map((_, row) => [
      textsOf($, $(row).find('.govuk-table__header, .govuk-table__cell'))
    ])
    .get()

describe('GET /', () => {
  let server
  const logError = vi.fn()

  beforeAll(async () => {
    server = await createServer()
    server.ext('onPreHandler', (request, h) => {
      request.logger = { ...request.logger, error: logError }
      return h.continue
    })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const getPage = async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    return { $: cheerio.load(result), result, statusCode }
  }

  describe('with the backend API switched off', () => {
    test('shows the service in development banner', async () => {
      const { $ } = await getPage()

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
        const { $ } = await getPage()

        expect($('[data-testid="phase-banner"]')).toHaveLength(0)
      } finally {
        config.set('serviceInDevelopmentBanner.enabled', true)
      }
    })

    test('renders the home page', async () => {
      const { $, statusCode } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('head > title').text().trim()).toBe('Home | IDM Insights')
      expect($('h1').text().trim()).toBe('IDM Insights')
    })

    test('links to the update risk level page', async () => {
      const { $ } = await getPage()

      expect(
        $('main a.govuk-link')
          .map((_, a) => ({
            text: $(a).text().trim(),
            href: $(a).attr('href')
          }))
          .get()
      ).toEqual([{ text: 'Update risk level', href: '/update-risk-level' }])
    })

    test('marks Home as the current navigation item', async () => {
      const { $ } = await getPage()

      expect($('[aria-current="page"]').text().trim()).toBe('Home')
    })

    test('shows placeholder history for each placeholder disease without calling the backend', async () => {
      const { $, statusCode } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect(fetch).not.toHaveBeenCalled()
      expect(tabsOf($)).toEqual([
        { text: 'African swine fever', href: '#disease-asf' },
        { text: 'Highly pathogenic avian influenza', href: '#disease-hpai' },
        { text: 'Bluetongue', href: '#disease-bluetongue' }
      ])
      $('.govuk-tabs__panel').each((_, panel) => {
        const rows = tableRows($, panel)

        expect(textsOf($, $(panel).find('.govuk-table__head th'))).toEqual(
          TABLE_HEAD
        )
        expect(rows.length).toBeGreaterThanOrEqual(2)
        for (const row of rows) {
          expect(row[4]).toBe('Placeholder data')
        }
      })
    })

    test('does not show a risk level change submitted through this service', async () => {
      const { $: before } = await getPage()
      await submitRiskLevelChange(validRiskLevelChange())

      const { $, result } = await getPage()

      expect(tableRows($, '#disease-asf')).toEqual(
        tableRows(before, '#disease-asf')
      )
      for (const { userComment } of validRiskLevelChange().changes) {
        expect(result).not.toContain(userComment)
      }
      expect(result).not.toContain('Latest update')
    })
  })

  describe('with the backend API switched on', () => {
    beforeEach(() => {
      config.set('backendApi.enabled', true)
      config.set('backendApi.url', BACKEND_URL)
    })

    afterEach(() => {
      config.reset('backendApi.enabled')
      config.reset('backendApi.url')
    })

    test('requests the summaries once, then each risk detail', async () => {
      fetch.mockImplementation(backendFetch())

      await getPage()

      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        `${BACKEND_URL}/risks?pageSize=200`,
        `${BACKEND_URL}/risks/00000000-0000-4000-a000-000000000001`,
        `${BACKEND_URL}/risks/00000000-0000-4000-a000-000000000002`
      ])
    })

    test('shows a tab per disease, in backend order, each with a table captioned with its label', async () => {
      fetch.mockImplementation(backendFetch())

      const { $, statusCode } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('main h2').first().text().trim()).toBe('Risk level changes')
      expect(tabsOf($)).toEqual([
        {
          text: 'African swine fever',
          href: '#disease-00000000-0000-4000-a000-000000000001'
        },
        {
          text: 'Avian influenza (H5N1)',
          href: '#disease-00000000-0000-4000-a000-000000000002'
        }
      ])
      expect(
        $('.govuk-tabs__panel')
          .map((_, panel) => [
            textsOf($, $(panel).find('table .govuk-table__caption'))
          ])
          .get()
      ).toEqual([['African swine fever'], ['Avian influenza (H5N1)']])
    })

    // GOV.UK Tabs finds each panel with querySelector(`#${id}`). Backend ids are UUIDs that can start
    // with a digit, which is not a valid CSS id selector, so the tabs would never switch.
    test('gives each tab a panel id that the GOV.UK tabs script can select', async () => {
      fetch.mockImplementation(backendFetch())

      const { result } = await getPage()
      const { document } = new JSDOM(result).window
      const hrefs = [...document.querySelectorAll('a.govuk-tabs__tab')].map(
        (tab) => tab.getAttribute('href')
      )

      expect(hrefs).toHaveLength(2)
      for (const href of hrefs) {
        const panel = document.querySelector('.govuk-tabs').querySelector(href)

        expect(panel.classList.contains('govuk-tabs__panel')).toBe(true)
      }
    })

    test('shows only the risk level, change, comment, submitted and source columns', async () => {
      fetch.mockImplementation(backendFetch())

      const { $, result } = await getPage()

      $('.govuk-tabs__panel').each((_, panel) => {
        expect(textsOf($, $(panel).find('.govuk-table__head th'))).toEqual(
          TABLE_HEAD
        )
      })
      expect(result).not.toContain('Default')
      expect(result).not.toContain('Latest update')
    })

    test('shows one row per assessment in the window, newest first', async () => {
      fetch.mockImplementation(backendFetch())

      const { $ } = await getPage()

      expect(
        tableRows($, '#disease-00000000-0000-4000-a000-000000000001')
      ).toEqual([
        [
          'Medium',
          'Deteriorating',
          '–',
          '6 November 2026',
          'Defra outbreak assessment'
        ],
        [
          'Low',
          'Deteriorating',
          '–',
          '14 August 2026',
          'Preliminary outbreak assessment'
        ]
      ])
      expect(
        tableRows($, '#disease-00000000-0000-4000-a000-000000000002')
      ).toEqual([
        ['High', 'No change', '–', '1 October 2026', 'Risk assessment']
      ])
    })

    test('escapes backend text so it is shown and never injected', async () => {
      const malicious = '<script>alert("x")</script>'
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, risk: assessment({ source: malicious }) }])
      )

      const { $, result } = await getPage()

      expect(
        tableRows($, '#disease-00000000-0000-4000-a000-000000000001')[0][4]
      ).toBe(malicious)
      expect(result).not.toContain(malicious)
    })

    describe.each([
      ['the summaries respond with an error', { failPath: '/risks' }],
      [
        'a risk detail responds with an error',
        { failPath: '/risks/00000000-0000-4000-a000-000000000002' }
      ],
      [
        'a risk detail cannot be reached',
        {
          failPath: '/risks/00000000-0000-4000-a000-000000000001',
          failWith: 'network'
        }
      ]
    ])('when %s', (_, failure) => {
      test('responds with the something went wrong page and no table', async () => {
        fetch.mockImplementation(backendFetch(riskDetails(), failure))

        const { $, result, statusCode } = await getPage()

        expect(statusCode).toBe(statusCodes.internalServerError)
        expect($('head > title').text().trim()).toBe(
          'Something went wrong | IDM Insights'
        )
        expect($('main p').text().trim()).toBe('Something went wrong')
        expect($('.govuk-tabs, .govuk-table')).toHaveLength(0)
        expect(result).not.toContain('African swine fever')
      })

      test('logs the error without the response body', async () => {
        fetch.mockImplementation(backendFetch(riskDetails(), failure))

        await getPage()

        expect(logError).toHaveBeenCalledTimes(1)
        expect(logError.mock.calls[0][0]).toEqual(expect.any(String))
        expect(logError.mock.calls[0][0]).not.toContain('Server error')
      })
    })

    test('says no risk levels have been recorded when the backend has no risks', async () => {
      fetch.mockImplementation(backendFetch([]))

      const { $, statusCode } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect($('main h2').first().text().trim()).toBe('Risk level changes')
      expect($('[data-testid="no-risk-levels"]').text().trim()).toBe(
        'No risk levels have been recorded yet.'
      )
      expect($('.govuk-tabs, .govuk-table')).toHaveLength(0)
      expect(logError).not.toHaveBeenCalled()
    })

    test('responds with the something went wrong page when a disease has no assessments in the window', async () => {
      const [asf, avianInfluenza] = riskDetails()
      fetch.mockImplementation(
        backendFetch([
          asf,
          {
            ...avianInfluenza,
            risk: assessment({ dateReported: '2026-01-10T00:00:00.000Z' })
          }
        ])
      )

      const { $, statusCode } = await getPage()

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect($('main p').text().trim()).toBe('Something went wrong')
      expect($('.govuk-tabs, .govuk-table')).toHaveLength(0)
      expect(logError.mock.calls[0][0]).toContain(
        'Risk 00000000-0000-4000-a000-000000000002 has no assessments in the last 6 months'
      )
    })
  })
})
