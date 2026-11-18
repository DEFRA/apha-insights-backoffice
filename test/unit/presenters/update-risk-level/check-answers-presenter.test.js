import { checkAnswersPresenter } from '#/presenters/update-risk-level/check-answers-presenter.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

describe('#checkAnswersPresenter', () => {
  test('Should provide the page title and heading', () => {
    const result = checkAnswersPresenter(validRiskLevelChange())

    expect(result.pageTitle).toBe('Check your answers')
    expect(result.heading).toBe('Check your answers')
  })

  test('Should provide a card for each disease with its current level, direction and new level', () => {
    const [asf] = checkAnswersPresenter(validRiskLevelChange()).diseases

    expect(asf.title).toBe('African swine fever')
    expect(asf.rows.map(({ key, value }) => [key.text, value.text])).toEqual([
      ['Current risk level', 'Medium'],
      ['Direction of change', 'Increase'],
      ['New risk level', 'High']
    ])
  })

  test("Should link each disease's new risk level to the form to change it", () => {
    const [asf] = checkAnswersPresenter(validRiskLevelChange()).diseases
    const [, , newLevel] = asf.rows

    expect(newLevel.actions.items).toEqual([
      {
        href: '/update-risk-level',
        text: 'Change',
        visuallyHiddenText: 'African swine fever'
      }
    ])
  })

  test('Should provide the expert comment with a link to change it', () => {
    const { comment } = checkAnswersPresenter(validRiskLevelChange())

    expect(comment.rows).toEqual([
      {
        key: { text: 'Expert comment' },
        value: { text: 'New outbreaks reported in domestic pigs.' },
        actions: {
          items: [
            {
              href: '/update-risk-level',
              text: 'Change',
              visuallyHiddenText: 'expert comment'
            }
          ]
        }
      }
    ])
  })
})
