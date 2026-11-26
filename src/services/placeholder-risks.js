import { subDays } from 'date-fns'

// Marks every placeholder assessment, so it is never mistaken for backend data
const PLACEHOLDER_SOURCE = 'Placeholder data'

// How many days before the request each placeholder assessment was reported, newest first.
// All fall inside a window of 3 months or more.
const DAYS_AGO = [3, 20, 75]

// Each disease's assessments, newest first: [status, previousStatus, levelChange]
const PLACEHOLDER_DISEASES = [
  {
    id: 'asf',
    name: 'African swine fever',
    assessments: [
      ['medium', 'low', 'deteriorating'],
      ['low', 'low', 'no change'],
      ['low', 'very low', 'deteriorating']
    ]
  },
  {
    id: 'hpai',
    name: 'Highly pathogenic avian influenza',
    assessments: [
      ['high', 'high', 'no change'],
      ['high', 'medium', 'deteriorating'],
      ['medium', 'medium', 'undetermined']
    ]
  },
  {
    id: 'bluetongue',
    name: 'Bluetongue',
    assessments: [
      ['low', 'medium', 'improving'],
      ['medium', 'medium', 'no change'],
      ['medium', 'high', 'improving']
    ]
  }
]

/**
 * Made-up risks in the same shape as the backend's GET /risks/{riskId}, used when the backend API is switched off.
 * Dates are counted back from `now`, so they always fall inside the history window.
 * @param {Date} now
 * @returns {object[]}
 */
export const placeholderRisks = (now) =>
  PLACEHOLDER_DISEASES.map(({ id, name, assessments }) => {
    const [risk, ...riskHistory] = assessments.map(
      ([status, previousStatus, levelChange], index) => ({
        status,
        previousStatus,
        levelChange,
        source: PLACEHOLDER_SOURCE,
        dateReported: subDays(now, DAYS_AGO[index]).toISOString()
      })
    )

    return { id, disease: { name }, risk, riskHistory }
  })
