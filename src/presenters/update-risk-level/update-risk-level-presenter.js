import {
  USER_COMMENT_MAX_LENGTH,
  riskDirections,
  riskLevelText
} from '#/constants/risk-levels.js'
import { SELECT_DISEASES_HREF } from '#/constants/update-risk-level-paths.js'
import {
  directionFieldName,
  userCommentFieldName
} from '#/schemas/risk-level-change-schema.js'

const PAGE_TITLE = 'Update risk level'

const directionItems = (selected) =>
  riskDirections.map(({ value, text }) => ({
    value,
    text,
    checked: value === selected
  }))

const errorMessage = (errors, field) =>
  errors[field] ? { text: errors[field] } : undefined

const diseaseFields = ({ id, name, currentRiskLevel }, values, errors) => {
  const field = directionFieldName(id)
  const commentField = userCommentFieldName(id)

  return {
    name,
    radios: {
      idPrefix: field,
      name: field,
      fieldset: {
        legend: { text: name, classes: 'govuk-fieldset__legend--s' }
      },
      hint: { text: `Current risk level: ${riskLevelText(currentRiskLevel)}` },
      items: directionItems(values.directions?.[id]),
      errorMessage: errorMessage(errors, field)
    },
    userComment: {
      id: commentField,
      name: commentField,
      label: { text: `Comment for ${name}`, classes: 'govuk-label--s' },
      maxlength: USER_COMMENT_MAX_LENGTH,
      value: values.userComments?.[id],
      errorMessage: errorMessage(errors, commentField)
    }
  }
}

/**
 * Formats data ready for presenting in the `/update-risk-level/change` page
 * @module updateRiskLevelPresenter
 * @param {object} form
 * @param {{id: string, name: string, currentRiskLevel: string}[]} form.diseases - the diseases to change
 * @param {object} [form.values] - the submitted values to keep when re-rendering the form
 * @param {Record<string, string>} [form.errors] - an error message per invalid field
 */
export const updateRiskLevelPresenter = ({
  diseases,
  values = {},
  errors = {}
}) => {
  const hasErrors = Object.keys(errors).length > 0
  const fields = diseases.flatMap(({ id }) => [
    directionFieldName(id),
    userCommentFieldName(id)
  ])

  return {
    pageTitle: hasErrors ? `Error: ${PAGE_TITLE}` : PAGE_TITLE,
    heading: PAGE_TITLE,
    backLink: { href: SELECT_DISEASES_HREF, text: 'Back' },
    intro:
      'For each disease, select whether its risk level should increase, decrease or stay the same, and add a comment.',
    diseases: diseases.map((disease) => diseaseFields(disease, values, errors)),
    errorList: fields
      .filter((field) => errors[field])
      .map((field) => ({ text: errors[field], href: `#${field}` }))
  }
}
