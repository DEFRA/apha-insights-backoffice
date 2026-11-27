import {
  buildRiskLevelHistoryEmptyLog,
  buildRiskLevelHistoryNoRisksLog
} from '#/utils/build-risk-level-history-log.js'

describe('#buildRiskLevelHistoryEmptyLog', () => {
  test('Should name the risk and the window in a failure event', () => {
    expect(buildRiskLevelHistoryEmptyLog('risk-asf', 6)).toEqual({
      event: {
        type: 'risk_level_history',
        action: 'filter_history',
        reference: 'risk-asf',
        reason: 'No assessments in the last 6 months',
        outcome: 'failure'
      }
    })
  })

  test('Should only have the event key at the top level', () => {
    expect(Object.keys(buildRiskLevelHistoryEmptyLog('risk-asf', 6))).toEqual([
      'event'
    ])
  })
})

describe('#buildRiskLevelHistoryNoRisksLog', () => {
  test('Should record a successful risks request that returned nothing', () => {
    expect(buildRiskLevelHistoryNoRisksLog()).toEqual({
      event: {
        type: 'risk_level_history',
        action: 'list_risks',
        reason: 'The backend returned no risks',
        outcome: 'success'
      }
    })
  })

  test('Should only have the event key at the top level', () => {
    expect(Object.keys(buildRiskLevelHistoryNoRisksLog())).toEqual(['event'])
  })
})
