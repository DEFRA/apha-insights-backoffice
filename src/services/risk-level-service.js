import { isAfter, isBefore, isValid, parseISO, subMonths } from 'date-fns'

import { config } from '#/config/config.js'
import { getFromBackend } from '#/utils/backend-api.js'
import {
  buildRiskLevelHistoryEmptyLog,
  buildRiskLevelHistoryNoRisksLog
} from '#/utils/build-risk-level-history-log.js'
import { createLogger } from '#/utils/logger.js'
import { placeholderRisks } from '#/services/placeholder-risks.js'

const logger = createLogger()

const RISKS_PATH = '/risks'

// The largest page the backend allows, which is more than the diseases it holds
const MAX_PAGE_SIZE = 200

/**
 * @typedef {object} Assessment
 * @property {string} status - negligible, very low, low, medium or high
 * @property {string} previousStatus
 * @property {string} levelChange - deteriorating, no change, improving or undetermined
 * @property {string} source
 * @property {string} dateReported - ISO 8601
 */

/**
 * @typedef {object} RiskSummary
 * @property {string} id
 * @property {{name: string}} disease
 * @property {string} [strain]
 * @property {Assessment} risk - the current assessment
 */

/**
 * @typedef {RiskSummary & {riskHistory?: Assessment[]}} RiskDetail
 */

/**
 * A disease can have a risk per strain, so the strain is part of the label
 * @param {RiskSummary} riskSummary
 * @returns {string}
 */
const riskLabel = ({ disease, strain }) =>
  strain ? `${disease.name} (${strain})` : disease.name

/**
 * @param {RiskSummary} riskSummary
 * @returns {{id: string, name: string, currentRiskLevel: string}}
 */
const toCurrentRiskLevel = (riskSummary) => ({
  id: riskSummary.id,
  name: riskLabel(riskSummary),
  currentRiskLevel: riskSummary.risk.status.replaceAll(' ', '-')
})

/**
 * Gets one summary per risk, in the order the backend lists them
 * @returns {Promise<RiskSummary[]>}
 */
const fetchRiskSummaries = async () => {
  const { items } = await getFromBackend(RISKS_PATH, {
    pageSize: MAX_PAGE_SIZE
  })

  return items
}

/**
 * Gets each risk with its history. The backend has no date-range filter, so this is the full history.
 * @returns {Promise<RiskDetail[]>}
 */
const fetchRiskDetails = async () => {
  const summaries = await fetchRiskSummaries()

  if (summaries.length === 0) {
    logger.warn(
      buildRiskLevelHistoryNoRisksLog(),
      'The backend returned no risks'
    )
  }

  return Promise.all(
    summaries.map(({ id }) =>
      getFromBackend(`${RISKS_PATH}/${encodeURIComponent(id)}`)
    )
  )
}

const assessmentKey = ({
  status,
  previousStatus,
  levelChange,
  source,
  dateReported
}) =>
  JSON.stringify([status, previousStatus, levelChange, source, dateReported])

const reportedAt = ({ dateReported }) => parseISO(dateReported).getTime()

/**
 * @param {RiskDetail} riskDetail
 * @throws {Error} When an assessment's dateReported is not a valid ISO 8601 date
 */
const assertValidDates = ({ id, risk, riskHistory = [] }) => {
  const invalid = [risk, ...riskHistory].some(
    ({ dateReported }) => !isValid(parseISO(dateReported))
  )
  if (invalid) {
    throw new Error(`Risk ${id} has an assessment with an invalid dateReported`)
  }
}

/**
 * Combines a risk's current assessment with its history, keeping only those reported in the window, newest first
 * @param {RiskDetail} riskDetail
 * @param {{start: Date, end: Date}} historyWindow - Both ends are inclusive
 * @returns {Assessment[]}
 */
const assessmentsInWindow = ({ risk, riskHistory = [] }, { start, end }) => {
  const unique = new Map(
    [risk, ...riskHistory].map((assessment) => [
      assessmentKey(assessment),
      assessment
    ])
  )

  return [...unique.values()]
    .filter(({ dateReported }) => {
      const date = parseISO(dateReported)
      return !isBefore(date, start) && !isAfter(date, end)
    })
    .sort((a, b) => reportedAt(b) - reportedAt(a))
}

/**
 * @param {RiskDetail} riskDetail
 * @param {{start: Date, end: Date}} historyWindow
 * @param {number} historyMonths
 * @returns {{id: string, label: string, assessments: Assessment[]}}
 * @throws {Error} When an assessment has an invalid date, or the risk has no assessments in the window
 */
const toRiskLevelHistory = (riskDetail, historyWindow, historyMonths) => {
  assertValidDates(riskDetail)
  const assessments = assessmentsInWindow(riskDetail, historyWindow)

  if (assessments.length === 0) {
    const message = `Risk ${riskDetail.id} has no assessments in the last ${historyMonths} months`
    logger.error(
      buildRiskLevelHistoryEmptyLog(riskDetail.id, historyMonths),
      message
    )
    throw new Error(message)
  }

  return { id: riskDetail.id, label: riskLabel(riskDetail), assessments }
}

/**
 * Gets the current risk level for each disease.
 * Reads from the backend API when it is switched on, otherwise returns placeholder diseases.
 * @returns {Promise<{id: string, name: string, currentRiskLevel: string}[]>}
 * @throws {import('#/utils/http-client.js').HttpError} When the backend responds with an error
 * @throws {import('#/utils/http-client.js').NetworkError} When the backend cannot be reached or times out
 */
export async function getCurrentRiskLevels() {
  const summaries = config.get('backendApi.enabled')
    ? await fetchRiskSummaries()
    : placeholderRisks(new Date())

  return summaries.map(toCurrentRiskLevel)
}

/**
 * Gets each disease's risk assessments from the last `backendApi.historyMonths` months up to now, newest first.
 * Reads from the backend API when it is switched on, otherwise returns placeholder history.
 * @returns {Promise<{id: string, label: string, assessments: Assessment[]}[]>} In the order the backend lists the risks
 * @throws {import('#/utils/http-client.js').HttpError} When the backend responds with an error
 * @throws {import('#/utils/http-client.js').NetworkError} When the backend cannot be reached or times out
 * @throws {Error} When an assessment has an invalid date, or a disease has no assessments in the window
 */
export async function getRiskLevelHistory() {
  const now = new Date()
  const historyMonths = config.get('backendApi.historyMonths')
  const historyWindow = { start: subMonths(now, historyMonths), end: now }

  const riskDetails = config.get('backendApi.enabled')
    ? await fetchRiskDetails()
    : placeholderRisks(now)

  return riskDetails.map((riskDetail) =>
    toRiskLevelHistory(riskDetail, historyWindow, historyMonths)
  )
}

/**
 * Submits a risk level change: the validated, checked answers from the update risk level form.
 * A stub that does nothing until the backend has an endpoint for creating risk level changes.
 * @returns {Promise<void>}
 */
export async function submitRiskLevelChange() {
  // TODO: POST the risk level change to the backend API once it has an endpoint for creating them. Until then it is not sent or stored.
}
