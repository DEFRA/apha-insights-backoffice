import {
  knownDiseaseIds,
  validateDiseaseSelection
} from '#/schemas/disease-selection-schema.js'
import { currentRiskLevels } from '#test/helpers/risk-level-fixtures.js'

const NO_SELECTION_ERROR = {
  diseases: 'Select at least one disease to update'
}

describe('#validateDiseaseSelection', () => {
  test('Should accept a single selection submitted as a string', () => {
    expect(
      validateDiseaseSelection({ diseases: 'hpai' }, currentRiskLevels())
    ).toEqual({ selectedIds: ['hpai'] })
  })

  test('Should accept several selections and return them in the order the diseases are listed', () => {
    expect(
      validateDiseaseSelection(
        { diseases: ['bluetongue', 'asf'] },
        currentRiskLevels()
      )
    ).toEqual({ selectedIds: ['asf', 'bluetongue'] })
  })

  test('Should ignore values that are not known disease ids and fields that are not part of the form', () => {
    expect(
      validateDiseaseSelection(
        { diseases: ['nope', 'asf', 'asf'], crumb: 'token' },
        currentRiskLevels()
      )
    ).toEqual({ selectedIds: ['asf'] })
  })

  test.each([
    ['an empty payload', {}],
    ['an empty string', { diseases: '' }],
    ['an empty list', { diseases: [] }],
    ['only unknown ids', { diseases: ['nope'] }],
    ['a value that is not a string', { diseases: [{ id: 'asf' }] }]
  ])('Should require at least one disease for %s', (_name, payload) => {
    expect(validateDiseaseSelection(payload, currentRiskLevels())).toEqual({
      selectedIds: [],
      errors: NO_SELECTION_ERROR
    })
  })
})

describe('#knownDiseaseIds', () => {
  test('Should keep known ids in the order the diseases are listed', () => {
    expect(
      knownDiseaseIds(['bluetongue', 'gone', 'asf'], currentRiskLevels())
    ).toEqual(['asf', 'bluetongue'])
  })

  test.each([[undefined], [null], ['asf'], [{}]])(
    'Should return no ids when given %s',
    (ids) => {
      expect(knownDiseaseIds(ids, currentRiskLevels())).toEqual([])
    }
  )
})
