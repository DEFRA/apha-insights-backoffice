import { statusCodes } from '#/constants/status-codes.js'
import { updateRiskLevelPresenter } from '#/presenters/update-risk-level/update-risk-level-presenter.js'
import { checkAnswersPresenter } from '#/presenters/update-risk-level/check-answers-presenter.js'
import { updateRiskLevelConfirmationPresenter } from '#/presenters/update-risk-level/update-risk-level-confirmation-presenter.js'
import {
  toFormValues,
  validateRiskLevelChange
} from '#/schemas/risk-level-change-schema.js'
import {
  getCurrentRiskLevels,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'

const UPDATE_RISK_LEVEL_PATH = '/update-risk-level'
const CHECK_ANSWERS_PATH = `${UPDATE_RISK_LEVEL_PATH}/check-answers`
const CONFIRMATION_PATH = `${UPDATE_RISK_LEVEL_PATH}/confirmation`

// Session key for the validated answers between the form and check your answers
const SESSION_KEY = 'riskLevelChange'

const getUpdateRiskLevel = {
  method: 'GET',
  path: UPDATE_RISK_LEVEL_PATH,
  handler: async (request, h) => {
    const saved = request.yar.get(SESSION_KEY)

    return h.view(
      'update-risk-level/index',
      updateRiskLevelPresenter({
        diseases: await getCurrentRiskLevels(),
        values: saved ? toFormValues(saved) : {}
      })
    )
  }
}

const postUpdateRiskLevel = {
  method: 'POST',
  path: UPDATE_RISK_LEVEL_PATH,
  handler: async (request, h) => {
    const diseases = await getCurrentRiskLevels()
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

const getCheckAnswers = {
  method: 'GET',
  path: CHECK_ANSWERS_PATH,
  handler: (request, h) => {
    const riskLevelChange = request.yar.get(SESSION_KEY)

    if (!riskLevelChange) {
      return h.redirect(UPDATE_RISK_LEVEL_PATH)
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
    const riskLevelChange = request.yar.get(SESSION_KEY)

    if (!riskLevelChange) {
      return h.redirect(UPDATE_RISK_LEVEL_PATH)
    }

    // The expert comment is free text that may name people or premises, so it is never logged
    const summary = riskLevelChange.changes
      .map(({ id, direction }) => `${id}:${direction}`)
      .join(', ')
    request.logger.info(`Risk level change submitted for ${summary}`)
    await submitRiskLevelChange(riskLevelChange)
    request.yar.clear(SESSION_KEY)

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
  getUpdateRiskLevel,
  postUpdateRiskLevel,
  getCheckAnswers,
  postCheckAnswers,
  getUpdateRiskLevelConfirmation
]
