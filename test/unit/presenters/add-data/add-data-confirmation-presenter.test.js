import { addDataConfirmationPresenter } from '#/presenters/add-data/add-data-confirmation-presenter.js'

describe('#addDataConfirmationPresenter', () => {
  test('Should provide the confirmation page view model', () => {
    expect(addDataConfirmationPresenter()).toEqual({
      pageTitle: 'Submission received',
      heading: 'Submission received',
      links: [
        { text: 'Home', href: '/' },
        { text: 'Add another', href: '/add-data' }
      ]
    })
  })
})
