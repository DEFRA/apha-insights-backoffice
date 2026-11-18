import { config } from '#/config/config.js'

/**
 * Formats data ready for presenting in the `/` page
 * @module homePresenter
 */
export const homePresenter = () => ({
  pageTitle: 'Home',
  heading: config.get('serviceDisplayName'),
  intro: 'Record risk level changes and view the latest data.',
  links: [{ text: 'Add new data', href: '/add-data' }]
})
