import { riskDirections, riskLevelText } from '#/constants/risk-levels.js'
import {
  COMMENT_FIELD,
  COMMENT_MAX_LENGTH,
  directionFieldName
} from '#/schemas/risk-level-change-schema.js'

const PAGE_TITLE = 'Add new data'

const directionItems = (selected) =>
  riskDirections.map(({ value, text }) => ({
    value,
    text,
    checked: value === selected
  }))

const errorMessage = (errors, field) =>
  errors[field] ? { text: errors[field] } : undefined

const diseaseRadios = ({ id, name, currentRiskLevel }, values, errors) => {
  const field = directionFieldName(id)

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
    }
  }
}

/**
 * Formats data ready for presenting in the `/add-data` page
 * @module addDataPresenter
 * @param {object} form
 * @param {{id: string, name: string, currentRiskLevel: string}[]} form.diseases - the diseases to change
 * @param {object} [form.values] - the submitted values to keep when re-rendering the form
 * @param {Record<string, string>} [form.errors] - an error message per invalid field
 */
export const addDataPresenter = ({ diseases, values = {}, errors = {} }) => {
  const hasErrors = Object.keys(errors).length > 0
  const fields = [
    ...diseases.map(({ id }) => directionFieldName(id)),
    COMMENT_FIELD
  ]

  return {
    pageTitle: hasErrors ? `Error: ${PAGE_TITLE}` : PAGE_TITLE,
    heading: PAGE_TITLE,
    intro:
      'For each disease, select whether its risk level should increase, decrease or stay the same.',
    diseases: diseases.map((disease) => diseaseRadios(disease, values, errors)),
    expertComment: {
      value: values[COMMENT_FIELD],
      maxLength: COMMENT_MAX_LENGTH,
      errorMessage: errorMessage(errors, COMMENT_FIELD)
    },
    errorList: fields
      .filter((field) => errors[field])
      .map((field) => ({ text: errors[field], href: `#${field}` }))
  }
}
