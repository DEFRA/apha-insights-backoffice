import { cookiesPresenter } from '#/presenters/cookies/cookies-presenter.js'

describe('#cookiesPresenter', () => {
  test('returns analytics radios with no checked when no policy', () => {
    const result = cookiesPresenter(false)

    expect(result.analytics.items[0].checked).toBe(undefined)
    expect(result.analytics.items[1].checked).toBe(true)
    expect(result.updated).toBe(false)
  })

  test('returns analytics radios with Yes checked when analytics accepted', () => {
    const result = cookiesPresenter(false, { analytics: true })

    expect(result.analytics.items[0].checked).toBe(true)
    expect(result.analytics.items[1].checked).toBe(false)
  })

  test('returns analytics radios with No checked when analytics rejected', () => {
    const result = cookiesPresenter(false, { analytics: false })

    expect(result.analytics.items[0].checked).toBe(false)
    expect(result.analytics.items[1].checked).toBe(true)
  })

  test('sets the page title', () => {
    expect(cookiesPresenter(false).pageTitle).toBe('Cookies')
  })

  test('sets updated to true when preferences saved', () => {
    const result = cookiesPresenter(true)

    expect(result.updated).toBe(true)
  })
})
