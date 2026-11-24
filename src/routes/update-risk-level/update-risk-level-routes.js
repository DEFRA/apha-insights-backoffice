import { statusCodes } from '#/constants/status-codes.js'
import {
  CHANGE_PATH,
  CHECK_ANSWERS_PATH,
  CONFIRMATION_PATH,
  UPDATE_RISK_LEVEL_PATH
} from '#/constants/update-risk-level-paths.js'
import { updateRiskLevelPresenter } from '#/presenters/update-risk-level/update-risk-level-presenter.js'
import { selectDiseasesPresenter } from '#/presenters/update-risk-level/select-diseases-presenter.js'
import { checkAnswersPresenter } from '#/presenters/update-risk-level/check-answers-presenter.js'
import { updateRiskLevelConfirmationPresenter } from '#/presenters/update-risk-level/update-risk-level-confirmation-presenter.js'
import {
  knownDiseaseIds,
  validateDiseaseSelection
} from '#/schemas/disease-selection-schema.js'
import {
  toFormValues,
  validateRiskLevelChange
} from '#/schemas/risk-level-change-schema.js'
import {
  getCurrentRiskLevels,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'

// Session key for the ids of the diseases chosen on the select diseases page
const SELECTED_DISEASES_SESSION_KEY = 'riskLevelSelectedDiseases'

// Session key for the validated answers between the form and check your answers
const SESSION_KEY = 'riskLevelChange'

/**
 * The diseases chosen in this journey that still exist, in the order they are listed
 * @param {object} request
 * @param {{id: string}[]} diseases - every disease that can be updated
 */
const selectedDiseasesFor = (request, diseases) => {
  const ids = new Set(
    knownDiseaseIds(request.yar.get(SELECTED_DISEASES_SESSION_KEY), diseases)
  )

  return diseases.filter(({ id }) => ids.has(id))
}

/**
 * Keeps only the answers for the selected diseases
 * @param {{changes: object[]}} riskLevelChange
 * @param {string[]} selectedIds
 */
const pruneChange = (riskLevelChange, selectedIds) => ({
  ...riskLevelChange,
  changes: riskLevelChange.changes.filter(({ id }) => selectedIds.includes(id))
})

const idsOf = (diseases) => diseases.map(({ id }) => id)

const hasAnswersFor = (riskLevelChange, selectedDiseases) =>
  selectedDiseases.every(({ id }) =>
    riskLevelChange.changes.some((change) => change.id === id)
  )

const getSelectDiseases = {
  method: 'GET',
  path: UPDATE_RISK_LEVEL_PATH,
  handler: async (request, h) => {
    const diseases = await getCurrentRiskLevels()
    const selected = selectedDiseasesFor(request, diseases)

    return h.view(
      'update-risk-level/select-diseases',
      selectDiseasesPresenter({
        diseases,
        selectedIds: idsOf(selected)
      })
    )
  }
}

const postSelectDiseases = {
  method: 'POST',
  path: UPDATE_RISK_LEVEL_PATH,
  handler: async (request, h) => {
    const diseases = await getCurrentRiskLevels()
    const { selectedIds, errors } = validateDiseaseSelection(
      request.payload ?? {},
      diseases
    )

    if (errors) {
      return h
        .view(
          'update-risk-level/select-diseases',
          selectDiseasesPresenter({ diseases, selectedIds, errors })
        )
        .code(statusCodes.badRequest)
    }

    request.yar.set(SELECTED_DISEASES_SESSION_KEY, selectedIds)

    // Keep the answers already given for diseases that are still selected
    const saved = request.yar.get(SESSION_KEY)
    if (saved) {
      request.yar.set(SESSION_KEY, pruneChange(saved, selectedIds))
    }

    return h.redirect(CHANGE_PATH)
  }
}

const getChangeForm = {
  method: 'GET',
  path: CHANGE_PATH,
  handler: async (request, h) => {
    const selected = selectedDiseasesFor(request, await getCurrentRiskLevels())

    if (selected.length === 0) {
      return h.redirect(UPDATE_RISK_LEVEL_PATH)
    }

    const saved = request.yar.get(SESSION_KEY)

    return h.view(
      'update-risk-level/index',
      updateRiskLevelPresenter({
        diseases: selected,
        values: saved ? toFormValues(saved) : {}
      })
    )
  }
}

const postChangeForm = {
  method: 'POST',
  path: CHANGE_PATH,
  handler: async (request, h) => {
    const diseases = selectedDiseasesFor(request, await getCurrentRiskLevels())

    if (diseases.length === 0) {
      return h.redirect(UPDATE_RISK_LEVEL_PATH)
    }

    const { value, errors, values } = validateRiskLevelChange(
      request.payload ?? {},
      diseases
    )

    if (errors) {
      return h
        .view(
          'update-risk-level/index',
          updateRiskLevelPresenter({ diseases, values, errors })
        )
        .code(statusCodes.badRequest)
    }

    request.yar.set(SESSION_KEY, value)

    return h.redirect(CHECK_ANSWERS_PATH)
  }
}

/**
 * Works out where a request to check or submit answers should go when the journey is incomplete
 * @param {object} request
 * @returns {Promise<{ riskLevelChange?: object, redirectTo?: string }>}
 */
const checkAnswersJourney = async (request) => {
  const riskLevelChange = request.yar.get(SESSION_KEY)
  const selected = selectedDiseasesFor(request, await getCurrentRiskLevels())

  if (!riskLevelChange || selected.length === 0) {
    return { redirectTo: UPDATE_RISK_LEVEL_PATH }
  }

  // A disease was added to the selection after the form was filled in, so it has no answers yet
  if (!hasAnswersFor(riskLevelChange, selected)) {
    return { redirectTo: CHANGE_PATH }
  }

  return {
    riskLevelChange: pruneChange(riskLevelChange, idsOf(selected))
  }
}

const getCheckAnswers = {
  method: 'GET',
  path: CHECK_ANSWERS_PATH,
  handler: async (request, h) => {
    const { riskLevelChange, redirectTo } = await checkAnswersJourney(request)

    if (redirectTo) {
      return h.redirect(redirectTo)
    }

    return h.view(
      'update-risk-level/check-answers',
      checkAnswersPresenter(riskLevelChange)
    )
  }
}

const postCheckAnswers = {
  method: 'POST',
  path: CHECK_ANSWERS_PATH,
  handler: async (request, h) => {
    const { riskLevelChange, redirectTo } = await checkAnswersJourney(request)

    if (redirectTo) {
      return h.redirect(redirectTo)
    }

    // The comment is free text that may name people or premises, so it is never logged
    const summary = riskLevelChange.changes
      .map(({ id, direction }) => `${id}:${direction}`)
      .join(', ')
    request.logger.info(`Risk level change submitted for ${summary}`)
    await submitRiskLevelChange(riskLevelChange)
    request.yar.clear(SESSION_KEY)
    request.yar.clear(SELECTED_DISEASES_SESSION_KEY)

    return h.redirect(CONFIRMATION_PATH)
  }
}

const getUpdateRiskLevelConfirmation = {
  method: 'GET',
  path: CONFIRMATION_PATH,
  handler: (_request, h) =>
    h.view(
      'update-risk-level/confirmation',
      updateRiskLevelConfirmationPresenter()
    )
}

export const updateRiskLevelRoutes = [
  getSelectDiseases,
  postSelectDiseases,
  getChangeForm,
  postChangeForm,
  getCheckAnswers,
  postCheckAnswers,
  getUpdateRiskLevelConfirmation
]
