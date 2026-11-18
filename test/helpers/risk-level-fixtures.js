const NEW_OUTBREAKS = 'New outbreaks reported in domestic pigs.'

/**
 * The diseases on the add data form, with their current risk levels
 */
export const currentRiskLevels = () => [
  { id: 'asf', name: 'African swine fever', currentRiskLevel: 'medium' },
  {
    id: 'hpai',
    name: 'Highly pathogenic avian influenza',
    currentRiskLevel: 'high'
  },
  { id: 'bluetongue', name: 'Bluetongue', currentRiskLevel: 'low' }
]

/**
 * A valid add data form payload, as the browser submits it
 */
export const validFormPayload = () => ({
  'direction-asf': 'increase',
  'direction-hpai': 'same',
  'direction-bluetongue': 'decrease',
  expertComment: NEW_OUTBREAKS
})

/**
 * The validated answers the valid form payload produces
 */
export const validRiskLevelChange = () => ({
  changes: [
    {
      id: 'asf',
      disease: 'African swine fever',
      currentRiskLevel: 'medium',
      direction: 'increase',
      newRiskLevel: 'high'
    },
    {
      id: 'hpai',
      disease: 'Highly pathogenic avian influenza',
      currentRiskLevel: 'high',
      direction: 'same',
      newRiskLevel: 'high'
    },
    {
      id: 'bluetongue',
      disease: 'Bluetongue',
      currentRiskLevel: 'low',
      direction: 'decrease',
      newRiskLevel: 'very-low'
    }
  ],
  expertComment: NEW_OUTBREAKS
})
