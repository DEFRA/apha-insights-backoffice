const NAVIGATION_ITEMS = [
  { text: 'Home', href: '/' },
  { text: 'Update risk level', href: '/update-risk-level' }
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
