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

/**
 * Submits a risk level change.
 * @param {object} _riskLevelChange - the validated, checked answers from the update risk level form
 * @returns {Promise<void>}
 */
export async function submitRiskLevelChange(_riskLevelChange) {
  // TODO: POST the risk level change to the backend API. Nothing is sent or stored yet.
}
