import Joi from 'joi'

import { DISEASES_FIELD_NAME } from '#/constants/disease-selection.js'

const NO_DISEASE_SELECTED_MESSAGE = 'Select at least one disease to update'

const payloadSchema = Joi.object({
  // A single ticked checkbox is submitted as a string, several as an array
  [DISEASES_FIELD_NAME]: Joi.array().items(Joi.string()).single().default([])
}).options({ stripUnknown: true })

/**
 * Keeps only the ids of known diseases, in the order the diseases are listed
 * @param {unknown} ids - ids to filter, such as ids held in the session
 * @param {{id: string}[]} diseases - the known diseases
 * @returns {string[]}
 */
export const knownDiseaseIds = (ids, diseases) => {
  const wanted = new Set(Array.isArray(ids) ? ids : [])

  return diseases.map(({ id }) => id).filter((id) => wanted.has(id))
}

/**
 * Validates the select diseases form payload. Submitted values that are not known disease ids are ignored.
 * @param {object} payload - the raw form payload
 * @param {{id: string}[]} diseases - the known diseases
 * @returns {{ selectedIds: string[], errors?: Record<string, string> }}
 */
export function validateDiseaseSelection(payload, diseases) {
  const { value, error } = payloadSchema.validate(payload)
  const selectedIds = error
    ? []
    : knownDiseaseIds(value[DISEASES_FIELD_NAME], diseases)

  if (selectedIds.length === 0) {
    return {
      selectedIds,
      errors: { [DISEASES_FIELD_NAME]: NO_DISEASE_SELECTED_MESSAGE }
    }
  }

  return { selectedIds }
}
