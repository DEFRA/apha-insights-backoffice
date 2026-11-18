import { healthRoutes } from '#/routes/health/health-routes.js'
import { homeRoutes } from '#/routes/home/home-routes.js'
import { cookiesRoutes } from '#/routes/cookies/cookies-routes.js'

export const routes = [...healthRoutes, ...homeRoutes, ...cookiesRoutes]
