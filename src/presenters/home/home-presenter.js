import { format, isValid, parseISO } from 'date-fns'
import { config } from '#/config/config.js'
import { riskDirectionText, riskLevelText } from '#/constants/risk-levels.js'
import { UPDATE_RISK_LEVEL_PATH } from '#/constants/update-risk-level-paths.js'

const NO_VALUE = '–'

const TABLE_HEAD = ['Status', 'Risk level', 'Change', 'Comment', 'Submitted']

const textCells = (values) => values.map((text) => ({ text }))

/**
 * Returns the latest changes keyed by disease id with their formatted submitted date, or an empty map when the latest change is missing or malformed
 */
const latestChangesById = (latest) => {
  const submittedAt = parseISO(latest?.submittedAt ?? '')

  if (!Array.isArray(latest?.changes) || !isValid(submittedAt)) {
    return new Map()
  }

  const submitted = format(submittedAt, "d MMMM yyyy 'at' h:mmaaa")

  return new Map(
    latest.changes
      .filter((change) => change && typeof change === 'object')
      .map((change) => [change.id, { ...change, submitted }])
  )
}

const diseaseTab = ({ id, name, currentRiskLevel }, latestChange) => {
  const rows = [
    textCells([
      'Default',
      riskLevelText(currentRiskLevel),
      NO_VALUE,
      NO_VALUE,
      NO_VALUE
    ])
  ]

  if (latestChange) {
    rows.push(
      textCells([
        'Latest update',
        riskLevelText(latestChange.newRiskLevel),
        riskDirectionText(latestChange.direction),
        latestChange.userComment,
        latestChange.submitted
      ])
    )
  }

  return { id, label: name, table: { head: textCells(TABLE_HEAD), rows } }
}

/**
 * Formats data ready for presenting in the `/` page
 * @module homePresenter
 * @param {{diseases: object[], latest: object | null}} data - the default risk levels and the latest submitted change
 */
export const homePresenter = ({ diseases, latest }) => {
  const latestChanges = latestChangesById(latest)

  return {
    pageTitle: 'Home',
    heading: config.get('serviceDisplayName'),
    intro: 'Record risk level changes and view the latest data.',
    links: [{ text: 'Update risk level', href: UPDATE_RISK_LEVEL_PATH }],
    riskLevelChanges: {
      heading: 'Risk level changes',
      tabs: diseases.map((disease) =>
        diseaseTab(disease, latestChanges.get(disease.id))
      )
    }
  }
}
