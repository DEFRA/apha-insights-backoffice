import { statusCodes } from '#/constants/status-codes.js'

/**
 * The time requests are made at in tests. With the default 6 month window, the window starts on 25 May 2026
 */
export const NOW = new Date('2026-11-25T12:00:00.000Z')

export const BACKEND_URL = 'http://backend.test:3001'

/**
 * A backend risk assessment
 * @param {object} [overrides]
 */
export const assessment = (overrides = {}) => ({
  status: 'medium',
  previousStatus: 'low',
  levelChange: 'deteriorating',
  source: 'Defra outbreak assessment',
  dateReported: '2026-11-06T00:00:00.000Z',
  ...overrides
})

/**
 * Backend risk details, as GET /risks/{riskId} returns them.
 * Assessments are newest first, and the current one is not repeated in the history.
 */
export const riskDetails = () => [
  {
    id: '00000000-0000-4000-a000-000000000001',
    disease: { code: 'ASF', name: 'African swine fever' },
    risk: assessment(),
    riskHistory: [
      assessment({
        status: 'low',
        previousStatus: 'very low',
        levelChange: 'deteriorating',
        source: 'Preliminary outbreak assessment',
        dateReported: '2026-08-14T00:00:00.000Z'
      }),
      assessment({
        status: 'very low',
        previousStatus: 'very low',
        levelChange: 'no change',
        dateReported: '2026-03-02T00:00:00.000Z'
      })
    ]
  },
  {
    id: '00000000-0000-4000-a000-000000000002',
    disease: { code: 'AI', name: 'Avian influenza' },
    strain: 'H5N1',
    risk: assessment({
      status: 'high',
      previousStatus: 'high',
      levelChange: 'no change',
      source: 'Risk assessment',
      dateReported: '2026-10-01T00:00:00.000Z'
    }),
    riskHistory: []
  }
]

/**
 * A risk detail without its history, as GET /risks returns it
 * @param {object} detail
 */
export const toSummary = (detail) =>
  Object.fromEntries(
    Object.entries(detail).filter(([key]) => key !== 'riskHistory')
  )

const jsonResponse = (body) => Response.json(body)

/**
 * A fetch implementation that answers like the backend, for the given risk details
 * @param {object[]} [details]
 * @param {{failPath?: string, failWith?: 'error' | 'network'}} [options] - make one path fail
 */
export const backendFetch =
  (details = riskDetails(), { failPath, failWith = 'error' } = {}) =>
  async (url) => {
    const { pathname } = new URL(url)

    if (pathname === failPath) {
      if (failWith === 'network') {
        throw new TypeError('fetch failed')
      }

      return new Response('Server error', {
        status: statusCodes.internalServerError
      })
    }

    if (pathname === '/risks') {
      return jsonResponse({ items: details.map(toSummary) })
    }

    const detail = details.find(({ id }) => pathname === `/risks/${id}`)

    return detail
      ? jsonResponse(detail)
      : new Response('Not found', { status: statusCodes.notFound })
  }
