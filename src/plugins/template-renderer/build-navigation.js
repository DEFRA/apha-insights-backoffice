import { UPDATE_RISK_LEVEL_PATH } from '#/constants/update-risk-level-paths.js'

const NAVIGATION_ITEMS = [
  { text: 'Home', href: '/' },
  { text: 'Update risk level', href: UPDATE_RISK_LEVEL_PATH }
]

/**
 * Builds the service navigation items, marking the current page
 * @param {{path?: string}} [request] - the Hapi request
 * @returns {{text: string, href: string, current: boolean}[]}
 */
export function buildNavigation(request) {
  return NAVIGATION_ITEMS.map((item) => ({
    ...item,
    current: request?.path === item.href
  }))
}
