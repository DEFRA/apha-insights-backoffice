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
      intro:
        'For each disease, select whether its risk level should increase, decrease or stay the same, and add a comment.',
      errorList: []
    })
    expect(result.diseases).toHaveLength(3)
  })

  test('Should provide a comment box with a character count for each disease', () => {
    const result = updateRiskLevelPresenter({ diseases: currentRiskLevels() })

    expect(result.diseases.map(({ userComment }) => userComment)).toEqual([
      {
        id: 'userComment-asf',
        name: 'userComment-asf',
        label: {
          text: 'Comment for African swine fever',
          classes: 'govuk-label--s'
        },
        maxlength: 500,
        value: undefined,
        errorMessage: undefined
      },
      {
        id: 'userComment-hpai',
        name: 'userComment-hpai',
        label: {
          text: 'Comment for Highly pathogenic avian influenza',
          classes: 'govuk-label--s'
        },
        maxlength: 500,
        value: undefined,
        errorMessage: undefined
      },
      {
        id: 'userComment-bluetongue',
        name: 'userComment-bluetongue',
        label: {
          text: 'Comment for Bluetongue',
          classes: 'govuk-label--s'
        },
        maxlength: 500,
        value: undefined,
        errorMessage: undefined
      }
    ])
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

  test('Should keep the submitted directions and comments', () => {
    const result = updateRiskLevelPresenter({
      diseases: currentRiskLevels(),
      values: {
        directions: { asf: 'increase', hpai: 'same', bluetongue: 'decrease' },
        userComments: { asf: 'Kept', hpai: 'Also kept' }
      }
    })

    expect(result.diseases.map(({ radios }) => checkedValue(radios))).toEqual([
      'increase',
      'same',
      'decrease'
    ])
    expect(result.diseases.map(({ userComment }) => userComment.value)).toEqual(
      ['Kept', 'Also kept', undefined]
    )
  })

  test('Should present errors inline and in form order for the error summary', () => {
    const result = updateRiskLevelPresenter({
      diseases: currentRiskLevels(),
      errors: {
        'userComment-bluetongue': 'Enter a comment for Bluetongue',
        'direction-bluetongue':
          'Select whether the risk level for Bluetongue increases, decreases or stays the same',
        'userComment-asf': 'Enter a comment for African swine fever',
        'direction-asf':
          'Select whether the risk level for African swine fever increases, decreases or stays the same'
      }
    })

    expect(result.pageTitle).toBe('Error: Update risk level')
    expect(result.diseases[0].radios.errorMessage).toEqual({
      text: 'Select whether the risk level for African swine fever increases, decreases or stays the same'
    })
    expect(result.diseases[0].userComment.errorMessage).toEqual({
      text: 'Enter a comment for African swine fever'
    })
    expect(result.diseases[1].radios.errorMessage).toBeUndefined()
    expect(result.diseases[1].userComment.errorMessage).toBeUndefined()
    expect(result.errorList).toEqual([
      {
        text: 'Select whether the risk level for African swine fever increases, decreases or stays the same',
        href: '#direction-asf'
      },
      {
        text: 'Enter a comment for African swine fever',
        href: '#userComment-asf'
      },
      {
        text: 'Select whether the risk level for Bluetongue increases, decreases or stays the same',
        href: '#direction-bluetongue'
      },
      {
        text: 'Enter a comment for Bluetongue',
        href: '#userComment-bluetongue'
      }
    ])
  })
})
