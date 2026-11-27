import { subMonths } from 'date-fns'

import { config } from '#/config/config.js'
import { statusCodes } from '#/constants/status-codes.js'
import * as riskLevelService from '#/services/risk-level-service.js'
import { HttpError, NetworkError } from '#/utils/http-client.js'
import { createLogger } from '#/utils/logger.js'
import {
  BACKEND_URL,
  NOW,
  assessment,
  backendFetch,
  riskDetails
} from '#test/helpers/backend-risk-fixtures.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

const { getCurrentRiskLevels, getRiskLevelHistory, submitRiskLevelChange } =
  riskLevelService

const switchBackendOn = () => {
  beforeEach(() => {
    config.set('backendApi.enabled', true)
    config.set('backendApi.url', BACKEND_URL)
  })

  afterEach(() => {
    config.reset('backendApi.enabled')
    config.reset('backendApi.url')
  })
}

const requestedUrls = () => fetch.mock.calls.map(([url]) => url)

describe('#riskLevelService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('getCurrentRiskLevels resolves with three diseases, each with a current risk level', async () => {
    const diseases = await getCurrentRiskLevels()

    expect(diseases).toHaveLength(3)
    for (const disease of diseases) {
      expect(disease).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        currentRiskLevel: expect.any(String)
      })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  describe('getCurrentRiskLevels with the backend API switched on', () => {
    switchBackendOn()

    test('requests the risks from the backend in a single page', async () => {
      fetch.mockResolvedValue(Response.json({ items: [] }))

      await getCurrentRiskLevels()

      expect(requestedUrls()).toEqual([`${BACKEND_URL}/risks?pageSize=200`])
    })

    test('maps each backend risk to a disease with its current risk level', async () => {
      fetch.mockResolvedValue(
        Response.json({
          items: [
            {
              id: 'risk-1',
              disease: { name: 'African swine fever' },
              risk: { status: 'very low' }
            },
            {
              id: 'risk-2',
              disease: { name: 'Avian influenza' },
              strain: 'H5N1',
              risk: { status: 'medium' }
            }
          ]
        })
      )

      await expect(getCurrentRiskLevels()).resolves.toEqual([
        {
          id: 'risk-1',
          name: 'African swine fever',
          currentRiskLevel: 'very-low'
        },
        {
          id: 'risk-2',
          name: 'Avian influenza (H5N1)',
          currentRiskLevel: 'medium'
        }
      ])
    })

    test('rejects with an HttpError when the backend responds with an error', async () => {
      fetch.mockResolvedValue(
        new Response('Server error', {
          status: statusCodes.internalServerError
        })
      )

      await expect(getCurrentRiskLevels()).rejects.toBeInstanceOf(HttpError)
    })

    test('rejects with a NetworkError when the backend cannot be reached', async () => {
      fetch.mockRejectedValue(new TypeError('fetch failed'))

      await expect(getCurrentRiskLevels()).rejects.toBeInstanceOf(NetworkError)
    })
  })

  describe('getRiskLevelHistory with the backend API switched off', () => {
    test('makes no HTTP request', async () => {
      await getRiskLevelHistory()

      expect(fetch).not.toHaveBeenCalled()
    })

    test('gives each placeholder disease at least 2 placeholder assessments inside the window, newest first', async () => {
      const windowStart = subMonths(NOW, 6)
      const diseases = await getRiskLevelHistory()

      expect(diseases.map(({ id }) => id)).toEqual([
        'asf',
        'hpai',
        'bluetongue'
      ])
      for (const { label, assessments } of diseases) {
        expect(label).toEqual(expect.any(String))
        expect(assessments.length).toBeGreaterThanOrEqual(2)

        const dates = assessments.map(({ dateReported }) =>
          new Date(dateReported).getTime()
        )
        expect(dates).toEqual(dates.toSorted((a, b) => b - a))

        for (const placeholder of assessments) {
          expect(placeholder).toEqual({
            status: expect.any(String),
            previousStatus: expect.any(String),
            levelChange: expect.any(String),
            source: 'Placeholder data',
            dateReported: expect.any(String)
          })
          expect(new Date(placeholder.dateReported) >= windowStart).toBe(true)
          expect(new Date(placeholder.dateReported) <= NOW).toBe(true)
        }
      }
    })

    test('starts each placeholder history at the disease current risk level', async () => {
      const current = await getCurrentRiskLevels()
      const history = await getRiskLevelHistory()

      expect(
        history.map(({ assessments }) =>
          assessments[0].status.replaceAll(' ', '-')
        )
      ).toEqual(current.map(({ currentRiskLevel }) => currentRiskLevel))
    })
  })

  describe('getRiskLevelHistory with the backend API switched on', () => {
    switchBackendOn()

    test('requests the summaries once, then the detail of each risk returned', async () => {
      fetch.mockImplementation(backendFetch())

      await getRiskLevelHistory()

      expect(requestedUrls()).toEqual([
        `${BACKEND_URL}/risks?pageSize=200`,
        `${BACKEND_URL}/risks/00000000-0000-4000-a000-000000000001`,
        `${BACKEND_URL}/risks/00000000-0000-4000-a000-000000000002`
      ])
    })

    test('sends every request with the backend timeout', async () => {
      fetch.mockImplementation(backendFetch())

      await getRiskLevelHistory()

      for (const [, options] of fetch.mock.calls) {
        expect(options.signal).toBeInstanceOf(AbortSignal)
      }
    })

    test('labels each disease with its name and strain, in the order the backend lists them', async () => {
      fetch.mockImplementation(backendFetch())

      const diseases = await getRiskLevelHistory()

      expect(diseases.map(({ id, label }) => ({ id, label }))).toEqual([
        {
          id: '00000000-0000-4000-a000-000000000001',
          label: 'African swine fever'
        },
        {
          id: '00000000-0000-4000-a000-000000000002',
          label: 'Avian influenza (H5N1)'
        }
      ])
    })

    test('combines the current assessment with the history inside the window, newest first', async () => {
      fetch.mockImplementation(backendFetch())

      const [asf, avianInfluenza] = await getRiskLevelHistory()
      const [inWindow, beforeWindow] = riskDetails()[0].riskHistory

      expect(asf.assessments).toEqual([assessment(), inWindow])
      expect(beforeWindow.dateReported < '2026-05-25').toBe(true)
      expect(avianInfluenza.assessments).toEqual([riskDetails()[1].risk])
    })

    test('keeps an assessment reported on the first day of the window', async () => {
      const onWindowStart = assessment({
        dateReported: '2026-05-25T12:00:00.000Z'
      })
      const dayBefore = assessment({ dateReported: '2026-05-24T23:59:59.000Z' })
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, riskHistory: [onWindowStart, dayBefore] }])
      )

      const [{ assessments }] = await getRiskLevelHistory()

      expect(assessments).toEqual([assessment(), onWindowStart])
    })

    test('keeps an assessment reported at the time of the request, and drops one reported after it', async () => {
      const atRequest = assessment({ dateReported: NOW.toISOString() })
      const justAfter = assessment({ dateReported: '2026-11-25T12:00:00.001Z' })
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, riskHistory: [justAfter, atRequest] }])
      )

      const [{ assessments }] = await getRiskLevelHistory()

      expect(assessments).toEqual([atRequest, assessment()])
    })

    test('rejects when a disease has only future assessments', async () => {
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([
          {
            ...asf,
            risk: assessment({ dateReported: '2026-11-26T00:00:00.000Z' }),
            riskHistory: []
          }
        ])
      )

      await expect(getRiskLevelHistory()).rejects.toThrow(
        'Risk 00000000-0000-4000-a000-000000000001 has no assessments in the last 6 months'
      )
    })

    test('rejects naming the risk when an assessment has an invalid dateReported', async () => {
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([
          {
            ...asf,
            riskHistory: [assessment({ dateReported: 'not a date' })]
          }
        ])
      )

      await expect(getRiskLevelHistory()).rejects.toThrow(
        'Risk 00000000-0000-4000-a000-000000000001 has an assessment with an invalid dateReported'
      )
    })

    test('orders the assessments newest first when the backend does not', async () => {
      const older = assessment({ dateReported: '2026-06-01T00:00:00.000Z' })
      const newer = assessment({ dateReported: '2026-11-20T00:00:00.000Z' })
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, riskHistory: [older, newer] }])
      )

      const [{ assessments }] = await getRiskLevelHistory()

      expect(assessments).toEqual([newer, assessment(), older])
    })

    test('shows an assessment only once when the history repeats the current one', async () => {
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, riskHistory: [assessment()] }])
      )

      const [{ assessments }] = await getRiskLevelHistory()

      expect(assessments).toEqual([assessment()])
    })

    test('treats a missing history as empty', async () => {
      const [asf] = riskDetails()
      fetch.mockImplementation(
        backendFetch([{ ...asf, riskHistory: undefined }])
      )

      const [{ assessments }] = await getRiskLevelHistory()

      expect(assessments).toEqual([assessment()])
    })

    test('uses the configured history window', async () => {
      // From 25 September 2026: keeps the November assessment, drops the August one
      config.set('backendApi.historyMonths', 2)
      fetch.mockImplementation(backendFetch())

      try {
        const [asf] = await getRiskLevelHistory()

        expect(asf.assessments).toEqual([assessment()])
      } finally {
        config.reset('backendApi.historyMonths')
      }
    })

    test.each([
      ['the summaries', '/risks'],
      ['a risk detail', '/risks/00000000-0000-4000-a000-000000000002']
    ])(
      'rejects with an HttpError when %s request fails',
      async (_, failPath) => {
        fetch.mockImplementation(backendFetch(riskDetails(), { failPath }))

        await expect(getRiskLevelHistory()).rejects.toBeInstanceOf(HttpError)
      }
    )

    test('rejects with a NetworkError when a risk detail cannot be reached', async () => {
      fetch.mockImplementation(
        backendFetch(riskDetails(), {
          failPath: '/risks/00000000-0000-4000-a000-000000000001',
          failWith: 'network'
        })
      )

      await expect(getRiskLevelHistory()).rejects.toBeInstanceOf(NetworkError)
    })

    describe('when a disease has no assessments in the window', () => {
      const staleRisk = () => ({
        ...riskDetails()[0],
        risk: assessment({ dateReported: '2026-01-10T00:00:00.000Z' }),
        riskHistory: []
      })

      test('rejects naming the risk and the window', async () => {
        fetch.mockImplementation(backendFetch([staleRisk()]))

        await expect(getRiskLevelHistory()).rejects.toThrow(
          'Risk 00000000-0000-4000-a000-000000000001 has no assessments in the last 6 months'
        )
      })

      test('logs an error with the risk id and the window in months', async () => {
        const logError = vi.spyOn(createLogger(), 'error')
        fetch.mockImplementation(backendFetch([staleRisk()]))

        await expect(getRiskLevelHistory()).rejects.toThrow()

        expect(logError).toHaveBeenCalledWith(
          {
            event: {
              type: 'risk_level_history',
              action: 'filter_history',
              reference: '00000000-0000-4000-a000-000000000001',
              reason: 'No assessments in the last 6 months',
              outcome: 'failure'
            }
          },
          'Risk 00000000-0000-4000-a000-000000000001 has no assessments in the last 6 months'
        )
      })
    })

    describe('when the backend has no risks', () => {
      test('resolves with no diseases after only the summaries request', async () => {
        fetch.mockImplementation(backendFetch([]))

        await expect(getRiskLevelHistory()).resolves.toEqual([])
        expect(requestedUrls()).toEqual([`${BACKEND_URL}/risks?pageSize=200`])
      })

      test('logs a warning so an environment missing its data is noticed', async () => {
        const logWarn = vi.spyOn(createLogger(), 'warn')
        fetch.mockImplementation(backendFetch([]))

        await getRiskLevelHistory()

        expect(logWarn).toHaveBeenCalledWith(
          {
            event: {
              type: 'risk_level_history',
              action: 'list_risks',
              reason: 'The backend returned no risks',
              outcome: 'success'
            }
          },
          'The backend returned no risks'
        )
      })
    })
  })

  test('submitRiskLevelChange resolves without sending the data over the network', async () => {
    await expect(
      submitRiskLevelChange(validRiskLevelChange())
    ).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('no longer keeps or returns submitted risk level changes', () => {
    expect(riskLevelService).not.toHaveProperty('getLatestRiskLevelChange')
    expect(riskLevelService).not.toHaveProperty('resetLatestRiskLevelChange')
  })
})
