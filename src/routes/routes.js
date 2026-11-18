import { healthRoutes } from '#/routes/health/health-routes.js'
import { homeRoutes } from '#/routes/home/home-routes.js'
import { addDataRoutes } from '#/routes/add-data/add-data-routes.js'
import { cookiesRoutes } from '#/routes/cookies/cookies-routes.js'

export const routes = [
  ...healthRoutes,
  ...homeRoutes,
  ...addDataRoutes,
  ...cookiesRoutes
]
