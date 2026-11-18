import Joi from 'joi'

import { moveRiskLevel, riskDirections } from '#/constants/risk-levels.js'

export const COMMENT_FIELD = 'expertComment'
export const COMMENT_MAX_LENGTH = 2000

const DIRECTION_VALUES = riskDirections.map(({ value }) => value)

/**
 * The form field holding a disease's direction of change
 * @param {string} diseaseId
 * @returns {string}
 */
export const directionFieldName = (diseaseId) => `direction-${diseaseId}`

const directionMessage = (name) =>
  `Select whether the risk level for ${name} increases, decreases or stays the same`

const cannotMoveMessage = (name, direction) =>
  direction === 'increase'
    ? `${name} is already at the highest risk level, so it cannot increase`
    : `${name} is already at the lowest risk level, so it cannot decrease`

const directionSchema = (name) =>
  Joi.string()
    .valid(...DIRECTION_VALUES)
    .required()
    .messages({
      'any.required': directionMessage(name),
      'string.empty': directionMessage(name),
      'any.only': directionMessage(name)
    })

const commentSchema = Joi.string()
  .trim()
  .required()
  // Browsers submit line breaks as CRLF, but the character count treats each as one character
  .replace(/\r\n/g, '\n')
  .max(COMMENT_MAX_LENGTH)
  .messages({
    'any.required': 'Enter your expert comment',
    'string.empty': 'Enter your expert comment',
    'string.max': `Expert comment must be ${COMMENT_MAX_LENGTH} characters or less`
  })

const buildSchema = (diseases) =>
  Joi.object({
    ...Object.fromEntries(
      diseases.map(({ id, name }) => [
        directionFieldName(id),
        directionSchema(name)
      ])
    ),
    [COMMENT_FIELD]: commentSchema
  })

/**
 * Turns a validated risk level change back into form values, so the form can be pre-filled
 * @param {{changes: object[], expertComment: string}} riskLevelChange
 * @returns {{directions: Record<string, string>, expertComment: string}}
 */
export const toFormValues = ({ changes, expertComment }) => ({
  directions: Object.fromEntries(
    changes.map(({ id, direction }) => [id, direction])
  ),
  expertComment
})

/**
 * Validates an add data form payload and works out each disease's new risk level
 * @param {object} payload - the raw form payload
 * @param {{id: string, name: string, currentRiskLevel: string}[]} diseases - the diseases on the form
 * @returns {{ value?: object, errors?: Record<string, string>, values: object }} the risk level change,
 * or an error message per field, plus the submitted values for re-rendering the form
 */
export function validateRiskLevelChange(payload, diseases) {
  const { value, error } = buildSchema(diseases).validate(payload, {
    abortEarly: false,
    stripUnknown: true
  })

  const errors = {}
  for (const { path, message } of error?.details ?? []) {
    errors[path[0]] ??= message
  }

  const values = {
    directions: Object.fromEntries(
      diseases.map(({ id }) => [id, payload[directionFieldName(id)]])
    ),
    expertComment: payload[COMMENT_FIELD]
  }

  const changes = diseases.map(({ id, name, currentRiskLevel }) => {
    const field = directionFieldName(id)
    const direction = values.directions[id]

    if (errors[field]) {
      return null
    }

    const newRiskLevel = moveRiskLevel(currentRiskLevel, direction)
    if (newRiskLevel === null) {
      errors[field] = cannotMoveMessage(name, direction)
    }

    return { id, disease: name, currentRiskLevel, direction, newRiskLevel }
  })

  if (Object.keys(errors).length) {
    return { errors, values }
  }

  return {
    value: { changes, expertComment: value[COMMENT_FIELD] },
    values
  }
}
