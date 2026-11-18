import {
  moveRiskLevel,
  riskDirectionText,
  riskLevelText,
  riskLevelValues
} from '#/constants/risk-levels.js'

describe('#riskLevels', () => {
  test('Should expose the value of every level, lowest first', () => {
    expect(riskLevelValues).toEqual([
      'very-low',
      'low',
      'medium',
      'high',
      'very-high'
    ])
  })

  test('Should give the display text for a value', () => {
    expect(riskLevelText('very-high')).toBe('Very high')
  })

  test('Should fall back to the value when it is not on the scale', () => {
    expect(riskLevelText('negligible')).toBe('negligible')
  })
})

describe('#riskDirectionText', () => {
  test.each([
    ['increase', 'Increase'],
    ['decrease', 'Decrease'],
    ['same', 'Stay the same']
  ])('Should give the display text for %s', (value, text) => {
    expect(riskDirectionText(value)).toBe(text)
  })
})

describe('#moveRiskLevel', () => {
  test('Should step up one level when increasing', () => {
    expect(moveRiskLevel('medium', 'increase')).toBe('high')
  })

  test('Should step down one level when decreasing', () => {
    expect(moveRiskLevel('medium', 'decrease')).toBe('low')
  })

  test('Should keep the same level when staying the same', () => {
    expect(moveRiskLevel('medium', 'same')).toBe('medium')
  })

  test('Should return null when increasing from the highest level', () => {
    expect(moveRiskLevel('very-high', 'increase')).toBeNull()
  })

  test('Should return null when decreasing from the lowest level', () => {
    expect(moveRiskLevel('very-low', 'decrease')).toBeNull()
  })
})
