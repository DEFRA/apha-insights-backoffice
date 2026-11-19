import { renderComponentFromContext } from '#test/helpers/component-helpers.js'

describe('Phase Banner Component', () => {
  let $banner

  beforeEach(() => {
    $banner = renderComponentFromContext('phase-banner', {
      tag: 'Alpha',
      text: 'This service is in development.'
    })
  })

  test('Should render the phase banner', () => {
    expect($banner('[data-testid="phase-banner"]')).toHaveLength(1)
  })

  test('Should render the tag text', () => {
    expect(
      $banner('[data-testid="phase-banner"] .govuk-tag').text().trim()
    ).toBe('Alpha')
  })

  test('Should render the banner text', () => {
    expect(
      $banner('[data-testid="phase-banner"] .govuk-phase-banner__text')
        .text()
        .trim()
    ).toBe('This service is in development.')
  })
})
