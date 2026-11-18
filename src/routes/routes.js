import { healthRoutes } from './health-routes.js'
import { homeRoutes } from './home/home-routes.js'
import { addDataRoutes } from './add-data/add-data-routes.js'
import { cookiesRoutes } from './cookies/cookies-routes.js'

export const routes = [
  ...healthRoutes,
  ...homeRoutes,
  ...addDataRoutes,
  ...cookiesRoutes
]
