import { homePresenter } from '#/presenters/home/home-presenter.js'
import { getRiskLevelHistory } from '#/services/risk-level-service.js'

const getHome = {
  method: 'GET',
  path: '/',
  handler: async (_request, h) => {
    const diseases = await getRiskLevelHistory()

    return h.view('home/index', homePresenter({ diseases }))
  }
}

export const homeRoutes = [getHome]
