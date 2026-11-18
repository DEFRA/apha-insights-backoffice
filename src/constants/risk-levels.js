/**
 * The risk level scale, lowest first.
 * Placeholder scale: confirm with the IDM team before relying on it.
 */
export const riskLevels = [
  { value: 'negligible', text: 'Negligible' },
  { value: 'very-low', text: 'Very low' },
  { value: 'low', text: 'Low' },
  { value: 'medium', text: 'Medium' },
  { value: 'high', text: 'High' },
  { value: 'very-high', text: 'Very high' }
]

export const riskLevelValues = riskLevels.map(({ value }) => value)

/**
 * How a disease's risk level can change, in the order they are shown
 */
export const riskDirections = [
  { value: 'increase', text: 'Increase' },
  { value: 'decrease', text: 'Decrease' },
  { value: 'same', text: 'Stay the same' }
]

const DIRECTION_STEPS = { increase: 1, decrease: -1, same: 0 }

/**
 * Returns the display text for a risk level value, or the value itself when it is not on the scale
 * @param {string} value
 * @returns {string}
 */
export function riskLevelText(value) {
  return riskLevels.find((level) => level.value === value)?.text ?? value
}

/**
 * Returns the display text for a direction value, or the value itself when it is not a direction
 * @param {string} value
 * @returns {string}
 */
export function riskDirectionText(value) {
  return (
    riskDirections.find((direction) => direction.value === value)?.text ?? value
  )
}

/**
 * Moves a risk level one step along the scale
 * @param {string} value - the current risk level
 * @param {string} direction - increase, decrease or same
 * @returns {string | null} the new risk level, or null when the scale has no step that way
 * @throws {Error} when the current risk level is not on the scale or the direction is unknown
 */
export function moveRiskLevel(value, direction) {
  const index = riskLevelValues.indexOf(value)

  if (index === -1) {
    throw new Error(`Unknown risk level: ${value}`)
  }

  if (!(direction in DIRECTION_STEPS)) {
    throw new Error(`Unknown risk direction: ${direction}`)
  }

  return riskLevelValues[index + DIRECTION_STEPS[direction]] ?? null
}
