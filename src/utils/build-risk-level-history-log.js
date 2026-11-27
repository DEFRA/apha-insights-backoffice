const EVENT_TYPE = 'risk_level_history'
const ACTION_FILTER_HISTORY = 'filter_history'
const ACTION_LIST_RISKS = 'list_risks'
const OUTCOME_FAILURE = 'failure'
const OUTCOME_SUCCESS = 'success'

/**
 * Build the ECS log object for a risk with no assessments in the history window.
 * @param {string} riskId - The backend risk id
 * @param {number} historyMonths - How many months the window covers
 * @returns {{ event: Record<string, unknown> }}
 */
const buildRiskLevelHistoryEmptyLog = (riskId, historyMonths) => ({
  event: {
    type: EVENT_TYPE,
    action: ACTION_FILTER_HISTORY,
    reference: riskId,
    reason: `No assessments in the last ${historyMonths} months`,
    outcome: OUTCOME_FAILURE
  }
})

/**
 * Build the ECS log object for a risks request that succeeded but returned no risks.
 * Not a failure, but an environment that should have data is worth noticing.
 * @returns {{ event: Record<string, unknown> }}
 */
const buildRiskLevelHistoryNoRisksLog = () => ({
  event: {
    type: EVENT_TYPE,
    action: ACTION_LIST_RISKS,
    reason: 'The backend returned no risks',
    outcome: OUTCOME_SUCCESS
  }
})

export { buildRiskLevelHistoryEmptyLog, buildRiskLevelHistoryNoRisksLog }
