import { statusCodes } from '#/constants/status-codes.js'
import { addDataPresenter } from '#/presenters/add-data/add-data-presenter.js'
import { checkAnswersPresenter } from '#/presenters/add-data/check-answers-presenter.js'
import { addDataConfirmationPresenter } from '#/presenters/add-data/add-data-confirmation-presenter.js'
import {
  toFormValues,
  validateRiskLevelChange
} from '#/schemas/risk-level-change-schema.js'
import {
  getCurrentRiskLevels,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'

const ADD_DATA_PATH = '/add-data'
const CHECK_ANSWERS_PATH = `${ADD_DATA_PATH}/check-answers`
const CONFIRMATION_PATH = `${ADD_DATA_PATH}/confirmation`

// Session key for the validated answers between the form and check your answers
const SESSION_KEY = 'riskLevelChange'

const getAddData = {
  method: 'GET',
  path: ADD_DATA_PATH,
  handler: async (request, h) => {
    const saved = request.yar.get(SESSION_KEY)

    return h.view(
      'add-data/index',
      addDataPresenter({
        diseases: await getCurrentRiskLevels(),
        values: saved ? toFormValues(saved) : {}
      })
    )
  }
}

const postAddData = {
  method: 'POST',
  path: ADD_DATA_PATH,
  handler: async (request, h) => {
    const diseases = await getCurrentRiskLevels()
    const { value, errors, values } = validateRiskLevelChange(
      request.payload ?? {},
      diseases
    )

    if (errors) {
      return h
        .view('add-data/index', addDataPresenter({ diseases, values, errors }))
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
      return h.redirect(ADD_DATA_PATH)
    }

    return h.view(
      'add-data/check-answers',
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
      return h.redirect(ADD_DATA_PATH)
    }

    request.logger.info({ riskLevelChange }, 'Risk level change submitted')
    await submitRiskLevelChange(riskLevelChange)
    request.yar.clear(SESSION_KEY)

    return h.redirect(CONFIRMATION_PATH)
  }
}

const getAddDataConfirmation = {
  method: 'GET',
  path: CONFIRMATION_PATH,
  handler: (_request, h) =>
    h.view('add-data/confirmation', addDataConfirmationPresenter())
}

export const addDataRoutes = [
  getAddData,
  postAddData,
  getCheckAnswers,
  postCheckAnswers,
  getAddDataConfirmation
]
