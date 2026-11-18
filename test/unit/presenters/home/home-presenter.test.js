import { homePresenter } from '#/presenters/home/home-presenter.js'

describe('#homePresenter', () => {
  test('Should provide the home page view model', () => {
    expect(homePresenter()).toEqual({
      pageTitle: 'Home',
      heading: 'IDM Insights',
      intro: 'Record risk level changes and view the latest data.',
      links: [{ text: 'Update risk level', href: '/add-data' }]
    })
  })
})
