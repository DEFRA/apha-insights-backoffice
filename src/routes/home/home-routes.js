import { homePresenter } from '#/presenters/home/home-presenter.js'
import {
  getCurrentRiskLevels,
  getLatestRiskLevelChange
} from '#/services/risk-level-service.js'

const getHome = {
  method: 'GET',
  path: '/',
  handler: async (_request, h) => {
    const [diseases, latest] = await Promise.all([
      getCurrentRiskLevels(),
      getLatestRiskLevelChange()
    ])

    return h.view('home/index', homePresenter({ diseases, latest }))
  }
}

export const homeRoutes = [getHome]
