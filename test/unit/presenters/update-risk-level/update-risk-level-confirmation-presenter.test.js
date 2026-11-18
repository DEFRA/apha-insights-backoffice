import { updateRiskLevelConfirmationPresenter } from '#/presenters/update-risk-level/update-risk-level-confirmation-presenter.js'

describe('#updateRiskLevelConfirmationPresenter', () => {
  test('Should provide the confirmation page view model', () => {
    expect(updateRiskLevelConfirmationPresenter()).toEqual({
      pageTitle: 'Submission received',
      heading: 'Submission received',
      links: [
        { text: 'Home', href: '/' },
        { text: 'Add another', href: '/update-risk-level' }
      ]
    })
  })
})
