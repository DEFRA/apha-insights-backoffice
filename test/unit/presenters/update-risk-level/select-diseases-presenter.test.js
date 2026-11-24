import { selectDiseasesPresenter } from '#/presenters/update-risk-level/select-diseases-presenter.js'
import { currentRiskLevels } from '#test/helpers/risk-level-fixtures.js'

describe('#selectDiseasesPresenter', () => {
  test('Should provide the page title and a checkbox group with a legend and hint', () => {
    const result = selectDiseasesPresenter({ diseases: currentRiskLevels() })

    expect(result.pageTitle).toBe('Which diseases do you want to update?')
    expect(result.errorList).toEqual([])
    expect(result.checkboxes).toMatchObject({
      idPrefix: 'diseases',
      name: 'diseases',
      fieldset: {
        legend: {
          text: 'Which diseases do you want to update?',
          isPageHeading: true
        }
      },
      hint: { text: 'Select all that apply' },
      errorMessage: undefined
    })
  })

  test('Should list every disease unticked by default', () => {
    const { items } = selectDiseasesPresenter({
      diseases: currentRiskLevels()
    }).checkboxes

    expect(items).toEqual([
      { value: 'asf', text: 'African swine fever', checked: false },
      {
        value: 'hpai',
        text: 'Highly pathogenic avian influenza',
        checked: false
      },
      { value: 'bluetongue', text: 'Bluetongue', checked: false }
    ])
  })

  test('Should tick the selected diseases', () => {
    const { items } = selectDiseasesPresenter({
      diseases: currentRiskLevels(),
      selectedIds: ['asf', 'bluetongue']
    }).checkboxes

    expect(items.map(({ checked }) => checked)).toEqual([true, false, true])
  })

  test('Should present the error inline, in the summary linking to the first checkbox and in the page title', () => {
    const message = 'Select at least one disease to update'
    const result = selectDiseasesPresenter({
      diseases: currentRiskLevels(),
      errors: { diseases: message }
    })

    expect(result.pageTitle).toBe(
      'Error: Which diseases do you want to update?'
    )
    expect(result.checkboxes.errorMessage).toEqual({ text: message })
    expect(result.errorList).toEqual([{ text: message, href: '#diseases' }])
  })
})
