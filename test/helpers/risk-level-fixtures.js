const USER_COMMENTS = {
  asf: 'New outbreaks reported in domestic pigs.',
  hpai: 'No change in wild bird findings.',
  bluetongue: 'Vector season has ended.'
}

/**
 * The diseases on the update risk level form, with their current risk levels
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
 * A valid update risk level form payload, as the browser submits it
 */
export const validFormPayload = () => ({
  'direction-asf': 'increase',
  'direction-hpai': 'same',
  'direction-bluetongue': 'decrease',
  'userComment-asf': USER_COMMENTS.asf,
  'userComment-hpai': USER_COMMENTS.hpai,
  'userComment-bluetongue': USER_COMMENTS.bluetongue
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
      newRiskLevel: 'high',
      userComment: USER_COMMENTS.asf
    },
    {
      id: 'hpai',
      disease: 'Highly pathogenic avian influenza',
      currentRiskLevel: 'high',
      direction: 'same',
      newRiskLevel: 'high',
      userComment: USER_COMMENTS.hpai
    },
    {
      id: 'bluetongue',
      disease: 'Bluetongue',
      currentRiskLevel: 'low',
      direction: 'decrease',
      newRiskLevel: 'very-low',
      userComment: USER_COMMENTS.bluetongue
    }
  ]
})
