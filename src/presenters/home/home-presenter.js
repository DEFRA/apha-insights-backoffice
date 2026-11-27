import { format, parseISO } from 'date-fns'
import { config } from '#/config/config.js'
import { riskLevelText, riskLevelValues } from '#/constants/risk-levels.js'
import { UPDATE_RISK_LEVEL_PATH } from '#/constants/update-risk-level-paths.js'

// The backend does not return comments yet
const NO_COMMENT = '–'

const NO_RISK_LEVELS_MESSAGE = 'No risk levels have been recorded yet.'

const TABLE_HEAD = ['Risk level', 'Change', 'Comment', 'Submitted', 'Source']

const textCells = (values) => values.map((text) => ({ text }))

/**
 * The display text for a backend status such as "very low", or the status itself when it is not on the scale
 * @param {string} status
 */
const statusText = (status) => {
  const value = status.replaceAll(' ', '-')

  return riskLevelValues.includes(value) ? riskLevelText(value) : status
}

const sentenceCase = (text) => text.charAt(0).toUpperCase() + text.slice(1)

const assessmentRow = ({ status, levelChange, source, dateReported }) =>
  textCells([
    statusText(status),
    sentenceCase(levelChange),
    NO_COMMENT,
    format(parseISO(dateReported), 'd MMMM yyyy'),
    source
  ])

/**
 * GOV.UK Tabs selects each panel with `#${id}`. Backend ids are UUIDs that can start with a digit,
 * which is not a valid CSS id selector, so the id is prefixed with a letter.
 * @param {string} id
 */
const tabId = (id) => `disease-${id}`

const diseaseTab = ({ id, label, assessments }) => ({
  id: tabId(id),
  label,
  table: {
    head: textCells(TABLE_HEAD),
    rows: assessments.map(assessmentRow)
  }
})

/**
 * Formats data ready for presenting in the `/` page
 * @module homePresenter
 * @param {{diseases: {id: string, label: string, assessments: object[]}[]}} data - each disease's risk assessments, newest first
 */
export const homePresenter = ({ diseases }) => ({
  pageTitle: 'Home',
  heading: config.get('serviceDisplayName'),
  intro: 'Record risk level changes and view the latest data.',
  links: [{ text: 'Update risk level', href: UPDATE_RISK_LEVEL_PATH }],
  riskLevelChanges: {
    heading: 'Risk level changes',
    tabs: diseases.map(diseaseTab),
    ...(diseases.length === 0 && { emptyMessage: NO_RISK_LEVELS_MESSAGE })
  }
})
