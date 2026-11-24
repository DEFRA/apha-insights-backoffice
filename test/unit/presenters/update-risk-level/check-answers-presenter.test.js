import { checkAnswersPresenter } from '#/presenters/update-risk-level/check-answers-presenter.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

describe('#checkAnswersPresenter', () => {
  test('Should provide the page title and heading', () => {
    const result = checkAnswersPresenter(validRiskLevelChange())

    expect(result.pageTitle).toBe('Check your answers')
    expect(result.heading).toBe('Check your answers')
  })

  test('Should provide a card for each disease with its current level, direction, new level and comment', () => {
    const [asf] = checkAnswersPresenter(validRiskLevelChange()).diseases

    expect(asf.title).toBe('African swine fever')
    expect(asf.rows.map(({ key, value }) => [key.text, value.text])).toEqual([
      ['Current risk level', 'Medium'],
      ['Direction of change', 'Increase'],
      ['New risk level', 'High'],
      ['Comment', 'New outbreaks reported in domestic pigs.']
    ])
  })

  test("Should link each disease's new risk level to its direction field on the form", () => {
    const [asf] = checkAnswersPresenter(validRiskLevelChange()).diseases
    const [, , newLevel] = asf.rows

    expect(newLevel.actions.items).toEqual([
      {
        href: '/update-risk-level/change#direction-asf',
        text: 'Change',
        visuallyHiddenText: 'direction of change for African swine fever'
      }
    ])
  })

  test("Should link each disease's comment to its comment field on the form", () => {
    const [, hpai] = checkAnswersPresenter(validRiskLevelChange()).diseases
    const [, , , comment] = hpai.rows

    expect(comment.actions.items).toEqual([
      {
        href: '/update-risk-level/change#userComment-hpai',
        text: 'Change',
        visuallyHiddenText: 'comment for Highly pathogenic avian influenza'
      }
    ])
  })

  test('Should provide a row listing the selected diseases that links to the select page', () => {
    const { selection } = checkAnswersPresenter(validRiskLevelChange())

    expect(selection).toEqual({
      key: { text: 'Diseases to update' },
      value: {
        text: 'African swine fever, Highly pathogenic avian influenza, Bluetongue'
      },
      actions: {
        items: [
          {
            href: '/update-risk-level',
            text: 'Change',
            visuallyHiddenText: 'diseases to update'
          }
        ]
      }
    })
  })

  test('Should provide a card only for the diseases in the change', () => {
    const [asf] = validRiskLevelChange().changes
    const result = checkAnswersPresenter({ changes: [asf] })

    expect(result.diseases.map(({ title }) => title)).toEqual([
      'African swine fever'
    ])
    expect(result.selection.value.text).toBe('African swine fever')
  })

  test('Should not provide a separate comment list', () => {
    expect(checkAnswersPresenter(validRiskLevelChange())).not.toHaveProperty(
      'comment'
    )
  })
})
