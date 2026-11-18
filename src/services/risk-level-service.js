/**
 * Gets the current risk level for each disease on the update risk level form.
 * @returns {Promise<{id: string, name: string, currentRiskLevel: string}[]>}
 */
export async function getCurrentRiskLevels() {
  // TODO: GET the current risk level for each disease from the backend API. These placeholder diseases are used until it exists.
  return [
    { id: 'asf', name: 'African swine fever', currentRiskLevel: 'medium' },
    {
      id: 'hpai',
      name: 'Highly pathogenic avian influenza',
      currentRiskLevel: 'high'
    },
    { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'low' }
  ]
}

// TODO: stands in for the backend API. Holds only the latest submission, is shared by all users and is lost on restart.
let latestRiskLevelChange = null

/**
 * Submits a risk level change, replacing the latest one.
 * @param {object} riskLevelChange - the validated, checked answers from the update risk level form
 * @returns {Promise<void>}
 */
export async function submitRiskLevelChange(riskLevelChange) {
  // TODO: POST the risk level change to the backend API. Until then it is only kept in memory.
  latestRiskLevelChange = {
    submittedAt: new Date().toISOString(),
    changes: riskLevelChange.changes
  }
}

/**
 * Gets the latest submitted risk level change.
 * @returns {Promise<{submittedAt: string, changes: object[]} | null>} null when nothing has been submitted
 */
export async function getLatestRiskLevelChange() {
  // TODO: GET the latest risk level change from the backend API.
  return latestRiskLevelChange
}

/**
 * Clears the latest submitted risk level change. Test-only.
 */
export function resetLatestRiskLevelChange() {
  latestRiskLevelChange = null
}
