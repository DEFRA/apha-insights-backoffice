import { updateRiskLevelPresenter } from '#/presenters/update-risk-level/update-risk-level-presenter.js'
import { currentRiskLevels } from '#test/helpers/risk-level-fixtures.js'

const checkedValue = (radios) =>
  radios.items.find((item) => item.checked)?.value

describe('#updateRiskLevelPresenter', () => {
  test('Should provide an empty form with a radio group for each disease', () => {
    const result = updateRiskLevelPresenter({ diseases: currentRiskLevels() })

    expect(result).toMatchObject({
      pageTitle: 'Update risk level',
      heading: 'Update risk level',
      expertComment: { value: undefined, maxLength: 2000 },
      errorList: []
    })
    expect(result.diseases).toHaveLength(3)
  })

  test('Should show the disease and its current risk level in each radio group', () => {
    const [asf] = updateRiskLevelPresenter({
      diseases: currentRiskLevels()
    }).diseases

    expect(asf.name).toBe('African swine fever')
    expect(asf.radios.idPrefix).toBe('direction-asf')
    expect(asf.radios.fieldset.legend.text).toBe('African swine fever')
    expect(asf.radios.hint.text).toBe('Current risk level: Medium')
  })

  test('Should offer increase, decrease and stay the same for each disease', () => {
    const [asf] = updateRiskLevelPresenter({
      diseases: currentRiskLevels()
    }).diseases

    expect(asf.radios.items).toEqual([
      { value: 'increase', text: 'Increase', checked: false },
      { value: 'decrease', text: 'Decrease', checked: false },
      { value: 'same', text: 'Stay the same', checked: false }
    ])
  })

  test('Should keep the submitted directions and comment', () => {
    const result = updateRiskLevelPresenter({
      diseases: currentRiskLevels(),
      values: {
        directions: { asf: 'increase', hpai: 'same', bluetongue: 'decrease' },
        expertComment: 'Kept'
      }
    })

    expect(result.diseases.map(({ radios }) => checkedValue(radios))).toEqual([
      'increase',
      'same',
      'decrease'
    ])
    expect(result.expertComment.value).toBe('Kept')
  })

  test('Should present errors inline and in form order for the error summary', () => {
    const result = updateRiskLevelPresenter({
      diseases: currentRiskLevels(),
      errors: {
        expertComment: 'Enter your expert comment',
        'direction-bluetongue':
          'Select whether the risk level for Bluetongue increases, decreases or stays the same',
        'direction-asf':
          'Select whether the risk level for African swine fever increases, decreases or stays the same'
      }
    })

    expect(result.pageTitle).toBe('Error: Update risk level')
    expect(result.diseases[0].radios.errorMessage).toEqual({
      text: 'Select whether the risk level for African swine fever increases, decreases or stays the same'
    })
    expect(result.diseases[1].radios.errorMessage).toBeUndefined()
    expect(result.expertComment.errorMessage).toEqual({
      text: 'Enter your expert comment'
    })
    expect(result.errorList).toEqual([
      {
        text: 'Select whether the risk level for African swine fever increases, decreases or stays the same',
        href: '#direction-asf'
      },
      {
        text: 'Select whether the risk level for Bluetongue increases, decreases or stays the same',
        href: '#direction-bluetongue'
      },
      { text: 'Enter your expert comment', href: '#expertComment' }
    ])
  })
})
