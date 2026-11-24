import { DISEASES_FIELD_NAME } from '#/constants/disease-selection.js'

const HEADING = 'Which diseases do you want to update?'

/**
 * Formats data ready for presenting in the `/update-risk-level` select diseases page
 * @module selectDiseasesPresenter
 * @param {object} form
 * @param {{id: string, name: string}[]} form.diseases - every disease that can be updated
 * @param {string[]} [form.selectedIds] - the ids to tick
 * @param {Record<string, string>} [form.errors] - an error message per invalid field
 */
export const selectDiseasesPresenter = ({
  diseases,
  selectedIds = [],
  errors = {}
}) => {
  const error = errors[DISEASES_FIELD_NAME]

  return {
    pageTitle: error ? `Error: ${HEADING}` : HEADING,
    checkboxes: {
      idPrefix: DISEASES_FIELD_NAME,
      name: DISEASES_FIELD_NAME,
      fieldset: {
        legend: {
          text: HEADING,
          isPageHeading: true,
          classes: 'govuk-fieldset__legend--l'
        }
      },
      hint: { text: 'Select all that apply' },
      items: diseases.map(({ id, name }) => ({
        value: id,
        text: name,
        checked: selectedIds.includes(id)
      })),
      errorMessage: error ? { text: error } : undefined
    },
    errorList: error ? [{ text: error, href: `#${DISEASES_FIELD_NAME}` }] : []
  }
}
